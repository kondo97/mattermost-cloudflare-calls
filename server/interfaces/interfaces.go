// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package interfaces

import (
	"database/sql"
	"net/http"

	"github.com/kondo97/mattermost-cloudflare-calls/server/public"

	rtcd "github.com/mattermost/rtcd/service"
	"github.com/mattermost/rtcd/service/rtc"

	"github.com/mattermost/mattermost/server/public/model"

	"github.com/mattermost/morph/models"
)

type Metrics interface {
	RTCMetrics() rtc.Metrics
	Handler() http.Handler
	IncWebSocketEvent(direction, evType string)
	IncWebSocketConn()
	DecWebSocketConn()
	IncClusterEvent(evType string)
	IncStoreOp(op string)
	ObserveClusterMutexGrabTime(group string, elapsed float64)
	ObserveClusterMutexLockedTime(group string, elapsed float64)
	IncClusterMutexLockRetries(group string)
	ObserveLiveCaptionsAudioLen(elapsed float64)
	IncLiveCaptionsWindowDropped()
	IncLiveCaptionsTranscriberBufFull()
	IncLiveCaptionsPktPayloadChBufFull()
	ObserveAppHandlersTime(handler string, elapsed float64)
	ObserveStoreMethodsTime(method string, elapsed float64)
	RegisterDBMetrics(db *sql.DB, name string)
	IncClientICECandidatePairs(p public.ClientICECandidatePairMetricPayload)
}

type StoreMetrics interface {
	IncStoreOp(op string)
	ObserveStoreMethodsTime(method string, elapsed float64)
}

type Store interface {
	Migrate(direction models.Direction, dryRun bool) error
	Close() error
	GetPost(postID string) (*model.Post, error)
	UpdateFileInfoPostID(fileID, channelID, postID string) error
	KVGet(pluginID, key string, fromWriter bool) ([]byte, error)
}

type RTCDClient interface {
	Connected() bool
	Send(msg rtcd.ClientMessage) error
	Close() error
	GetVersionInfo() (rtcd.VersionInfo, error)
	GetSystemInfo() (rtcd.SystemInfo, error)
	GetSession(callID, sessionID string) (rtc.SessionConfig, int, error)
	GetSessions(callID string) ([]rtc.SessionConfig, int, error)
}
