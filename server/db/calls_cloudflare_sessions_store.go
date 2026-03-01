// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package db

import (
	"context"
	"fmt"
	"time"

	"github.com/kondo97/mattermost-cloudflare-calls/server/public"

	sq "github.com/mattermost/squirrel"
)

func (s *Store) CreateCallCloudflareSession(session *public.CallCloudflareSession) error {
	if err := session.IsValid(); err != nil {
		return fmt.Errorf("invalid cloudflare session: %w", err)
	}

	qb := getQueryBuilder(s.driverName).
		Insert("calls_cloudflare_sessions").
		Columns("id", "callid", "mm_session_id", "sessionid").
		Values(session.ID, session.CallID, session.MMSessionID, session.CloudflareCallSessionID)

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

func (s *Store) GetCallCloudflareSession(mmSessionID string) (*public.CallCloudflareSession, error) {
	qb := getQueryBuilder(s.driverName).
		Select("id", "callid", "mm_session_id", "sessionid").
		From("calls_cloudflare_sessions").
		Where(sq.Eq{"mm_session_id": mmSessionID})

	q, args, err := qb.ToSql()
	if err != nil {
		return nil, fmt.Errorf("failed to prepare query: %w", err)
	}

	var session public.CallCloudflareSession
	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(*s.settings.QueryTimeout)*time.Second)
	defer cancel()
	err = s.rDB.QueryRowContext(ctx, q, args...).Scan(&session.ID, &session.CallID, &session.MMSessionID, &session.CloudflareCallSessionID)
	if err != nil {
		return nil, fmt.Errorf("failed to run query: %w", err)
	}

	return &session, nil
}

func (s *Store) GetCallCloudflareSessions(callID string) ([]*public.CallCloudflareSession, error) {
	qb := getQueryBuilder(s.driverName).
		Select("id", "callid", "mm_session_id", "sessionid").
		From("calls_cloudflare_sessions").
		Where(sq.Eq{"callid": callID})

	q, args, err := qb.ToSql()
	if err != nil {
		return nil, fmt.Errorf("failed to prepare query: %w", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(*s.settings.QueryTimeout)*time.Second)
	defer cancel()
	rows, err := s.rDB.QueryContext(ctx, q, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to run query: %w", err)
	}
	defer rows.Close()

	var sessions []*public.CallCloudflareSession
	for rows.Next() {
		var session public.CallCloudflareSession
		if err := rows.Scan(&session.ID, &session.CallID, &session.MMSessionID, &session.CloudflareCallSessionID); err != nil {
			return nil, fmt.Errorf("failed to scan row: %w", err)
		}
		sessions = append(sessions, &session)
	}
	return sessions, rows.Err()
}

func (s *Store) DeleteCallCloudflareSession(mmSessionID string) error {
	qb := getQueryBuilder(s.driverName).
		Delete("calls_cloudflare_sessions").
		Where(sq.Eq{"mm_session_id": mmSessionID})

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
