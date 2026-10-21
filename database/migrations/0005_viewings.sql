CREATE TABLE viewing_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id),
  seeker_id UUID NOT NULL REFERENCES users(id),
  proposed_at TIMESTAMPTZ NOT NULL,
  message VARCHAR(1000),
  status VARCHAR(16) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','rejected','cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX viewing_requests_property_idx ON viewing_requests(property_id);
CREATE INDEX viewing_requests_seeker_idx ON viewing_requests(seeker_id,created_at DESC,id DESC);
CREATE TABLE viewing_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  viewing_id UUID NOT NULL REFERENCES viewing_requests(id),
  old_status VARCHAR(16) CHECK (old_status IN ('pending','accepted','rejected','cancelled')),
  new_status VARCHAR(16) NOT NULL CHECK (new_status IN ('pending','accepted','rejected','cancelled')),
  changed_by UUID NOT NULL REFERENCES users(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX viewing_status_history_viewing_idx ON viewing_status_history(viewing_id,changed_at,id);
CREATE INDEX viewing_status_history_actor_idx ON viewing_status_history(changed_by);
