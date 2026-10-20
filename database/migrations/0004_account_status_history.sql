CREATE TABLE account_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  old_status VARCHAR(12) NOT NULL CHECK (old_status IN ('active','suspended')),
  new_status VARCHAR(12) NOT NULL CHECK (new_status IN ('active','suspended')),
  changed_by UUID NOT NULL REFERENCES users(id),
  reason VARCHAR(1000) NOT NULL CHECK (length(btrim(reason)) BETWEEN 10 AND 1000),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX account_status_history_user_idx ON account_status_history(user_id,changed_at);
CREATE INDEX account_status_history_actor_idx ON account_status_history(changed_by);
