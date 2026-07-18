# Synthetic data generation

Run `npm run ai:data`. The script uses random seed `20260718` and writes CSV/JSONL under `apps/ai-service/data/synthetic`.

## Personas

Strong and fast, strong but slow, weak in range, weak in while, weak prerequisite, frequent hints, inconsistent, long inactivity, sparse data and strong improvement after review. Each appears twice across 20 learners.

## Probability process

Correctness depends on latent concept ability, exercise difficulty, prerequisite mastery, days since practice, forgetting rate, hint use, attempt count, learning gain and controlled noise. It is not sampled independently.

## Edge cases

The generator forces skipped attempts, success after practice, wrong answers at high latent ability, lucky correct answers, implausibly fast and slow responses, multiple-concept exercises, missing misconception labels and repeated registered misconceptions.

It also models operational messiness that a pilot can realistically encounter:

- different grades, learning goals, weekly availability and preferred session lengths;
- personal computers, tablets, shared phones and library computers;
- stable, intermittent and offline-sync connectivity;
- event occurrence time separate from receive time;
- controlled late events, offline batches and sparse histories, each marked in `data_quality_flags`.

The generator does not corrupt primary keys or flood the data with random nulls. Noise remains traceable so the pipeline can exclude, down-weight or investigate it instead of silently learning from bad telemetry.

All tabular outputs contain the notice `SYNTHETIC DATA — NOT REAL EDUONE DATA`; JSONL events carry a synthetic marker. `scripts/validate-synthetic-data.mjs` verifies 20 profiles, 8 concepts, 48 exercises and matching 400 attempts/events, plus the notices.
