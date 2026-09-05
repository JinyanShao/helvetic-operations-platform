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
4. Keep `buildImages` enabled.

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
4. Set `buildImages` to `false`.
5. Use the same `environmentName`, resource group, and region.

This moves the API, Web, and Migrator job definitions back to the selected image tag. The workflow still runs the Migrator before deploying API/Web, so rollback images must be compatible with the current database schema. The application uses forward-only EF Core migrations; automatic destructive down migrations are not part of the deployment workflow. If a schema change breaks older application images, ship a database-forward compatibility fix rather than relying on automatic database rollback.

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

The same Bicep template supports `prod`, but the current deployment workflow intentionally exposes only `e2e` and `nonprod`. Production cutover should happen only after:

- Non-production deployment is healthy.
- The Migrator job has been exercised safely.
- Authenticated Playwright reports `8 passed / 0 failed / 0 skipped`.
- Alerts and operational contacts are confirmed.
- A rollback rehearsal has been completed.
