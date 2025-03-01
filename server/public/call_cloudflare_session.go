package public

import (
	"fmt"
)

type CallCloudflareSession struct {
	ID         string `json:"id"`
	CallID     string `json:"call_id"`
	CloudflareCallSessionID     string `json:"cloudflare_call_session_id"`
}

func (s *CallCloudflareSession) IsValid() error {
	if s == nil {
		return fmt.Errorf("should not be nil")
	}

	if s.ID == "" {
		return fmt.Errorf("invalid ID: should not be empty")
	}

	if s.CallID == "" {
		return fmt.Errorf("invalid CallID: should not be empty")
	}

	if s.CloudflareCallSessionID == "" {
		return fmt.Errorf("invalid CloudflareCallSessionID: should not be empty")
	}

	return nil
}