# Demo guide

This guide is a short viewing path for Helvetic Operations Platform. It is intended for a portfolio reviewer who wants to understand the implemented system quickly without mistaking the repository for a completed Azure production deployment.

## Recommended format

- Length: 2-3 minutes
- Audience: backend, full-stack, or platform engineering reviewer
- Focus: one real Work Order workflow, the generated API contract boundary, authorization, concurrency, and verified delivery evidence
- Boundary: local or approved Entra-backed environment only; Azure production deployment remains planned

## Storyboard

### 1. Open with the implemented scope

Show the README overview and engineering highlights.

Say:

> Helvetic Operations Platform is a focused work-order management slice. The backend enforces lifecycle, authorization, SQL Server persistence, optimistic concurrency, and an Angular frontend. I kept the Azure section explicit: the repository has a Bicep baseline, not a completed production deployment.

Show:

- `README.md` overview
- Engineering highlights
- Limitations section

### 2. Show the Work Order register

Open the Work Order list view.

Say:

> The main workflow starts from the Work Order register. The list is API-backed, supports filters and pagination, and reflects the same contract generated from OpenAPI rather than a handwritten Angular service.

Show:

- Status, priority, site, and SLA risk filters
- A list row with reference, site, due date, status, and priority
- Existing screenshot: `docs/images/work-orders-list.png`

### 3. Show detail, audit, and role-gated actions

Open one Work Order detail page.

Say:

> The detail view exposes the operational state and audit trail. Angular may hide actions for usability, but server-side authorization is the real boundary: Viewer can read, Dispatcher can create and transition, and Manager can cancel.

Show:

- Work Order detail facts
- Audit history
- Transition action
- Manager cancellation area when using a Manager session
- Existing screenshot: `docs/images/work-order-detail.png`

### 4. Show create or edit through the facade

Open create or edit.

Say:

> The frontend does not duplicate backend DTOs. Work Order components call `WorkOrderFacade`, and the facade delegates to the NSwag-generated `Client` from `web/src/app/api/generated/`.

Show:

- `web/src/app/core/work-order.facade.ts`
- `web/src/app/api/generated/work-orders-api.ts`
- Create or edit form
- Existing screenshot: `docs/images/work-order-edit.png`

### 5. Show lifecycle enforcement

Advance a Work Order status.

Say:

> Status changes are not arbitrary field updates. They go through guarded domain methods, so invalid transitions are rejected in the backend and covered by tests.

Show:

- Next status selector
- Advance status action
- Resulting status change
- Existing screenshot: `docs/images/work-order-status-transition.png`
- `src/HelveticOps.Domain/WorkOrders/WorkOrder.cs`

### 6. Show stale-write conflict recovery

Show the conflict state.

Say:

> Writes carry a Base64 rowversion. If another user changes the Work Order first, the API returns HTTP 409 Problem Details and the Angular client shows a reload-and-retry path instead of silently overwriting data.

Show:

- Existing screenshot: `docs/images/work-order-conflict-state.png`
- Conflict section in README
- Repository/API tests covering concurrency behavior

### 7. Close with verification evidence

Show the Testing and Implementation status sections.

Say:

> The remaining evidence gap is not CRUD depth. It is deployment. The implemented repository scope is verified by backend tests, Angular tests, generated-client drift checks, container builds, migration validation, and protected authenticated Playwright flows when Entra session artifacts are available.

Show:

- `docs/IMPLEMENTATION.md`
- GitHub Actions workflows
- README limitations

## Local capture checklist

Use this checklist when recording a fresh demo from a configured environment.

- Start from a clean working tree or clearly note intentional documentation-only changes.
- Start the Docker Compose stack with valid `.env` values.
- Confirm `http://localhost:5080/health` succeeds.
- Confirm `http://localhost:4200/` loads.
- Use a Dispatcher session for list, create, edit, and transition.
- Use a Manager session for cancellation.
- Keep the final video under 3 minutes.
- Do not show secrets, `.auth` contents, tokens, browser storage, or `.env` values.
- Do not present Azure production deployment as complete.

## Verification commands

These commands validate the repository evidence used by the demo:

```bash
dotnet test HelveticOps.sln --configuration Release
npm test --prefix web
npm run build --prefix web
npm run api:check --prefix web
npm run e2e --prefix web
```

Authenticated Playwright requires protected Microsoft Entra test sessions. If those session artifacts are unavailable, the tests are intentionally skipped rather than counted as executed coverage.
