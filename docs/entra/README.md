# Microsoft Entra ID setup

The platform uses two single-tenant app registrations: one SPA registration for Angular and one API registration for ASP.NET Core. Client IDs and tenant IDs are identifiers, not secrets; no client secret is required by the browser.

## 1. Register the API

1. Create an app registration named `helvetic-operations-api`.
2. Under **Expose an API**, set the Application ID URI to `api://<API_CLIENT_ID>`.
3. Add the delegated scope `access_as_user` for admins and users.
4. Under **App roles**, add the three enabled roles below with **Users/Groups** as the allowed member type:
   - `Operations.Viewer`
   - `Operations.Dispatcher`
   - `Operations.Manager`
5. Assign each operator or Entra group exactly the operational role they require in the API enterprise application.

## 2. Register the Angular SPA

1. Create an app registration named `helvetic-operations-web`.
2. Add **Single-page application** redirect URIs for `http://localhost:4200` and each deployed web origin.
3. Under **API permissions**, add the API's delegated `access_as_user` permission.
4. Grant tenant-wide admin consent if required by your tenant policy.

Do not create a client secret for the SPA. It is a public client and cannot keep one confidential.

## 3. Configure the applications

For Docker Compose, copy `.env.example` to `.env`, then add or set `ENTRA_TENANT_ID`, `ENTRA_SPA_CLIENT_ID`, `ENTRA_API_CLIENT_ID` and `ENTRA_API_BASE_URL`. `ENTRA_API_BASE_URL` is the API root only (`http://localhost:4200`), because the generated client already prefixes every route with `/api`. The web container creates `/config/entra-config.json` at startup; the file is explicitly served with `Cache-Control: no-store`.

For native Angular development:

```bash
cp web/public/config/entra-config.example.json web/public/config/entra-config.json
```

Replace the placeholders and keep the generated file uncommitted. Configure the API with environment variables:

```bash
AzureAd__TenantId=<ENTRA_TENANT_ID>
AzureAd__ClientId=<ENTRA_API_CLIENT_ID>
```

## Enforcement model

Every protected API policy requires an authenticated token, the delegated `access_as_user` value in `scp`, and an accepted role from `roles`. Role inheritance is explicit:

| Policy | Accepted app roles |
|---|---|
| Viewer | Viewer, Dispatcher, Manager |
| Dispatcher | Dispatcher, Manager |
| Manager | Manager |

Current endpoint enforcement is:

- Viewer policy: Work Order list and detail
- Dispatcher policy: create, update and lifecycle transition
- Manager policy: cancellation

The API remains authoritative even when Angular hides actions that are unavailable to the signed-in role.

## Authenticated Playwright setup

The business E2E suite uses the same Microsoft Entra path as the application. It does not use fake JWTs, password grants, or a development authentication bypass.

Required Entra setup:

- API app registration exposes `api://<API_CLIENT_ID>/access_as_user`.
- SPA app registration has a redirect URI for the tested web origin, for example `http://localhost:4200`.
- The Dispatcher test identity is assigned `Operations.Dispatcher` in the API enterprise application.
- The Manager test identity is assigned `Operations.Manager` in the API enterprise application. A Manager may also have Dispatcher if your test tenant grants both, but the Manager session must contain `Operations.Manager`.

With the Docker Compose stack or local web/API running, generate local session maps:

```bash
npm run e2e:auth:dispatcher --prefix web
npm run e2e:auth:manager --prefix web
```

The setup script opens a real browser for interactive Microsoft sign-in, including MFA when required. It saves only the application origin's localStorage map:

- `web/.auth/dispatcher-storage.json`
- `web/.auth/manager-storage.json`

These files can contain live MSAL tokens and must stay local. They are ignored by Git and must not be committed, logged, or uploaded as artifacts.

Run the authenticated Work Order business suite:

```bash
E2E_BASE_URL=http://localhost:4200 \
E2E_DISPATCHER_SESSION_STORAGE=.auth/dispatcher-storage.json \
E2E_MANAGER_SESSION_STORAGE=.auth/manager-storage.json \
npm run e2e --prefix web -- e2e/work-orders.spec.ts
```

The `npm --prefix web` commands run from the `web/` directory, so relative session paths should use `.auth/...` and resolve to `web/.auth/...`.

The suite provisions its own Work Orders for list, filtering/pagination, detail, create, edit, transition, conflict recovery, and Manager cancellation, then uses Manager cancellation as best-effort cleanup. No fixed Work Order GUIDs or references are required for the business suite.

For GitHub Actions, run the authenticated workflow manually after configuring these repository secrets:

| Secret | Purpose |
|---|---|
| `E2E_BASE_URL` | Tested web origin for a dedicated non-production environment reachable from GitHub-hosted runners |
| `E2E_DISPATCHER_SESSION_STORAGE_JSON` | Full JSON contents of `dispatcher-storage.json` |
| `E2E_MANAGER_SESSION_STORAGE_JSON` | Full JSON contents of `manager-storage.json` |

The GitHub workflow does not start SQL Server, the API, or the Angular web application. `E2E_BASE_URL` must already point to an environment configured for the same Microsoft Entra app registrations and API scope. Because the suite creates Work Orders and cancels them during cleanup, use a test or staging environment rather than a real production business environment.

The workflow materializes session secrets under the runner temporary directory and runs only `e2e/work-orders.spec.ts`. It does not upload `web/.auth/`, Playwright traces, screenshots, or HTML reports for authenticated runs because those artifacts can contain request headers or tenant/user details. The workflow is not scheduled because interactive SPA session JSON is not a durable long-term credential.
