CREATE TABLE properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES users(id),
  title VARCHAR(160) NOT NULL CHECK (length(btrim(title)) BETWEEN 5 AND 160),
  description TEXT NOT NULL CHECK (length(btrim(description)) BETWEEN 20 AND 5000),
  monthly_rent NUMERIC(12,2) NOT NULL CHECK (monthly_rent >= 0),
  deposit NUMERIC(12,2) NOT NULL CHECK (deposit >= 0),
  bedrooms SMALLINT NOT NULL CHECK (bedrooms BETWEEN 0 AND 20),
  neighbourhood VARCHAR(100) NOT NULL CHECK (length(btrim(neighbourhood)) BETWEEN 2 AND 100),
  landmarks TEXT CHECK (length(landmarks) <= 500),
  water_available BOOLEAN NOT NULL DEFAULT false,
  parking_available BOOLEAN NOT NULL DEFAULT false,
  move_in_date DATE NOT NULL,
  availability_status VARCHAR(16) NOT NULL DEFAULT 'available' CHECK (availability_status IN ('available','rented')),
  visibility_status VARCHAR(16) NOT NULL DEFAULT 'published' CHECK (visibility_status IN ('draft','published','hidden','archived')),
  confirmed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX properties_public_idx ON properties(visibility_status,availability_status,expires_at);
CREATE INDEX properties_neighbourhood_idx ON properties(neighbourhood);
CREATE INDEX properties_rent_idx ON properties(monthly_rent);
CREATE INDEX properties_bedrooms_idx ON properties(bedrooms);
CREATE INDEX properties_owner_idx ON properties(owner_id);
