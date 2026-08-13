# Architecture

Helvetic Operations Platform is a modular monolith for a focused operational domain. It keeps Work Order transactions and deployment boundaries simple while separating domain rules, application orchestration, persistence and delivery concerns.

## Runtime architecture

```mermaid
flowchart LR
    User[Operations user] --> Web[Angular 22 web application]
    Web -->|MSAL interactive sign-in| Entra[Microsoft Entra ID]
    Web -->|Bearer token + JSON| API[ASP.NET Core Minimal APIs]
    API --> Policy[Scope and app-role authorization]
    Policy --> UseCases[Application use cases]
    UseCases --> Domain[C# Work Order domain]
    UseCases --> Port[Work Order repository port]
    Port --> Adapter[Entity Framework Core adapter]
    Adapter --> SQL[(SQL Server)]
```

## Local delivery sequence

```mermaid
flowchart LR
    SQL[(SQL Server healthy)] --> Migrator[One-shot Migrator succeeds]
    Migrator --> API[API healthy]
    API --> Web[Web healthy]
```

The API process does not run migrations or production seed data. Docker Compose defaults seeding to disabled. The Migrator is the single local migration owner and the API starts only after it exits successfully.

## Delivery architecture

```mermaid
flowchart LR
    Commit[Git commit] --> Actions[GitHub Actions]
    Actions --> Backend[.NET build and 30 tests]
    Actions --> Migration[Clean migration and pending-model check]
    Actions --> Angular[Angular build and 19 tests]
    Actions --> Contract[NSwag drift check]
    Actions --> Images[API and Web image builds]
    Migration --> SQLArtifact[Idempotent SQL artifact]
    Actions --> E2E{Protected Entra E2E config available?}
    E2E -->|Yes| Playwright[Run 8 authenticated flows]
    E2E -->|No| Skipped[Visible skipped job and reason]
```

## Key decisions

- **Domain-owned lifecycle:** callers cannot directly set status; legal transitions remain inside `WorkOrder`.
- **Pragmatic application boundary:** Work Order-specific repository contracts support use cases without a generic repository framework.
- **Database concurrency:** SQL Server `rowversion` prevents silent overwrites and is transported as Base64 outside persistence.
- **Explicit failures:** validation, not-found and conflict outcomes use consistent Problem Details contracts.
- **Typed client generation:** NSwag generates Angular contracts from OpenAPI, and drift validation prevents manual divergence.
- **Identity at the boundary:** Microsoft Entra ID supplies access tokens; API policies require `access_as_user` plus the appropriate app role.
- **Reviewed migration delivery:** production should use a reviewed migration bundle or idempotent SQL artifact under a separate deployment identity.

## Azure boundary

The repository contains an Azure Bicep infrastructure baseline for an intended Azure Container Apps direction. It does not represent a completed deployment environment. Container Apps deployment, Key Vault integration, private endpoints, and production observability remain outside the implemented boundary.
