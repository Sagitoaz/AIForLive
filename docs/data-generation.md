# Synthetic data generation

Run `npm run ai:data`. The script uses random seed `20260718` and writes CSV/JSONL under `apps/ai-service/data/synthetic`.

## Personas

Strong and fast, strong but slow, weak in range, weak in while, weak prerequisite, frequent hints, inconsistent, long inactivity, sparse data and strong improvement after review. Each appears twice across 20 learners.

## Probability process

Correctness depends on latent concept ability, exercise difficulty, prerequisite mastery, days since practice, forgetting rate, hint use, attempt count, learning gain and controlled noise. It is not sampled independently.

## Edge cases

The generator forces skipped attempts, success after practice, wrong answers at high latent ability, lucky correct answers, implausibly fast and slow responses, multiple-concept exercises, missing misconception labels and repeated registered misconceptions.

All tabular outputs contain the notice `SYNTHETIC DATA — NOT REAL EDUONE DATA`; JSONL events carry a synthetic marker. `scripts/validate-synthetic-data.mjs` verifies row counts and notices.
