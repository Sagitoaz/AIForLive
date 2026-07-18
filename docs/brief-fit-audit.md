# Đối chiếu dự án với brief STEAM for Vietnam / EduOne

Ngày rà soát: 18/07/2026. Phạm vi kết luận là source code và demo local hiện tại; không phải kết quả pilot trên học sinh thật.

## Kết luận ngắn

Dự án **đủ tốt để chạy một prototype demo local có tương tác**, gồm cá nhân hóa, giải thích recommendation, sinh structured draft thật bằng FPT AI và cổng human review. Dự án **chưa sẵn sàng để tuyên bố hoàn thành toàn bộ brief hoặc chạy pilot thật** vì API chưa lưu vào PostgreSQL/Supabase, các khối JWT/RBAC chưa được áp dụng cho web/business endpoints hay RLS, và chưa có live URL/video công khai.

## Requirement matrix

| Yêu cầu | Trạng thái | Bằng chứng hiện có | Khoảng trống |
| --- | --- | --- | --- |
| Recommendation theo từng học sinh, gần thời gian thực | Đạt ở mức demo | FastAPI chạy BKT, forgetting, diagnosis và recommendation sau mỗi attempt; mastery được tách theo `studentId + conceptCode` | State vẫn ở memory; chưa chứng minh độ trễ/tải với 20 học sinh thật |
| Recommendation log giải thích được | Đạt ở mức demo | Log có signal, threshold, rule, attempt ID, model version và reasons; teacher có màn hình evidence chain | Chưa lưu bền vững vào `PersonalizationRun`/audit tables |
| AI hỗ trợ tạo bài/course | Đạt ở mức demo | FPT AI `DeepSeek-V4-Flash` sinh structured draft tiếng Việt; có source registry, chuẩn hóa JSON, schema validation và local fallback | Mới demo micro-lesson, chưa chứng minh sản xuất trọn một lesson/course 40–50 giờ |
| Human review trước publish | Đạt ở mức demo | State machine `DRAFT → APPROVED → PUBLISHED`; student endpoint chỉ trả bản `PUBLISHED` | Có JWT/RBAC building blocks nhưng business controllers chưa dùng guard, nên chưa xác minh actor thật là giáo viên |
| Tiếng Việt tự nhiên cho K-12 | Đạt ở mức demo | UI và prompt dùng tiếng Việt đơn giản; draft FPT có objective, narration và quiz | Cần giáo viên chấm rubric ngôn ngữ/độ tuổi trên nhiều bài trước pilot |
| Pilot 1 course, 1 class, 20 students | Đạt ở dữ liệu synthetic | Seed có 1 course, 1 class, 20 học sinh; validator kiểm tra 20 students, 8 concepts, 48 exercises, 400 attempts/events | Chưa có dữ liệu EduOne thật; chỉ được dùng synthetic trước consent |
| Đo giảm thời gian soạn bài | Một phần | UI đo generation time và teacher workflow time thật trong phiên demo | Brief nêu 40–50 giờ cho một bài hoàn chỉnh; micro-lesson 5 phút chưa phải mẫu tương đương để tính phần trăm giảm |
| Explainable AI architecture | Đạt | `docs/ai-architecture.md`, `docs/recommendation-explainability.md`, model card và audit UI | Cần cập nhật khi thay model/provider hoặc nối dữ liệu thật |
| Pilot roadmap 1–2 trang | Đạt | `docs/pilot-roadmap.md` mô tả scope, tuần, metric, privacy và retraining gate | Cần EduOne xác nhận owner, lịch, consent và success thresholds |
| Prototype live URL hoặc video | Chưa đạt | Demo local chạy được | Chưa có deployment URL/video bàn giao |
| Public GitHub repo | Chưa đạt | Source đã có cấu trúc repo | Repository hiện chưa có commit đầu tiên và chưa được push public |

## Kiểm tra các anti-pattern

- **Chỉ chạy trên clean sample data:** mới giảm rủi ro một phần. Có synthetic validator và fallback test, nhưng chưa có test dữ liệu thiếu, trùng, out-of-order, malformed code submission và tải đồng thời.
- **AI content đi thẳng tới học sinh:** đã chặn ở mức state machine và student endpoint. Cần áp dụng JWT/RBAC hiện có vào business controllers để cổng này có ý nghĩa bảo mật.
- **Mockup/slideshow, không có AI thật:** không mắc ở demo local; personalization chạy thật và content workflow đã gọi FPT AI thật, sau đó chuẩn hóa/validate đầu ra.
- **Phụ thuộc hoàn toàn vào paid API:** không mắc; FPT AI là provider mặc định nhưng `LocalTemplateProvider` vẫn là fallback không cần khóa. Pilot cần thêm quota/cost log theo bảng giá thực tế.

## Việc ưu tiên trước khi nộp hoặc pilot

1. Nối NestJS với Prisma/Supabase cho attempt, student-concept state, recommendation log, generated content, version và audit trail; thêm integration test chống lẫn state giữa hai học sinh.
2. Nối web với auth, áp dụng `AuthGuard`/`RolesGuard` vào business controllers (hoặc dùng Supabase Auth), rồi thiết kế RLS hay khóa PostgREST khỏi client.
3. Chạy phép đo trước/sau trên hai bài hoàn chỉnh cùng phạm vi; không suy ra mức giảm từ timer micro-lesson hiện tại.
4. Thử robustness với dữ liệu bẩn và concurrency; theo dõi FPT quota, cost, fallback/error/override rate.
5. Tạo commit, public GitHub, deployment URL hoặc video demo có recommendation log và luồng draft-review-publish.

## Bằng chứng xác minh hiện tại

`npm run verify` đã qua lint, TypeScript, Prisma schema validation, 19 Node tests, 17 Python tests, synthetic-data validation, model evaluation, asset validation và production build. Luồng HTTP local đã được smoke-test theo chuỗi attempt → recommendation → draft → approve → publish → student read → quiz. Xem `docs/build-verification.md` và `docs/run-local-and-supabase.md` để chạy lại.

Model metrics hiện dùng synthetic data và ROC-AUC chỉ khoảng 0.5691; không được trình bày như bằng chứng tác động giáo dục hay chất lượng production.

`npm audit --omit=dev` tại ngày rà soát còn hai advisory mức moderate do Next.js 16.2.10 khóa PostCSS 8.4.31; không có advisory production mức high/critical. Không dùng `npm audit fix --force` vì npm đề xuất hạ Next xuống một major cũ. Cần nâng theo bản Next chính thức khi dependency này được cập nhật.
