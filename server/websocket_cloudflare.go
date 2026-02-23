package main

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/webrtc"
	"github.com/mattermost/mattermost/server/public/shared/rtc"
)

func (p *Plugin) sendRTCMessageForCloudflare(msg rtc.Message, callID string) error {
	APP_ID := "5a11beb519a5f360006faa9249830037";
	APP_TOKEN := "af68e58c1025bed9103f8014b46d0ba8ed2ec74c659e79f8893db67185d7a5c1";
	API_BASE := "https://rtc.live.cloudflare.com/v1/apps/" + APP_ID

	client := &http.Client{}

	req, err := http.NewRequest("POST", API_BASE + "/sessions/new", nil)
	if err != nil {
		return fmt.Errorf("failed to create new request: %w", err)
	}

	req.Header.Add("Authorization", "Bearer " + APP_TOKEN)
	resp, err := client.Do(req)
	if err != nil {
			return fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
			bodyBytes, _ := io.ReadAll(resp.Body)
			return fmt.Errorf("unexpected status code: %d, response: %s", resp.StatusCode, string(bodyBytes))
	}

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
			return fmt.Errorf("failed to read response body: %w", err)
	}

	var body map[string]interface{}
	if err := json.Unmarshal(bodyBytes, &body); err != nil {
			return fmt.Errorf("failed to unmarshal response body: %w", err)
	}

	sessionID, ok := body["sessionId"].(string)
	if !ok {
		return fmt.Errorf("sessionId not found in response body")
	}

	var dataMap map[string]interface{}
	if err := json.Unmarshal([]byte(msg.Data), &dataMap); err != nil {
		return fmt.Errorf("failed to unmarshal msg.Data: %w", err)
	}

	sdpBase64, ok := dataMap["sdp"].(string)
	if !ok {
		return fmt.Errorf("invalid or missing 'sdp' field, expected a string but got: %T", dataMap["sdp"])
	}

	sdpDecoded, err := base64.StdEncoding.DecodeString(sdpBase64)
	if err != nil {
		return fmt.Errorf("failed to decode base64 sdp: %w", err)
	}

	var webrtcsdp webrtc.SessionDescription
	if err := json.Unmarshal(sdpDecoded, &webrtcsdp); err != nil {
		return fmt.Errorf("failed to unmarshal sdp: %w", err)
	}

	tracks, ok := dataMap["tracks"].([]interface{})
	if !ok {
			return fmt.Errorf("invalid or missing 'tracks' field, expected an array but got: %T", dataMap["tracks"])
	}

	trackList := []map[string]interface{}{}
	for _, track := range tracks {
		trackMap, ok := track.(map[string]interface{})
		if !ok {
			return fmt.Errorf("invalid track, expected a map but got: %T", track)
		}
		location := trackMap["location"].(string)
		mid := trackMap["mid"].(string)
		trackName := trackMap["trackName"].(string)
		trackList = append(trackList, map[string]interface{}{
			"location": location,
			"mid": mid,
			"trackName": trackName,
		})
	}

	body = map[string]interface{}{
		"sessionDescription": map[string]interface{}{
			"type": "offer",
			"sdp": webrtcsdp.SDP,
		},
		"tracks": trackList,
	}

	jsonBody, err := json.Marshal(body)
	if err != nil {
		return fmt.Errorf("failed to marshal body: %w", err)
	}

	req, err = http.NewRequest("POST", API_BASE+"/sessions/"+sessionID+"/tracks/new", bytes.NewReader(jsonBody))
  if err != nil {
		return fmt.Errorf("failed to create new request: %w", err)
	}
	req.Header.Add("Content-Type", "application/json")
	req.Header.Add("Authorization", "Bearer " + APP_TOKEN)

	resp, err = client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("unexpected status code: %d, response: %s", resp.StatusCode, string(bodyBytes))
	}

	cloudflareCallSession := &public.CallCloudflareSession{
		ID: model.NewId(),
		CallID: callID,
		CloudflareCallSessionID: sessionID,
	}

	fmt.Printf("cloudflareCallSession: %v\n", cloudflareCallSession)

	if err := p.store.CreateCallCloudflareSession(cloudflareCallSession); err != nil {
		return fmt.Errorf("failed to update call session: %w", err)
	}

	bodyBytes, err = io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read response body: %w", err)
	}

	us := p.getSessionByOriginalID(msg.SessionID)

	p.publishWebSocketEvent(wsEventSignal, map[string]interface{}{
		"data": string(bodyBytes),
		"connID": msg.SessionID,
	}, &WebSocketBroadcast{ConnectionID: us.connID, ReliableClusterSend: true})

	return nil
}

func (p *Plugin) handleAddUserForCloudflare(msg rtc.Message, callID string) error {
	APP_ID := "5a11beb519a5f360006faa9249830037";
	APP_TOKEN := "af68e58c1025bed9103f8014b46d0ba8ed2ec74c659e79f8893db67185d7a5c1";
	API_BASE := "https://rtc.live.cloudflare.com/v1/apps/" + APP_ID

	var dataMap map[string]interface{}
	if err := json.Unmarshal([]byte(msg.Data), &dataMap); err != nil {
		return fmt.Errorf("failed to unmarshal msg.Data: %w", err)
	}
	tracks, ok := dataMap["tracks"].([]interface{})
	if !ok {
		return fmt.Errorf("invalid or missing 'tracks' field, expected an array but got: %T", dataMap["tracks"])
	}
	trackList := []map[string]interface{}{}
	for _, track := range tracks {
		trackMap, ok := track.(map[string]interface{})
		if !ok {
			return fmt.Errorf("invalid track, expected a map but got: %T", track)
		}
		location := trackMap["location"].(string)
		mid := trackMap["mid"].(string)
		trackName := trackMap["trackName"].(string)
		trackList = append(trackList, map[string]interface{}{
			"location": location,
			"mid": mid,
			"trackName": trackName,
		})
	}

	var body = map[string]interface{}{
		"tracks": trackList,
	}
	jsonBody, err := json.Marshal(body)
	if err != nil {
		return fmt.Errorf("failed to marshal body: %w", err)
	}

	sessionId, err := p.store.GetCallCloudflareSession(callID)
	if err != nil {
		return fmt.Errorf("failed to get call cloudflare session: %w", err)
	}

	fmt.Printf("==================================")
	fmt.Printf("sessionId: %v\n", sessionId)
	fmt.Printf("==================================")

	client := &http.Client{}
	// POST /apps/{appId}/sessions/:id/tracks/newを実行する
	req, err := http.NewRequest("POST", API_BASE + "/sessions/" + sessionId.CloudflareCallSessionID + "/tracks/new", bytes.NewReader(jsonBody))
	if err != nil {
		return fmt.Errorf("failed to create new request: %w", err)
	}
	req.Header.Add("Authorization", "Bearer " + APP_TOKEN)
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusCreated {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("unexpected status code: %d, response: %s", resp.StatusCode, string(bodyBytes))
  }
	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read response body: %w", err)
	}
	us := p.getSessionByOriginalID(msg.SessionID)
	p.publishWebSocketEvent(wsEventSignal, map[string]interface{}{
		"data": string(bodyBytes),
		"connID": msg.SessionID,
	}, &WebSocketBroadcast{ConnectionID: us.connID, ReliableClusterSend: true})
	return nil
}