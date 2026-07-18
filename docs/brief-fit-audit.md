# Đối chiếu dự án với brief STEAM for Vietnam / EduOne

Ngày rà soát: 18/07/2026. Phạm vi kết luận là source code và demo local hiện tại; không phải kết quả pilot trên học sinh thật.

## Kết luận ngắn

Dự án **đủ tốt để chạy một prototype demo local có tương tác**, gồm cá nhân hóa, giải thích recommendation, sinh structured draft thật bằng FPT AI và cổng human review có phân quyền. Dự án **chưa sẵn sàng để tuyên bố hoàn thành toàn bộ brief hoặc chạy pilot thật** vì API chưa lưu vào PostgreSQL/Supabase, chưa có cơ chế identity/RLS production, và chưa có live URL/video công khai.

## Requirement matrix

| Yêu cầu | Trạng thái | Bằng chứng hiện có | Khoảng trống |
| --- | --- | --- | --- |
| Recommendation theo từng học sinh, gần thời gian thực | Đạt ở mức demo | FastAPI chạy BKT, forgetting, diagnosis và recommendation sau mỗi attempt; mastery được tách theo `studentId + conceptCode` | State vẫn ở memory; chưa chứng minh độ trễ/tải với 20 học sinh thật |
| Recommendation log giải thích được | Đạt ở mức demo | Log có candidate signals, rule, attempt ID, model version, reasons và đích cụ thể gồm activity/phase/thời lượng; teacher có màn hình evidence chain | Chưa lưu bền vững vào `PersonalizationRun`/audit tables |
| AI hỗ trợ tạo bài/course | Đạt ở mức prototype | FPT AI `DeepSeek-V4-Flash` sinh draft tiếng Việt có 3 pha; nguồn TXT phải được xác minh, output được chuẩn hóa/validate và có local fallback | Chưa chứng minh chất lượng trên nhiều môn hoặc đo đủ quy trình 40–50 giờ ngoài pilot |
| Human review trước publish | Đạt ở mức demo | State machine `DRAFT → APPROVED → PUBLISHED`; student endpoint chỉ trả bản `PUBLISHED`; generate/review/publish yêu cầu JWT vai trò `TEACHER`, còn micro-lesson yêu cầu `STUDENT` | Demo auth vẫn dùng account/secret cố định; chưa có identity provider, token revocation hay RLS production |
| Tiếng Việt tự nhiên cho K-12 | Đạt ở mức demo | UI và prompt dùng tiếng Việt đơn giản; draft FPT có objective, narration và quiz | Cần giáo viên chấm rubric ngôn ngữ/độ tuổi trên nhiều bài trước pilot |
| Pilot 1 course, 1 class, 20 students | Đạt ở dữ liệu synthetic | Seed có 1 khóa 6 tuần/12 bài/84 hoạt động, 1 lớp, 20 học sinh; validator kiểm tra 20 students, 8 concepts, 48 model exercises và 400 attempts/events | Chưa có dữ liệu EduOne thật; chỉ được dùng synthetic trước consent |
| Đo giảm thời gian soạn bài | Một phần | UI đo generation time và teacher workflow time thật trong phiên demo | Brief nêu 40–50 giờ cho một bài hoàn chỉnh; micro-lesson 5 phút chưa phải mẫu tương đương để tính phần trăm giảm |
| Explainable AI architecture | Đạt | `docs/ai-architecture.md`, `docs/recommendation-explainability.md`, model card và audit UI | Cần cập nhật khi thay model/provider hoặc nối dữ liệu thật |
| Pilot roadmap 1–2 trang | Đạt | `docs/pilot-roadmap.md` mô tả scope, tuần, metric, privacy và retraining gate | Cần EduOne xác nhận owner, lịch, consent và success thresholds |
| Prototype live URL hoặc video | Chưa đạt | Demo local chạy được | Chưa có deployment URL/video bàn giao |
| Public GitHub repo | Chưa xác minh | Source có Git history và cấu trúc repo | Chưa có URL public được cung cấp/kiểm tra trong phiên này |

## Kiểm tra các anti-pattern

- **Chỉ chạy trên clean sample data:** đã chủ động thêm profile khác thiết bị/kết nối và event gửi muộn, offline batch, sparse history, phản hồi quá nhanh/chậm có quality flags. Vẫn cần test duplicate/out-of-order thật, malformed code submission và tải đồng thời trước pilot.
- **AI content đi thẳng tới học sinh:** đã chặn bằng state machine, student endpoint chỉ đọc `PUBLISHED`, và API teacher/student có JWT role guards. Trước pilot vẫn cần kiểm thử integration với identity provider và RLS thật.
- **Mockup/slideshow, không có AI thật:** không mắc ở demo local; personalization chạy thật và content workflow đã gọi FPT AI thật, sau đó chuẩn hóa/validate đầu ra.
- **Phụ thuộc hoàn toàn vào paid API:** không mắc; FPT AI là provider mặc định nhưng `LocalTemplateProvider` vẫn là fallback không cần khóa. Pilot cần thêm quota/cost log theo bảng giá thực tế.

## Việc ưu tiên trước khi nộp hoặc pilot

1. Nối NestJS với Prisma/Supabase cho attempt, student-concept state, recommendation log, generated content, version và audit trail; thêm integration test chống lẫn state giữa hai học sinh.
2. Thay demo credential/secret bằng identity production (ví dụ Supabase Auth), bổ sung refresh-token revocation và thiết kế RLS hay khóa PostgREST khỏi client.
3. Chạy phép đo trước/sau trên hai bài hoàn chỉnh cùng phạm vi; không suy ra mức giảm từ timer micro-lesson hiện tại.
4. Thử robustness với dữ liệu bẩn và concurrency; theo dõi FPT quota, cost, fallback/error/override rate.
5. Tạo commit, public GitHub, deployment URL hoặc video demo có recommendation log và luồng draft-review-publish.

## Bằng chứng xác minh hiện tại

Verification cuối đã qua lint, TypeScript, Prisma schema validation, 28 Node unit tests, 1 E2E workflow test, 17 Python tests, synthetic-data validation, model evaluation, asset validation và production build. Luồng E2E đi qua attempt → recommendation target → grounded draft → approve → publish → student quiz → reuse. Xem `docs/build-verification.md` và `docs/run-local-and-supabase.md` để chạy lại.

Model metrics hiện dùng synthetic data và ROC-AUC chỉ khoảng 0.5691; không được trình bày như bằng chứng tác động giáo dục hay chất lượng production.

`npm audit --omit=dev` tại ngày rà soát còn hai advisory mức moderate do Next.js 16.2.10 khóa PostCSS 8.4.31; không có advisory production mức high/critical. Không dùng `npm audit fix --force` vì npm đề xuất hạ Next xuống một major cũ. Cần nâng theo bản Next chính thức khi dependency này được cập nhật.
