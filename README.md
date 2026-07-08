# Surveillance Map

Static public county map and protected-admin scaffold for veterinary pathogen
surveillance data.

## Start Here

This repository has two jobs:

1. Show a public county-level map from sanitized files.
2. Provide a protected admin area/API boundary for private veterinary records.

The public app reads sanitized county-level artifacts only. Private records are
intended to live behind the API boundary and, in production, a university-owned
Postgres database with SSO-protected admin access.

## What To Open

- Public/admin web app: `apps/web`
- API boundary: `apps/api`
- Shared data rules: `packages/shared`
- shadcn UI primitives: `packages/ui`
- Human documentation: `docs`

## Common Commands

Run these from the repository root:

```sh
npm install
npm run dev
npm run build
npm run test
npm run typecheck
```

The public map is route `/`. The admin preview is route `/admin`.

## Development

See [docs/development.md](docs/development.md).
