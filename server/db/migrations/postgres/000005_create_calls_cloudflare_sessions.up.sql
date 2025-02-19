CREATE TABLE IF NOT EXISTS calls_cloudflare_sessions (
    id VARCHAR(26) PRIMARY KEY,
    callid VARCHAR(26),
    sessionid VARCHAR(26)
);

CREATE INDEX IF NOT EXISTS idx_calls_cloudflare_sessions_call_id ON calls_sessions (callid);
