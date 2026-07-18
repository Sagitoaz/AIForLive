# Chạy local với Supabase

Localhost và bản deploy dùng cùng một kiến trúc: Next.js → NestJS → Supabase PostgreSQL và FastAPI. Không có memory store, seed/reset hay dữ liệu nghiệp vụ dự phòng trong trình duyệt.

## 1. Biến môi trường

Tệp `.env` bắt buộc có:

- `DATABASE_URL`: transaction pooler cho API runtime;
- `DIRECT_URL`: session pooler cho Prisma migration;
- `JWT_ACCESS_SECRET` và `JWT_REFRESH_SECRET`;
- `WEB_URL` và `AI_SERVICE_URL`.

Không commit `.env`. Kiểm tra kết nối bằng:

```powershell
npm run db:check
```

Kết quả hợp lệ có `TRANSACTION_POOLER=OK` và `SESSION_POOLER=OK`. API cũng chạy `SELECT 1` khi khởi động và fail-fast nếu Supabase không sẵn sàng.

## 2. Chạy sản phẩm

```powershell
npm install
npm run ai:install
npm run dev
```

- Web: `http://localhost:3000`
- API: `http://localhost:4000/api/docs`
- Python AI: `http://localhost:8001/docs`

Tài khoản pilot trên Supabase:

- học sinh: `minh@edurecall.local` / `Demo@123`
- giảng viên: `teacher@edurecall.local` / `Demo@123`

Mọi thay đổi từ localhost được ghi vào Supabase và sẽ xuất hiện trên bản deploy khi cùng dùng một project/database.

## 3. Kiểm thử end-to-end

Khi cả ba service đang chạy:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/smoke-product.ps1
```

Script kiểm tra auth từ bảng `User`, tải khóa học/bài tập thật, ghi attempt, gọi Python AI, đọc recommendation log, sinh draft từ nguồn `VERIFIED`, duyệt và publish.

## 4. Migration

Hai migration hiện tại đã được áp dụng và baseline trong bảng `_prisma_migrations` của Supabase:

- `202607180001_init`
- `202607180002_product_learning_flow`

Kiểm tra trước khi deploy:

```powershell
npx prisma migrate status --schema prisma/schema.prisma
```

Kết quả hiện tại là `Database schema is up to date!`. Với migration mới, review SQL rồi chạy `npm run db:setup`; không copy lại hai migration cũ vào SQL Editor.
