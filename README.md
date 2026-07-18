# EduRecall AI

EduRecall AI is a Vietnamese-first EdTech hackathon prototype that combines evidence-based personalization with a human-reviewed structured content workflow prepared for generative providers. It ships one complete pilot domain—**Python cơ bản cho học sinh**—while keeping the learning core independent from any subject.

> **Data notice:** every learner, event, metric and model record in this repository is synthetic. It is not real EduOne or student data.

## What the prototype proves

- Bayesian Knowledge Tracing updates concept mastery after each attempt.
- A forgetting model separates current understanding from recall risk.
- Domain rules diagnose known misconceptions with inspectable evidence.
- The recommendation engine explains every action using stored thresholds and signals.
- Teachers create structured micro-lesson drafts with FPT AI `DeepSeek-V4-Flash`, edit them, approve them and publish them.
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

The NestJS auth endpoint can issue demo JWTs, but the browser selector currently switches roles locally and business endpoints are not protected by those guards yet.

## Demo story

1. Log in as Minh and open **Range Runner diagnostic**.
2. Submit the answer that includes `5` for `range(1, 5)`.
3. Inspect the `RANGE_STOP_INCLUDED` diagnosis and micro-lesson recommendation.
4. Switch to the teacher dashboard, inspect evidence, generate and edit the structured draft.
5. Approve and publish it.
6. Return as Minh, study the due review, finish its quiz and inspect the mastery before/after view.

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

Set `AI_PROVIDER=external-llm`, `EXTERNAL_LLM_BASE_URL=https://mkp-api.fptcloud.com`, `EXTERNAL_LLM_MODEL=DeepSeek-V4-Flash` and an FPT API key to enable real structured drafting. The adapter calls the OpenAI-compatible `/chat/completions` endpoint, normalizes model output, validates the lesson contract and always leaves new content in `DRAFT`. `LocalTemplateProvider` remains the zero-key fallback. Narration uses browser `SpeechSynthesis` by default; generated audio can later be cached behind `ExternalTtsProvider`.

## Model lifecycle

`generate_synthetic_data.py` creates 20 learner personas, 48 exercises and 400 attempts with a fixed seed. `train_models.py` uses a group split by student to avoid row leakage and exports a small logistic-regression artifact. See `docs/model-card.md`; this model is for prototype behavior only and must never be used for grading, discipline or high-stakes decisions.

## Deployment and security

Docker Compose is suitable for a local judge demo. Before production, rotate secrets, terminate TLS at a gateway, make the AI service private, move uploaded files to object storage, add a managed queue, connect provider-specific moderation, and complete a child-data privacy review. Draft content is never visible through student endpoints.

## Known limitations

- The NestJS runtime currently uses an in-process demo store; the Prisma/Supabase schema is not yet wired into request handlers.
- FPT AI drafting requires an active account/quota; the browser demo falls back to `LocalTemplateProvider` if the external request fails.
- JWT/RBAC building blocks exist, but the web flow and business controllers do not enforce them yet.
- Synthetic model quality does not establish effectiveness on real learners.
- File extractors expose validated adapters and demo text extraction; production OCR and malware scanning need managed services.
- Browser speech quality varies by OS and installed Vietnamese voices.
- The source ZIP excludes dependencies and database volumes by design.

See `docs/brief-fit-audit.md` for the requirement-by-requirement status, `docs/run-local-and-supabase.md` for the two database setup choices, `docs/pilot-roadmap.md` for the 4–6 week pilot and `docs/demo-script.md` for the judge walkthrough.
