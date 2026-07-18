# Build verification

- Ngày kiểm chứng: 2026-07-18
- Node: v24.13.0
- Python: 3.12.0
- Kết quả: **PASSED**

## Ma trận kiểm chứng

| Hạng mục | Kết quả | Bằng chứng |
| --- | --- | --- |
| Node lint | PASS | Web và API ESLint |
| TypeScript | PASS | Tất cả workspace strict typecheck |
| API unit test | PASS | 4 suites, 7 tests |
| Web unit test | PASS | 2 files, 5 tests |
| Python AI lint/test | PASS | Ruff sạch, 17 pytest pass |
| Production build | PASS | NestJS build và Next.js build, 9 route |
| Supabase connectivity | PASS | Transaction pooler và session pooler đều `OK` |
| Prisma migrations | PASS | 3/3 migration; `202607180003_course_plan_drafts` đã áp dụng trên Supabase |
| Product smoke test | PASS | Progress → animation → attempt → recommendation → lesson review → course-plan revision/publish |
| Idempotency | PASS | Gửi lại cùng key trả đúng cùng attempt, không nhân đôi dữ liệu |
| AI attempt latency | PASS | Cùng flow range: 10,491 ms trước → 7,574 ms sau tối ưu transaction |

## Dữ liệu Supabase sau kiểm thử

| Nhóm | Số lượng |
| --- | ---: |
| Người dùng / lớp / khóa học | 21 / 1 / 1 |
| Enrollment | 20 |
| Bài học / học liệu / bài tập | 12 / 36 / 60 |
| Game học tập | 4 |
| Animation spec riêng theo bài | 12 |
| Điểm lịch sử mastery | 444 |
| Attempt / diagnosis / recommendation | 8 / 7 / 7 |
| Nội dung AI / micro-lesson / lượt review | 2 / 2 / 4 |
| Course-plan draft đã xuất bản | 1 |

Các dòng phát sinh bởi smoke test nằm trong chính Supabase, chứng minh API không chỉ gọi database kiểm tra kết nối. Bộ pilot cố ý có học sinh học nhanh/chậm, thiếu dữ liệu, kết nối kém và lỗ hổng khác nhau; không phải dữ liệu sạch lý tưởng.

Tối ưu latency trên là phép đo cục bộ cùng ngày, cùng API/Supabase và cùng loại attempt; không phải SLA production. UI vẫn hiển thị operation state và chặn submit lặp vì độ trễ mạng đến region Supabase có thể dao động.

## Giới hạn chưa được che giấu

- Kết quả mô hình hiện dựa trên dữ liệu mô phỏng; cần hiệu chỉnh lại bằng dữ liệu pilot có đồng thuận.
- Live LLM/TTS phụ thuộc credential và quota của nhà cung cấp. `LocalTemplateProvider` bảo đảm quy trình soạn bài có cấu trúc vẫn chạy với chi phí thấp.
- Tệp nhị phân chưa được nhận giả là đã xử lý; PDF/DOCX/PPTX cần Storage và worker extraction/OCR.
- Trước khi dùng dữ liệu trẻ em thật cần hoàn thiện RLS, tenant isolation, retention và privacy review.
