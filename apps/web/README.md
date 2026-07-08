# Web App

Vite + React + TanStack Router app for the surveillance map.

## Routes

| Route    | Purpose                                                                |
| -------- | ---------------------------------------------------------------------- |
| `/`      | Static public county map that uses sanitized county-level data.        |
| `/admin` | Admin preview for private records, import preview, and public exports. |

## Important Folders

```text
src/routes/                    TanStack file routes
src/features/surveillance/     Public map and admin screens
src/components/layouts/        App shell and page layout wrappers
src/components/interfaces/     Reusable app-specific UI pieces
src/lib/                       Browser helpers such as downloads and XLSX export
public/data/                   Static sanitized public data artifacts
```

## Safety Rule

Public routes and files under `public/data/` must not include accession IDs,
city, ZIP, raw location, exact detection dates, or notes.
