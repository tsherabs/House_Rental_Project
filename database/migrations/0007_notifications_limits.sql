CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  kind VARCHAR(40) NOT NULL CHECK (kind IN ('viewing_requested','viewing_accepted','viewing_rejected','viewing_cancelled','report_reviewed','listing_moderated')),
  title VARCHAR(160) NOT NULL,
  message VARCHAR(500) NOT NULL,
  link VARCHAR(80) NOT NULL CHECK (link IN ('/viewings','/my-properties','/properties')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  read_at TIMESTAMPTZ
);
CREATE INDEX notifications_user_idx ON notifications(user_id,created_at DESC,id DESC);
CREATE INDEX notifications_unread_idx ON notifications(user_id) WHERE read_at IS NULL;
CREATE TABLE request_limits (
  bucket_key VARCHAR(160) NOT NULL,
  window_start BIGINT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  hits INTEGER NOT NULL CHECK(hits > 0),
  PRIMARY KEY(bucket_key,window_start)
);
CREATE INDEX request_limits_expiry_idx ON request_limits(expires_at);
