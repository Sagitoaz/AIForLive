# Chạy local và chuẩn bị Supabase

Tài liệu này tách rõ hai việc: chạy demo hiện tại không cần database và chuẩn bị schema/seed trên Supabase để kiểm tra PostgreSQL. Hai việc đó chưa phải là một luồng tích hợp hoàn chỉnh.

## Trạng thái runtime hiện tại

- Web lưu tiến trình demo trong `localStorage` để giám khảo vẫn đi được luồng khi API tắt.
- NestJS API lưu attempt, mastery và generated content trong `DemoStoreService` bằng bộ nhớ tiến trình. Restart API hoặc gọi `POST /api/health/demo-reset` sẽ xóa phần dữ liệu này.
- FastAPI thực thi BKT, forgetting, diagnosis, next-attempt prediction và recommendation; service không kết nối business database.
- Prisma schema và migration mô tả PostgreSQL đích, nhưng NestJS runtime **chưa khởi tạo PrismaClient và chưa đọc/ghi các bảng đó**.

Vì vậy, tạo database trên Supabase không tự động làm API chuyển từ `demo-memory-ready` sang database. Đây là giới hạn có chủ đích cần giữ minh bạch khi demo.

## Chạy demo không Docker và không database

Yêu cầu: Windows PowerShell, Node.js 20.9+, npm 10+ và Python 3.11+.

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\setup-demo.ps1
npm run dev
```

Script setup sẽ kiểm tra phiên bản, tạo `.env` từ `.env.example` nếu cần, cài Node/Python dependencies và validate asset. Nó không khởi động Docker, không migrate và không seed database.

Mở một cửa sổ PowerShell thứ hai sau khi cả ba service đã báo sẵn sàng:

```powershell
.\scripts\smoke-demo.ps1
```

Smoke test yêu cầu Web, NestJS và FastAPI đều đang chạy. Nó reset demo memory rồi gọi HTTP theo chuỗi:

`attempt → recommendation → generate DRAFT → approve → publish → student read → quiz`.

Nếu một service chưa chạy, script dừng với tên service, URL và lệnh khởi động cần dùng. Kết quả smoke này xác nhận integration HTTP của demo-memory mode, không xác nhận PostgreSQL.

Các URL mặc định:

- Web: <http://localhost:3000>
- NestJS Swagger: <http://localhost:4000/api/docs>
- FastAPI Swagger: <http://localhost:8001/docs>

## Chạy PostgreSQL local bằng Docker

Luồng đầy đủ hiện có vẫn dùng được khi cần kiểm tra migration/seed với PostgreSQL local:

```powershell
.\scripts\setup.ps1
npm run dev
```

Lưu ý: ngay cả sau khi local PostgreSQL được migrate và seed, API hiện vẫn phục vụ `DemoStoreService`; database mới chỉ được xác nhận ở mức schema và seed.

## Chuẩn bị Supabase hosted PostgreSQL

1. Tạo một Supabase project dành riêng cho dữ liệu synthetic.
2. Copy `.env.supabase.example` thành `.env`.
3. Lấy PostgreSQL connection string trong Supabase dashboard và thay toàn bộ placeholder. URL-encode ký tự đặc biệt trong password và giữ `sslmode=require`.
4. Đổi hai JWT secret thành hai chuỗi ngẫu nhiên khác nhau.
5. Chọn **chính xác một** trong hai cách tạo schema bên dưới.

Ứng dụng hiện chỉ xem Supabase là hosted PostgreSQL. Nó chưa dùng Supabase Auth, anon key, Storage hay client SDK.

### Cách A — chạy SQL trong Supabase SQL Editor

Dùng cách này nếu muốn paste script SQL có sẵn:

1. Mở file `prisma/migrations/202607180001_init/migration.sql`, paste vào SQL Editor của project/schema mới và chạy một lần.
2. Mở file `prisma/migrations/202607180002_product_learning_flow/migration.sql`, paste và chạy sau khi migration đầu đã thành công.
3. Kiểm tra cả hai lần chạy không có statement lỗi.
4. Chạy seed bằng Prisma từ máy local:

```powershell
npm install
npm run db:seed
```

Migration SQL tạo schema nhưng không chứa demo rows. `prisma/seed/index.ts` mới tạo 1 course, 1 class, 20 students, 8 concepts, 12 lessons, 36 learning resources và 84 exercises.

Script migration không idempotent: enum/table không có `IF NOT EXISTS`. Không paste lại trên cùng schema. Chạy SQL thủ công cũng không tạo lịch sử `_prisma_migrations`; vì vậy không chạy tiếp `npm run db:setup` trên database đó nếu chưa thực hiện một quy trình Prisma baseline có chủ đích.

### Cách B — để Prisma quản lý migration

Dùng cách này nếu muốn Prisma ghi migration history:

```powershell
npm install
npm run db:setup
npm run db:seed
```

Trong cách này, không paste `migration.sql` trong SQL Editor trước. `prisma/schema.prisma` đọc cả `DATABASE_URL` và `DIRECT_URL`; URL direct phải cho phép DDL để Prisma triển khai migration. URL-encode ký tự đặc biệt trong password.

### Không trộn hai cách

| Database mới | Thao tác đúng |
| --- | --- |
| SQL Editor | Paste `0001`, rồi `0002`, sau đó chỉ chạy seed |
| Prisma | `db:setup`, sau đó `db:seed` |

Nếu paste SQL rồi chạy `db:setup`, Prisma không biết migration đã được áp dụng và có thể thử tạo lại enum/table. Nếu `db:setup` rồi paste SQL, SQL cũng sẽ lỗi vì object đã tồn tại.

## Checklist kiểm tra database

Sau migration và seed, chạy các truy vấn read-only sau trong Supabase SQL Editor:

```sql
select count(*) as organizations from "Organization";
select count(*) as courses from "Course";
select count(*) as classes from "Class";
select count(*) as students from "StudentProfile";
select count(*) as concepts from "LearningConcept";
select count(*) as lessons from "Lesson";
select count(*) as resources from "LearningResource";
select count(*) as exercises from "Exercise";
```

Kết quả seed mong đợi lần lượt là `1, 1, 1, 20, 8, 12, 36, 84`. Tiếp tục kiểm tra:

- `npm exec -- prisma validate --schema prisma/schema.prisma` chạy thành công;
- `npm run db:seed` có thể chạy lại mà không nhân đôi các record dùng `upsert`;
- mọi row đều là synthetic, không nhập dữ liệu học sinh thật;
- API health vẫn báo `dependencies.database = demo-memory-ready` — đây là kết quả mong đợi của code hiện tại, không phải bằng chứng API đã nối Supabase;
- restart API làm mất attempt/content vừa tạo trong UI/API demo, trong khi seed rows trên Supabase vẫn còn;
- chưa dùng kết quả Supabase để tuyên bố per-student persistence cho đến khi có Prisma repository và integration test thật.

## Việc cần làm trước khi gọi là Supabase-integrated

NestJS cần một Prisma module/service và transaction cho luồng attempt: tạo `LearningEvent`/`Attempt`, đọc `StudentConceptState` và recent history đúng học sinh, gọi FastAPI, rồi lưu diagnosis, concept history, recommendation/evidence, review schedule và `PersonalizationRun`. Content workflow cũng cần lưu generation job, versions, teacher editing time, review và audit actor.

Migration hiện tạo bảng trong schema `public` và chưa bật Row Level Security. Web hiện chỉ gọi NestJS, nên trước pilot cần chặn truy cập PostgREST bằng anon/authenticated role hoặc thiết kế RLS phù hợp; tuyệt đối không đưa direct database password hay service credentials vào biến `NEXT_PUBLIC_*`.

Sau khi wiring Prisma, thêm một integration test riêng xác nhận một attempt của Minh tạo đúng rows trên Supabase test project và không làm thay đổi concept state của Lan.
