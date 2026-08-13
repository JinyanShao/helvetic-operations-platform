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
