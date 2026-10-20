# Current M3 schema

```mermaid
erDiagram
  users ||--o{ properties : owns
  properties ||--o{ property_images : contains
  users ||--o{ account_status_history : subject
  users ||--o{ account_status_history : actor
  users {
    uuid id PK
    varchar email UK
    text password_hash
    varchar role
    varchar account_status
  }
  properties {
    uuid id PK
    uuid owner_id FK
    numeric monthly_rent
    numeric deposit
    varchar availability_status
    varchar visibility_status
    timestamptz expires_at
  }
  property_images {
    uuid id PK
    uuid property_id FK
    text storage_key UK
    smallint display_order
  }
  account_status_history {
    uuid id PK
    uuid user_id FK
    uuid changed_by FK
    varchar old_status
    varchar new_status
    varchar reason
    timestamptz changed_at
  }
  session {
    varchar sid PK
    json sess
    timestamp expire
  }
  schema_migrations {
    text name PK
    text checksum
    timestamptz applied_at
  }
```

The session adapter stores userId in server-side JSON; this is not a SQL foreign
key. account_status_history records old/new status, actor, reason and time.
M4's future tables reference users/properties via UUIDs. No M4 business tables
or endpoints are implemented by this slice.
