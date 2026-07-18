# EduRecall AI

EduRecall AI là sản phẩm học Python bằng tiếng Việt cho học sinh K-12, tập trung vào hai bài toán của EduOne:

- cá nhân hóa lộ trình theo năng lực, mục tiêu và bằng chứng học tập của từng học sinh;
- hỗ trợ giảng viên soạn bài bằng AI, nhưng luôn qua bước kiểm duyệt trước khi xuất bản.

## Sản phẩm hiện có

- 1 khóa **Python cơ bản cho học sinh**, 1 lớp và 20 hồ sơ học sinh pilot trên Supabase.
- 4 mô-đun, 12 bài học; mỗi bài gồm Lý thuyết, Thực hành và Kiểm tra cuối bài.
- 36 học liệu, 60 bài tập có đáp án đã duyệt và 5 câu đánh giá đầu vào.
- AI ghi nhận attempt, chẩn đoán lỗ hổng, cập nhật mastery và tạo recommendation có bằng chứng giải thích.
- AI soạn micro-lesson từ nguồn đã xác minh; nội dung đi qua `DRAFT → APPROVED → PUBLISHED`.
- 4 hoạt động luyện tập dạng game nhẹ, vẫn ưu tiên mục tiêu học tập.
- Bài đã hoàn thành luôn có thể mở lại để ôn tập.

## Kiến trúc chạy thật

```text
Next.js web :3000
       |
NestJS API :4000 ───── Supabase PostgreSQL
       |
FastAPI AI :8001
```

Supabase là nguồn dữ liệu nghiệp vụ duy nhất cho cả localhost và deploy. API dừng ngay nếu thiếu `DATABASE_URL` hoặc không kết nối được database. Không có memory store, seed/reset demo hay fallback dữ liệu nghiệp vụ trong trình duyệt.

## Chạy local

Yêu cầu Node.js 20.9+, npm 10+ và Python 3.11+.

```powershell
npm install
npm run ai:install
npm run db:check
npm run dev
```

- Web: <http://localhost:3000>
- API docs: <http://localhost:4000/api/docs>
- AI docs: <http://localhost:8001/docs>

Tài khoản pilot:

| Vai trò | Email | Mật khẩu |
| --- | --- | --- |
| Giảng viên | `teacher@edurecall.local` | `Demo@123` |
| Học sinh | `minh@edurecall.local` | `Demo@123` |

Chạy kiểm thử tích hợp khi ba service đang hoạt động:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/smoke-product.ps1
```

Smoke test thực hiện toàn bộ luồng trên Supabase: auth → course/exercise → attempt → AI diagnosis/recommendation → AI draft → teacher review → publish.

## AI và kiểm duyệt

FastAPI nhận bằng chứng học tập có giới hạn, chạy luật chẩn đoán và mô hình mastery/forgetting, sau đó NestJS lưu cả kết quả lẫn phiên bản/đầu vào giải thích vào Supabase. Với soạn bài, `LocalTemplateProvider` là chế độ AI có cấu trúc, chi phí bằng 0; có thể chuyển sang LLM tương thích OpenAI qua biến môi trường. Dù dùng provider nào, nội dung mới không thể đến học sinh nếu chưa được giảng viên duyệt và xuất bản.

AI Voice dùng endpoint TTS phía server khi cấu hình nhà cung cấp. Nếu chưa có quota TTS, trình duyệt có thể đọc tiếng Việt để minh họa, nhưng đây không phải nguồn dữ liệu học tập.

## Lệnh chính

| Lệnh | Mục đích |
| --- | --- |
| `npm run dev` | Chạy web, API và AI service |
| `npm run db:check` | Kiểm tra transaction/session pooler Supabase |
| `npm run db:setup` | Áp dụng migration mới đã được kiểm tra |
| `npm run lint` | Kiểm tra mã nguồn |
| `npm run typecheck` | Kiểm tra TypeScript |
| `npm run test` | Chạy unit test |
| `npm run build` | Build production |

## Giới hạn pilot

- Dữ liệu 20 học sinh là dữ liệu mô phỏng không đồng đều để demo, không phải dữ liệu trẻ em thật và không chứng minh hiệu quả sư phạm.
- TXT được lưu và chia đoạn trong Supabase; PDF/DOCX/PPTX cần Supabase Storage cùng worker OCR/extraction trước khi bật.
- Tích hợp LLM/TTS bên ngoài cần tài khoản và quota; workflow kiểm duyệt không phụ thuộc một API trả phí duy nhất.
- Trước pilot thật cần bật RLS/tenant isolation, chính sách quyền riêng tư trẻ em, giám sát chi phí và đánh giá của giáo viên.

Đọc [cơ chế AI](docs/ai-mechanisms.md), [hướng dẫn Supabase](docs/run-local-and-supabase.md), [pilot roadmap](docs/pilot-roadmap.md) và [kịch bản demo](docs/demo-script.md).
