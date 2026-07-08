# Shared Surveillance Logic

Shared TypeScript package for data contracts and privacy-sensitive behavior.

Use this package for logic that must stay consistent between the web app, API,
tests, and future publish jobs.

## Files

| File                 | Purpose                                                |
| -------------------- | ------------------------------------------------------ |
| `src/types.ts`       | Private and public record types.                       |
| `src/privacy.ts`     | Public/private field separation and text sanitization. |
| `src/metrics.ts`     | County/pathogen/host aggregation and display metrics.  |
| `src/exports.ts`     | Public JSON and CSV export builders.                   |
| `src/sample-data.ts` | Safe sample records for local UI and tests.            |

## Rule

If a change affects what can appear in public data, add or update a test in this
package before publishing real data.
