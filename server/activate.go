// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"runtime"

	"github.com/kondo97/mattermost-cloudflare-calls/server/cluster"
	"github.com/kondo97/mattermost-cloudflare-calls/server/enterprise"
	"github.com/kondo97/mattermost-cloudflare-calls/server/license"

	"github.com/mattermost/rtcd/service/rtc"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/i18n"
)

func (p *Plugin) createBotSession() (*model.Session, error) {
	m, err := cluster.NewMutex(p.API, p.metrics, "ensure_bot", cluster.MutexConfig{})
	if err != nil {
		return nil, err
	}
	lockCtx, cancelCtx := context.WithTimeout(context.Background(), lockTimeout)
	defer cancelCtx()
	if err := m.Lock(lockCtx); err != nil {
		return nil, fmt.Errorf("failed to lock cluster mutex: %w", err)
	}
	defer m.Unlock()

	botID, err := p.API.EnsureBotUser(&model.Bot{
		Username:    "calls",
		DisplayName: "Calls",
		Description: "Calls Bot",
		OwnerId:     manifest.Id,
	})
	if err != nil {
		return nil, err
	}

	session, appErr := p.API.CreateSession(&model.Session{
		UserId:    botID,
		ExpiresAt: 0,
	})
	if appErr != nil {
		return nil, appErr
	}

	return session, nil
}

func (p *Plugin) OnActivate() (retErr error) {
	p.LogInfo("OnActivate: starting")

	defer func() {
		if retErr != nil {
			p.LogError("OnActivate: FAILED", "err", retErr.Error())
		} else {
			p.LogInfo("OnActivate: SUCCESS")
		}
	}()

	if os.Getenv("MM_CALLS_DISABLE") == "true" {
		p.LogInfo("disable flag is set, exiting")
		return fmt.Errorf("disabled by environment flag")
	}

	p.LogInfo("OnActivate: step 1 - getting bundle path")
	bundlePath, err := p.API.GetBundlePath()
	if err != nil {
		return fmt.Errorf("failed to get bundle path: %w", err)
	}
	p.LogInfo("OnActivate: step 1 done", "bundlePath", bundlePath)

	p.LogInfo("OnActivate: step 2 - loading i18n translations")
	if err := i18n.TranslationsPreInit(filepath.Join(bundlePath, "assets/i18n")); err != nil {
		return fmt.Errorf("failed to load translation files: %w", err)
	}
	p.LogInfo("OnActivate: step 2 done")

	p.LogInfo("OnActivate: step 3 - initializing DB")
	if err := p.initDB(); err != nil {
		p.LogError(err.Error())
		return err
	}
	p.LogInfo("OnActivate: step 3 done")

	defer func() {
		if retErr != nil {
			if err := p.store.Close(); err != nil {
				p.LogError("failed to close store", "err", err.Error())
			}
		}
	}()

	p.licenseChecker = enterprise.NewLicenseChecker(p.API)

	p.LogInfo("OnActivate: step 4 - isSingleHandler check")
	if p.isSingleHandler() {
		p.LogInfo("OnActivate: step 4 - cleanUpState")
		if err := p.cleanUpState(); err != nil {
			p.LogError(err.Error())
			return err
		}
	}
	p.LogInfo("OnActivate: step 4 done")

	p.LogInfo("OnActivate: step 5 - registerCommands")
	if err := p.registerCommands(); err != nil {
		p.LogError(err.Error())
		return err
	}
	p.LogInfo("OnActivate: step 5 done")

	p.LogInfo("OnActivate: step 6 - GetPluginStatus")
	status, appErr := p.API.GetPluginStatus(manifest.Id)
	if appErr != nil {
		p.LogError("GetPluginStatus failed", "err", appErr.Error())
		return appErr
	}
	p.LogInfo("OnActivate: step 6 done", "ClusterID", status.ClusterId)

	p.LogInfo("OnActivate: step 7 - loadConfig")
	if err := p.loadConfig(); err != nil {
		p.LogError(err.Error())
		return err
	}
	p.LogInfo("OnActivate: step 7 done")

	cfg := p.getConfiguration()
	p.LogInfo("OnActivate: step 8 - IsValid",
		"CloudflareAppID_set", cfg.CloudflareCallsAppID != "",
		"CloudflareAppToken_set", cfg.CloudflareCallsAppToken != "",
		"RTCDServiceURL", cfg.RTCDServiceURL,
	)
	if err := cfg.IsValid(); err != nil {
		p.LogError("cfg.IsValid failed", "err", err.Error())
		return err
	}
	p.LogInfo("OnActivate: step 8 done")

	// On Cloud installations we want calls enabled in all channels so we
	// override it since the plugin's default is now false.
	if license.IsCloud(p.API.GetLicense()) {
		cfg.DefaultEnabled = new(bool)
		*cfg.DefaultEnabled = true
		if err := p.setConfiguration(cfg); err != nil {
			err = fmt.Errorf("failed to set configuration: %w", err)
			p.LogError(err.Error())
			return err
		}
	}

	p.LogInfo("OnActivate: step 9 - createBotSession")
	session, err := p.createBotSession()
	if err != nil {
		p.LogError(err.Error())
		return err
	}
	p.botSession = session
	p.LogInfo("OnActivate: step 9 done", "botUserID", session.UserId)

	if appErr := p.API.SetProfileImage(session.UserId, pluginIconData); appErr != nil {
		p.LogError(appErr.Error())
	}

	if p.licenseChecker.RecordingsAllowed() && cfg.recordingsEnabled() {
		go func() {
			if err := p.initJobService(); err != nil {
				err = fmt.Errorf("failed to initialize job service: %w", err)
				p.LogError(err.Error())
				return
			}
			p.LogInfo("job service initialized successfully")
		}()
	}

	// rtcServer and rtcdManager are mutually exclusive throughout the entire lifetime of the plugin.
	// Which one is used is decided here, during activation.
	// We first check if RTCD is configured and allowed by the license. If so
	// we try to initialize its connection and fail to start the plugin if that errors.
	// If Cloudflare Calls is configured, we skip both RTCD and the embedded RTC server entirely.
	p.LogInfo("OnActivate: step 10 - selecting RTC backend",
		"CloudflareAppID_set", cfg.CloudflareCallsAppID != "",
		"CloudflareAppToken_set", cfg.CloudflareCallsAppToken != "",
		"RTCDServiceURL", cfg.getRTCDURL(),
		"RTCDAllowed", p.licenseChecker.RTCDAllowed(),
	)
	if cfg.CloudflareCallsAppID != "" && cfg.CloudflareCallsAppToken != "" {
		p.LogInfo("OnActivate: step 10 - using Cloudflare Calls backend, skipping embedded RTC server and RTCD")
	} else if rtcdURL := cfg.getRTCDURL(); rtcdURL != "" && p.licenseChecker.RTCDAllowed() {
		p.LogInfo("OnActivate: step 10 - using RTCD backend", "rtcdURL", rtcdURL)
		rtcdManager, err := p.newRTCDClientManager(rtcdURL)
		if err != nil {
			err = fmt.Errorf("failed to create rtcd manager: %w", err)
			p.LogError(err.Error())
			return err
		}

		p.LogInfo("rtcd client manager initialized successfully")

		p.rtcdManager = rtcdManager

		if err := p.cleanUpState(); err != nil {
			p.LogError("failed to cleanup state", "err", err.Error())
		}
	} else {
		p.LogInfo("OnActivate: step 10 - using embedded RTC server")
		rtcServerConfig := rtc.ServerConfig{
			ICEAddressUDP:   cfg.UDPServerAddress,
			ICEAddressTCP:   cfg.TCPServerAddress,
			ICEPortUDP:      *cfg.UDPServerPort,
			ICEPortTCP:      *cfg.TCPServerPort,
			ICEHostOverride: cfg.ICEHostOverride,
			ICEServers:      rtc.ICEServers(cfg.getICEServers(false)),
			TURNConfig: rtc.TURNConfig{
				CredentialsExpirationMinutes: *cfg.TURNCredentialsExpirationMinutes,
			},
			EnableIPv6:      *cfg.EnableIPv6,
			UDPSocketsCount: runtime.NumCPU(),
		}
		if *cfg.ServerSideTURN {
			rtcServerConfig.TURNConfig.StaticAuthSecret = cfg.TURNStaticAuthSecret
		}
		if cfg.ICEHostPortOverride != nil {
			rtcServerConfig.ICEHostPortOverride = rtc.ICEHostPortOverride(fmt.Sprintf("%d", *cfg.ICEHostPortOverride))
		}
		rtcServer, err := rtc.NewServer(rtcServerConfig, newLogger(p), p.metrics.RTCMetrics())
		if err != nil {
			p.LogError("rtc.NewServer failed", "err", err.Error())
			return err
		}

		p.LogInfo("OnActivate: step 10 - starting embedded RTC server")
		if err := rtcServer.Start(); err != nil {
			p.LogError("rtcServer.Start failed", "err", err.Error())
			return err
		}
		p.LogInfo("OnActivate: step 10 - embedded RTC server started")

		// NodeID is set only when using the embedded service (no RTCD) since it's used to track which node is hosting
		// a call and coordinate between nodes they may own the WS connection for other sessions in that same call.
		// When RTCD is in place, there isn't a node hosting a call since this task is completely delegated to the RTCD side.
		// Hence, in that case this field should be left empty.
		p.nodeID = status.ClusterId

		p.rtcServer = rtcServer

		// The wsWriter routine is only necessary when running the embedded RTC server since
		// it's a listener on rtcServer.ReceiveCh used to forward RTC messages (e.g. signaling)
		// back to the client through the WS connection. The RTCD handler has a separate way to
		// do this (see clientReader method).
		go p.wsWriter()
	}

	// Cluster events need to be handled regardless of whether the embedded RTC service or RTCD are in use.
	go p.clusterEventsHandler()

	p.LogInfo("OnActivate: completed successfully", "ClusterID", status.ClusterId)

	return nil
}

func (p *Plugin) OnDeactivate() error {
	p.LogDebug("deactivate")
	close(p.stopCh)

	if err := p.store.Close(); err != nil {
		p.LogError(err.Error())
	}

	if p.rtcdManager != nil {
		if err := p.rtcdManager.Close(); err != nil {
			p.LogError(err.Error())
		}
	}

	if p.rtcServer != nil {
		if err := p.rtcServer.Stop(); err != nil {
			p.LogError(err.Error())
		}
	}

	if p.isSingleHandler() {
		if err := p.cleanUpState(); err != nil {
			p.LogError(err.Error())
		}
	}

	if err := p.unregisterCommands(); err != nil {
		p.LogError(err.Error())
	}

	if err := p.uninitTelemetry(); err != nil {
		p.LogError(err.Error())
	}

	if p.botSession != nil {
		if err := p.API.RevokeSession(p.botSession.Id); err != nil {
			p.LogError(err.Error())
		}
	}

	return nil
}
