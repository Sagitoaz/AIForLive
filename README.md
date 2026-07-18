# EduRecall AI

EduRecall AI is a Vietnamese-first EdTech hackathon prototype that combines evidence-based personalization with a human-reviewed structured content workflow prepared for generative providers. It ships one complete pilot domain—**Python cơ bản cho học sinh**—while keeping the learning core independent from any subject.

> **Data notice:** every learner, event, metric and model record in this repository is synthetic. It is not real EduOne or student data.

## What the prototype proves

- Bayesian Knowledge Tracing updates concept mastery after each attempt.
- A forgetting model separates current understanding from recall risk.
- Domain rules diagnose known misconceptions with inspectable evidence.
- The recommendation engine returns a concrete lesson/activity target and explains the choice using stored thresholds, candidate signals, attempt IDs and model/rule versions.
- The pilot course contains 4 modules and 12 realistic lessons; every lesson has Theory, Practice and Checkpoint phases.
- Teachers create grounded three-phase lesson or remediation drafts with FPT AI `DeepSeek-V4-Flash`, edit them, approve them and publish them.
- Uploaded TXT sources must be reviewed before generation; binary documents stay honestly marked as pending extraction.
- Published content can be reused for learners with the same misconception without another provider call.
- The app works without a paid AI key through an explicitly labelled `LocalTemplateProvider`.

## Architecture

```text
Next.js web (3000) -> NestJS core API (4000) -> FastAPI personalization (8001)
                               |
                     DemoStoreService (current)
                               |
          Prisma/PostgreSQL target schema (not wired to runtime yet)
                               |
                    LLM/TTS provider abstractions
```

NestJS currently owns demo business state in process memory. The target design moves that state to Prisma/PostgreSQL. FastAPI receives a bounded analysis contract and never writes business tables. If FastAPI is unavailable, NestJS records the attempt in demo memory and returns deterministic fallback analysis rather than failing the learning flow.

## Stack

- Next.js 16, React 19, TypeScript strict, Tailwind CSS, Framer Motion, Recharts, DnD Kit
- NestJS 11, Prisma, PostgreSQL, JWT, Swagger/OpenAPI
- FastAPI, Pydantic, NumPy, pandas, scikit-learn, joblib
- Jest/Vitest and pytest/ruff
- Docker Compose and Windows PowerShell automation

## Quick start — Windows PowerShell

Prerequisites: Node.js 20.9+, Python 3.11+ and npm 10+. Docker Desktop is needed only for the local PostgreSQL path.

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\setup-demo.ps1
npm run dev
```

After all three services are ready, run the full HTTP smoke flow in a second PowerShell window:

```powershell
.\scripts\smoke-demo.ps1
```

Open:

- Web: <http://localhost:3000>
- API docs: <http://localhost:4000/api/docs>
- AI docs: <http://localhost:8001/docs>

This quick path does not require Docker or a database. The current NestJS demo runtime stores attempts and generated content in process memory, so restarting the API clears them. See `docs/run-local-and-supabase.md` before preparing Supabase or interpreting a smoke result as database integration.

The root scripts are PowerShell-safe; they never use POSIX `VARIABLE=value command` syntax.

## Local PostgreSQL setup — Docker

```powershell
Copy-Item .env.example .env
npm install
npm run ai:install
docker compose up -d postgres
npm run db:setup
npm run ai:data
npm run ai:train
npm run db:seed
npm run dev
```

## Demo accounts

| Role | Email | Password |
| --- | --- | --- |
| Teacher | `teacher@edurecall.local` | `Demo@123` |
| Student Minh | `minh@edurecall.local` | `Demo@123` |
| Student Lan | `lan@edurecall.local` | `Demo@123` |

The browser account selector signs in through NestJS and stores a short-lived demo access token. Student learning/diagnostic endpoints and teacher content, class and recommendation endpoints enforce JWT role guards; submitted learning events are bound to the student identity in the token.

## Demo story

1. As a teacher, open **Nội dung AI** and generate lesson 8 from the verified Python handbook source; inspect its Theory–Practice–Checkpoint plan.
2. Edit the draft, approve it and publish it. New AI content never starts as student-visible.
3. As Minh, open **Khóa học**, inspect the 4-module/12-lesson syllabus and enter lesson 8.
4. Move through theory, practice and checkpoint; submit the answer that incorrectly includes `5` for `range(1, 5)`.
5. Inspect the `RANGE_STOP_INCLUDED` diagnosis, exact remediation target and recommendation log.
6. Return to the teacher studio, create a seven-minute remediation from that evidence, review and publish it; then complete it as Minh.

The browser retains the demo workflow in local storage, and uses the API when it is available. This allows UI judging even before Docker is started while preserving the full API integration path.

## Commands

| Command | Purpose |
| --- | --- |
| `.\scripts\setup-demo.ps1` | Install and validate the no-database demo path |
| `.\scripts\smoke-demo.ps1` | Exercise the live Web/API/FastAPI content workflow over HTTP |
| `npm run dev` | Run web, API and AI service together |
| `npm run db:setup` / `npm run db:seed` | Migrate and seed PostgreSQL |
| `npm run ai:data` / `ai:train` / `ai:evaluate` | Reproduce the prototype model |
| `npm run lint` / `typecheck` / `test` | Quality checks |
| `npm run verify` | Full verification gate |
| `npm run package` | Build a clean source ZIP |

## AI provider and TTS

Set `AI_PROVIDER=external-llm`, `EXTERNAL_LLM_BASE_URL=https://mkp-api.fptcloud.com`, `EXTERNAL_LLM_MODEL=DeepSeek-V4-Flash` and an FPT API key to enable real structured drafting. The adapter calls the OpenAI-compatible `/chat/completions` endpoint, normalizes model output, validates the lesson contract and always leaves new content in `DRAFT`. `LocalTemplateProvider` remains the zero-key fallback. Vietnamese narration is generated through the server-only `/api/tts/speech` proxy using `FPT.AI-VITs` and voice `std_kimngan`; WAV responses are cached in API memory and browser speech is only a final fallback.

## Model lifecycle

`generate_synthetic_data.py` creates 20 learner personas, 48 exercises and 400 attempts with a fixed seed. Profiles vary in grade, goal, device, shared-device access and connectivity. Events include traceable late/offline/sparse cases instead of unrealistically clean data. `train_models.py` uses a group split by student to avoid row leakage and exports a small logistic-regression artifact. See `docs/model-card.md`; this model is for prototype behavior only and must never be used for grading, discipline or high-stakes decisions.

## Deployment and security

Docker Compose is suitable for a local judge demo. Before production, rotate secrets, terminate TLS at a gateway, make the AI service private, move uploaded files to object storage, add a managed queue, connect provider-specific moderation, and complete a child-data privacy review. Draft content is never visible through student endpoints.

## Known limitations

- The NestJS runtime currently uses an in-process demo store; the Prisma/Supabase schema is not yet wired into request handlers.
- FPT AI drafting requires an active account/quota; the browser demo falls back to `LocalTemplateProvider` if the external request fails.
- Core student and teacher workflows enforce demo JWT/RBAC. This is not production identity: secrets, refresh-token storage/revocation, per-tenant authorization and PostgreSQL/Supabase RLS still need to be completed.
- Synthetic model quality does not establish effectiveness on real learners.
- TXT upload, checksum, preview and teacher verification work in the prototype. PDF/DOCX/PPTX are accepted only into `PENDING_EXTRACTION`; production extraction, OCR and malware scanning still need managed workers.
- Browser speech quality varies by OS and installed Vietnamese voices.
- The source ZIP excludes dependencies and database volumes by design.

See `docs/product-blueprint.md` for the product scope and flows, `docs/ai-mechanisms.md` for the complete AI runtime explanation, `docs/design-research.md` for the evidence behind key decisions, `docs/brief-fit-audit.md` for requirement status, `docs/run-local-and-supabase.md` for database setup, `docs/pilot-roadmap.md` for the 4–6 week pilot and `docs/demo-script.md` for the judge walkthrough.
