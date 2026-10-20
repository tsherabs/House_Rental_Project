CREATE TABLE property_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  storage_key TEXT NOT NULL UNIQUE,
  mime_type VARCHAR(32) NOT NULL CHECK (mime_type IN ('image/jpeg','image/png','image/webp')),
  display_order SMALLINT NOT NULL DEFAULT 0 CHECK (display_order >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(property_id, display_order) DEFERRABLE INITIALLY DEFERRED
);
CREATE INDEX property_images_order_idx ON property_images(property_id,display_order);
