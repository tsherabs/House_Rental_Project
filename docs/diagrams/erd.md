# Current M3 + M4 schema

```mermaid
erDiagram
  users ||--o{ properties : owns
  properties ||--o{ property_images : contains
  users ||--o{ account_status_history : subject
  users ||--o{ account_status_history : actor
  properties ||--o{ viewing_requests : receives
  users ||--o{ viewing_requests : requests
  viewing_requests ||--|{ viewing_status_history : records
  users ||--o{ viewing_status_history : changes
  users ||--o{ favourites : saves
  properties ||--o{ favourites : saved
  properties ||--o{ listing_reports : reported
  users ||--o{ listing_reports : reports
  users o|--o{ listing_reports : reviews
  properties ||--o{ property_visibility_history : moderated
  users ||--o{ property_visibility_history : moderates
  viewing_requests {
    uuid id PK
    uuid property_id FK
    uuid seeker_id FK
    timestamptz proposed_at
    varchar status
  }
  viewing_status_history {
    uuid id PK
    uuid viewing_id FK
    uuid changed_by FK
    varchar old_status
    varchar new_status
    timestamptz changed_at
  }
  favourites {
    uuid user_id PK,FK
    uuid property_id PK,FK
    timestamptz created_at
  }
  listing_reports {
    uuid id PK
    uuid property_id FK
    uuid reporter_id FK
    varchar reason
    varchar review_status
    uuid reviewed_by FK
    varchar review_reason
    timestamptz reviewed_at
  }
  property_visibility_history {
    uuid id PK
    uuid property_id FK
    uuid changed_by FK
    varchar old_status
    varchar new_status
    varchar reason
    timestamptz changed_at
  }
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
M4 tables reference existing users/properties via UUIDs. Migrations 0005/0006 add
viewings/history, favourites, reports and a durable moderation audit. Pending
reports have a partial unique index on reporter/property. No original migration
was modified. See ADR 0002 for lifecycle and renewal choices pending team review.
