 

## P0 — Bắt buộc trước khi gọi là pilot-ready

| Vấn đề | Tác động | Phương hướng giải quyết | Bằng chứng cần nộp |
|---|---|---|---|
| E2E test không tồn tại | `npm run test:e2e` fail; không chứng minh được luồng cốt lõi | Viết Playwright/API E2E chạy trên PostgreSQL thật | Test pass cho attempt → diagnosis → recommendation → generation → review → publish → quiz → mastery → schedule |
| Database seed không hoàn chỉnh | DB hiện chỉ có 10 lessons, 50 exercises, không khớp kế hoạch 12 lessons | Viết seed idempotent bằng composite `upsert`; thêm reset fixture riêng cho test | Chạy seed 2 lần đều pass; assert 1 lớp, 20 học viên, 12 lessons và đủ exercises |
| Thiếu bằng chứng persistence runtime | DB hiện có 0 learning events và 0 audit logs | Chạy smoke test trên DB sạch, lưu snapshot trước/sau | JSON chứa counts và record IDs của event, attempt, diagnosis, recommendation, state history, schedule, review và audit |
| External LLM chưa được chứng minh | Live/default flow chỉ dùng `LOCAL_TEMPLATE` | Chạy ít nhất hai generation request thật với input khác nhau | Provider/model, prompt version/hash, source IDs, latency, tokens, cost và response đã che bí mật |
| Setup phụ thuộc Prisma Client stale | Typecheck fail trước `prisma generate` | Chuẩn hóa clean CI: install → generate → migrate → seed → lint → typecheck → test → build | Một CI run từ clean checkout pass hoàn toàn |
| Báo cáo/test artifact lỗi thời | Báo cáo cũ còn mô tả `DemoStore` dù source đã dùng Prisma | Tạo report tự động từ commit SHA và test output mới | Report ghi timestamp, commit, command, exit code và artifact links |

## P1 — Tăng mạnh điểm AI, Safety và UX

### 1. Thống nhất learner model

Hiện attempt path dùng BKT/forgetting model, nhưng quiz micro-lesson vẫn cập nhật:

- Đúng: `mastery + 0.14`.
- Sai: `mastery - 0.04`.
- Lịch ôn: cố định 5 hoặc 1 ngày.

Cần đưa quiz event vào cùng personalization pipeline:

```text
Quiz evidence
→ BKT update
→ forgetting/retrievability
→ recommendation
→ persisted review schedule
```

Mỗi quyết định cần lưu model version, input evidence, mastery trước/sau và lý do chọn interval.

**Điểm có thể tăng:** khoảng 2–3 điểm AI Architecture.

### 2. Chứng minh personalization thực sự khác biệt

Tạo paired test cho hai học sinh có cùng tổng điểm nhưng:

- Học sinh A sai `range(stop)`.
- Học sinh B sai vòng lặp `while`.
- Học sinh C trả lời ngẫu nhiên hoặc dùng hint liên tục.

Kết quả phải cho thấy concept, misconception, nội dung bổ trợ và lịch ôn khác nhau. Không chỉ kiểm tra response khác mà phải kiểm tra dữ liệu được persist và ảnh hưởng đến lần học sau.

### 3. Bổ sung authorization testing

Source đã lấy student identity từ JWT, nhưng còn cần negative tests:

- Student A không đọc attempt của Student B.
- Student không đọc draft hoặc approved-but-unpublished content.
- Teacher A không sửa source/content/class của Teacher B.
- Student không submit exercise ngoài course đang enrolled.
- Idempotency key của người dùng khác bị từ chối.
- ID đoán được không vượt qua object-level authorization.

**Điểm có thể tăng:** 1–2 điểm Safety.

### 4. Kiểm tra nội dung Python thật

Validator hiện chủ yếu kiểm tra cấu trúc và forbidden strings. Cần:

- Parse bằng Python AST.
- Chạy code trong container/sandbox không network.
- CPU, memory và execution timeout.
- So sánh stdout với expected output.
- Cấm filesystem, process, import nguy hiểm.
- Kiểm tra quiz có đúng một đáp án đúng về mặt ngữ nghĩa.
- Gửi nội dung lỗi trở lại trạng thái `REVISION_REQUIRED`.

Không nên ghi `codeValidation: passed` chỉ vì output đúng schema.

### 5. Hoàn thiện document grounding

Pilot hiện chỉ xử lý TXT. Nếu muốn claim PDF/DOCX/PPTX:

- Lưu file vào object storage.
- Extract trong worker tách biệt.
- Không chạy macro, embedded object hoặc uploaded code.
- Lưu checksum, page/slide locator và extraction version.
- Cho giáo viên xem và xác minh excerpt trước generation.
- Detect prompt injection trong tài liệu.
- Citation trong lesson phải truy ngược tới source chunk/page.

Nếu chưa làm, nên giới hạn claim công khai là “TXT grounding”.

### 6. Browser UX và accessibility

Bổ sung Playwright cho:

- Login student/teacher.
- Làm bài và xem recommendation.
- Teacher generate, edit, request revision, approve, publish.
- Student không thấy draft nhưng thấy published lesson.
- Làm quiz và thấy mastery/lịch ôn thay đổi.
- Error/fallback/provider-down flow.

Chạy thêm axe ở desktop/mobile, kiểm tra keyboard navigation, focus management, contrast, reduced motion và screen-reader labels.

**Điểm có thể tăng:** 2–3 điểm UX/Technical.

## P1 — Pilot và khả năng kinh doanh

### Cost model

Cần bảng chi phí ít nhất cho ba mức:

| Quy mô | Phải tính |
|---|---|
| 20 học viên | LLM generation, TTS, database, storage, monitoring và teacher review |
| 2.000 học viên | Cache/reuse ratio, concurrency, support và monthly budget |
| 20.000 học viên | Rate limits, queue workers, observability, retention và incident response |

Không để token rate mặc định bằng 0 trong báo cáo. Thêm:

- Cost per generated lesson.
- Cost per active learner/month.
- Reuse savings.
- Provider quota.
- Daily/monthly budget limit.
- Alert và fallback policy.

### Pilot measurement

Pilot roadmap đã hợp lý nhưng cần biến thành kế hoạch thực thi:

- Owner/RACI cho EduOne, giáo viên và đội kỹ thuật.
- Baseline trước pilot.
- Delayed-recall test sau 7/14 ngày.
- Teacher active-edit time, không tính generation latency vào thời gian lao động.
- Recommendation acceptance và override rate.
- Draft rejection/factual correction rate.
- Fallback/error rate.
- Privacy/accessibility incidents.
- Ngưỡng go/no-go định lượng.

Với một lớp và một giáo viên, kết quả chỉ nên trình bày là descriptive pilot, không phải causal proof.

## P2 — Hoàn thiện và tăng sức thuyết phục

- Hiển thị version diff giữa AI draft và teacher version.
- Sửa approved content phải tạo revision rõ ràng và giữ immutable history.
- Thêm model/provider registry và rollback.
- Chuẩn hóa tiếng Việt, sửa mojibake trong log/source strings.
- Tạo screenshot/video demo có timestamp.
- Thêm panel “evidence” trong demo: model version, source, recommendation reasons, audit record và DB record IDs.
- Cung cấp standalone HTML export thật nếu tiếp tục claim xuất HTML slide.
- Thêm data export/deletion và retention enforcement.
- Không đưa credentials demo hoặc fallback JWT secret vào production deployment.

## Lộ trình đề xuất

### Giai đoạn 1: 2–3 ngày

1. Sửa seed idempotent và đủ dữ liệu.
2. Tạo clean CI.
3. Viết API E2E cho toàn bộ closed loop.
4. Lưu DB before/after và audit evidence.
5. Cập nhật báo cáo kiểm thử theo commit hiện tại.

**Điểm dự kiến:** 74–78.

### Giai đoạn 2: 3–5 ngày

1. Thống nhất BKT/forgetting cho quiz.
2. Thêm paired-personalization tests.
3. Thêm authorization negative tests.
4. Chạy external LLM thật với trace/cost.
5. Thêm Playwright và accessibility audit.

**Điểm dự kiến:** 80–84.

### Giai đoạn 3: 1–2 tuần

1. Python execution sandbox.
2. Binary document extraction và injection defense.
3. Cost/quota model.
4. Pilot instrumentation, privacy workflow và owner matrix.
5. Tiến hành pilot có delayed-recall measurement.

**Điểm dự kiến:** 84–88. Chỉ có cơ sở hướng tới 90+ sau khi có pilot outcome thật.

## Ba việc nên làm ngay

1. **Khôi phục E2E PostgreSQL và tạo DB evidence đầy đủ.**
2. **Đưa quiz vào cùng learner-model pipeline, loại bỏ mastery/interval hard-code.**
3. **Chứng minh external AI thật bằng trace có source, token, cost và human-review history.**

Đây là ba hạng mục tăng điểm nhanh nhất vì chúng trực tiếp biến các claim lớn nhất của EduRecall từ “có code” thành “đã được chứng minh”.
Nâng cấp Technical Implementation & Engineering Depth (20 điểm)
Môi trường chạy thử mã nguồn an toàn (Client-Side Sandbox):
Mục tiêu: Thay vì chỉ có một <textarea> nhập text thô, hãy tích hợp Pyodide (WebAssembly Python) chạy trực tiếp trong trình duyệt của học sinh.
Tại sao điểm cao: Ban giám khảo cực kỳ dị ứng với việc thực thi code Python tùy ý của học sinh trên máy chủ (rất dễ bị hack). Chạy Python ở client-side bằng WebAssembly vừa an toàn tuyệt đối, vừa chứng minh chiều sâu kỹ thuật frontend.
Xử lý tệp nhị phân thực tế (Document Processing Worker):
Mục tiêu: Hiện tại hệ thống chỉ nhận .txt. Cần phác thảo hoặc làm một mock worker xử lý trích xuất văn bản (OCR/Extraction) từ tài liệu thực tế của giáo viên (.pdf, .docx, .pptx) trước khi đẩy vào prompt của LLM.
Nâng cấp AI-Native Architecture & Innovation (20 điểm)
Cải thiện chất lượng mô hình Dự đoán (Next-Attempt Model):
Mục tiêu: Mô hình Logistic Regression tĩnh hiện tại có độ chính xác rất thấp (ROC-AUC ~0.57). Hãy đề xuất hoặc cài đặt cơ chế hiệu chuẩn xác suất (Probability Calibration) hoặc chuyển sang dùng mô hình DKT (Deep Knowledge Tracing) chạy trên LSTM để nắm bắt chuỗi thời gian làm bài của học sinh tốt hơn.
Mở rộng Telemetry cho lõi BKT (Bayesian Knowledge Tracing):
Mục tiêu: Ngoài thời gian phản hồi (response time) và gợi ý (hints), hãy tích hợp thêm telemetry về: số lần chuyển tab (mất tập trung), tốc độ gõ phím hoặc số lần bấm nút xóa (backspace) để đánh giá độ tự tin thực sự của học sinh khi làm bài.
Nâng cấp Business Viability & Pilot Pathway (20 điểm)
Mở rộng bộ dữ liệu Pilot thật (Real-world Syllabus):
Mục tiêu: Bộ dữ liệu hiện tại hoàn toàn là mô phỏng (synthetic data). Cần bổ sung kế hoạch hoặc giao diện cho phép nhập trực tiếp danh sách học sinh thực tế (có mã đồng thuận của phụ huynh - consent form) và syllabus thật của EduOne.
Bảng tính toán ROI chi tiết cho giáo viên:
Mục tiêu: Thiết kế một dashboard đo lường chính xác lượng thời gian giáo viên tiết kiệm được (ví dụ: Tổng thời gian soạn bài thủ công (45h) vs. Thời gian duyệt AI draft + sửa đổi (3h) = Tiết kiệm 93% thời gian).
Lỗi P0: clean install bằng npm ci thất bại; npm run test:e2e không có test; public clone không có seed để tái tạo 20 học viên; không có live URL/video.
Sai lệch quan trọng: mục tiêu/quỹ thời gian được lưu ở UI nhưng request sang AI vẫn đang hard-code; recommendation sinh target ID giả lập thay vì liên kết chắc chắn tới activity thật; thời gian giáo viên chỉnh sửa chưa được ghi nên chưa chứng minh mức giảm 40–50 giờ.