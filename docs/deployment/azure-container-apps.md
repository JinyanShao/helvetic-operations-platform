# Azure Container Apps Deployment

Issue #14 is implemented as one reusable Azure Container Apps architecture with an environment parameter. The first real target is a dedicated non-production `e2e` or `nonprod` environment. Do not point authenticated Playwright at a real production business environment because the suite creates Work Orders and cancels them during cleanup.

## Architecture

The Bicep template in `infra/bicep/main.bicep` deploys:

- Log Analytics and workspace-based Application Insights
- A VNet-integrated Container Apps Environment
- Azure Container Registry with admin credentials disabled
- A registry user-assigned managed identity used by API, Web, and Migrator for ACR image pulls
- A backend secret user-assigned managed identity used only by API and Migrator for Key Vault secret reads
- Azure SQL Database with public network access disabled
- SQL private endpoint, private DNS zone, and VNet link
- Key Vault with the SQL connection string stored as a secret
- API Container App with internal ingress, process-only liveness, and database-backed readiness probes
- Web Container App with external ingress and same-origin `/api` proxying to the internal API
- Manual Migrator Container Apps Job
- Basic Container App 5xx metric alerts wired to an action group when email receivers are provided

The API still does not run migrations at startup. Database schema changes are applied by the Migrator job.

## Required External Setup

Before the first non-production deployment, create or choose:

- An Azure subscription and existing dedicated non-production resource group, for example `rg-helvetic-ops-e2e`.
- Registered Azure resource providers: `Microsoft.App`, `Microsoft.Sql`, `Microsoft.KeyVault`, `Microsoft.ContainerRegistry`, `Microsoft.Network`, `Microsoft.OperationalInsights`, `Microsoft.Insights`, and `Microsoft.ManagedIdentity`.
- A GitHub Actions OIDC federated identity allowed to deploy this repository.
- The GitHub deployment identity should have `Contributor` scoped to the dedicated non-production resource group.
- The same identity also needs `Role Based Access Control Administrator` scoped to the same resource group so Bicep can create the ACR Pull and Key Vault Secrets User role assignments.
- The same identity needs `AcrPush` scoped to the E2E Azure Container Registry when images are built by the GitHub-hosted runner.

Do not grant the GitHub deployment identity subscription-level Owner for normal deployments. Register resource providers and create the dedicated resource group as a one-time Azure bootstrap step. The workflow fails fast if providers are not registered or the resource group does not exist.
- Microsoft Entra API and SPA app registrations for this project.
- API app roles: `Operations.Viewer`, `Operations.Dispatcher`, `Operations.Manager`.
- Delegated API scope: `access_as_user`.

The deployment workflow needs these GitHub environment or repository secrets:

| Secret | Purpose |
|---|---|
| `AZURE_CLIENT_ID` | Federated workload identity client ID for GitHub Actions |
| `AZURE_TENANT_ID` | Azure tenant ID for OIDC login |
| `AZURE_SUBSCRIPTION_ID` | Azure subscription ID |
| `AZURE_SQL_ADMIN_PASSWORD` | SQL administrator password stored into Key Vault |
| `ENTRA_TENANT_ID` | Entra tenant used by the app |
| `ENTRA_SPA_CLIENT_ID` | SPA app registration client ID |
| `ENTRA_API_CLIENT_ID` | API app registration client ID |

Do not use a long-lived Azure client secret for GitHub Actions.

## Deployment Workflow

Run the **Deploy Container Apps** workflow manually.

Normal non-production deployment:

1. Select `environmentName`: `e2e` or `nonprod`.
2. Set the target resource group and region.
3. Leave `imageTag` empty.
4. Set `deploymentMode` to `deploy`.

The workflow:

1. Confirms the dedicated resource group exists and required Azure resource providers are registered.
2. Deploys bootstrap infrastructure with `deploymentStage=bootstrap`.
3. Builds API, Web, and Migrator images on the GitHub-hosted runner and pushes them to ACR with the immutable commit SHA tag.
4. Deploys or updates only the Migrator job with `deploymentStage=migrator`.
5. Starts the Migrator job and waits for success.
6. Deploys or updates API and Web revisions with `deploymentStage=applications`.
7. Verifies API/Web Container App provisioning.
8. Checks the public Web URL.
9. Calls `GET /api/ops/ready` through the public Web same-origin proxy. This validates Web ingress, Nginx proxying to the internal API Container App, API readiness, and private SQL connectivity without exposing Work Order business data.

## Rollback

Images are tagged by commit SHA. To roll back a non-production deployment:

1. Find the previous healthy commit SHA image tag.
2. Run **Deploy Container Apps** manually.
3. Set `imageTag` to that previous SHA.
4. Set `deploymentMode` to `rollback`.
5. Use the same `environmentName`, resource group, and region.

Rollback deploys the selected API and Web image tag and runs the same smoke checks. It does not build new images, run the Migrator, or run destructive/down database migrations. The application uses forward-only EF Core migrations, so the selected rollback image must already be compatible with the current database schema. If a schema change breaks older application images, ship a database-forward compatibility fix rather than relying on automatic database rollback.

## Entra Updates After First Deployment

After the first successful non-production deployment, copy the Web URL from the workflow summary and update the SPA app registration:

- Add the Web URL as a SPA redirect URI.
- Add the Web URL to any configured allowed origins needed by the tenant.
- Confirm the API app exposes `api://<ENTRA_API_CLIENT_ID>/access_as_user`.
- Assign Dispatcher and Manager test identities to the API enterprise application roles.

Then regenerate local Dispatcher and Manager session files against the deployed Web URL and configure the Authenticated E2E workflow secrets:

- `E2E_BASE_URL`
- `E2E_DISPATCHER_SESSION_STORAGE_JSON`
- `E2E_MANAGER_SESSION_STORAGE_JSON`

Run the authenticated E2E workflow manually. A skipped authenticated E2E run is not passing coverage.

## Production Boundary

The same Bicep template supports `prod`, but the non-production deployment workflow intentionally exposes only `e2e` and `nonprod`. Production cutover uses the separate **Deploy Production Container Apps** workflow with the dedicated GitHub Environment `production`.

Production deployment must use production-only secrets:

- `AZURE_CLIENT_ID`
- `AZURE_TENANT_ID`
- `AZURE_SUBSCRIPTION_ID`
- `AZURE_SQL_ADMIN_PASSWORD`
- `ENTRA_TENANT_ID`
- `ENTRA_SPA_CLIENT_ID`
- `ENTRA_API_CLIENT_ID`

Use an explicit immutable image tag for production rollback. Do not use `latest`.

Production cutover should happen only after:

- Non-production deployment is healthy.
- The Migrator job has been exercised safely.
- Authenticated Playwright reports `8 passed / 0 failed / 0 skipped`.
- Alerts and operational contacts are confirmed.
- A rollback rehearsal has been completed.
- A dedicated production resource group is confirmed.
- The `production` GitHub Environment is configured with required reviewers if the repository plan supports environment protection.
- The production Web URL is planned for the SPA app registration redirect URI list.
- The production image SHA is explicitly selected.
- Post-deploy smoke passes.

Authenticated Playwright remains pointed at the dedicated E2E environment. Do not set `E2E_BASE_URL` to a production URL.

## Production Parameter Differences

With `environmentName=prod`, the Bicep template changes these runtime parameters compared with `e2e` and `nonprod`:

- Resource names use the `hoprod-` / `hopprod` prefix derived from `environmentName=prod`.
- Tags include `environment=prod`.
- Log Analytics retention is 90 days instead of 30.
- Key Vault soft delete retention is 90 days instead of 7, and purge protection is enabled.
- Azure SQL uses Standard `S0` instead of Basic.
- API and Web run with `ASPNETCORE_ENVIRONMENT=Production` and production SPA/API identifiers from production secrets.
- API and Web scale from `minReplicas=1` to `maxReplicas=5`; non-production scales from 0 to 2.
- API/Web 5xx alerts use severity 2 instead of 3, but remain disabled unless `alertEmailReceivers` contains at least one receiver.

## Production Cost Sanity

Before creating production resources, expect steady-state cost from:

- Azure SQL Standard `S0`.
- API and Web Container Apps with `minReplicas=1`.
- Container Apps Environment and Log Analytics ingestion/retention.
- Application Insights workspace telemetry.
- Azure Container Registry Basic.
- Key Vault operations and stored secrets.
- SQL private endpoint and private DNS.

This is a rough cost footprint, not a formal estimate. Confirm current regional Azure pricing before production creation.
