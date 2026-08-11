# Helvetic Operations Platform

[![CI](https://github.com/JinyanShao/helvetic-operations-platform/actions/workflows/ci.yml/badge.svg)](https://github.com/JinyanShao/helvetic-operations-platform/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-10212c.svg)](LICENSE)
[![.NET 8](https://img.shields.io/badge/.NET-8.0-512bd4)](https://dotnet.microsoft.com/)
[![Angular 22](https://img.shields.io/badge/Angular-22-dd0031)](https://angular.dev/)

## 60-Second Overview

**Helvetic Operations Platform** is a multi-site work-order management application built with .NET 8, ASP.NET Core, EF Core, SQL Server and Angular.

It models operational workflows where dispatchers and managers need to assign work, identify SLA risk, control valid work-order state transitions, preserve audit history and handle concurrent updates safely.

### Engineering Highlights

- Domain-controlled work-order lifecycle and business rules
- SQL Server `rowversion` optimistic concurrency with HTTP 409 conflict handling
- ASP.NET Core Minimal APIs with EF Core, OpenAPI and explicit authorization boundaries
- Angular workflows using an NSwag-generated TypeScript API client
- Automated backend, frontend, database migration and container validation with GitHub Actions

### Quick Start

Authenticated workflows require a configured Microsoft Entra ID app registration. See the setup guide below.

```bash
cp .env.example .env
docker compose up --build --wait
curl --fail http://localhost:5080/health
curl --fail --head http://localhost:4200/
```

---

## Application Preview

**Work Order List & Filtering**  
![Work Orders list](docs/images/work-orders-list.png)  
Filter by status, priority, site and SLA risk; paginate safely with server-side sorting.

**Work Order Detail & Operational Actions**  
![Work Order detail](docs/images/work-order-detail.png)  
View work details, audit trail and available actions (edit, transition status, cancel).

**Edit Form with Validation**  
![Work Order edit](docs/images/work-order-edit.png)  
Real-time validation, unsaved changes indicator, optimistic concurrency version handling.

**Status Transition**  
![Status transition](docs/images/work-order-status-transition.png)  
State machine enforces valid transitions: Planned → Dispatched → InProgress/Blocked → Completed.

**Conflict Recovery**  
![Conflict state](docs/images/work-order-conflict-state.png)  
HTTP 409 conflict detected; reload guidance and retry handling for concurrent edits.

---

## Business Problem

Operations teams need one reliable view of planned, dispatched, active, blocked, completed and cancelled work. The platform supports the decisions behind that workflow: finding SLA risk, assigning technicians, progressing legal states, resolving concurrent edits and preserving an audit history.

## Current Capabilities

Implemented and verified:

- Domain-controlled lifecycle: `Planned` → `Dispatched` → `InProgress` / `Blocked` → `Completed`, with `Cancelled` as a terminal Manager action
- SQL Server persistence through Entity Framework Core migrations and explicit mappings
- SQL Server `rowversion` optimistic concurrency with Base64 API versions and HTTP 409 conflict handling
- Work Order list, detail, create, update, transition and cancellation use cases
- Server-side pagination; status, priority, site and SLA-risk filters; explicit safe sorting
- Audit events for successful status transitions and cancellation, without fabricated actor identities
- ASP.NET Core Minimal APIs with OpenAPI, Problem Details and explicit FluentValidation execution
- Angular list, detail, create and edit flows, operational actions, loading/empty/error/saving states and conflict recovery
- NSwag-generated TypeScript API contracts with deterministic drift checking
- Microsoft Entra ID token, delegated-scope and app-role authorization boundaries
- One-shot database migrator, health-ordered Docker Compose startup and production image builds
- GitHub Actions validation for backend, database migrations, Angular, generated contracts and containers

## Architecture

```mermaid
flowchart LR
    User[Operations user] --> Angular[Angular 22 application]
    Angular -->|MSAL sign-in| Entra[Microsoft Entra ID]
    Angular -->|Bearer token + REST| API[ASP.NET Core Minimal APIs]
    API --> Auth[Scope and app-role policies]
    Auth --> Application[Application use cases]
    Application --> Domain[C# domain model]
    Application --> Repository[Work Order repository]
    Repository --> EF[Entity Framework Core]
    EF --> SQL[(SQL Server)]

    SQL --> Migrator[One-shot migration process]
    CI[GitHub Actions] --> Validation[Build, test, migration and container validation]
    Validation --> Artifact[Reviewed idempotent SQL artifact]
    Bicep[Azure Bicep baseline] -. planned deployment target .-> Azure[Azure Container Apps]
```

The backend is a pragmatic modular monolith. Domain rules do not depend on ASP.NET Core or Entity Framework Core; application use cases coordinate operations; infrastructure implements persistence; the API handles transport, validation and authorization.

Azure Bicep records the intended deployment direction only. Production Azure deployment, Key Vault, private endpoints and production observability are not implemented. See [Architecture](docs/architecture/architecture.md).

## Technology Stack

| Area | Technology |
|---|---|
| Backend | .NET 8, C#, ASP.NET Core Minimal APIs, Problem Details, OpenAPI |
| Persistence | Entity Framework Core 8, SQL Server, EF Core migrations, `rowversion` |
| Frontend | Angular 22, TypeScript, Reactive Forms, Angular Router and HttpClient |
| Identity | Microsoft Entra ID, MSAL, delegated scope and app roles |
| Contract generation | NSwag from the checked OpenAPI contract |
| Testing | xUnit, Testcontainers for SQL Server, Respawn, Angular unit tests, Playwright |
| Delivery | Docker, Docker Compose, GitHub Actions, Dependabot, Azure Bicep baseline |

## Code Navigation

**Quick evidence review:**

1. Domain layer: `src/HelveticOps.Domain/WorkOrders/WorkOrder.cs` — guarded lifecycle and invariants.
2. Persistence: `src/HelveticOps.Infrastructure/Persistence` — SQL Server, `rowversion` optimistic concurrency, audit writes.
3. API surface: `src/HelveticOps.Api` — Minimal APIs, Problem Details, authorization policies.
4. Frontend: `web/src/app` — generated TypeScript client, Angular Work Order flows.
5. CI/CD: [GitHub Actions runs](https://github.com/JinyanShao/helvetic-operations-platform/actions/workflows/ci.yml) — backend, migrations, frontend, container validation.

## Local Setup

Prerequisites: Docker Desktop with Docker Compose. Copy the local environment template, then add or set `SQL_PASSWORD`, `ENTRA_TENANT_ID`, `ENTRA_SPA_CLIENT_ID`, `ENTRA_API_CLIENT_ID` and `ENTRA_API_BASE_URL` with a strong local SQL password and real Microsoft Entra identifiers. Do not commit `.env`.

```bash
cp .env.example .env
docker compose up --build --wait
curl --fail http://localhost:5080/health
curl --fail --head http://localhost:4200/
```

Endpoints:

- Angular: `http://localhost:4200`
- API health: `http://localhost:5080/health`
- Development OpenAPI UI: `http://localhost:5080/swagger`

The Compose dependency chain is SQL Server healthy → Migrator completed successfully → API healthy → Web healthy. Development seed data is opt-in through `SEED_DATA=true`; it is disabled by default in Compose.

For a realistic local demonstration, keep `SEED_DATA=true`, assign the signed-in account an API app role, and use this flow:

1. Sign in and review the seeded Work Order list, filters and pagination.
2. Open a Work Order and edit it using its current concurrency version.
3. Advance a legal lifecycle transition as Dispatcher or Manager.
4. Cancel a non-terminal Work Order as Manager and provide a reason.
5. Open the same Work Order in two tabs, save one edit, then submit the stale tab to observe the HTTP 409 reload guidance.

The application intentionally has no local password, fabricated token or special-purpose authentication bypass.

Stop the stack and remove its local database volume with:

```bash
docker compose down --volumes
```

See [Microsoft Entra ID setup](docs/entra/README.md) before the first authenticated run.

## Database Migrations

The checked migration is applied by the dedicated one-shot Migrator container. The production API process does not run migrations or seed data at startup.

Official EF Core commands for a configured development connection are:

```bash
dotnet tool install --global dotnet-ef --version 8.0.8
dotnet ef database update --project src/HelveticOps.Infrastructure --startup-project src/HelveticOps.Api --context OperationsDbContext
dotnet ef migrations has-pending-model-changes --project src/HelveticOps.Infrastructure --startup-project src/HelveticOps.Api --context OperationsDbContext
dotnet ef migrations script --idempotent --project src/HelveticOps.Infrastructure --startup-project src/HelveticOps.Api --context OperationsDbContext --output operations-migrations.sql
```

Supply `ConnectionStrings__OperationsDb` or the design-time `--connection` argument. Production releases should apply a reviewed migration bundle or reviewed idempotent SQL with a separate deployment identity and an approved rollback plan.

## Authentication and Roles

Angular uses MSAL route protection and `MsalInterceptor`; it does not manually persist access tokens. The API validates the Microsoft Entra ID access token, delegated scope `access_as_user` and the required app role.

| Role | Permissions |
|---|---|
| `Operations.Viewer` | Read dashboard and Work Orders |
| `Operations.Dispatcher` | Viewer permissions plus create, edit, assign and transition Work Orders |
| `Operations.Manager` | Dispatcher permissions plus cancel Work Orders and future administrative operations |

Server authorization is authoritative. UI visibility is only a usability aid. Configuration steps are in [Microsoft Entra ID setup](docs/entra/README.md).

## Testing

Run the verified suites from the repository root:

```bash
dotnet test HelveticOps.sln --configuration Release
npm ci --prefix web
npm test --prefix web
npm run build --prefix web
npm run api:check --prefix web
npm run e2e --prefix web
```

Current verified totals:

- Backend: 30 passed, 0 failed, 0 skipped
- Angular: 19 passed, 0 failed, 0 skipped
- Playwright: 8 authenticated flows configured; 8 explicitly skipped because protected Microsoft Entra test configuration is unavailable

The backend suite includes domain, service, repository, API, authorization, migration and concurrency coverage against the real SQL Server engine where persistence matters.

## CI/CD

GitHub Actions runs:

- .NET restore, Release build and all backend tests
- SQL Server integration tests and migration application to a clean database
- pending-model-change validation and idempotent migration SQL generation
- Angular dependency installation, high-severity production dependency audit, unit tests and production build
- NSwag generated-client drift validation
- API and Web production image builds
- authenticated Playwright only when every protected Entra value and deterministic fixture identifier is available

The migration SQL is uploaded as a reviewable artifact. When protected Playwright configuration is absent, the authenticated job is visibly skipped and the configuration job records the reason; it is never reported as an executed pass.

## Current Status

The Work Order delivery milestone is implemented and reproducible. Persistence, migrations, concurrency, audit records, API validation and authorization policies, Angular read/write workflows, generated contracts, Docker delivery and CI validation are complete at repository level.

The system is not presented as production-deployed. Live authenticated browser evidence and the Azure production environment remain outside the completed boundary. See [Implementation status](docs/IMPLEMENTATION.md).

## Roadmap

- Execute all 8 authenticated Playwright flows with protected Microsoft Entra test configuration
- Capture final authenticated list, detail, form, filter/pagination and conflict/action screenshots
- Deploy the reviewed application and migration artifact to Azure Container Apps
- Integrate Key Vault and private endpoints
- Add OpenTelemetry, Application Insights dashboards and production operational alerts
- Complete production runbooks, rollback evidence and operational acceptance

## Screenshots

Current authenticated UI screenshots are pending one manual Microsoft Entra login. Earlier design-stage dashboard images are not presented here as implementation evidence, and the repository does not include a demo authentication bypass.

One-time capture procedure:

1. Complete the two app registrations and role assignment in [Microsoft Entra ID setup](docs/entra/README.md).
2. Copy `.env.example` to `.env`, replace all placeholder identifiers, retain `SEED_DATA=true`, and run `docker compose up --build --wait`.
3. Open `http://localhost:4200`, complete Microsoft login manually, and confirm the account has the intended Viewer, Dispatcher or Manager role.
4. Capture only the application viewport for the Work Order list, an applied filter with pagination, detail, create/edit form, and a successful transition or cancellation.
5. For conflict evidence, open one Work Order in two tabs, save the first, submit the second, and capture the displayed reload guidance.
6. Remove account menus, tenant identifiers and unrelated browser or desktop content; store approved PNG files under `docs/images/` and then add only two or three representative images here.

Do not capture tokens, browser storage, Azure portal pages, passwords or MFA prompts.

## License

MIT © 2026 Jinyan Shao
