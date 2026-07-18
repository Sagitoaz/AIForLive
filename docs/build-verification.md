# Build verification

- Date: 2026-07-18T17:56:00+07:00
- Node: v24.13.0
- npm: 11.6.2
- Python: Python 3.12.0
- Total source/artifact files (dependencies excluded): 488
- Total custom icons: 80
- Total SVG assets: 254
- Model artifact: 1997 bytes
- ZIP size: pending package verification
- Overall: PASSED

## Verification matrix

| Check | Result | Final evidence |
| --- | --- | --- |
| Node lint | PASS | Web + API ESLint |
| TypeScript typecheck | PASS | Web + API strict `tsc --noEmit` |
| Prisma schema validation | PASS | Schema valid after phase/source/recommendation migration |
| Prisma seed typecheck | PASS | Standalone strict compile of `prisma/seed/index.ts` |
| Node unit tests | PASS | Web 12/12; API 17/17, including AI Voice/animation visibility, completed-lesson review, server-side scoring and role-guard behavior |
| End-to-end workflow tests | PASS | 1/1 after adding verified source registry to the harness |
| Python lint | PASS | Ruff |
| Python unit tests | PASS | 17/17 |
| Synthetic data validation | PASS | 20 profiles, 48 exercises, 400 matching attempts/events |
| Model evaluation check | PASS | Artifact readable; metrics remain prototype-only |
| Asset validation | PASS | 254 SVG files, 80 custom icons |
| Production build | PASS | NestJS build + Next.js 8 routes/prerender after JWT/RBAC, AI Voice/animation and lesson-review wiring |

## Model result

The next-attempt artifact uses a student-group split on synthetic data. See `apps/ai-service/ml/artifacts/evaluation.json` and `docs/model-card.md`.

## Known limitations

- The source gate validates Prisma and the production build but does not exercise the full Docker/PostgreSQL runtime.
- Model metrics are from synthetic data and do not establish real educational effectiveness.
- FPT LLM live calls require deployment credentials and quota; automated verification covers the adapter with mocked provider responses and keeps LocalTemplateProvider as fallback.
- The full gate first exposed an outdated E2E constructor after `ContentSourceService` became mandatory. The harness was fixed and the E2E test then passed independently; no product guard was bypassed.

Final verification completed on 18/07/2026. The production build and every gate item above passed; live FPT/Supabase calls were not part of this local verification.
