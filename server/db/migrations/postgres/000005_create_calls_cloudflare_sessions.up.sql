CREATE TABLE IF NOT EXISTS calls_cloudflare_sessions (
    id VARCHAR(26) PRIMARY KEY,
    callid VARCHAR(26),
    mm_session_id VARCHAR(26),
    sessionid VARCHAR(64)
);

CREATE INDEX IF NOT EXISTS idx_calls_cloudflare_sessions_call_id ON calls_cloudflare_sessions (callid);
CREATE INDEX IF NOT EXISTS idx_calls_cloudflare_sessions_mm_session_id ON calls_cloudflare_sessions (mm_session_id);
