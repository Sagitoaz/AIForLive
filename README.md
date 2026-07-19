# EduRecall AI

**AI-Powered Personalization & Content Creation for self-paced learning**

Prototype cho bài toán [STEAM for Vietnam · EduOne](STEAM_for_Vietnam_EduOne_ProblemBrief.md): cá nhân hóa lộ trình học theo thời gian thực và tăng tốc soạn bài bằng AI, vẫn giữ con người kiểm duyệt trước khi học sinh tiếp cận nội dung.

> *Một học sinh lớp 6 đăng nhập, hệ thống nhận ra em đang chậm ở vòng lặp, đề xuất bài bổ trợ bằng tiếng Việt đơn giản — trong khi đội content chỉ cần chỉnh bản nháp AI thay vì soạn từ đầu.*  
> — đúng hướng giải pháp lý tưởng của đề bài.

---

## Bài toán & câu trả lời của EduRecall

| Vấn đề EduOne (theo brief) | Cách EduRecall xử lý |
| --- | --- |
| Học viên cùng một lộ trình, không phân biệt trình độ / tốc độ / mục tiêu; dropout cao | Mỗi học sinh có recommendation riêng từ BKT, forgetting, diagnosis và ranking; log giải thích đầy đủ |
| Giáo viên tình nguyện phải chỉnh nội dung thủ công cho từng lớp | Teacher studio hiển thị trạng thái lớp, recommendation log và lịch ôn theo học sinh |
| 40–50 giờ / một bài hoàn chỉnh; đội content mỏng | AI soạn draft có cấu trúc từ nguồn đã xác minh; giáo viên chỉ edit + review |
| Tổ chức phi lợi nhuận, không scale bằng nhân sự hay API đắt | Core personalization **không phụ thuộc paid LLM**; có `LOCAL_TEMPLATE` chi phí provider = 0 |
| Nội dung AI không được “lọt” thẳng tới học sinh | Bắt buộc `DRAFT → IN_REVIEW → APPROVED → PUBLISHED`; author không tự approve |

**Phạm vi pilot đúng brief:** 1 khóa Python Foundations · 1 lớp · 20 học sinh · giao diện & nội dung tiếng Việt K-12.

---

## Hai vòng lặp cốt lõi (đúng deliverable đề bài)

### 1. Cá nhân hóa theo thời gian thực — mỗi học sinh một bước tiếp theo

```text
JWT học sinh
  → server chấm attempt (answer key không rời DB)
  → FastAPI: BKT · forgetting · diagnosis · candidate ranking
  → API resolve target thật (ACTIVE exercise/lesson hoặc PUBLISHED content)
  → lưu PersonalizationRun + Recommendation + Evidence + lý do tiếng Việt
  → học sinh / giáo viên xem “vì sao đề xuất bài này”
```

**Điểm mạnh vận hành**

- Identity lấy từ token — client không gửi `studentId` đáng tin.
- Chấm điểm phía server, idempotent khi retry; chặn collision giữa hai người dùng.
- Recommendation chỉ hiện khi resolve được nội dung thật trong đúng course/concept.
- AI service lỗi → deterministic fallback **có nhãn riêng**, vòng học vẫn chạy.
- Misconception thiếu bằng chứng trả `UNKNOWN` / `NEED_MORE_EVIDENCE` — không gán nhãn bừa.

### 2. Soạn bài có AI + human review — rút ngắn thời gian, không bỏ kiểm duyệt

```text
Nguồn VERIFIED
  → Local Template hoặc External LLM (structured output)
  → schema / allowlist validator (slide, quiz, animation an toàn)
  → DRAFT → IN_REVIEW → APPROVED → PUBLISHED
  → student endpoint chỉ trả PUBLISHED
```

**Ba vai trò demo (đúng mô hình volunteer + reviewer độc lập)**

| Vai trò | Account demo | Trách nhiệm |
| --- | --- | --- |
| OWNER | `teacher@edurecall.local` | Quản lý lớp, tạo bản nháp |
| INSTRUCTOR | `thay.nam@edurecall.local` | Hỗ trợ lớp, chỉnh nội dung |
| REVIEWER | `co.linh@edurecall.local` | Phản biện, approve, publish — không xem hàng định danh học sinh |

`LOCAL_TEMPLATE` = khung soạn xác định, zero paid-provider cost, **không gắn nhãn LLM**.  
`ExternalLlmProvider` chỉ gọi khi có credential; mọi job ghi provider, model, token, latency và chi phí ước tính.

---

## Deliverables tối thiểu của brief — đã có trong repo

| Deliverable đề bài | Trong EduRecall |
| --- | --- |
| Prototype demo được | Web + API + AI service; smoke end-to-end trên Supabase; runbook 6–8 phút |
| Public GitHub repo | Mã nguồn monorepo đầy đủ, license MIT |
| Kiến trúc AI giải thích được | BKT, forgetting, diagnosis rule, weighted ranker; mỗi recommendation lưu reason + version + evidence |
| Lộ trình pilot 1–2 trang với EduOne | [docs/pilot-roadmap.md](docs/pilot-roadmap.md) — 6 tuần, go/no-go, đo thời gian soạn, privacy gate |
| Tiếng Việt / K-12 | UI, rubric, narration, quiz, recommendation reason bằng tiếng Việt tự nhiên |
| Pilot 1 course · 1 class · 20 students | Seed `pilot-v1` + verifier: 20 enrollments, 3 teacher roles, 12 lessons, 60 exercises |

Chi tiết đối chiếu đề bài: [docs/brief-fit-audit.md](docs/brief-fit-audit.md) · Bằng chứng chấm điểm: [docs/JUDGING-EVIDENCE.md](docs/JUDGING-EVIDENCE.md).

---

## Anti-pattern đề bài — EduRecall đã tránh có chủ đích

| Anti-pattern brief | Cách hệ thống xử lý |
| --- | --- |
| Chỉ chạy trên dữ liệu mẫu “sạch” | Fixture có profile thưa/không đều, 400 learning events, device & connectivity flags; pipeline vẫn ổn định |
| AI content tới học sinh không qua review | Source gate + validator + state machine + reviewer độc lập |
| Demo mockup / slideshow, không có AI thật | FastAPI chạy BKT/forgetting/diagnosis/ranking; live E2E và smoke ghi/đọc PostgreSQL |
| Phụ thuộc hoàn toàn API trả phí | Personalization core free-of-LLM; authoring có path zero-cost; cost được track theo job |

---

## AI được dùng đúng chỗ — tối ưu chất lượng, không “AI vì AI”

EduRecall tách rõ từng cơ chế, mỗi lớp một câu hỏi:

| Lớp | Câu hỏi | Cơ chế |
| --- | --- | --- |
| Knowledge tracing | Concept này học sinh nắm đến đâu? | Bayesian Knowledge Tracing |
| Forgetting | Khả năng nhớ lại lúc này? | Exponential retrievability + lịch ôn |
| Diagnosis | Lỗi quen thuộc nào có bằng chứng? | Domain rules (không bịa misconception) |
| Ranking | Bước tiếp theo nên là gì? | Weighted score: gap · forgetting · error · prerequisite · goal/time |
| Practice AI | Ý tưởng mã giả có đúng logic? | `IDEA_RUBRIC` advisory — **không chấm syntax** |
| Content AI | Làm draft nhanh nhưng an toàn? | Provider abstraction + schema + human gate |

**Nguyên tắc tối ưu cho nonprofit & học sinh**

1. **AI advisory, server quyết định** — FastAPI không publish, không ghi business table; NestJS sở hữu scoring, auth, persistence.
2. **Explainable by design** — lý do recommendation sinh từ tín hiệu đã đo, không nhờ LLM “viết giải thích sau”.
3. **Cost-aware** — path chính không bắt buộc paid API; generation trả phí là tùy chọn có metadata chi phí.
4. **Child-data ready architecture** — tối thiểu field gửi provider, tắt training ngoài, RBAC + RLS, synthetic fixture rõ nhãn trước pilot thật.
5. **Degrade gracefully** — fallback có nhãn; vòng học không sập khi AI service tạm lỗi.

Kiến trúc chi tiết: [docs/ai-architecture.md](docs/ai-architecture.md) · Explainability: [docs/recommendation-explainability.md](docs/recommendation-explainability.md).

---

## Trải nghiệm học sinh & giáo viên

### Học sinh — thực hành có chiều sâu, không chỉ trắc nghiệm

- **Mã giả / ý tưởng:** workspace tới 2.000 ký tự; rubric chấm logic, `syntaxPolicy = IGNORE` — phù hợp K-12 mới học lập trình.
- **Ghép khối code:** kéo-thả block; server kiểm tra ID và thứ tự đã duyệt — kết quả tái lập.
- **Mỗi bài demo có animation đăng ký sẵn + AI Voice từ narration đã duyệt**; quiz tiếng Việt không lộ answer key trước khi nộp.
- **Next step cá nhân hóa** kèm lý do và độ tin cậy bằng chứng.

### Giáo viên — studio gọn, workflow rõ

- Wizard 3 bước: phạm vi & nguồn → mục tiêu & provider → xác nhận.
- Workflow bar theo state; nút ẩn/disable theo role (OWNER / INSTRUCTOR / REVIEWER).
- Course-plan draft, remediation reuse, audit version/reviewer/timestamp/decision.
- So sánh recommendation giữa học sinh trong cùng lớp — thấy personalization thật, không “cùng một path”.

---

## Kiến trúc hệ thống

```text
Next.js Web (:3000)
  └── REST / JWT ── NestJS Core API (:4000)
                      ├── Auth · RBAC · server scoring · review workflow · audit
                      ├── Prisma ── Supabase PostgreSQL (+ RLS)
                      └── validated I/O ── FastAPI AI (:8001)
                                            ├── BKT + forgetting
                                            ├── diagnosis + ranking
                                            └── idea-rubric advisory
```

| Thành phần | Trách nhiệm |
| --- | --- |
| `apps/web/` | UX học sinh / giáo viên — chỉ render dữ liệu API |
| `apps/api/` | Auth, object authorization, chấm điểm, transaction, publish gate |
| `apps/ai-service/` | Personalization & grading advisory |
| `domains/` | Concept, prerequisite, misconception, diagnosis, animation template |
| `prisma/` | Schema, migrations, seed synthetic + verifier |
| `packages/` | Contract dùng chung giữa service |

Browser **không** quyết định đúng/sai hay mastery. AI service **không** được publish nội dung.

---

## Fixture pilot tái tạo được

```powershell
$env:ALLOW_SYNTHETIC_DEMO_SEED="true"
npm run db:seed
npm run db:seed:check
```

| Hạng mục | Số lượng |
| --- | ---: |
| Demo accounts | 23 (3 giáo viên + 20 học sinh) |
| Organization / domain / course / class | 1 / 1 / 1 / 1 |
| Modules · lessons · resources · exercises | 4 · 12 · 36 · 60 |
| Pseudocode IDEA_RUBRIC · CODE_ORDER | 12 · 24 |
| Concept states · synthetic histories | 160 · 400 |
| Linked events / attempts / recommendations | 20 mỗi loại |

Mật khẩu fixture: `Demo@123` · Học sinh chính: `minh@edurecall.local` · So sánh: `lan@`, `an@`, `binh@edurecall.local`.

Kịch bản demo: [docs/DEMO-RUNBOOK.md](docs/DEMO-RUNBOOK.md).

---

## Chạy local

**Yêu cầu:** Node.js ≥ 20.9 · npm ≥ 10 · Python ≥ 3.11 · PostgreSQL / Supabase.

```powershell
npm ci
npm run ai:install
npm run db:check
npm run db:setup

$env:ALLOW_SYNTHETIC_DEMO_SEED="true"
npm run db:seed
npm run db:seed:check

npm run dev
```

| Dịch vụ | URL |
| --- | --- |
| Web | http://localhost:3000 |
| API docs | http://localhost:4000/api/docs |
| AI docs | http://localhost:8001/docs |

---

## Chất lượng kỹ thuật đã kiểm chứng

```powershell
npm run lint
npm run typecheck
npm run test
npm run ai:test
npm run validate:synthetic
npm run ai:evaluate
npm run validate:assets
npm run test:e2e
powershell -ExecutionPolicy Bypass -File scripts/smoke-product.ps1
npm run build
```

| Hạng mục | Kết quả (19/07/2026) |
| --- | --- |
| Lint · typecheck · production build | Pass |
| Node tests | 75 (16 web + 59 API) |
| Python tests | 23 pytest + Ruff |
| Live HTTP E2E | Pass trên Supabase |
| Product smoke | Pass ~110s: progress → animation → pseudocode → diagnosis/recommendation → independent review → publish |
| Synthetic validation | 20 students · 8 concepts · 400 attempts/events |
| Assets | 254 SVG · 80 custom icons |
| Production dependency audit | 0 vulnerability (thời điểm kiểm tra) |

Luồng smoke chứng minh **AI thật + persistence thật + review gate thật** — không phải slideshow.

Live Render ngày 19/07/2026 đã được chủ dự án kiểm tra với External LLM (`DeepSeek-V4-Flash`, 1938 tokens, 7s, trace `b69e656a`), AI Voice trên account học sinh và phản hồi mã giả. Xem [live demo evidence](docs/live-demo-evidence.md) để phân biệt owner-observed runtime evidence với automated tests và artifact còn cần lưu trước submission.

---

## An toàn & tin cậy (phù hợp giáo dục K-12)

- Chỉ source `VERIFIED` mới đưa vào generation; output provider là dữ liệu không tin cậy.
- Không render JavaScript / raw HTML từ model; animation chỉ template đã đăng ký.
- Student projection loại answer key, cost nội bộ và trace nhạy cảm.
- RLS bật; API vẫn object-authorize theo course / class / role.
- Không dùng model output cho điểm số chính thức, kỷ luật hay tuyển sinh.
- Pilot thật cần consent/assent, retention/deletion và privacy review — roadmap đã nêu rõ gate.

Xem [docs/security.md](docs/security.md).

---

## Lộ trình pilot với EduOne

Tóm tắt [docs/pilot-roadmap.md](docs/pilot-roadmap.md):

| Giai đoạn | Trọng tâm |
| --- | --- |
| Tuần 0 | Chọn cohort, baseline soạn bài thủ công, consent, owner/reviewer |
| Tuần 1–2 | Placement, recommendation log, fallback monitoring |
| Tuần 3–4 | Full-lesson draft/review, remediation reuse, delayed recall |
| Tuần 5–6 | So sánh before/after thời gian soạn (cùng scope), willingness-to-adopt, go/no-go |

Đo thời gian tách generation latency · active edit · review · correction/reject — không gộp nhầm remediation ngắn với baseline 40–50 giờ của bài hoàn chỉnh.

---

## Tài liệu cho giám khảo & partner

| Tài liệu | Nội dung |
| --- | --- |
| [STEAM_for_Vietnam_EduOne_ProblemBrief.md](STEAM_for_Vietnam_EduOne_ProblemBrief.md) | Đề bài gốc |
| [docs/JUDGING-EVIDENCE.md](docs/JUDGING-EVIDENCE.md) | Claim → evidence theo rubric |
| [docs/brief-fit-audit.md](docs/brief-fit-audit.md) | Ma trận khớp yêu cầu brief |
| [docs/DEMO-RUNBOOK.md](docs/DEMO-RUNBOOK.md) | Script demo 6–8 phút |
| [docs/ai-architecture.md](docs/ai-architecture.md) | Kiến trúc AI giải thích được |
| [docs/recommendation-explainability.md](docs/recommendation-explainability.md) | Vì sao đề xuất bài X |
| [docs/pilot-roadmap.md](docs/pilot-roadmap.md) | Pilot 1 course · 1 class · 20 learners |
| [docs/architecture.md](docs/architecture.md) | Boundary web / API / AI / domain |
| [docs/security.md](docs/security.md) | Child-data & trust boundary |
| [docs/deploy-render.md](docs/deploy-render.md) | Triển khai Render |

---

## Tóm lại

EduRecall AI không chỉ “có AI”, mà **đặt AI đúng chỗ** trong hai vòng lặp EduOne đang cần:

1. **Real-time personalization** có log, có target thật, có fallback — demo được trên 20 hồ sơ pilot.
2. **AI-assisted authoring** có grounding, có human review, có path chi phí thấp cho nonprofit.

Cấu trúc monorepo rõ boundary, test/smoke/E2E chạy được, tiếng Việt sẵn cho K-12, và roadmap pilot đủ ngắn để EduOne triển khai từng bước có go/no-go.

**MIT License** — xem [LICENSE](LICENSE).
