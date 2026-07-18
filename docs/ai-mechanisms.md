# Cơ chế AI trong EduRecall AI / EduOne prototype

Ngày cập nhật: 18/07/2026. Tài liệu này mô tả đúng những gì source code hiện thực thi, phân biệt rõ AI runtime, fallback, dữ liệu synthetic và các phần mới chỉ là kiến trúc đích.

## 1. AI giải quyết hai bài toán nào?

Sản phẩm có hai động cơ AI độc lập nhưng liên kết với nhau:

1. **Personalization engine:** đọc learning event của từng học sinh, cập nhật mức hiểu, phát hiện nguy cơ quên hoặc misconception, sau đó chọn đúng bài/hoạt động tiếp theo và ghi lý do.
2. **Content authoring engine:** dùng tài liệu đã được xác minh để tạo bản nháp bài học tiếng Việt gồm Lý thuyết – Thực hành – Kiểm tra. Giáo viên luôn sửa, duyệt và xuất bản; AI không tự đưa nội dung mới tới học sinh.

AI Voice và AI animation là hai phương thức trình bày nội dung của động cơ thứ hai, không phải hai hệ thống ra quyết định riêng.

## 2. Ranh giới giữa Web, NestJS và Python service

```text
Next.js Web
  ├─ giao diện học sinh/giảng viên
  ├─ HTML/CSS animation renderer từ template an toàn
  └─ phát audio FPT TTS hoặc Browser Speech fallback
          │ REST + JWT
          ▼
NestJS Core API
  ├─ xác thực và RBAC
  ├─ chấm activity đã đăng ký ở server
  ├─ điều phối attempt, content workflow, source và audit
  ├─ gọi LLM/TTS provider bằng secret phía server
  └─ deterministic fallback nếu Python tạm lỗi
          │ bounded JSON contract
          ▼
FastAPI Personalization Service
  ├─ Bayesian Knowledge Tracing
  ├─ forgetting/retrievability
  ├─ misconception rule engine
  ├─ next-attempt predictor
  └─ recommendation ranking + evidence
```

Python service **là lõi AI của cá nhân hóa**. NestJS vẫn là lõi nghiệp vụ: nó xác minh actor, chấm câu trả lời, quản lý trạng thái và quyết định có chấp nhận output AI hay không. Việc tách này có chủ đích: model không được ghi thẳng vào business database và khi model lỗi, học sinh vẫn tiếp tục học bằng fallback có nhãn.

## 3. Luồng personalization sau mỗi attempt

### Bước 1 — ghi và chấm learning event

Học sinh gửi `activityId`, đáp án, thời gian phản hồi, hint và phase. Với activity đã đăng ký, NestJS tự lấy đáp án chuẩn, concept, phase và difficulty; trường `isCorrect` từ browser không được tin cậy. `studentId` cũng được lấy lại từ JWT.

`idempotencyKey` ngăn cùng một event bị phân tích hai lần khi mạng chập chờn hoặc client retry.

### Bước 2 — Knowledge Tracing

FastAPI dùng Bayesian Knowledge Tracing để cập nhật `mastery_before → mastery_after`. Quan sát được giảm trọng số khi học sinh dùng gợi ý, trả lời lại nhiều lần, bỏ qua, phản hồi quá nhanh hoặc quá chậm. Vì vậy một đáp án đúng không mặc định đồng nghĩa đã nắm chắc, và một lỗi đơn lẻ không lập tức gắn nhãn misconception.

Thông số prototype hiện tại:

- prior knowledge `p_l0 = 0.28`;
- learning transition `p_transit = 0.08`;
- guess `p_guess = 0.20`;
- slip `p_slip = 0.10`.

Đây là thông số demo có thể thay thế sau pilot; không phải tham số đã hiệu chỉnh từ học sinh EduOne thật.

### Bước 3 — Forgetting và lịch ôn

Mô hình quên dạng exponential dùng thời gian từ lần học gần nhất, stability, chất lượng nhớ lại, chuỗi trả lời đúng và lỗi gần đây. Output gồm:

- `retrievability`: khả năng nhớ lại tại thời điểm hiện tại;
- `forgetting_risk = 1 - retrievability`;
- `recommended_interval_days`: thời điểm nên ôn lại, giới hạn 1–90 ngày.

Interface được tách riêng để có thể thay bằng FSRS hoặc mô hình đã hiệu chỉnh sau pilot.

### Bước 4 — phát hiện misconception

Rule engine tải rule theo domain. Ví dụ `RANGE_STOP_INCLUDED` chỉ match khi dãy học sinh gửi có chứa `stop`, trong khi đáp án chuẩn không chứa nó. Kết quả luôn kèm `rule_id`, confidence và evidence có thể đọc lại; hệ thống không yêu cầu LLM suy đoán lỗi sai một cách mơ hồ.

### Bước 5 — dự đoán next attempt

Logistic regression nhỏ dùng mastery, recent accuracy, difficulty, hint rate, response time, attempt count, forgetting risk, misconception repetition, prerequisite mastery, consistency và engagement. Artifact được huấn luyện trên synthetic data với split theo học sinh để giảm row leakage.

Kết quả model hiện chỉ là một signal. Chỉ số từ synthetic data không chứng minh hiệu quả giáo dục và không được dùng cho xếp loại, kỷ luật hoặc quyết định high-stakes.

### Bước 6 — chọn recommendation cụ thể

Priority score hiện kết hợp:

```text
0.35 × knowledge gap
+ 0.25 × forgetting risk
+ 0.20 × recent error rate
+ 0.10 × prerequisite gap
+ 0.10 × course relevance
```

Misconception lặp lại được cộng ưu tiên. Engine chọn một action như prerequisite review, micro-lesson, flash review, guided practice, checkpoint hoặc tiếp tục lộ trình. Output không dừng ở tên action mà có target cụ thể: `type`, `id`, `title`, `phase`, thời lượng và difficulty.

Mỗi recommendation lưu/hiển thị các candidate signal, attempt ID, rule ID, model version và danh sách lý do. Đây là phần đáp ứng yêu cầu “explainable AI architecture” và recommendation log theo từng học sinh.

### Bước 7 — fallback có kiểm soát

NestJS gọi FastAPI với timeout 2,5 giây và retry tối đa hai lần. Nếu FastAPI không phản hồi, deterministic fallback vẫn trả mastery, evidence và target, đồng thời gắn `mode = DETERMINISTIC_FALLBACK`. UI và log không được phép trình bày fallback như kết quả model thật.

## 4. Luồng AI hỗ trợ giảng viên tạo bài

### Nguồn và grounding

- Nguồn nội bộ seed sẵn có trạng thái `VERIFIED`.
- TXT upload được trích xuất thật, tính checksum và vào `NEEDS_REVIEW`; giáo viên phải xác minh trước khi dùng.
- PDF/DOCX/PPTX hiện chỉ vào `PENDING_EXTRACTION`. Prototype không giả vờ đã đọc binary khi chưa có extraction/OCR worker.
- LLM prompt nhận excerpt của nguồn đã xác minh và bị yêu cầu không thêm fact ngoài excerpt.

### Provider

- `ExternalLlmProvider`: gọi endpoint OpenAI-compatible của FPT AI Marketplace, model cấu hình mặc định `DeepSeek-V4-Flash`.
- `LocalTemplateProvider`: tạo structured draft không cần API trả phí, dùng được cho demo offline.
- Provider được chọn bằng biến `AI_PROVIDER`; secret chỉ tồn tại ở NestJS, không đưa sang `NEXT_PUBLIC_*`.

### Output contract

AI trả JSON có title, objective, slide, narration, animation template/data, quiz và ba section:

1. `THEORY`: lecture, animation/tài liệu;
2. `PRACTICE`: code, trắc nghiệm, debug;
3. `CHECKPOINT`: câu mới để củng cố và cập nhật lộ trình.

Normalizer và validator từ chối output thiếu pha, thời lượng sai, quiz không có đúng một đáp án, nguồn chưa xác minh, animation template ngoài allowlist, raw HTML, JavaScript, iframe hoặc remote URL.

### Human review

State machine chính:

```text
DRAFT → APPROVED → PUBLISHED
          └──────→ REJECTED / REVISION khi cần
```

Chỉ endpoint học sinh đọc được `PUBLISHED`; generate, edit, review và publish yêu cầu JWT vai trò `TEACHER`. Việc edit tạo version mới và chạy validation lại.

## 5. AI animation thay video như thế nào?

Có thể dùng animation thay phần lớn video minh họa ngắn, đặc biệt với Python cơ bản: dòng thực thi, giá trị biến, vòng lặp, nhánh điều kiện, index list và luồng gọi hàm.

Không nên cho model sinh một file HTML/JavaScript bất kỳ rồi chạy trực tiếp. Thiết kế hiện tại an toàn hơn:

1. AI chọn một template đã đăng ký như `NUMBER_SEQUENCE`, `LOOP_TIMELINE`, `CODE_HIGHLIGHT`, `FLOW_BRANCH` hoặc `BUG_REVEAL`.
2. AI chỉ sinh `animationData` phẳng đã validate.
3. Next.js render HTML/CSS/React từ template do đội phát triển kiểm soát.
4. Giáo viên xem preview và duyệt trước publish.
5. `prefers-reduced-motion` tắt chuyển động không cần thiết cho học sinh nhạy cảm với animation.

Ưu điểm so với video: tạo nhanh, nhẹ băng thông, sửa được từng dữ kiện, hỗ trợ tương tác và phù hợp thiết bị yếu. Video vẫn hữu ích cho lời giảng dài, thí nghiệm thật hoặc biểu cảm của giáo viên; khi dùng video, production cần upload lên Storage/CDN, metadata, phụ đề, quyền truy cập và quét file. Prototype hiện chưa có pipeline upload video.

## 6. AI Voice

Nút AI Voice gọi `POST /api/tts/speech`. NestJS dùng `FPT.AI-VITs`, voice mặc định `std_kimngan`, trả WAV và cache tối đa 64 clip theo model + voice + format + nội dung.

Thứ tự fallback:

1. FPT.AI-VITs phía server;
2. Web Speech API với voice `vi-VN` phù hợp nhất trên máy;
3. thông báo rõ nếu cả hai không khả dụng.

Các biến liên quan: `TTS_BASE_URL`, `TTS_MODEL`, `TTS_VOICE`, `TTS_RESPONSE_FORMAT`, `TTS_TIMEOUT_MS`, `TTS_API_KEY`. Nếu `TTS_API_KEY` trống, server dùng `EXTERNAL_LLM_API_KEY`. TTS endpoint không làm thay đổi nội dung bài; nó chỉ đọc narration đã được giáo viên duyệt.

## 7. Supabase hiện được dùng đến đâu?

Điền `DATABASE_URL` và `DIRECT_URL` trong `.env` chỉ cung cấp connection string. Hiện tại:

- Prisma CLI dùng Supabase khi chạy migration/validate/seed;
- `prisma/seed/index.ts` dùng `PrismaClient` để tạo dataset mẫu;
- NestJS runtime **chưa có Prisma module/repository**, nên attempt, mastery, recommendation và generated content vẫn nằm trong `DemoStoreService` memory;
- Web còn có localStorage fallback để demo khi API tắt.

Do đó `.env` có thể kết nối Supabase thành công nhưng `npm run dev` vẫn không đọc/ghi business state ở đó. Muốn gọi là Supabase-integrated cần thay `DemoStoreService` bằng repository Prisma, transaction hóa luồng attempt/content, thêm tenant authorization/RLS và integration test chống lẫn dữ liệu giữa hai học sinh.

## 8. Python service đã là cốt lõi chưa?

**Có, đối với personalization runtime:** BKT, forgetting, misconception diagnosis, next-attempt prediction và recommendation đều chạy trong FastAPI sau mỗi attempt.

**Chưa phải toàn bộ AI của sản phẩm:** content generation và TTS được điều phối trong NestJS vì chúng gắn với secret, source verification và human-review state machine. Đây là phân chia hợp lý, không phải thiếu sót.

Khoảng trống trước pilot thật:

- nối state với PostgreSQL/Supabase thay vì process memory;
- hiệu chỉnh BKT/threshold bằng dữ liệu pilot có consent;
- đo latency và fallback rate với 20 học sinh đồng thời;
- đo teacher override/reject rate và chất lượng bài theo rubric;
- thêm monitoring drift, model registry và rollback;
- không retrain tự động từ dữ liệu trẻ em nếu chưa có governance/consent rõ ràng.

## 9. File code chính để kiểm tra

- Personalization orchestrator: `apps/ai-service/app/services/personalization.py`
- BKT: `apps/ai-service/app/services/knowledge_tracing.py`
- Forgetting: `apps/ai-service/app/services/forgetting.py`
- Rule diagnosis: `apps/ai-service/app/services/diagnosis.py`
- Recommendation: `apps/ai-service/app/services/recommendation.py`
- NestJS AI client/fallback: `apps/api/src/personalization/`
- Learning event và server-side scoring: `apps/api/src/learning-events/learning.service.ts`
- Content providers: `apps/api/src/ai-generation/providers/`
- Source/review workflow: `apps/api/src/generated-content/`
- TTS: `apps/api/src/tts/`
- Safe animation registry: `packages/lesson-schema/` và `apps/api/domains/python-foundations/animation-templates.json`
- Synthetic data/model scripts: `apps/ai-service/scripts/` và `apps/ai-service/ml/`

