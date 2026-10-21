CREATE TABLE favourites (
  user_id UUID NOT NULL REFERENCES users(id),
  property_id UUID NOT NULL REFERENCES properties(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id,property_id)
);
CREATE INDEX favourites_property_idx ON favourites(property_id);
CREATE TABLE listing_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id),
  reporter_id UUID NOT NULL REFERENCES users(id),
  reason VARCHAR(1000) NOT NULL CHECK (length(btrim(reason)) BETWEEN 10 AND 1000),
  review_status VARCHAR(16) NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending','dismissed','actioned')),
  reviewed_by UUID REFERENCES users(id),
  review_reason VARCHAR(1000),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (review_status='pending' AND reviewed_by IS NULL AND review_reason IS NULL AND reviewed_at IS NULL)
    OR (review_status<>'pending' AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL
      AND review_reason IS NOT NULL AND length(btrim(review_reason)) BETWEEN 10 AND 1000)
  )
);
CREATE UNIQUE INDEX listing_reports_pending_idx ON listing_reports(reporter_id,property_id) WHERE review_status='pending';
CREATE INDEX listing_reports_review_idx ON listing_reports(review_status,created_at DESC,id DESC);
CREATE INDEX listing_reports_property_idx ON listing_reports(property_id);
CREATE INDEX listing_reports_reviewer_idx ON listing_reports(reviewed_by);
CREATE TABLE property_visibility_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id),
  old_status VARCHAR(16) NOT NULL CHECK (old_status IN ('draft','published','hidden','archived')),
  new_status VARCHAR(16) NOT NULL CHECK (new_status IN ('hidden','published')),
  changed_by UUID NOT NULL REFERENCES users(id),
  reason VARCHAR(1000) NOT NULL CHECK (length(btrim(reason)) BETWEEN 10 AND 1000),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX property_visibility_history_property_idx ON property_visibility_history(property_id,changed_at,id);
CREATE INDEX property_visibility_history_actor_idx ON property_visibility_history(changed_by);
