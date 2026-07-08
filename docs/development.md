# Development

This guide is written for maintainers who may not work in JavaScript every day.
Run all commands from the repository root:

```sh
cd /Users/udhavramachandran/Documents/Projects/surveillance-map
```

## Requirements

- Node.js 20+
- npm 11+

## Commands

Install dependencies:

```sh
npm install
```

Start the local development server:

```sh
npm run dev
```

Check that the project still works:

```sh
npm run build
npm run test
npm run typecheck
```

Optional but useful before sharing work:

```sh
npm run lint
npm run format
```

## Workspace Layout

- `apps/web`: Vite, React, shadcn, and TanStack Router app.
- `apps/api`: API boundary for admin/private data and generated public exports.
- `packages/shared`: shared surveillance types, sample data, privacy rules,
  metric aggregation, and export helpers.
- `packages/ui`: shadcn-generated UI package.

## Where To Make Changes

| Need                            | Start here                                                            |
| ------------------------------- | --------------------------------------------------------------------- |
| Change public map UI            | `apps/web/src/features/surveillance/public-map-page.tsx`              |
| Change admin table/export UI    | `apps/web/src/features/surveillance/admin-page.tsx`                   |
| Change privacy/export rules     | `packages/shared/src/privacy.ts` and `packages/shared/src/exports.ts` |
| Change sample records           | `packages/shared/src/sample-data.ts`                                  |
| Change shared visual primitives | `packages/ui/src/components`                                          |
| Add project documentation       | `docs/`                                                               |

## Data Boundary

The public map must only consume sanitized generated artifacts such as
`apps/web/public/data/public_cases.json`.

Private fields including accession IDs, city, ZIP, raw location, exact detection
date, and notes belong behind the admin/API boundary and should not be included
in static public artifacts.

## Metrics

Use "detections" or "positive tests" unless denominator data are available. Use
"prevalence" only when total tests or another defensible denominator is present
for the selected county, pathogen, host, and time period.

## Before Publishing Public Data

Check that the generated public files do not contain:

- accession IDs
- city
- ZIP
- raw location
- exact detection date
- notes

The automated tests already check representative privacy cases, but a human
review is still required before publishing real university data.
