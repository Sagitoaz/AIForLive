# Demo runbook — EduRecall AI

Mục tiêu: trình bày hai vòng lặp cốt lõi trong 6–8 phút, có role handoff và bằng chứng Supabase thật. Không gọi dữ liệu synthetic là dữ liệu pilot thật.

## Chuẩn bị trước buổi demo

Chạy trước ít nhất 15 phút; cold seed trên Supabase từng mất khoảng 476 giây.

```powershell
npm ci
npm run ai:install
npm run db:check
npm run db:setup

$env:ALLOW_SYNTHETIC_DEMO_SEED="true"
$env:ALLOW_LEGACY_DEMO_ADOPTION="true" # chỉ khi dùng DB MVP cũ đã biết
npm run db:seed
npm run db:seed:check

npm run dev
```

Preflight:

```powershell
Invoke-RestMethod http://127.0.0.1:4000/api/health
Invoke-RestMethod http://127.0.0.1:8001/health

$env:E2E_API_URL="http://127.0.0.1:4000/api"
npm run test:e2e

powershell -ExecutionPolicy Bypass -File scripts/smoke-product.ps1
```

Kết quả mong đợi của smoke:

```text
[OK] Supabase product flow: progress -> animation -> pseudocode + deterministic attempt -> AI recommendation -> independent lesson review -> course-plan revision/publish
```

Mở sẵn ba cửa sổ/incognito profile để không phải nhập lại nhiều lần:

- Học sinh: `minh@edurecall.local`
- Tác giả/OWNER: `teacher@edurecall.local`
- Reviewer: `co.linh@edurecall.local`

Mật khẩu fixture chung: `Demo@123`. Endpoint/list account chỉ bật khi `DEMO_MODE=true` và phải tắt ở production.

## Kịch bản 6–8 phút

### 0:00–0:35 — Nêu bài toán và giới hạn

Thông điệp:

> EduRecall giải hai bottleneck của EduOne: chọn bước học tiếp theo từ evidence hiện tại và giảm thao tác dựng bài, nhưng giữ giáo viên là người chịu trách nhiệm publish. Demo dùng fixture synthetic 20 học sinh; chúng tôi không claim giảm dropout hay learning outcome.

Mở trang đăng nhập và cho thấy có 3 giáo viên, 20 học sinh, tìm kiếm được theo tên/email.

### 0:35–2:50 — Vòng lặp học sinh

1. Đăng nhập Minh.
2. Mở khóa `PYTHON-FOUNDATIONS-DEMO`, bài có concept `PYTHON_RANGE`.
3. Chỉ animation `NUMBER_SEQUENCE`: `range(2,5)` hiển thị 2, 3, 4 và dừng trước 5.
4. Ở phần Thực hành, mở `EX-08-1`.
5. Nhập mã giả, ví dụ:

```text
NHẬN điểm bắt đầu và điểm dừng
LẶP qua từng số trước điểm dừng
HIỂN THỊ số hiện tại
KẾT THÚC
```

6. Nộp và chỉ vào:
   - strategy `IDEA_RUBRIC`;
   - syntax không phải tiêu chí;
   - criterion/evidence và confidence;
   - AI service hoặc deterministic fallback được ghi nhãn riêng.
7. Mở `EX-08-2`, ghép block thành:

```python
for so in range(1, 4):
    print(so)
print("Xong")
```

8. Chỉ trang recommendation/“Vì sao AI chọn bước này?”: target có ID thật, reason, model version và evidence attempt.

Thông điệp phản biện:

> Browser không gửi điểm/answer key/concept đáng tin cậy. Server lấy identity từ JWT, chấm bằng contract đã duyệt, rồi mới gửi evidence tối thiểu sang FastAPI.

### 2:50–4:45 — Tác giả dựng bài

1. Chuyển sang cửa sổ Cô Mai (`OWNER`).
2. Dashboard: chỉ rõ “1 lớp · fixture synthetic”, heatmap có khác biệt giữa học sinh.
3. Mở **Soạn nội dung → Tạo bài học hoặc bài bổ trợ**.
4. Ở wizard:
   - course hiện tại được khóa rõ;
   - chọn một nguồn `VERIFIED` cùng course;
   - chọn `PYTHON_RANGE`;
   - chọn `FULL_LESSON` hoặc `REMEDIATION` có misconception thật;
   - `LOCAL_TEMPLATE` được mô tả là deterministic/0 USD/not LLM.
5. Tạo draft, mở editor và chỉ:
   - ba pha Theory / Practice / Checkpoint;
   - slide/quiz/animation allowlist;
   - validation panel;
   - provider, version, generation time và source reference.
6. Sửa một câu, lưu, rồi **Gửi duyệt**.

Thông điệp:

> Draft chưa thể đến học sinh. Người tạo và người sửa gần nhất không thể tự approve.

### 4:45–5:55 — Reviewer độc lập

1. Chuyển sang cửa sổ Cô Linh (`REVIEWER`).
2. Mở hàng chờ review, chọn draft mới nhất.
3. Chỉ ra reviewer không có quyền đọc danh sách learner định danh và không có nút tạo draft.
4. Kiểm tra source/quiz/animation, sau đó **Phê duyệt → Xuất bản**.
5. Chỉ workflow state và review history.

Nếu muốn chứng minh revision gate thay vì publish ngay:

1. Yêu cầu sửa.
2. Cô Mai sửa và gửi lại.
3. Cô Linh phê duyệt/publish lần hai.

### 5:55–6:45 — Student-safe projection

1. Quay lại Minh và refresh.
2. Mở micro-lesson đã publish.
3. Chỉ rằng học sinh nhìn thấy slide/practice/quiz nhưng không thấy:
   - `correctIndex` trước khi trả lời;
   - provider cost/token trace;
   - review/audit nội bộ.
4. Trả lời quiz để nhận explanation sau submit.

### 6:45–7:30 — Kết luận bằng bằng chứng và pilot path

Hiển thị [Judging evidence](JUDGING-EVIDENCE.md) hoặc terminal:

- 70 Node tests + 23 Python tests.
- 1 live E2E và full smoke pass.
- Fixture verifier: 23 account, 12 bài, 60 reviewed exercise, 400 synthetic histories, 20 linked recommendations.
- `LOCAL_TEMPLATE` không phải LLM; model evaluation là synthetic.
- Pilot 6 tuần chỉ mở khi consent/retention/tenant-isolation gates hoàn tất.

Kết thúc:

> Phần chúng tôi chứng minh hôm nay là hai closed loop có audit và human accountability. Phần chưa chứng minh là tác động giáo dục và tiết kiệm thời gian ở quy mô pilot; đó là mục tiêu đo, không phải claim.

## Kịch bản dự phòng

| Sự cố | Cách xử lý trung thực |
| --- | --- |
| FastAPI không sẵn sàng | Attempt vẫn được lưu; API dùng `DETERMINISTIC_FALLBACK` và UI hiển thị nhãn đó |
| External LLM hết quota | Chọn `LOCAL_TEMPLATE`; nói rõ đây là deterministic provider, không phải LLM |
| Supabase chậm | Không bấm submit lại; UI giữ pending payload/idempotency key và hiển thị operation state |
| Không có live URL | Chạy local + E2E/smoke và nói rõ public deployment là Planned |
| Reviewer không thấy draft | Refresh hàng chờ, chọn bản mới nhất; kiểm tra Cô Mai đã chuyển `IN_REVIEW` |
| Nhiều artifact từ smoke | Dùng timestamp/trạng thái mới nhất; không xóa database ngay trước phần trình bày |

Không tắt database hoặc xóa dữ liệu để tạo hiệu ứng demo. Không đổi model output thủ công rồi gọi đó là AI result.

## Tài khoản demo

### Giáo viên

| Tên | Email | Class role | Demo tốt nhất cho |
| --- | --- | --- | --- |
| Cô Mai | `teacher@edurecall.local` | OWNER | Dashboard, learner evidence, tạo/chỉnh draft |
| Thầy Nam | `thay.nam@edurecall.local` | INSTRUCTOR | Co-teaching, tạo/chỉnh draft |
| Cô Linh | `co.linh@edurecall.local` | REVIEWER | Independent review/publish, không đọc learner rows |

### Học sinh

`minh`, `lan`, `an`, `binh`, `chi`, `dung`, `giang`, `ha`, `khanh`, `linh`, `mai`, `nam`, `oanh`, `phuc`, `quan`, `son`, `trang`, `uyen`, `viet`, `yen` — thêm `@edurecall.local`.

Ưu tiên Minh cho golden path. Dùng Lan hoặc một account khác để chứng minh identity/state tách biệt và recommendation khác nhau.

## Artifact nên lưu sau demo

- URL + timestamp health check.
- Video full flow và video dự phòng ngắn.
- ID của attempt, personalization run, recommendation, generation job, content và review decision.
- Output `npm run test:e2e`, smoke và `npm run db:seed:check`.
- Teacher-time transcript nếu có; không so remediation 7 phút với baseline complete lesson 40–50 giờ.
- Bản ghi mọi lỗi/fallback xảy ra trong buổi demo.
