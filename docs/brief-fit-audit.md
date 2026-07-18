# Đối chiếu hiện trạng với brief STEAM for Vietnam / EduOne

Ngày rà soát: 18/07/2026. Tài liệu này mô tả đúng source và dữ liệu pilot hiện tại; không thay thế kết quả pilot trên học sinh thật.

## Kết luận

Prototype đã có hai vòng lặp cốt lõi dùng chung Supabase:

1. Học sinh làm bài → server chấm → FastAPI phân tích mastery/forgetting/misconception → NestJS liên kết đề xuất với bài học/bài tập thật → lưu log giải thích và lịch ôn.
2. Giảng viên chọn nguồn đã xác minh → AI tạo structured draft → giảng viên sửa → `DRAFT → IN_REVIEW → APPROVED → PUBLISHED` → học sinh chỉ đọc bản đã xuất bản.

Đã có cấu hình một Docker Web Service cho Render, nhưng chỉ được đánh dấu live URL sau khi deploy thành công. Dataset pilot là synthetic, không phải dữ liệu trẻ em thật.

## Requirement matrix

| Yêu cầu | Trạng thái | Bằng chứng hiện có | Khoảng trống còn lại |
| --- | --- | --- | --- |
| Recommendation theo từng học sinh gần thời gian thực | Verified ở prototype | Attempt thật gọi FastAPI; state, profile goal, quỹ thời gian, progress và prerequisite mastery được đọc từ Supabase | Chưa benchmark tải đồng thời 20 học sinh |
| Recommendation log giải thích được | Verified ở prototype | `PersonalizationRun`, `RecommendationEvidence`, candidate signals, rule/model version, reason và target resolution audit | Cần rubric giáo viên đánh giá usefulness trong pilot |
| Target là nội dung học thật | Verified ở source/test | NestJS resolve output semantic sang `PUBLISHED MicroLesson`, `ACTIVE Exercise` hoặc `ACTIVE Lesson` đúng course/concept | Cần smoke lại sau mỗi thay đổi dataset |
| AI hỗ trợ tạo bài/course | Verified theo provider được cấu hình | Draft có source reference, structured slides/animation, quiz, provider, generation time và version | Chỉ claim external LLM khi log thật ghi `EXTERNAL_LLM`; local template là fallback |
| Human review trước publish | Verified | Student endpoint chỉ đọc `PUBLISHED`; edit bản approved tạo revision cần duyệt lại; audit/version/review ở Supabase | Chưa tích hợp identity provider/RLS production |
| Tiếng Việt cho K-12 | Demo-ready | UI, Python course, narration, quiz và animation bằng tiếng Việt | Cần giáo viên EduOne chấm rubric theo độ tuổi |
| Pilot 1 course, 1 class, 20 students | Verified trên Supabase synthetic | 1 khóa, 1 lớp, 20 enrollment, 12 bài, 36 học liệu, 60 bài tập; phân bố năng lực không đồng đều | Chưa có consent và dữ liệu EduOne thật |
| Đo thời gian tạo/chỉnh bài | Verified ở mức phiên prototype | Ghi generation milliseconds và teacher editing seconds khi lưu revision | Chưa có paired baseline cho bài hoàn chỉnh 40–50 giờ |
| Explainable AI architecture | Verified trong tài liệu/source | `docs/ai-mechanisms.md`, model card và evidence UI | Cần cập nhật khi đổi model/provider |
| Pilot roadmap 1–2 trang | Verified | `docs/pilot-roadmap.md` | Cần EduOne chốt owner, lịch, consent, threshold |
| Live URL hoặc video | Pending external action | `Dockerfile.render` và `docs/deploy-render.md` sẵn sàng | Cần tạo Web Service và ghi URL/video thật |
| Public GitHub | Pending external verification | Git repository tồn tại | Chủ repo phải bật public và kiểm tra incognito |

## Anti-pattern check

- Không dùng memory store hoặc frontend mock cho dữ liệu nghiệp vụ; localhost/deploy dùng Prisma → Supabase.
- Nội dung AI không tự đến học sinh: bắt buộc human review và publish.
- Personalization có Python service thật; khi service lỗi, fallback được gắn mode riêng và vẫn lưu audit, không giả là AI service đã trả lời.
- Dataset có profile mạnh/yếu, sparse history và hành vi không đồng đều; vẫn là synthetic.
- Không claim PDF/DOCX/PPTX: pipeline grounding hiện hỗ trợ TXT; binary extraction/OCR là backlog.
- Không claim giảm dropout, tăng learning outcome hoặc tiết kiệm 93% trước pilot.

## Việc còn phải làm sau Checkpoint 2

1. Deploy Render, kiểm tra health/golden path và quay video 60–90 giây.
2. Chạy paired test hai học sinh và lưu transcript recommendation IDs/logs.
3. Đo một bài thủ công và một bài AI cùng scope bằng rubric giáo viên.
4. Trước pilot thật: Supabase Auth/RLS hoặc tenant isolation tương đương, consent, retention/deletion và incident owner.
5. Thêm browser E2E/CI, robustness malformed input, concurrency và cost/quota monitoring.

Xem `docs/build-verification.md`, `scripts/smoke-product.ps1` và `docs/deploy-render.md` để tái kiểm chứng.
