# AI architecture

EduRecall uses several different mechanisms and names each one accurately.

| Layer | Question | Mechanism |
| --- | --- | --- |
| Knowledge tracing | How well is the concept understood? | Bayesian Knowledge Tracing |
| Forgetting | How likely is recall now? | Replaceable exponential model |
| Scheduler | When should the learner review? | Target-recall interval rule |
| Diagnosis | What known error pattern has evidence? | Domain rules, bounded fallback |
| Next attempt | What is the next-answer probability? | Logistic regression artifact |
| Recommendation | What activity should happen next? | Weighted deterministic scoring |
| Content | How can a draft be produced? | Provider abstraction + schema |

## Bayesian Knowledge Tracing

Each student-concept state tracks prior mastery, transition, guess and slip parameters. Observation confidence is reduced for hints, repeated attempts, extreme difficulty, implausibly fast responses and skipped attempts. The posterior is blended by confidence and clamped; one answer cannot force mastery to 0 or 1.

## Forgetting

The current prototype computes `retrievability = exp(-elapsedDays / adjustedStability)`. Recall quality and consecutive successful reviews increase stability; recent failures reduce it. The interface can later use FSRS without changing the API.

## Diagnosis

Registered deterministic rules run first. A rule returns a misconception code, confidence, rule ID and evidence. A future model or LLM fallback may only select codes from the registry and may return `UNKNOWN` or `NEED_MORE_EVIDENCE`.

## Recommendation

The priority score is:

`0.35 × knowledgeGap + 0.25 × forgettingRisk + 0.20 × recentErrorRate + 0.10 × prerequisiteImportance + 0.10 × courseRelevance`.

Actions use explicit thresholds and retain all signals. Reasons are templates filled from those signals; an LLM does not invent them.

## Content generation

Sources are extracted, chunked and retrieved before generation. A provider returns 3–5 structured slides, narration, a registered animation template and one quiz. Validators reject scripts, raw HTML, remote URLs, invalid answer indices and missing source references. Output stays `DRAFT` until teacher review.

## Failure mode

NestJS records attempts before calling FastAPI. If the bounded call fails, it calculates a deterministic result, marks `FALLBACK_ANALYZED` and shows “Personalization fallback mode” in the UI. Analysis can later be retried without duplicating the event.
