# Build verification

- Date: 2026-07-18T04:26:02.231Z
- Node: v24.13.0
- npm: 11.6.2
- Python: Python 3.12.0
- Total source/artifact files (dependencies excluded): 476
- Total custom icons: 80
- Total SVG assets: 254
- Model artifact: 1997 bytes
- ZIP size: pending package verification
- Overall: PASSED

## Verification matrix

| Check | Result | Duration |
| --- | --- | ---: |
| Node lint | PASS | 10410 ms |
| TypeScript typecheck | PASS | 13710 ms |
| Prisma schema validation | PASS | 7421 ms |
| Node unit tests | PASS | 31448 ms |
| End-to-end workflow tests | PASS | 4466 ms |
| Python lint | PASS | 2330 ms |
| Python unit tests | PASS | 13773 ms |
| Synthetic data validation | PASS | 445 ms |
| Model evaluation check | PASS | 517 ms |
| Asset validation | PASS | 736 ms |
| Model artifact | PASS | 0 ms |
| Production build | PASS | 59492 ms |

## Model result

The next-attempt artifact uses a student-group split on synthetic data. See `apps/ai-service/ml/artifacts/evaluation.json` and `docs/model-card.md`.

## Known limitations

- The source gate validates Prisma and the production build but does not exercise the full Docker/PostgreSQL runtime.
- Model metrics are from synthetic data and do not establish real educational effectiveness.
- FPT LLM live calls require deployment credentials and quota; automated verification covers the adapter with mocked provider responses and keeps LocalTemplateProvider as fallback.

Verification started at 2026-07-18T04:23:37.481Z and finished at 2026-07-18T04:26:03.032Z.
