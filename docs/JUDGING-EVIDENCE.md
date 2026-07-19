# Judging evidence — EduRecall AI

Ngày cập nhật: 19/07/2026. Tài liệu này dùng đúng năm nhãn bằng chứng của dự án: **Implemented**, **Tested**, **Demonstrated**, **Measured** và **Planned**.

Điểm dưới đây là tự đánh giá mức sẵn sàng của hồ sơ, không phải điểm bảo đảm từ ban giám khảo. Với bằng chứng hiện có, mức hợp lý là khoảng **88/100**. Sản phẩm đã có chiều sâu kỹ thuật; khoảng cách đáng kể còn lại nằm ở bằng chứng bên ngoài repository.

## Tóm tắt theo rubric

| Tiêu chí | Mức tự đánh giá | Bằng chứng mạnh nhất | Khoảng trống làm mất điểm |
| --- | ---: | --- | --- |
| Technical Implementation & Engineering Depth | **19/20** | Transactional attempt, server scoring, idempotency, object authorization, Prisma migrations/RLS, 59 API test, live E2E và smoke Supabase | `npm ci` chưa pass trên host Windows hiện tại; chưa load/concurrency test 20 phiên đồng thời |
| AI-Native Architecture & Innovation | **18/20** | BKT + forgetting + diagnosis + ranking, idea-rubric advisory, validated structured generation, versioned traces và deterministic fallback riêng | Model metrics chỉ synthetic; chưa có live external-LLM artifact trong lần kiểm chứng |
| Business Viability & Pilot Pathway | **15/20** | Scope 1 course/1 class/20 learners, cold-start fixture, provider-cost tracking, zero-paid-provider template, roadmap 6 tuần và go/no-go metrics | Chưa có partner sign-off, paired full-lesson timing, observed infra/provider cost hay teacher willingness-to-adopt |
| AI-Native UX & Design Thinking | **13/15** | Mã giả chấm ý tưởng, code-order workspace, explainability, 3-step authoring wizard, role-aware actions, trạng thái loading/error và cỡ chữ lớn hơn | Chưa có usability session/accessibility audit với học sinh và giáo viên thật |
| AI Safety, Grounding & Trust | **14/15** | Verified source gate, output validator/allowlist, independent review, no answer-key leak, learner isolation, audit/version history, synthetic disclosure | Consent/retention/tenant isolation và external-provider DPIA là gate trước pilot thật |
| Presentation, Demo & Defensibility | **9/10** | 23 account demo, scripted role handoff, live HTTP E2E và 110,4 giây smoke test hoàn chỉnh | Chưa có public URL/video được kiểm tra incognito |
| **Tổng** | **88/100** |  | Không nên tuyên bố 90+ như kết quả đã đạt trước khi bổ sung artifact bên ngoài |

## Ba việc có tác động lớn nhất để vượt mốc 90 về bằng chứng

1. Deploy một URL cố định, chạy lại `npm run test:e2e`/smoke trên URL đó và quay video 6–8 phút không cắt luồng chính.
2. Đo một bài manual và một bài AI-assisted **cùng scope**, cùng rubric, tách generation/edit/review/correction; có giáo viên ký xác nhận transcript.
3. Chạy 3–5 usability sessions và một tabletop privacy review; lưu task-completion, confusion points, accessibility issues và quyết định go/no-go.

Các việc trên cần deployment, người tham gia hoặc dữ liệu quan sát thật; repository không thể tự tạo ra bằng chứng đó một cách trung thực.

## 1. Technical Implementation & Engineering Depth

### Implemented

- Browser chỉ gửi `courseId`, `activityId`, submission và interaction metadata; API lấy identity từ JWT và answer key từ database.
- Attempt được ghi bằng transaction; retry có idempotency và cross-user collision protection.
- Recommendation resolve về `ACTIVE Exercise/Lesson` hoặc `PUBLISHED MicroLesson`; log giữ input, candidate score, target, reason, model/rule version và evidence.
- `ClassTeacherMembership` tách `OWNER`, `INSTRUCTOR`, `REVIEWER`; course/class/source/content đều kiểm tra object authorization.
- Schema/migrations có review workflow, course plan, audit/version tables và RLS cho business tables.

### Tested / Demonstrated

- [Attempt and personalization service](../apps/api/src/learning-events/learning.service.ts)
- [Exercise grader](../apps/api/src/learning-events/exercise-grader.service.ts)
- [Authorization tests](../apps/api/src/teacher/teacher.controller.spec.ts)
- [Attempt persistence tests](../apps/api/src/learning-events/learning-attempt-persistence.spec.ts)
- [Live HTTP E2E](../tests/e2e/live-personalization.test.ts)
- [Full product smoke](../scripts/smoke-product.ps1)
- 59 API tests, 11 web tests, 23 Python tests pass; production build pass.

### Defense

Nếu được hỏi “AI service có được phép ghi business state không?”, câu trả lời là không. FastAPI trả validated signals; NestJS sở hữu auth, scoring, target resolution, transaction và persistence.

## 2. AI-Native Architecture & Innovation

### Implemented

| Cơ chế | Vai trò | Trust boundary |
| --- | --- | --- |
| Bayesian Knowledge Tracing | Cập nhật mastery theo concept/học sinh | Input lấy từ persisted evidence; output được version hóa |
| Forgetting model | Ước tính retrievability/risk và lịch ôn | Không dùng làm điểm số/hình phạt |
| Domain diagnosis rules | Chỉ gắn misconception khi đủ evidence | Thiếu evidence trả unknown/need-more-evidence |
| Candidate ranker | Chọn bước tiếp theo theo gap, forgetting, error, prerequisite, goal/time | API resolve target sang record thật |
| Idea rubric evaluator | Phản hồi logic mã giả, bỏ qua syntax | Advisory ở Practice; NestJS recompute criterion score |
| Structured content provider | Draft slide/quiz/animation từ source VERIFIED | Schema + allowlist → DRAFT, không publish trực tiếp |

### Tested

- [Idea grading service](../apps/ai-service/app/services/idea_grading.py) và [tests](../apps/ai-service/tests/test_grading.py)
- [AI client validation/fallback tests](../apps/api/src/personalization/ai-client.service.spec.ts)
- [External provider parser tests](../apps/api/src/ai-generation/providers/external-llm.provider.spec.ts)
- [AI mechanisms](ai-mechanisms.md) và [model card](model-card.md)

### Measured

Artifact synthetic hiện có accuracy `0.6703`, ROC-AUC `0.5691`, Brier `0.2169`. Con số này chỉ đánh giá một artifact tổng hợp; ROC-AUC thấp là lý do phải giữ rule/ranker giải thích được và calibration gate trước pilot.

## 3. Business Viability & Pilot Pathway

### Đối tượng và giá trị

- Người dùng trực tiếp: học sinh K-12 tự học và giáo viên/tình nguyện viên sản xuất, phản biện nội dung.
- Người vận hành/mua giải pháp: tổ chức phi lợi nhuận hoặc chương trình tài trợ; không kiếm tiền từ dữ liệu trẻ em.
- Giá trị kiểm chứng cần đo: recommendation hữu ích hơn lộ trình chung và giảm **active authoring time** mà không tăng factual correction/reject rate.

### Cost controls đã triển khai

- Personalization/ranking không phụ thuộc paid LLM.
- `LOCAL_TEMPLATE` có paid-provider cost bằng 0 và luôn được gắn nhãn “deterministic, not LLM”.
- External generation lưu provider/model, token trace, generation latency và `estimatedCostUsd` theo job.
- Reuse count, edit seconds, review decision và correction history được lưu riêng.
- Có deterministic fallback cho AI-service outage; không cần trả tiền LLM để giữ core learning loop hoạt động.

### Pilot pathway

| Giai đoạn | Scope | Gate |
| --- | --- | --- |
| Week 0 | Chọn 1 course, 1 class, teacher owner/reviewer; consent/assent, retention, baseline lesson | Không có governance → không nhận dữ liệu trẻ em |
| Weeks 1–2 | Placement/evidence, recommendation log, fallback monitoring | Target-resolution 100%; không có cross-user incident |
| Weeks 3–4 | Full-lesson draft/review/reuse và delayed recall | Critical factual correction vượt ngưỡng → dừng provider |
| Weeks 5–6 | Paired analysis, interviews, cost/quality report | Chỉ mở rộng nếu safety, usefulness và cost ceiling đạt |

Xem [pilot roadmap](pilot-roadmap.md). **Planned**: partner sign-off, observed baseline/cost, willingness-to-adopt và integration estimate với EduOne identity/content APIs.

## 4. AI-Native UX & Design Thinking

### Học sinh

- Workspace mã giả nêu rõ “chấm ý tưởng, không chấm cú pháp”, có starter text, giới hạn ký tự, trạng thái đang chấm và trace strategy/fallback.
- Code-order dùng block kéo/sắp xếp, hỗ trợ ghép chương trình thay vì chỉ chọn trắc nghiệm.
- Lý do recommendation, evidence confidence và fallback được hiển thị bằng tiếng Việt.
- Quiz không lộ answer key/explanation trước khi nộp.

### Giáo viên

- Studio chia rõ “tạo bài/bài bổ trợ” và “lập kế hoạch course”.
- Wizard 3 bước: phạm vi/nguồn → mục tiêu/provider → xác nhận; course và source luôn cùng scope.
- Workflow bar giải thích bước kế tiếp; button ẩn/disable theo role và state.
- Reviewer có thể phản biện/publish nhưng không xem hàng dữ liệu định danh học sinh.
- Cỡ chữ/spacing/form controls đã tăng; loading, empty, error và dirty states được diễn đạt rõ.

### Tested

- [Practice workspace tests](../apps/web/features/student/practice-workspaces.spec.tsx)
- [Retry-safe pending attempt tests](../apps/web/features/student/pending-attempt.spec.ts)
- Web typecheck/build pass.

## 5. AI Safety, Grounding & Trust

| Guardrail | Evidence |
| --- | --- |
| Source grounding | Chỉ source `VERIFIED`; source có checksum, preview, verifier và chunks |
| Untrusted provider output | Structured parser, registered slide/animation types, no raw JS/HTML |
| Human review | `DRAFT → IN_REVIEW → APPROVED → PUBLISHED`; author/last editor không tự approve |
| Student projection | Chỉ `PUBLISHED`; answer key/provider cost/internal trace bị loại khỏi DTO |
| Identity/isolation | JWT-derived user, course/class authorization, reviewer không xem learner rows |
| Auditability | Version, reviewer, timestamps, decision, audit log, prompt/model/rule version |
| Synthetic transparency | Fixture/model histories có nhãn synthetic/model-only, no-future-evidence verifier |
| Provider privacy | Không gửi direct learner identifiers; external training disabled theo policy pilot |
| DB boundary | RLS bật, public client roles bị revoke; API thực hiện object authorization |

Không claim production-safe cho dữ liệu trẻ em trước khi hoàn tất consent/assent, retention/deletion, tenant isolation, incident handling và legal/privacy review.

## 6. Presentation, Demo & Defensibility

### Demonstrated

`scripts/smoke-product.ps1` đã pass trên Supabase trong 110,4 giây với chuỗi:

```text
progress
→ registered animation
→ pseudocode IDEA_RUBRIC
→ deterministic answer/diagnosis
→ evidence-backed recommendation
→ independent content review/publish
→ student-safe projection
→ course-plan revision/re-review/publish
```

`tests/e2e/live-personalization.test.ts` pass 1/1 và xác nhận HTTP response cùng persisted analysis/real target.

### Demo assets

- [Demo runbook](DEMO-RUNBOOK.md)
- [Build verification](build-verification.md)
- [Seed verifier](../prisma/verify-seed.ts)
- Swagger: `/api/docs`; FastAPI docs: `/docs`

### Câu hỏi phản biện nên chuẩn bị

1. **“Local Template có phải AI không?”** — Không. Đây là deterministic zero-cost provider; AI-native value chính nằm ở personalization/diagnosis/ranking và optional external LLM.
2. **“AI chấm mã giả có quyết định điểm?”** — Không. Advisory feedback chỉ dùng ở Practice; server validate/recompute và không dùng cho grade/high-stakes decision.
3. **“Tại sao chưa claim giảm dropout?”** — Fixture/model là synthetic; chưa có consented counterfactual/pilot measurement.
4. **“Nếu FastAPI/LLM chết?”** — Attempt vẫn transactionally persisted; deterministic fallback được gắn nhãn; authoring vẫn có local template.
5. **“Ai chịu trách nhiệm nội dung?”** — Người review/publish được lưu cùng version/timestamp/decision; author không thể tự duyệt.
6. **“Kế hoạch course có tự thay course thật không?”** — Chưa. Publish hiện tạo artifact kế hoạch đã duyệt; apply-to-course là bước integration có kiểm soát sau pilot.
