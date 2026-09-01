# System evolution

Helvetic Operations Platform did not start as a fully documented platform skeleton. The first implementation step was a single end-to-end Work Order slice that proved the main runtime path across the domain model, SQL Server persistence, API surface, and Angular client.

That initial slice established the core application shape:

- a guarded `WorkOrder` lifecycle rather than free-form status updates
- SQL Server persistence through Entity Framework Core
- API use cases for create, update, transition, cancellation, list, and detail flows
- an Angular client that exercised the same operational workflow from the browser

Once the vertical slice was in place, later changes focused on tightening the engineering boundary around it rather than changing the core product direction.

## Decision sequence

### 1. Domain-controlled workflow

The first architectural decision was to keep lifecycle rules inside the `WorkOrder` domain object. Status changes are not treated as arbitrary field edits. Callers must go through explicit transitions such as dispatch, start, block, resume, complete, and cancel.

This keeps invalid transitions out of the API and persistence layers and makes the lifecycle testable without involving infrastructure.

### 2. Persistence-backed concurrency

Once write flows were working, the next decision was to make concurrent edits explicit. SQL Server `rowversion` was chosen as the concurrency token so stale updates fail deterministically instead of silently overwriting newer data.

That decision shaped multiple layers:

- Entity Framework Core mappings use `rowversion`
- the API exposes concurrency versions as Base64 values
- stale writes return HTTP 409
- the Angular client handles conflicts as a reload-and-retry workflow

### 3. Boundary authentication and authorization

After the core operational flow existed, Microsoft Entra ID was added at the delivery boundary. The goal was not to move domain rules into the identity layer, but to make authenticated workflows and role enforcement match the intended operating model.

That led to:

- delegated `access_as_user` scope validation in the API
- app-role-based policies for Viewer, Dispatcher, and Manager capabilities
- Angular route protection and token acquisition through MSAL
- server-side policy enforcement remaining authoritative over UI visibility

### 4. Contract and delivery discipline

With the application slice and auth boundary in place, later work focused on making the system easier to validate and maintain:

- NSwag-generated Angular API contracts
- migration validation and idempotent SQL artifacts
- container build checks
- authenticated Playwright flows gated by protected Entra test configuration
