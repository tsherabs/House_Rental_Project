# House Rental Web Application

M1's initial Angular browsing/details slice is now in `frontend/`. See [frontend setup](frontend/README.md) and [M1 integration handoff](docs/M1-handoff.md). The backend and proposed contracts still require team integration; the planning material below describes the broader project.

> **Project status:** Planning / initial setup  
> **Team:** 5 members — 2 frontend, 2 backend, 1 DevOps  
> **Goal:** Build and deploy a web application where landlords advertise rental properties and seekers find properties and request viewings, while practising collaborative development, Scrum, testing, containerization, and CI/CD.

## 1. Project overview

The House Rental Web Application connects people who have houses or rooms to rent with people looking for accommodation. Landlords can publish and manage property listings. Seekers can browse available listings, view details and request viewings. Administrators can moderate reports and suspend accounts.

**Learning goals:** Work as one development team; design a relational database and documented REST APIs; integrate Angular with a backend; use Git branches and pull requests; test changes automatically; use Docker and deploy a working product.

### Core user roles

- **Seeker:** Register/sign in, browse available properties, see details, request viewings, track requests; optionally save favourites.
- **Landlord:** Register/sign in, create and maintain *their own* property listings, upload photos, respond to viewing requests and mark a property rented.
- **Administrator:** Review reports, hide misleading listings and suspend accounts. **Public registration must never grant the administrator role.**

> **Scope rule:** Deliver one working end-to-end flow before adding optional features. Prioritize secure authentication, listing management, browse/details, viewing requests and deployment. Comparison/calculator features are optional.

## 2. Proposed technology stack

| Layer | Technology | Status |
| --- | --- | --- |
| Frontend | Angular + TypeScript | Agreed by frontend team |
| Backend | Node.js + Express (JavaScript or TypeScript) | **Proposed — confirm together** |
| Database | PostgreSQL | **Proposed — confirm together** |
| HTTP API | REST + JSON | **Proposed — confirm conventions** |
| Version control | Git + GitHub | Proposed workflow |
| Containerization | Docker + Docker Compose | Proposed workflow |
| CI/CD | GitHub Actions | Proposed workflow |
| Tests | Angular tests; backend unit/integration tests (e.g., Vitest/Jest + Supertest) | **Select together** |
| Deployment | Docker-capable hosting | **Not decided** |

**Do not change technologies independently.** Record agreed choices in `docs/decisions/` (a short Markdown note is enough).

## 3. Team responsibilities

| Role | Primary responsibilities | Collaboration expectations |
| --- | --- | --- |
| Frontend developer 1 | Property list, filters, property details | Agree on property response format with backend |
| Frontend developer 2 | Login/register, landlord and admin interfaces | Agree on auth and error handling with backend |
| Backend developer 1 | Authentication, authorization, property management | Review schema and API decisions with other backend member |
| Backend developer 2 | Viewings, favourites, reporting/admin logic | Coordinate database migrations and permissions |
| DevOps engineer | Local development environments, CI, containers, deployment | Pair with others so every member learns to run/debug the system |

Assignments above are **suggestions, not final named-member assignments**. Every feature has one primary owner, but **all members own integration and product quality**. The team should rotate reviews and do short knowledge-sharing sessions.

## 4. Product backlog and definition of MVP

Use backlog IDs `B01`–`B20` from the team’s product backlog as the source of truth. Link each GitHub issue and pull request to its backlog item. The proposed MVP covers:

- Foundation: **B01** shared setup, **B02** requirements, wireframes, database design and API contracts.
- Access: **B03** authentication, **B04** server-side role/ownership enforcement.
- Listings: **B05** create/edit/remove, **B06** photo uploads, **B07** browse/filter, **B08** details, **B12** rented status.
- Viewings: **B09** request a viewing, **B10** landlord response, **B11** track requests.
- Delivery: **B17** CI from early development, **B18** deployed application, **B19** report and demonstration.

Admin items **B13–B14** are in the stated Must backlog and need explicit sprint allocation. Features **B15–B16** are Should, **B20** Optional. If time is tight, ask the team/supervisor to agree on a reduced MVP rather than silently dropping Must features.

## 5. Proposed repository layout

```text
house-rental-app/
├── frontend/                 # Angular app
│   ├── src/
│   ├── package.json
│   └── Dockerfile            # once configured
├── backend/                  # Express API
│   ├── src/
│   │   ├── routes/
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── middleware/
│   │   └── db/
│   ├── tests/
│   ├── package.json
│   └── Dockerfile            # once configured
├── database/
│   ├── migrations/           # schema changes under version control
│   └── seeds/                # non-sensitive demo/test data
├── docs/
│   ├── api/                  # agreed endpoint contracts
│   ├── diagrams/             # ERD and architecture diagrams
│   └── decisions/            # agreed architecture decisions
├── .github/
│   ├── workflows/            # CI workflows
│   └── pull_request_template.md
├── compose.yaml             # once configured
├── .env.example             # placeholder names only, never real secrets
├── .gitignore
└── README.md
```

This is a **target structure**. Create files when the team implements them; do not expect every file to exist on day one.

## 6. Getting started (after initial setup is committed)

### Prerequisites

- Git
- A compatible Node.js **LTS** version and npm (the team will pin the exact version in `.nvmrc` or `package.json`)
- Docker Desktop or Docker Engine + Docker Compose (once the Compose configuration is available)
- An editor such as VS Code

### Clone the repository

```bash
git clone <REPOSITORY_URL>
cd house-rental-app
```

### Configure environment variables

Once `.env.example` exists, copy it to `.env` and replace placeholders with local values. The specific command depends on your OS; for macOS/Linux:

```bash
cp .env.example .env
```

**Never commit `.env`, passwords, tokens, database credentials, or private keys.** Keep `.env.example` free of secrets.

### Run locally

Choose **one** documented workflow when the respective project folders are available:

**Option A — Native development (frontend/backend):**

```bash
# Terminal 1 — Angular (after frontend/package.json exists)
cd frontend
npm ci
npm start

# Terminal 2 — Express (after backend/package.json and a dev script exist)
cd backend
npm ci
npm run dev
```

Set up PostgreSQL separately and configure the backend with the agreed local environment values. The Angular development server URL, API port and proxy setup must be documented after they are finalized.

**Option B — Docker Compose (after compose.yaml and Dockerfiles exist):**

```bash
docker compose up --build
```

Do not assume either command works before the required configuration is implemented. The developer who first sets up a workflow must verify it on another member’s computer and update this section with tested commands, URLs, migration/seed commands and troubleshooting tips.

## 7. Git and GitHub collaboration workflow

**Branching convention:** Keep `main` deployable. Do not develop directly on `main`. Create a branch per issue, using names such as `feature/B03-registration-api`, `feature/B07-property-search`, `fix/B09-viewing-validation`, or `chore/B01-compose-setup`.

### Typical contributor workflow

1. Pick an assigned GitHub issue linked to a backlog item. Confirm dependencies and API/database decisions before coding.
2. Pull the latest `main`, then create a new feature branch:

   ```bash
   git switch main
   git pull origin main
   git switch -c feature/B03-registration-api
   ```

3. Make focused commits. Add or update tests and documentation as applicable.
4. Run relevant local checks before pushing.
5. Push the branch:

   ```bash
   git push -u origin feature/B03-registration-api
   ```

6. Open a pull request to `main`, link the issue, explain what changed and how it was tested. Attach screenshots for UI changes.
7. Request a review from at least one teammate; fix feedback and wait for CI checks to pass.
8. Merge through the pull request. Delete the feature branch when merged. Update the task board.

**Team rules:** No force-pushing to shared branches; do not commit directly to protected `main`; use short-lived branches; discuss breaking API/schema changes before merging; keep PRs small enough to review. Require passing CI and one review when branch protection is enabled.

### Example pull request description

```markdown
## Backlog / issue
Closes #<issue-number> — B03 Registration API

## What changed?
- Added registration route and input validation
- Hashes passwords before storage

## How was it tested?
- [ ] Automated tests pass
- [ ] Manual test documented

## API/schema changes
- New POST /api/auth/register endpoint
- New users table migration (if applicable)

## Screenshots (UI changes only)
Not applicable
```

## 8. How frontend and backend coordinate

Frontend and backend **agree on a contract before implementing the same feature independently**. For each endpoint, record:

- HTTP method and path
- Authentication/role requirements
- Path/query/body fields and validations
- Success response JSON and status code
- Error response JSON and status codes
- Pagination/filter naming where relevant
- Ownership rules and edge cases

**Illustrative contract only — not yet approved:**

```http
POST /api/auth/register
Content-Type: application/json
```

```json
{
  "name": "Sonam",
  "email": "sonam@example.com",
  "password": "examplePassword123",
  "role": "seeker"
}
```

```http
HTTP/1.1 201 Created
Content-Type: application/json
```

```json
{
  "message": "Registration successful",
  "user": { "id": 1, "name": "Sonam", "email": "sonam@example.com", "role": "seeker" }
}
```

Passwords are **never returned**. The server validates roles; a client cannot register as an admin. The team must decide its authentication approach (for example, secure cookie-based sessions versus tokens), cross-origin handling, and a uniform error format.

When the backend is unfinished, frontend members may use **documented mock JSON that matches the agreed contract**. When the frontend is unfinished, backend members can test endpoints with automated tests or an API client. Integrate early and regularly.

## 9. Proposed relational database schema

This schema is a **starting design**, not final SQL DDL. Agree on data types, nullability, constraints, enum/check values, timestamps, delete behavior and migrations before implementing it.

| Table | Key information | Relationships |
| --- | --- | --- |
| `users` | id, name, email, password_hash, role, account_status | Owns properties; creates viewing requests and favourites |
| `properties` | id, owner_id, title, description, rent, deposit, bedrooms, neighbourhood, landmarks, water, parking, move_in_date, status, confirmed_at, expires_at | `owner_id → users.id` |
| `property_images` | id, property_id, image_path, display_order | `property_id → properties.id` |
| `viewing_requests` | id, property_id, seeker_id, proposed_time, message, status | `property_id → properties.id`, `seeker_id → users.id` |
| `viewing_status_history` | id, viewing_id, previous_status, new_status, changed_by, changed_at | `viewing_id → viewing_requests.id`, `changed_by → users.id` |
| `favourites` | user_id, property_id, created_at | Join table between users and properties |
| `listing_reports` | id, property_id, reporter_id, reason, review_status, reviewed_by, reviewed_at | References properties, reporter and optional admin reviewer |

### Important schema constraints and questions

- **Users:** Unique email (prefer case-insensitive uniqueness); store a strong password hash, never plaintext. Define allowable roles (`seeker`, `landlord`, `admin`) and account statuses; determine whether one account may have both landlord and seeker abilities.
- **Properties:** Foreign key to owner; `rent` and `deposit` non-negative; `bedrooms` non-negative; decide currency, units, location details and accepted property states (`available`, `rented`, `hidden` etc.). Separate *rental status* from *moderation/expiry* if one status field becomes ambiguous.
- **Images:** Set upload type/size limits, storage strategy and stable image URL/path. Consider a uniqueness constraint on `(property_id, display_order)` if display positions must be unique.
- **Viewing requests:** Define states (e.g., `pending`, `accepted`, `rejected`, `cancelled`), valid transitions, and whether requests can overlap or duplicate; `proposed_time` should be in the future when requested. Use timezone-aware timestamps.
- **Status history:** Record who changed a request and when; write the request update and its history entry within the **same database transaction**.
- **Favourites:** Composite primary key or unique constraint `(user_id, property_id)` to prevent duplicates.
- **Listing reports:** Decide duplicate-report rules, what the admin reviews, and whether an admin action needs an additional moderation/audit table to record decisions and reasons. Reports should not disappear simply because a listing was hidden.
- **General:** Add `created_at`/`updated_at` where useful, foreign key indexes, deletion rules, and migrations. Never allow frontend-supplied `owner_id` to override the authenticated user’s identity.

### First ERD task

Create an ER diagram showing primary keys, foreign keys, cardinalities and participation. Review the schema with both backend developers **and** the frontend team before adopting it.

## 10. Security and quality expectations

- Hash passwords with a reputable password-hashing method (such as Argon2id or bcrypt with appropriate configuration).
- Enforce authentication, role permissions and **ownership checks in the backend** for every protected operation; hiding a button in Angular is not authorization.
- Validate and sanitize inputs as appropriate; use parameterized SQL queries or a safe database library/ORM.
- Limit uploads by size and allowed content types; do not trust filename extensions alone.
- Do not expose database credentials or secrets in Angular client code.
- Keep database migrations under version control and use seed data that contains no real credentials or personal information.
- Test successful requests and failure cases: unauthenticated, forbidden, invalid input and missing resource.

## 11. DevOps from day one

The DevOps engineer helps build the following in collaboration with the rest of the team:

1. **Reproducible local setup:** pinned versions, `.env.example`, Dockerfiles/Compose, and setup verification across team computers.
2. **Continuous integration:** run frontend and backend install/lint/test/build checks on pull requests. Add migration checks and integration tests as the project grows.
3. **Containerization:** separate frontend, backend and database concerns; use persistent named volumes or equivalent durable storage for PostgreSQL and uploaded images. Do **not** assume container restarts preserve images unless storage is configured.
4. **Deployment:** agree on a staging/demo environment, secret management, database migrations, health checks, logs and a rollback plan.
5. **Knowledge sharing:** each teammate learns how to run the full stack, interpret a failed pipeline, and inspect basic logs.

## 12. Scrum ceremonies and task tracking

Use GitHub Issues and a GitHub Projects board with **Todo → In Progress → Review → Done**. Each issue should contain a backlog ID, description, acceptance criteria, assignee and dependencies.

- **Sprint planning:** Choose a single sprint goal and only the amount of work the team reasonably expects to finish. Assign tasks and identify dependencies.
- **Short stand-ups:** Share what changed, what comes next, and blockers (10–15 minutes is plenty).
- **Sprint review:** Demonstrate *working, integrated software*, not only screenshots or individual code files.
- **Retrospective:** Discuss collaboration problems and select one improvement for the next sprint.

### Definition of Done

A task is done only when its acceptance criteria pass, its relevant tests run, no secrets are committed, documentation/contracts are updated, it has been reviewed and merged, CI passes, and the integrated behavior can be demonstrated where applicable.

## 13. Recommended Sprint 1 goal

**Sprint goal:** Each developer can run the project; Angular can reach the backend; the backend can connect to PostgreSQL; a small end-to-end feature is demonstrated and checked through the pull-request process.

| Role | Suggested initial tasks |
| --- | --- |
| Frontend 1 | Angular project structure, routing, placeholder property list using agreed mock response |
| Frontend 2 | Angular registration/login forms with validation |
| Backend 1 | Express scaffold, database connection, users table migration, registration API tests |
| Backend 2 | Database ERD review, properties schema migration, sample properties read endpoint |
| DevOps | Repository protections, GitHub Actions starter pipeline, initial Docker Compose setup, reproducible onboarding |

Finish the first vertical slice (e.g., **register through Angular → Express validates and hashes password → PostgreSQL saves the user → UI shows a result**) before expanding into many unfinished features.

## 14. First team meeting checklist

- [ ] Confirm team names ↔ roles and identify who coordinates Scrum.
- [ ] Confirm backend/database/testing technology choices and package/version policy.
- [ ] Confirm MVP scope, priorities and academic deadline.
- [ ] Create repository and give all members access.
- [ ] Agree on issue naming, branch naming, PR review and merge policy.
- [ ] Review ERD and decide how migrations will be owned.
- [ ] Agree on the **first** API contract and common error-response shape.
- [ ] Choose a Sprint 1 goal and assign small GitHub issues.
- [ ] Confirm how every member will run the app locally and ask another member to test the instructions.

## 15. Decisions still open

The team must document its decisions about: backend language (JavaScript/TypeScript), database tooling (raw SQL/query builder/ORM), authentication and session handling, storage for images, listing expiry/confirmation rules, moderation audit records, API URL/error conventions, deployment host, sprint length and definition of the MVP.

---

**Working agreement:** Communicate early, agree on shared contracts, keep changes small, review one another’s work, test often, and make the application run as a whole—not as five unrelated assignments.
