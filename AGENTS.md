# EduRecall AI — Agent Guide

Use this file as the canonical operating guide for any AI coding agent working in this repository. Read it before changing code or making claims about the product.

## Mission

Build and demonstrate two evidence-backed loops for the STEAM for Vietnam EduOne brief:

1. Produce a level-appropriate next activity for each learner from current evidence, with an inspectable recommendation log.
2. Reduce lesson-authoring work with AI-assisted drafting while keeping a mandatory teacher-review gate before students can access content.

Optimize for a Vietnamese K-12 pilot with one course, one class and 20 learners. Treat nonprofit cost, child-data safety, explainability and reproducibility as product requirements.

## Read order

Load only the material needed for the task, in this order:

1. `STEAM_for_Vietnam_EduOne_ProblemBrief.md` — authoritative challenge requirements.
2. `README.md` — entry points, verified status and current gaps.
3. Relevant source code and tests — authoritative implementation behavior.
4. `prisma/schema.prisma` and migrations — authoritative persistence contract.
5. Relevant `docs/*.md` — rationale and operational guidance.

When documentation conflicts with executable code, report the conflict and update the stale document in the same change. Never resolve a conflict by claiming behavior that is not implemented.

## Evidence vocabulary

Use these labels consistently:

- **Implemented**: an executable code path exists.
- **Tested**: an automated test exercises the claim and passes now.
- **Demonstrated**: a live URL, video or reproducible script shows the complete user flow.
- **Measured**: a stored metric comes from a declared protocol and comparable baseline.
- **Planned**: documented but not implemented or verified.

Do not promote a claim to a stronger label without evidence. Synthetic model metrics are not evidence of educational impact.

## Architecture ownership

| Area | Source | Owns |
| --- | --- | --- |
| Web | `apps/web/` | Student/teacher UX; renders API data; never invents mastery, recommendation or AI content |
| Core API | `apps/api/` | Auth/RBAC, server scoring, transactions, persistence, review workflow and audit trail |
| Personalization | `apps/ai-service/` | BKT, forgetting, diagnosis, next-attempt signal and recommendation ranker |
| Domain knowledge | `domains/` | Concepts, prerequisites, misconceptions, diagnosis rules and safe animation templates |
| Persistence | `prisma/` | Business state and lifecycle constraints |
| Shared contracts | `packages/` | Cross-service types and schemas |

Keep these boundaries. FastAPI must not publish content or write business tables. The browser must not decide whether an answer is correct.

## Non-negotiable invariants

### Student identity and scoring

- Derive the student ID from the authenticated token, never from a trusted client field.
- Score attempts on the server with an approved answer key.
- Preserve idempotency across retries and reject cross-user idempotency collisions.
- Keep learner-concept state isolated by student and concept.

### Recommendation integrity

- Build recommendations from persisted learner state, recent evidence, prerequisites, actual goal and actual time budget.
- Store model/rule version, input signals, candidate scores, selected target and human-readable reasons.
- Resolve a recommendation target to a real lesson, exercise, game or published content record before presenting it as actionable.
- Label deterministic fallback separately from AI-service output.
- Return `UNKNOWN` or `NEED_MORE_EVIDENCE` when a misconception rule lacks evidence.

### Human-reviewed content

- Treat provider output as untrusted structured data.
- Require a `VERIFIED` source for grounded generation.
- Allow only registered slide types and animation templates; never render provider JavaScript or raw HTML.
- Enforce `DRAFT → IN_REVIEW → APPROVED → PUBLISHED`.
- Return only `PUBLISHED` content from student endpoints.
- Move edited approved content to `REVISION_REQUIRED`.
- Retain version, reviewer, timestamps, decision and audit history.

### Claims and metrics

- Label `LOCAL_TEMPLATE` as a deterministic zero-cost authoring provider, not an LLM.
- Label the checked-in learner dataset and model artifact as synthetic.
- Compare authoring time only between lessons of matched scope; never compare a short remediation with the 40–50 hour complete-lesson baseline.
- Record generation latency, active editing time, review time, reject/override rate, correction rate, reuse and provider cost separately.
- Do not claim dropout reduction or pedagogical effectiveness from the 20-learner synthetic prototype.

### Child-data safety

- Minimize fields sent to external providers and exclude direct identifiers.
- Keep external-provider training disabled by policy for pilot data.
- Require consent/assent, retention/deletion procedures and tenant isolation before real learner data.
- Never use model output for grades, discipline, admission or exclusion.

## Working workflow

1. Inspect `git status` and preserve unrelated changes.
2. State the requirement and the observable acceptance criterion.
3. Trace the full path through web, API, AI service and database before editing.
4. Add or update the smallest test that would fail without the change.
5. Implement the smallest complete vertical slice.
6. Run the proportional verification matrix below.
7. Update README/docs only with verified behavior and current counts.
8. Report remaining limitations explicitly.

For hackathon-readiness reviews, use `.agents/skills/audit-edurecall/SKILL.md`.

## Verification matrix

Run clean installation first when validating reproducibility:

```bash
npm ci
```

If it fails, report clean-clone verification as failed. Do not hide the failure by silently changing the lockfile or using a different installer. For local diagnosis only, an alternative install may be used if clearly disclosed.

Run the relevant commands:

```bash
npm run lint
npm run typecheck
npm run test
npm run ai:test
npm run validate:synthetic
npm run ai:evaluate
npm run validate:assets
npm run test:e2e
npm run build
```

Database-backed changes also require:

```bash
npm run db:check
```

Then run `scripts/smoke-product.ps1` against a provisioned test database. A schema-only test is not evidence that the end-to-end product flow works.

## Test expectations by change

| Change | Minimum evidence |
| --- | --- |
| Recommendation formula or target | Python unit test plus API persistence/target-resolution test |
| Student isolation or auth | API integration test with at least two users |
| Review state machine | Transition tests plus proof student cannot fetch non-published content |
| Content provider | Parser/validator tests, failure case and provider label |
| Prisma schema | Migration review, schema validation and database integration test |
| README or metric claim | Command output, live link, stored measurement or exact code path |

## Definition of done

A task is complete only when:

- the requested behavior works through its real boundary, not only in a mock UI;
- tests cover the important success and failure path;
- no invariant above is weakened;
- clean-clone or environment limitations are disclosed;
- relevant documentation matches current code and test counts;
- every public claim can be traced to a file, test, live demo or declared measurement.

