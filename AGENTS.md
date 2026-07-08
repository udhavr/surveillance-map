# Project Agent Instructions

- Keep the public map static and privacy preserving.
- Do not expose accession IDs, city, ZIP, raw location, exact detection dates, or
  notes in public artifacts.
- Treat Postgres/API access as an admin-only boundary; browser code must not
  connect directly to the database.
- Use Conventional Commits, Keep a Changelog, and Semantic Versioning when GitHub
  release work is added later.
- Store detailed docs in `docs/`; keep the root `README.md` lean.
- Follow `apps/web/src/components/README.md` for component organization.
- Use `@/*` for `apps/web/src/*` imports.
- Keep shadcn primitives in `packages/ui/src/components`; composed app UI belongs
  in `apps/web/src/components/interfaces` or `apps/web/src/components/layouts`.
