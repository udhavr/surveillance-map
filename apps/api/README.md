# API

Small Hono API boundary for private/admin data and generated public exports.

This is currently a scaffold using sample records from `packages/shared`. In
production, this is where university SSO, Postgres access, audit logging, import
jobs, and publish jobs should live.

## Current Endpoints

| Endpoint                   | Purpose                                                 |
| -------------------------- | ------------------------------------------------------- |
| `GET /health`              | Basic service health check.                             |
| `GET /admin/cases`         | Sample private records; production should require auth. |
| `GET /public/cases.json`   | Sanitized public payload.                               |
| `GET /exports/public.json` | Sanitized JSON export.                                  |
| `GET /exports/public.csv`  | Sanitized CSV export.                                   |

## Production Rule

The browser must never connect directly to Postgres. Admin screens should call
API endpoints that enforce authentication, authorization, validation, and audit
logging.
