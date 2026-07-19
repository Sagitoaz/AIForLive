# EduRecall AI — cá nhân hóa học tập và soạn bài có kiểm duyệt cho EduOne

EduRecall AI là prototype cho bài toán STEAM for Vietnam EduOne, tập trung vào hai vòng lặp có thể kiểm tra được:

1. Từ bằng chứng học tập hiện tại, tạo hoạt động tiếp theo phù hợp cho từng học sinh và lưu log giải thích.
2. Hỗ trợ giáo viên dựng bản nháp bài học từ nguồn đã xác minh, nhưng bắt buộc một người có vai trò phù hợp kiểm duyệt trước khi học sinh truy cập.

Phạm vi demo là một khóa Python, một lớp và 20 hồ sơ học sinh tổng hợp. Đây không phải dữ liệu trẻ em thật và không phải bằng chứng về tác động giáo dục.

## Trạng thái bằng chứng

| Nhãn | Hiện trạng |
| --- | --- |
| **Implemented** | Web Next.js, API NestJS, AI service FastAPI, Prisma/Supabase, hai workflow cốt lõi và RBAC theo lớp |
| **Tested** | 70 test Node, 23 test Python, 1 live HTTP E2E; lint, typecheck, seed verifier và production build pass ngày 19/07/2026 |
| **Demonstrated** | Smoke test Supabase đi qua progress → animation → pseudocode → diagnosis/recommendation → independent review → publish |
| **Measured** | Latency/cost metadata của generation và model metrics trên artifact synthetic; không suy rộng thành hiệu quả pilot |
| **Planned** | Public deployment/video, paired teacher-time study, consented pilot, usability study và calibration trên dữ liệu pilot |

Chi tiết claim-to-evidence nằm tại [Judging evidence](docs/JUDGING-EVIDENCE.md), [build verification](docs/build-verification.md) và [demo runbook](docs/DEMO-RUNBOOK.md).

## Hai vòng lặp sản phẩm

### 1. Học sinh: bằng chứng → phân tích → hoạt động tiếp theo

```text
JWT học sinh
  → API lấy exercise, answer key và enrollment thật
  → server chấm và ghi LearningEvent + Attempt theo transaction
  → FastAPI cập nhật BKT/forgetting, diagnosis và candidate ranking
  → API kiểm tra lại output, resolve target ACTIVE/PUBLISHED
  → lưu PersonalizationRun, Recommendation, Evidence và ReviewSchedule
  → học sinh/giáo viên xem lý do, model/rule version và target thật
```

Điểm an toàn quan trọng:

- ID học sinh luôn lấy từ token; client không gửi `studentId` đáng tin cậy.
- Client không gửi đáp án đúng, concept, difficulty hoặc điểm số.
- Retry dùng idempotency key; collision giữa hai người dùng bị từ chối.
- Nếu AI service lỗi, API dùng rule xác định và gắn nhãn `DETERMINISTIC_FALLBACK` riêng.
- Misconception thiếu bằng chứng trả `UNKNOWN`/`NEED_MORE_EVIDENCE`, không tự bịa nhãn.
- Recommendation chỉ khả dụng khi target được resolve sang record thật trong đúng course/concept.

### 2. Giáo viên: nguồn đã xác minh → draft → review → publish

```text
Chọn course và nguồn VERIFIED
  → Local Template hoặc External LLM trả structured data
  → schema/allowlist validator
  → DRAFT → IN_REVIEW → APPROVED → PUBLISHED
  → student endpoint chỉ trả PUBLISHED
```

Người tạo hoặc người sửa phiên bản gần nhất không thể tự phê duyệt. Demo dùng ba vai trò:

- `OWNER` — Cô Mai: quản lý lớp và tạo bản nháp.
- `INSTRUCTOR` — Thầy Nam: hỗ trợ lớp và tạo/chỉnh nội dung.
- `REVIEWER` — Cô Linh: phản biện, yêu cầu sửa, phê duyệt và publish; không đọc hàng dữ liệu định danh học sinh.

`LocalTemplateProvider` là bộ dựng khung xác định, chi phí paid-provider bằng 0 và **không phải LLM**. `ExternalLlmProvider` chỉ được gọi là LLM khi server có credential và generation trace thực sự ghi provider/model/token.

## Thực hành lập trình

### Mã giả — chấm ý tưởng, không đề cao syntax

- Học sinh viết tối đa 2.000 ký tự trong workspace có hướng dẫn.
- Rubric `IDEA_RUBRIC` chấm các tiêu chí ý tưởng đã được giáo viên duyệt; `syntaxPolicy = IGNORE`.
- FastAPI chỉ đưa ra đánh giá advisory. NestJS kiểm tra evidence/criterion IDs và tự tính lại score trước khi lưu.
- Chấm AI chỉ dùng ở pha `PRACTICE`, không dùng làm điểm số, kỷ luật, tuyển sinh hoặc loại trừ.
- Khi provider không sẵn sàng, deterministic rubric fallback được ghi rõ trong grading trace.

### Ghép khối code

- Học sinh kéo/sắp xếp các block để ghép thành chương trình hoàn chỉnh.
- Server kiểm tra đúng tập block ID, không chấp nhận block lạ/trùng/thiếu.
- `CODE_ORDER` chấm theo thứ tự đã được giáo viên duyệt, cho kết quả tái lập.
- Payload retry được đóng băng cùng idempotency key để tránh nộp nhầm phiên bản UI.

## Kiến trúc

```text
Next.js Web (:3000)
  └── REST/JWT ── NestJS Core API (:4000)
                    ├── Auth/RBAC, scoring, transactions, review workflow
                    ├── Prisma ── Supabase PostgreSQL
                    └── validated request/response ── FastAPI AI (:8001)
                                                        ├── BKT + forgetting
                                                        ├── diagnosis/ranking
                                                        └── advisory idea rubric
```

| Thành phần | Trách nhiệm |
| --- | --- |
| `apps/web/` | UX học sinh/giáo viên; chỉ hiển thị dữ liệu API |
| `apps/api/` | Auth, object authorization, chấm server, transaction, persistence và audit |
| `apps/ai-service/` | BKT, forgetting, diagnosis, prediction, ranking và rubric advisory |
| `domains/` | Concept, prerequisite, misconception, diagnosis rule và animation template an toàn |
| `prisma/` | Schema, migrations, seed synthetic idempotent và verifier |
| `packages/` | Contract dùng chung |

## Fixture demo có thể tái tạo

Seed `pilot-v1` được bảo vệ bằng hai cờ opt-in và từ chối chạy ở production:

```powershell
$env:ALLOW_SYNTHETIC_DEMO_SEED="true"
$env:ALLOW_LEGACY_DEMO_ADOPTION="true" # chỉ cần khi DB có đúng fixture MVP cũ
npm run db:seed
npm run db:seed:check
```

Verifier hiện xác nhận:

| Dữ liệu | Số lượng |
| --- | ---: |
| Demo accounts | 23 = 3 giáo viên + 20 học sinh |
| Organization / domain / course / class | 1 / 1 / 1 / 1 |
| Teacher memberships | 3: OWNER / INSTRUCTOR / REVIEWER |
| Modules / lessons / resources / reviewed exercises | 4 / 12 / 36 / 60 |
| Pseudocode IDEA_RUBRIC / CODE_ORDER | 12 / 24 |
| Concept states / synthetic histories | 160 / 400 |
| Linked events / attempts / recommendations / evidence / schedules | 20 mỗi loại |
| Verified source / source chunks | 1 / 3 |

Mọi history/model artifact trong fixture đều gắn nhãn synthetic/model-only. Verifier từ chối timestamp tương lai, recommendation không có target thật và exercise thiếu teacher-review contract.

## Chạy local

Yêu cầu: Node.js ≥ 20.9, npm ≥ 10, Python ≥ 3.11 và PostgreSQL/Supabase.

```powershell
npm ci
npm run ai:install
npm run db:check
npm run db:setup

$env:ALLOW_SYNTHETIC_DEMO_SEED="true"
npm run db:seed
npm run db:seed:check

npm run dev
```

Các URL mặc định:

| Dịch vụ | URL |
| --- | --- |
| Web | `http://localhost:3000` |
| API docs | `http://localhost:4000/api/docs` |
| AI docs | `http://localhost:8001/docs` |

### Tài khoản demo

Mật khẩu chung của fixture: `Demo@123`. Danh sách chỉ xuất hiện khi `DEMO_MODE=true`; production mặc định tắt endpoint này.

| Vai trò | Email |
| --- | --- |
| OWNER / tác giả | `teacher@edurecall.local` |
| INSTRUCTOR | `thay.nam@edurecall.local` |
| REVIEWER độc lập | `co.linh@edurecall.local` |
| Học sinh chính | `minh@edurecall.local` |
| Học sinh so sánh | `lan@edurecall.local`, `an@edurecall.local`, `binh@edurecall.local` |

UI đăng nhập có tìm kiếm đủ 23 account. Danh sách đầy đủ và kịch bản 6–8 phút nằm trong [demo runbook](docs/DEMO-RUNBOOK.md).

## Kiểm chứng

```powershell
npm run lint
npm run typecheck
npm run test
npm run ai:test
npm run validate:synthetic
npm run ai:evaluate
npm run validate:assets
npm run render:check
npm audit --omit=dev --audit-level=high
npm run db:check

$env:E2E_API_URL="http://127.0.0.1:4000/api"
npm run test:e2e

powershell -ExecutionPolicy Bypass -File scripts/smoke-product.ps1
npm run build
```

Kết quả gần nhất ngày 19/07/2026:

- Lint: pass.
- TypeScript: web + API pass.
- Node tests: 11 web + 59 API pass.
- Python: 23 pytest pass; Ruff pass.
- Live E2E: 1/1 pass trên Supabase.
- Smoke product: pass trong 110,4 giây.
- Production build: NestJS + Next.js pass; 9 route.
- Render contract/startup smoke: pass; DB + AI ready, 23 demo account, TTS ẩn danh bị chặn 401.
- Production dependency audit: 2 moderate từ PostCSS do Next 16.2.10 pin; không có high/critical.
- Synthetic validation: 20 students, 8 concepts, 48 dataset exercises, 400 attempts/events.
- Asset validation: 254 SVG, 80 custom icons.
- Model evaluation: accuracy 0,6703; ROC-AUC 0,5691; Brier 0,2169 — **synthetic artifact, không phải hiệu quả giáo dục**.

Lần `npm ci` trên máy kiểm chứng hiện tại bị chặn bởi lỗi junction/workspace của filesystem Windows. Lockfile đã được chuẩn hóa bằng đúng npm `10.9.8` của Render và exact-version `ci --dry-run` pass; clean install thực trên Windows vẫn dừng ở thao tác tạo workspace symlink. Vì vậy production build là **Tested**, còn clean-clone install Linux vẫn cần GitHub Actions/Render xác nhận sau commit; xem chi tiết tại [build verification](docs/build-verification.md).

## An toàn, grounding và dữ liệu trẻ em

- External provider chỉ nhận excerpt cần thiết, không nhận email/tên trực tiếp của học sinh.
- Source phải ở trạng thái `VERIFIED`; pipeline hiện chỉ nhận TXT. PDF/DOCX/PPTX/OCR là **Planned**.
- Provider output là dữ liệu không tin cậy; không render JavaScript/raw HTML.
- Animation chỉ dùng template đã đăng ký và key allowlist.
- RLS được bật trên các bảng nghiệp vụ; `anon`/`authenticated` không có table privileges trong mô hình API-only. API vẫn phải thực hiện object authorization.
- Trước dữ liệu trẻ em thật cần consent/assent, retention/deletion, tenant isolation, incident owner và privacy/legal review tại Việt Nam.
- Không tự động retrain từ dữ liệu trẻ em và không dùng model cho quyết định có hậu quả cao.

## Giới hạn công khai

- Chưa có live URL/video công khai được xác minh trong lần kiểm tra này.
- Chưa chạy external LLM/TTS bằng credential thật trong lần kiểm tra này; provider path có unit test/validator nhưng live artifact chưa có.
- Chưa có paired baseline hai bài hoàn chỉnh cùng scope, teacher override rate hay kết quả pilot consented.
- Model next-attempt hiện có ROC-AUC synthetic thấp; ranking chính vẫn dựa trên rule/tín hiệu giải thích được và cần calibration pilot.
- Course-plan publish hiện lưu một kế hoạch đã duyệt, chưa tự động ghi đè cấu trúc course đang học.
- Seed cold run qua Supabase mất khoảng 476 giây trên máy kiểm chứng.

## Tài liệu chính

- [Judging evidence và khoảng cách tới 90+](docs/JUDGING-EVIDENCE.md)
- [Demo runbook](docs/DEMO-RUNBOOK.md)
- [Build verification](docs/build-verification.md)
- [Brief-fit audit](docs/brief-fit-audit.md)
- [AI mechanisms](docs/ai-mechanisms.md)
- [Architecture](docs/architecture.md)
- [Recommendation explainability](docs/recommendation-explainability.md)
- [Pilot roadmap](docs/pilot-roadmap.md)
- [Security and child-data boundaries](docs/security.md)
- [Render deployment](docs/deploy-render.md)

## License

MIT — xem [LICENSE](LICENSE).
