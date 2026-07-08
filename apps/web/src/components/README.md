# Components

This folder contains app-specific React components for the surveillance map UI.
Keep generated shadcn primitives in `packages/ui/src/components`; compose them
here only when a component belongs to this app's domain or layout.

## How it maps

| Concern                     | Put it in                               | Notes                                                                                                        |
| --------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Generated shadcn primitives | `packages/ui/src/components`            | Do not hand-edit unless fixing the shared primitive itself.                                                  |
| Page shells and navigation  | `apps/web/src/components/layouts`       | Use for app chrome, sidebars, headers, and route-level layout wrappers.                                      |
| Domain UI                   | `apps/web/src/components/interfaces`    | Use for reusable surveillance widgets such as metric cards, detail panels, legends, and filter groups.       |
| Route-specific UI           | `apps/web/src/features/*`               | Keep components close to a feature when they are not reused elsewhere.                                       |
| Shared behavior             | `apps/web/src/lib` or `packages/shared` | Use `packages/shared` for data contracts, sanitization, exports, and metric logic used by more than one app. |

## Rules

1. Public UI must not display private fields such as accession IDs, city, ZIP,
   raw location, exact detection dates, or notes.
2. Use "detections" or "positive tests" unless denominator data supports a
   prevalence or positivity-rate label.
3. Keep components small and named after what they render, not where they appear.
4. Prefer shadcn primitives from `@workspace/ui/components/*` over custom
   controls.
5. Keep route files thin; move substantial UI into `features` or `components`.

## Layout

```text
apps/web/src/components/
  layouts/       AppShell and other route/page layout wrappers
  interfaces/    Reusable surveillance UI composed from shadcn primitives
  README.md      Component organization rules
```

Feature-owned components can stay with their feature:

```text
apps/web/src/features/surveillance/
  admin-page.tsx
  public-map-page.tsx
  data.ts
```
