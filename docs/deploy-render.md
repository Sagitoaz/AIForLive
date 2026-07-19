# Deploy EduRecall AI bằng một Render Web Service

Tài khoản Render chỉ cần tạo **một Web Service chạy Docker**. [`Dockerfile.render`](../Dockerfile.render) đóng gói đủ ba tiến trình:

```text
Trình duyệt
    │ HTTPS, cùng origin
    ▼
Next.js :$PORT (public)
    ├── /backend-api/* → NestJS :4000 ── Supabase PostgreSQL
    └── NestJS → FastAPI :8001 ── personalization models
```

Đây là cấu hình phù hợp cho Checkpoint 2/pilot nhỏ: một URL, một cold start và không bắt buộc Blueprint hay Private Service. Khi chạy production nhiều instance, mới nên tách Web, API và AI thành ba service riêng.

Repository cũng có [`render.yaml`](../render.yaml) cho một deployment mới bằng Blueprint. Nếu service đã tồn tại, không cần tạo service thứ hai: giữ service hiện tại, đối chiếu bảng biến môi trường ở mục 3 rồi push branch đang được Render theo dõi.

## 1. Chuẩn bị

### Repository

Đẩy branch cần deploy lên GitHub. Các file bắt buộc phải có:

- `Dockerfile.render`;
- `render.yaml` (Blueprint tùy chọn);
- `.dockerignore`;
- `scripts/start-render.sh`;
- `prisma/schema.prisma` và `prisma/migrations/`;
- `apps/web`, `apps/api`, `apps/ai-service`.

Không commit `.env` hoặc API key.

### Xác nhận đúng database demo

Container chỉ chạy migration, không tự seed. Trước khi push, dùng đúng `DATABASE_URL`/`DIRECT_URL` đang cấu hình trên Render và chạy:

```powershell
npm run db:check
npm run db:seed:check
```

Kết quả phải có đúng `23 demo accounts = 3 teacher + 20 student`. Nếu đây là database demo mới và verifier báo thiếu fixture, chỉ khi đó mới chạy seed có guard:

```powershell
$env:ALLOW_SYNTHETIC_DEMO_SEED="true"
npm run db:seed
npm run db:seed:check
Remove-Item Env:ALLOW_SYNTHETIC_DEMO_SEED
```

Account picker hiện dùng mật khẩu fixture `Demo@123`; giữ đúng mật khẩu này cho database hackathon. Không chạy các lệnh trên với dữ liệu trẻ em thật.

### Hai URL kết nối Supabase

1. Mở Supabase Dashboard → project → **Connect**.
2. Chọn **Session pooler / Supavisor**, port `5432`.
3. Copy connection string và thay `[YOUR-PASSWORD]` bằng database password thật.
4. Với bản pilot một container, dùng chuỗi Session pooler đó cho cả `DATABASE_URL` và `DIRECT_URL`.

Không dùng hostname direct `db.<project-ref>.supabase.co` nếu project không có IPv4 add-on: direct endpoint mặc định dùng IPv6, còn Session pooler hỗ trợ IPv4 cho backend chạy lâu. Xem [Supabase connection guide](https://supabase.com/docs/guides/database/connecting-to-postgres) và [Supabase Prisma guide](https://supabase.com/docs/guides/database/prisma).

### JWT secrets

Chạy lệnh dưới đây hai lần và giữ hai kết quả khác nhau:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Dùng một kết quả cho `JWT_ACCESS_SECRET`, kết quả còn lại cho `JWT_REFRESH_SECRET`.

### Khóa LLM

Để demo AI soạn bài thật, chuẩn bị `EXTERNAL_LLM_API_KEY` hợp lệ cho FPT AI Marketplace. TTS mặc định dùng lại khóa này. Nếu chưa có quota, có thể đặt `AI_PROVIDER=local-template`, nhưng phải gọi đúng đó là deterministic fallback, không phải external LLM.

## 2. Tạo Web Service thủ công

1. Vào [Render Dashboard](https://dashboard.render.com/).
2. Chọn **New +** → **Web Service**.
3. Chọn **Build and deploy from a Git repository**.
4. Kết nối GitHub và chọn repository EduRecall AI.
5. Điền cấu hình:

   | Trường trên Render | Giá trị |
   | --- | --- |
   | Name | `edurecall-checkpoint-2` hoặc tên còn khả dụng |
   | Region | `Singapore` |
   | Branch | branch dùng để nộp |
   | Root Directory | để trống |
   | Language / Runtime | `Docker` |
   | Dockerfile Path | `./Dockerfile.render` |
   | Instance Type | `Free` cho thử nghiệm; paid trong buổi chấm nếu có thể |

6. Không nhập Build Command hoặc Start Command; Render dùng lệnh trong Dockerfile.
7. Mở phần **Environment Variables** và nhập bảng ở mục 3 trước khi bấm deploy.
8. Chọn **Create Web Service**.

## 3. Environment Variables

Nhập tối thiểu các biến sau:

| Key | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Supavisor Session pooler `:5432` |
| `DIRECT_URL` | Supavisor Session pooler `:5432` |
| `JWT_ACCESS_SECRET` | secret ngẫu nhiên thứ nhất |
| `JWT_REFRESH_SECRET` | secret ngẫu nhiên thứ hai |
| `JWT_ACCESS_TTL` | `15m` |
| `JWT_REFRESH_TTL` | `7d` |
| `DEMO_MODE` | `true` — chỉ cho URL hackathon dùng fixture synthetic |
| `AI_PROVIDER` | `external-llm` |
| `EXTERNAL_LLM_BASE_URL` | `https://mkp-api.fptcloud.com` |
| `EXTERNAL_LLM_MODEL` | `DeepSeek-V4-Flash` |
| `EXTERNAL_LLM_TIMEOUT_MS` | `60000` |
| `IDEA_GRADING_PROVIDER_TIMEOUT_MS` | `10000` |
| `EXTERNAL_LLM_API_KEY` | khóa thật |
| `TTS_BASE_URL` | `https://mkp-api.fptcloud.com` |
| `TTS_MODEL` | `FPT.AI-VITs` |
| `TTS_VOICE` | `std_kimngan` |
| `TTS_RESPONSE_FORMAT` | `wav` |
| `TTS_TIMEOUT_MS` | `90000` |

Nếu muốn hiển thị cost estimate, thêm `EXTERNAL_LLM_INPUT_USD_PER_MILLION` và `EXTERNAL_LLM_OUTPUT_USD_PER_MILLION` theo đúng bảng giá hiện hành của nhà cung cấp. Không tự điền một mức giá giả; token count/model/prompt hash vẫn được log khi hai rate để trống.

Không đặt `PORT`, `API_PORT`, `AI_SERVICE_URL`, `API_INTERNAL_URL` hoặc `NEXT_PUBLIC_API_URL`. Hãy xóa các key này nếu chúng còn sót lại từ kiến trúc nhiều service cũ:

- Render tự cấp `PORT` cho Next.js;
- Dockerfile giữ NestJS ở `4000` và FastAPI ở `8001` trong cùng container;
- browser gọi `/backend-api`, Next.js tự proxy sang NestJS;
- nhờ same-origin, CSP/CORS không phụ thuộc hostname Render.

Script khởi động ép các cổng nội bộ về `4000/8001` để biến cũ không thể làm lệch health check. Upload nguồn ở prototype được giới hạn cố định 15 MiB trên server; `MAX_UPLOAD_MB` không phải biến runtime.

Nếu có khóa TTS riêng, thêm `TTS_API_KEY`. Nếu không, server dùng `EXTERNAL_LLM_API_KEY`. Tên cũ `EXTERNAL_TTS_API_KEY` vẫn được nhận để redeploy không gián đoạn, nhưng nên đổi sang `TTS_API_KEY`.

`DEMO_MODE=true` công khai danh sách account synthetic và chỉ phù hợp cho buổi chấm. Chuyển thành `false` trước mọi pilot dùng danh tính thật.

## 4. Health check và auto deploy

Sau khi service được tạo:

1. Vào **Settings**.
2. Tìm **Health Check Path** và đặt:

   ```text
   /backend-api/health
   ```

3. Giữ **Auto-Deploy = Yes** nếu muốn mỗi lần push lên branch đều deploy lại.
4. Save Changes.

Health endpoint thực hiện `SELECT 1` trên Supabase; deploy chỉ được coi là sẵn sàng khi DB kết nối được.

## 5. Theo dõi lần deploy đầu

Trong tab **Logs**, thứ tự bình thường là:

1. `npm ci` và `prisma generate`;
2. build NestJS và Next.js production;
3. cài Python runtime dependencies;
4. `prisma migrate deploy`;
5. Uvicorn ở `127.0.0.1:8001`;
6. NestJS log `api_started`, port `4000`;
7. Next.js lắng nghe `0.0.0.0:$PORT`;
8. health check trả 200.

`prisma migrate deploy` là idempotent và chỉ áp dụng migration đã review; nó không seed/reset hoặc tạo dataset demo.

Lần build đầu có thể lâu vì image chứa cả Node, Python và model dependencies. Không hủy khi log vẫn đang cài package.

## 6. Kiểm tra URL sau deploy

Giả sử URL là:

```text
https://edurecall-checkpoint-2.onrender.com
```

Kiểm tra theo thứ tự:

1. `https://.../backend-api/health` phải trả `status: "ok"` và `database: "supabase-postgresql-ready"`.
2. `https://.../backend-api/docs` phải mở Swagger NestJS.
3. `https://.../backend-api/auth/demo-accounts` phải trả đúng 23 hồ sơ synthetic.
4. URL gốc phải mở màn hình đăng nhập và hiển thị `20` học sinh, `3` giảng viên.
5. Đăng nhập tài khoản pilot đang tồn tại trên Supabase.
6. Học sinh: khóa học → Practice → nộp câu mã giả → kiểm tra grading trace là external provider hoặc fallback được ghi nhãn rõ.
7. Giảng viên: chọn nguồn `VERIFIED` → tạo draft → xác nhận provider `EXTERNAL_LLM` → sửa → gửi duyệt → approve → publish.
8. Quay lại phía học sinh để xác nhận chỉ nội dung `PUBLISHED` mới xuất hiện.

Chạy smoke test trực tiếp vào bản deploy bằng PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/smoke-product.ps1 `
  -ApiUrl "https://edurecall-checkpoint-2.onrender.com/backend-api"
```

Smoke test ghi attempt, recommendation, content version/review và course-plan draft thật vào Supabase. Chỉ chạy trên project pilot, không chạy trên dữ liệu trẻ em thật.

Hoặc chạy live E2E tự động (test được skip rõ ràng nếu chưa truyền URL):

```powershell
$env:E2E_API_URL="https://edurecall-checkpoint-2.onrender.com/backend-api"
npm run test:e2e
Remove-Item Env:E2E_API_URL
```

## 7. Bằng chứng nên dùng khi nộp

Dùng dữ liệu có thể truy ngược, không sửa JSON hoặc tự điền số đẹp:

- live URL và `/backend-api/health`;
- recommendation có attempt ID, model version, candidate signals và reasons;
- hai học sinh có history khác nhau nhận output/log khác nhau;
- draft có provider `EXTERNAL_LLM`, source reference và generation time;
- sau khi giảng viên sửa, `teacherEditingSeconds` tăng và version mới được lưu;
- workflow `DRAFT → IN_REVIEW → APPROVED → PUBLISHED`;
- record tương ứng trong `LearningEvent`, `PersonalizationRun`, `Recommendation`, `GeneratedContent`, `ContentVersion`, `ContentReview` trên Supabase.

Chỉ gọi generation/editing time là **measurement của phiên prototype**. Không claim giảm dropout, hiệu quả học tập hoặc tiết kiệm 40–50 giờ trước khi có pilot so sánh thật.

## 8. Lỗi thường gặp

### `P1001` hoặc không kết nối được Supabase

- Đổi direct hostname IPv6 sang Supavisor Session pooler `:5432`.
- Kiểm tra password và ký tự đặc biệt đã URL-encode.
- Resume project nếu Supabase đang paused, rồi **Manual Deploy → Deploy latest commit**.

### Health check fail

Tìm lỗi trước dòng `api_started`. Thường do `DATABASE_URL`, `DIRECT_URL` hoặc migration. Hai URL cần cùng truy cập đúng project/schema.

### Web mở được nhưng API lỗi

Xóa biến `NEXT_PUBLIC_API_URL` nếu từng tự thêm. Client phải dùng `/backend-api`; không được trỏ tới `localhost:4000` trên browser production.

### AI soạn bài báo thiếu khóa

Vào **Environment**, kiểm tra `AI_PROVIDER=external-llm` và `EXTERNAL_LLM_API_KEY`, sau đó chọn **Save, rebuild, and deploy**.

### Mở lần đầu mất gần một phút

Render Free spin down sau 15 phút không có request và cần thời gian thức lại. Mở live URL trước phần chấm 5–10 phút và chạy golden path một lượt. Xem [Render Free service limits](https://render.com/docs/free#spinning-down-on-idle). Nếu buổi chấm cho phép chi phí, nâng instance trong ngày demo để tránh cold start.

### Upload mất sau restart

Filesystem Free là ephemeral. Dữ liệu nghiệp vụ/chunk đã xử lý phải ở Supabase. Khi hỗ trợ PDF/DOCX, lưu file gốc ở Supabase Storage thay vì local disk.

## 9. Deploy phiên bản mới

Trước khi push:

```powershell
npm run lint
npm run typecheck
npm run test
npm run ai:test
npm run render:check
npm audit --omit=dev --audit-level=high
npm run build
git status --short
```

Commit toàn bộ file mới bằng `git add -A` (không dùng riêng `git add -u`), rồi push. GitHub Actions sẽ chạy lại clean install/check/build trên Linux; đó mới là bằng chứng clean-clone, không phải việc workflow chỉ tồn tại trong repository.

Sau auto-deploy, kiểm tra health rồi chạy golden path. Render hỗ trợ Dockerfile ở repository root cho monorepo; xem [Render Docker web services](https://render.com/docs/web-services), [Monorepo support](https://render.com/docs/monorepo-support) và [Environment variables](https://render.com/docs/configure-environment-variables).
