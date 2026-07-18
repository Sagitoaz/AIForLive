# Cơ chế AI và dữ liệu của EduRecall

Ngày cập nhật: 18/07/2026. Tài liệu mô tả code runtime hiện tại, không mô tả mockup.

## 1. Phân chia trách nhiệm

- Next.js chỉ hiển thị dữ liệu API và gửi hành động của người dùng. Không tự tạo mastery, recommendation hoặc AI draft.
- NestJS xác thực JWT, kiểm tra quyền, chấm bằng answer key đã duyệt, quản lý transaction và human-review state machine.
- FastAPI là lõi AI cá nhân hóa: knowledge tracing, forgetting, misconception diagnosis, dự đoán lần làm tiếp theo và chọn hoạt động.
- Supabase PostgreSQL là nguồn dữ liệu duy nhất cho user, course, attempt, concept state, recommendation, content và audit.
- Provider nội dung tạo structured JSON tiếng Việt từ nguồn VERIFIED. Giáo viên phải duyệt trước khi publish.

## 2. Đánh giá đầu vào và tạo lộ trình

1. API lấy 5 exercise có `metadataJson.placement = true` từ khóa học trên Supabase.
2. Học sinh trả lời; response được ghi trong một `LearningEvent` loại `DIAGNOSTIC`.
3. Server so đáp án với `answerJson.acceptedAnswers`; client không được gửi cờ đúng/sai có hiệu lực.
4. Mỗi concept nhận mastery khởi điểm có điều chỉnh theo độ khó; kết quả được lưu vào `StudentConceptState` và `ConceptStateHistory`.
5. `PersonalizationRun` lưu input/output và version `placement-v1`; lộ trình dùng state này để chọn trọng tâm.

Placement dùng quy tắc có thể giải thích để tránh cho LLM tự chấm kiến thức. Sau khi có lịch sử, FastAPI tiếp quản cập nhật thời gian thực.

## 3. Cá nhân hóa sau mỗi attempt

Luồng transaction:

```text
JWT student
  → lấy Exercise + answer key + Enrollment từ Supabase
  → server chấm đáp án
  → ghi LearningEvent(PENDING_ANALYSIS) + Attempt
  → gọi FastAPI với mastery/stability/retrievability, history, progress,
    prerequisite mastery, mục tiêu, quỹ thời gian, difficulty/hint/response time
  → ghi Diagnosis + Recommendation + Evidence
  → cập nhật StudentConceptState + History + ReviewSchedule
  → ghi PersonalizationRun và ANALYZED/FALLBACK_ANALYZED
```

FastAPI kết hợp:

- Bayesian Knowledge Tracing để cập nhật xác suất nắm vững;
- exponential forgetting để ước tính retrievability/forgetting risk;
- domain rule để nhận diện misconception có bằng chứng, ví dụ `RANGE_STOP_INCLUDED`;
- logistic regression prototype để ước tính xác suất đúng ở lần tiếp theo;
- ranker có trọng số cho knowledge gap, forgetting risk, lỗi gần đây, prerequisite, mục tiêu và quỹ thời gian.

Output luôn có `reasons`, `candidateScores`, model/rule version và target semantic. Trước khi lưu, NestJS resolve target này sang ID của `PUBLISHED MicroLesson`, `ACTIVE Exercise` hoặc `ACTIVE Lesson` đúng course/concept; mapping và semantic ID ban đầu được ghi trong `targetResolution`. Nếu FastAPI tạm lỗi, deterministic fallback chạy ở NestJS, được gắn nhãn `DETERMINISTIC_FALLBACK` và vẫn lưu Supabase; UI không giả nó là model result.

AI tự điều chỉnh thứ tự/target trong lộ trình từng học sinh bằng `Recommendation` và `ReviewSchedule`; hệ thống không nhân bản toàn bộ course. Nếu cần bài mới, AI tạo một `GeneratedContent` dùng lại theo concept/misconception, giáo viên duyệt rồi mới gắn cho người phù hợp.

## 4. AI hỗ trợ giảng viên tạo khóa học và bài học

Đây là luồng riêng với personalization và có hai nhánh trong cùng Teacher Studio.

### 4.1. Tổ hợp lộ trình khóa học từ nhu cầu lớp

1. Giảng viên chọn lớp pilot, khóa nguồn, khối lớp, số tuần và mục tiêu.
2. `LOCAL_CATALOG_PLANNER` đọc catalog đang hoạt động trên Supabase: module, lesson, concept, prerequisite, resource và exercise.
3. Mỗi lesson nhận `selectionScore` từ mức khớp mục tiêu, prerequisite, thứ tự module và độ phủ ba pha.
4. Planner bổ sung bài tiên quyết, giữ thứ tự kiến thức, chia các đoạn lesson liên tiếp theo tuần và lưu `candidateLog`.
5. Kết quả được lưu vào `CoursePlanDraft` ở trạng thái `DRAFT`, không ghi đè course gốc.
6. Giảng viên có thể đổi brief, chuyển/bỏ bài giữa các tuần và lưu version. Sửa bản `APPROVED` tự động đưa về `REVISION_REQUIRED`.
7. Workflow bắt buộc là `DRAFT → IN_REVIEW → APPROVED → PUBLISHED`; mọi chuyển trạng thái có review history và audit log.

Planner catalog là thuật toán chi phí 0, xác định và giải thích được; không được trình bày như LLM. Nhánh `EXTERNAL_LLM` dành cho việc soạn nội dung ngôn ngữ khi có credential, còn quyết định publish luôn thuộc giáo viên.

### 4.2. Soạn bài học từ tài liệu đã xác minh

1. Giảng viên tải TXT; API lưu `ContentSource` và `SourceChunk` trên Supabase.
2. Giảng viên xác minh nguồn; chỉ `VERIFIED` được dùng.
3. API tạo `AiGenerationJob` chứa provider, prompt version và source checksum; khi external LLM trả về, job lưu thêm model, prompt/completion token count, prompt hash, thời gian và cost estimate.
4. Provider sinh JSON: mục tiêu, 3 pha, slides, narration, animation template và quiz.
5. Validator chặn output sai schema, raw JavaScript/HTML nguy hiểm và quiz không hợp lệ.
6. Draft được lưu vào `GeneratedContent`, `MicroLesson`, `MicroLessonSlide`, `GeneratedQuiz`, `ContentVersion` với trạng thái `DRAFT`.
7. Giáo viên sửa → gửi review → `APPROVED` → `PUBLISHED`; sửa một bản đã approve sẽ tạo vòng `REVISION_REQUIRED` mới. Mỗi lần lưu ghi thêm thời gian của phiên chỉnh sửa để so sánh với generation time mà không giả định kết quả pilot.
8. Student endpoint chỉ trả content `PUBLISHED`.

`LocalTemplateProvider` là provider không tốn paid API và vẫn tạo nội dung thật có cấu trúc. `ExternalLlmProvider` có thể dùng FPT AI khi có khóa. Không có mock development provider.

## 5. Animation và AI Voice

Model không được chạy raw HTML/JavaScript. Nó chọn template an toàn như `NUMBER_SEQUENCE`, `CODE_HIGHLIGHT`, `LOOP_TIMELINE` cùng `animationData`; web render bằng component React/HTML/CSS đã đăng ký. Cách này vẫn cho trải nghiệm sinh động nhưng giảm XSS và nội dung ngoài kiểm soát. Cả 12 bài trong khóa Python hiện có một animation spec riêng trên Supabase; bài bổ trợ `range()` có bốn slide animation và ba câu củng cố.

Narration đã duyệt được gửi tới endpoint TTS. Server ưu tiên FPT.AI-VITs khi có cấu hình; Web Speech `vi-VN` là phương án đọc cuối. Voice không thay đổi nội dung hay kết quả học tập.

## 6. Supabase đang lưu gì

- danh tính, role, profile, lớp và enrollment;
- 4 module, 12 bài, 36 resource và 60 exercise có answer key đã duyệt;
- 20 hồ sơ pilot không đồng đều, có missing/sparse history và kết nối không ổn định;
- learning event, attempt, diagnosis, mastery/current history;
- recommendation, evidence, lịch ôn và personalization run;
- source, AI job, draft, phiên bản giáo viên, review và publish audit;
- course-plan draft, catalog snapshot, AI draft, teacher plan, candidate log và review history;
- game session, XP, badge và leaderboard setting.

API fail-fast nếu `DATABASE_URL` thiếu hoặc Supabase không sẵn sàng. Không có `DemoStore`, localStorage business state, seed hoặc reset endpoint.

## 7. Hiệu năng và tính nhất quán UI

- GET trùng nhau trong cùng thời điểm được hợp nhất; cache bộ nhớ 12 giây chỉ giảm request lặp, không thay Supabase làm business truth.
- Dashboard tối thiểu được tải trước; course, lesson, chart và heatmap đồng bộ nền với skeleton rõ ràng.
- Mutation/AI operation khóa nút điều hướng và submit bằng một operation overlay để không gửi nhiều attempt/draft trùng nhau.
- Attempt dùng idempotency key và unique constraint. Đọc state/history và ghi attempt chạy song song; bảy bản ghi kết quả AI được commit trong một batch transaction.
- Sau khi server trả kết quả chấm, các dashboard signal được refresh nền nên học sinh thấy phản hồi trước, không phải đợi tải lại toàn bộ trang.

## 8. Vai trò của Python service

Python service là lõi của vấn đề cá nhân hóa trong brief. NestJS vẫn giữ quyền quyết định nghiệp vụ vì model không được ghi thẳng database hoặc tự publish nội dung. Đây là phân lớp an toàn, không làm AI kém “cốt lõi”.

Hạn chế còn lại trước pilot thật: model đang được đánh giá bằng synthetic training artifact; cần consent, calibration từ dữ liệu pilot, fairness review, latency/load test 20 học sinh, teacher override/reject metrics và không retrain tự động từ dữ liệu trẻ em khi chưa có governance.

## 9. File code chính

- Supabase/Prisma: `apps/api/src/database/`, `prisma/schema.prisma`
- Attempt transaction: `apps/api/src/learning-events/learning.service.ts`
- Placement: `apps/api/src/learning-events/diagnostics.controller.ts`
- Python AI client: `apps/api/src/personalization/`
- AI service: `apps/ai-service/app/`
- Content workflow: `apps/api/src/generated-content/`
- Course planner: `apps/api/src/teacher/course-plan.service.ts`
- Trạng thái bài học: `apps/api/src/students/lesson-progress.service.ts`
- Animation renderer an toàn: `apps/web/components/learning-animation.tsx`
- Product state API-only: `apps/web/features/product/product-context.tsx`
