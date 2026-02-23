package db

import (
	"context"
	"fmt"
	"time"
	
	"github.com/mattermost/mattermost-plugin-calls/server/public"

	sq "github.com/mattermost/squirrel"
)

func (s *Store) CreateCallCloudflareSession(cloudflareSession *public.CallCloudflareSession) error {
	if err := cloudflareSession.IsValid(); err != nil {
		return fmt.Errorf("invalid call session: %w", err)
	}

	qb := getQueryBuilder(s.driverName).
		Insert("calls_cloudflare_sessions").
		Columns("ID", "CallID", "sessionid").
		Values(cloudflareSession.ID, cloudflareSession.CallID, cloudflareSession.CloudflareCallSessionID)

	q, args, err := qb.ToSql()
	if err != nil {
		return fmt.Errorf("failed to prepare query: %w", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(*s.settings.QueryTimeout)*time.Second)
	defer cancel()
	_, err = s.wDB.ExecContext(ctx, q, args...)
	if err != nil {
		return fmt.Errorf("failed to run query: %w", err)
	}

	return nil
}

func (s *Store) GetCallCloudflareSession(callID string) (*public.CallCloudflareSession, error) {
	qb := getQueryBuilder(s.driverName).
		Select("ID", "CallID", "sessionid").
		From("calls_cloudflare_sessions").
		Where(sq.Eq{"CallID": callID})

	q, args, err := qb.ToSql()
	if err != nil {
		return nil, fmt.Errorf("failed to prepare query: %w", err)
	}

	var cloudflareSession public.CallCloudflareSession
	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(*s.settings.QueryTimeout)*time.Second)
	defer cancel()
	err = s.rDB.QueryRowContext(ctx, q, args...).Scan(&cloudflareSession.ID, &cloudflareSession.CallID, &cloudflareSession.CloudflareCallSessionID)
	if err != nil {
		return nil, fmt.Errorf("failed to run query: %w", err)
	}

	return &cloudflareSession, nil
}
