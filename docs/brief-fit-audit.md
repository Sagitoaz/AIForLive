# Đối chiếu hiện trạng với STEAM for Vietnam EduOne

Ngày rà soát: 19/07/2026. Khi tài liệu và code khác nhau, code/test/database verifier là nguồn hành vi có thẩm quyền. Dataset và model artifact hiện tại là synthetic.

## Kết luận

Hai vòng lặp chính đã **Implemented**, **Tested** và **Demonstrated** trên API/Supabase:

1. Attempt → server grading → AI/fallback analysis → state/diagnosis → recommendation/evidence/target → review schedule.
2. VERIFIED source → structured draft → author edit → independent review → publish → student-safe projection.

Prototype giải đúng phần kỹ thuật của brief. Những claim về giảm dropout, learning outcome, tiết kiệm thời gian bài hoàn chỉnh hoặc khả năng triển khai production cho dữ liệu trẻ em vẫn là **Planned**, không phải kết quả đã đo.

## Requirement matrix

| Yêu cầu | Nhãn bằng chứng | Bằng chứng hiện tại | Khoảng trống |
| --- | --- | --- | --- |
| Recommendation phù hợp từng học sinh gần thời gian thực | **Demonstrated** | Live attempt đọc profile/state/goal/time/prerequisite; FastAPI phân tích; API resolve target và lưu run/evidence | Chưa benchmark 20 phiên đồng thời hoặc đo usefulness với học sinh thật |
| Recommendation log giải thích được | **Tested** | Input/output, candidate log, reason, rule/model version, attempt evidence và target resolution được persist/test | Cần rubric giáo viên chấm explanation usefulness |
| Target là nội dung thật | **Tested** | Chỉ `ACTIVE Exercise/Lesson` hoặc `PUBLISHED MicroLesson` cùng scope | Cần regression chạy trên deployment sau mỗi dataset release |
| Mã giả chấm ý tưởng, không đề cao syntax | **Demonstrated** | `IDEA_RUBRIC`, `syntaxPolicy=IGNORE`, advisory FastAPI, server recompute và labeled fallback | Cần teacher calibration rubric và disagreement analysis |
| Thực hành ghép code | **Tested** | Workspace block order; server reject missing/duplicate/foreign IDs và chấm accepted order | Chưa có usability study kéo/thả trên thiết bị yếu |
| AI hỗ trợ tạo full lesson/remediation | **Demonstrated (owner-observed)** với external LLM; local deterministic provider vẫn là fallback riêng | VERIFIED source; live `DeepSeek-V4-Flash` draft có 1938 tokens, 7s, trace; structured slide/quiz/animation và review gate | Cần lưu video/Network artifact trong hồ sơ submission để bên thứ ba tái kiểm chứng |
| Human review trước publish | **Demonstrated** | Author/last editor không tự approve; student chỉ đọc `PUBLISHED`; audit/version/review history | Production identity/tenant governance chưa hoàn tất |
| Teacher flow dễ hiểu | **Implemented/Tested** | Wizard 3 bước, workflow bar, role-aware actions, source/course scoping, larger controls, typecheck/build | Cần observed task-completion/usability evidence |
| Tiếng Việt/K-12 | **Implemented** | UI, fixture course, rubric, narration, reason và quiz tiếng Việt; animation allowlist | Cần giáo viên EduOne thẩm định theo độ tuổi |
| Pilot 1 course/1 class/20 learners | **Tested** synthetic | Seed/verifier: 4 modules, 12 lessons, 36 resources, 60 exercises, 20 enrollments | Consent và dữ liệu EduOne thật chưa có |
| Nhiều account demo/role handoff | **Demonstrated** | 20 student + OWNER/INSTRUCTOR/REVIEWER, searchable login, `DEMO_MODE` gate | Production phải tắt demo endpoint/password |
| Pilot roadmap và nonprofit cost | **Implemented** | 6-week roadmap, zero-paid-provider template, per-job cost/reuse/edit/review tracking | Chưa có observed unit cost, partner sign-off hoặc funding owner |
| Live URL/video | **Demonstrated (owner-observed)** / video **Planned** | Chủ dự án đã chạy External LLM, student TTS và pseudocode feedback trên Render | URL hiện hành chưa được pin trong repo; cần incognito check và video không cắt |
| Public repository | **Demonstrated** | `https://github.com/Sagitoaz/AIForLive`, Linux CI đã chạy clean install/test/build | Kiểm tra lại visibility/link từ máy không đăng nhập trước submission |

## Anti-pattern audit

| Anti-pattern | Kết quả |
| --- | --- |
| Chỉ chạy tốt trên dữ liệu mẫu sạch | Fixture có sparse/uneven profile, device/connectivity flags, 400 histories và 20 linked evidence; vẫn công khai là synthetic |
| AI content đi thẳng đến học sinh | Bị chặn bởi source gate, schema/allowlist validator, state machine và independent reviewer |
| Demo là slideshow/mock UI | Live E2E và smoke ghi/read Supabase; FastAPI thực thi BKT/forgetting/diagnosis/ranking/rubric |
| Phụ thuộc paid API đắt tiền | Core personalization không dùng LLM; `LOCAL_TEMPLATE` là zero-paid-provider deterministic path; external generation có cost trace |

## Trust boundary audit

- Browser không quyết định correctness, mastery, diagnosis hoặc recommendation.
- FastAPI không publish và không ghi business tables.
- Provider output không được render như HTML/JS và không tự chuyển trạng thái.
- Student identity lấy từ token; course/class/source/content reads dùng object authorization.
- Reviewer có quyền review nhưng không đọc hàng learner định danh.
- RLS bật và public client roles không có table privileges; đây là API-only, không phải Supabase client-direct architecture.

## Claims được phép dùng

- “Implemented server-side grading và per-student recommendation log.”
- “Tested 75 Node tests, 23 Python tests và một live HTTP E2E.”
- “Demonstrated full Supabase product flow bằng smoke script.”
- “Measured model metrics trên synthetic artifact và generation metadata của phiên prototype.”
- “Planned consented pilot để đo usefulness, teacher time và learning outcomes.”

## Claims không được dùng

- “Đã giảm dropout/tăng mastery của học sinh thật.”
- “Đã tiết kiệm X% hoặc 40–50 giờ” khi chưa có hai complete lesson cùng scope.
- “Local Template là LLM/GenAI call.”
- “PDF/DOCX/PPTX đã được grounding” — runtime hiện chỉ nhận TXT.
- “Production-ready cho dữ liệu trẻ em” trước consent/retention/tenant-isolation/privacy review.
- “Đã đạt 90 điểm” — điểm là quyết định của giám khảo; chỉ được nói evidence-readiness tự đánh giá hiện khoảng 90/100 và nêu rõ artifact/pilot còn thiếu.

## Việc còn lại theo ưu tiên

1. Pin URL Render hiện hành trong README, chạy health/E2E/smoke trên URL đó và quay video không cắt golden path.
2. CI clean install/build trên Linux và giữ production dependency audit thành release gate.
3. Paired teacher-time study hai full lesson cùng scope, kèm correction/reject/override/cost.
4. 3–5 usability sessions và accessibility audit trên thiết bị mục tiêu.
5. Consent/assent, retention/deletion, tenant isolation, incident owner và external-provider DPIA trước real pilot.
6. Calibrate model với student/time-aware split; không auto-retrain.

Xem [Judging evidence](JUDGING-EVIDENCE.md), [demo runbook](DEMO-RUNBOOK.md), [build verification](build-verification.md) và [pilot roadmap](pilot-roadmap.md).
