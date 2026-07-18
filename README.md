# 🎓 EduRecall AI — Cá nhân hóa Lộ trình Học & Tạo Nội dung Bằng AI cho EduOne

> **Vietnam Innovation Challenge 2026 · Track: Giáo dục & Đào tạo**
> Giải pháp AI-Powered Personalization & Content Creation cho nền tảng học tự định hướng EduOne của STEAM for Vietnam Foundation.

[![Node.js](https://img.shields.io/badge/Node.js-20.9+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?logo=python&logoColor=white)](https://python.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Build](https://img.shields.io/badge/Build-Passing-brightgreen.svg)](docs/build-verification.md)
[![Tests](https://img.shields.io/badge/Tests-29_Node_|_17_Python-blue.svg)](docs/build-verification.md)

---

## 📋 Mục lục

- [Tổng quan & Bối cảnh Bài toán](#-tổng-quan--bối-cảnh-bài-toán)
- [Giải pháp Đề xuất](#-giải-pháp-đề-xuất)
- [Đối chiếu Yêu cầu Đề bài](#-đối-chiếu-yêu-cầu-đề-bài)
- [Kiến trúc Hệ thống](#-kiến-trúc-hệ-thống)
- [Kiến trúc AI — Giải thích được](#-kiến-trúc-ai--giải-thích-được)
- [Vấn đề 1: Cá nhân hóa Lộ trình Học](#-vấn-đề-1-cá-nhân-hóa-lộ-trình-học-personalization)
- [Vấn đề 2: AI Hỗ trợ Sản xuất Nội dung](#-vấn-đề-2-ai-hỗ-trợ-sản-xuất-nội-dung-content-creation)
- [Khóa học Pilot](#-khóa-học-pilot)
- [Chống Anti-Pattern](#-chống-anti-pattern)
- [Cài đặt & Chạy thử](#-cài-đặt--chạy-thử)
- [Kết quả Kiểm chứng](#-kết-quả-kiểm-chứng)
- [Tài liệu Kỹ thuật](#-tài-liệu-kỹ-thuật)
- [Pilot Roadmap với EduOne](#-pilot-roadmap-với-eduone)

---

## 🌟 Tổng quan & Bối cảnh Bài toán

**STEAM for Vietnam** là tổ chức phi lợi nhuận vận hành nền tảng [EduOne](https://www.eduone.ai/), cung cấp các khóa học lập trình và STEM miễn phí cho học sinh Việt Nam K-12 thông qua mạng lưới giáo viên tình nguyện. Đề bài yêu cầu giải quyết đồng thời **hai bài toán vận hành cốt lõi**:

| Bài toán | Hiện trạng | Tác động |
|----------|-----------|---------|
| **Cá nhân hóa lộ trình học** | Học viên học chung 1 lộ trình, không phân biệt trình độ, tốc độ hay mục tiêu | Tỉ lệ dropout >50%; giáo viên tình nguyện phải tự điều chỉnh thủ công |
| **Sản xuất nội dung bằng AI** | 5 khóa học, 1 người fulltime + 10 volunteer, 40–50 giờ cho 1 bài hoàn chỉnh | Nghẽn cổ chai nội dung; học viên phải chờ khóa học mới |

**EduRecall AI** được xây dựng như một giải pháp toàn diện, tối ưu hóa AI vào từng khâu vận hành — từ chẩn đoán kiến thức, cá nhân hóa theo thời gian thực đến soạn bài tự động có kiểm duyệt — nhằm cải thiện chất lượng trải nghiệm học tập cho từng học sinh Việt Nam mà không cần tăng nhân sự vận hành.

---

## 🚀 Giải pháp Đề xuất

EduRecall AI giải quyết cả hai bài toán trong một hệ thống thống nhất, chuyên nghiệp với kiến trúc **3-tier microservice** rõ ràng:

### Vấn đề 1 — Cá nhân hóa Lộ trình Học

```
Học sinh làm bài → Server chấm đáp án → AI chẩn đoán lỗ hổng + cập nhật mastery
→ Đề xuất hoạt động cụ thể kèm lý do & bằng chứng → Lộ trình được điều chỉnh tự động
```

- **Bayesian Knowledge Tracing (BKT)** cập nhật xác suất nắm vững từng khái niệm sau mỗi lần làm bài
- **Exponential Forgetting Model** ước tính khả năng nhớ lại và lịch ôn tập tối ưu
- **Domain Rule Engine** phát hiện misconception có bằng chứng (VD: `RANGE_STOP_INCLUDED`)
- **Weighted Recommendation Scoring** xếp hạng hoạt động tiếp theo dựa trên 5 tín hiệu có trọng số
- **Mỗi đề xuất đều có log giải thích**: candidate scores, rule ID, model version, reasons tiếng Việt

### Vấn đề 2 — AI Hỗ trợ Sản xuất Nội dung

```
Giảng viên tải nguồn → Xác minh (VERIFIED) → AI tạo Draft 3 pha → Validator kiểm tra
→ Giảng viên sửa/duyệt → APPROVED → PUBLISHED → Đến tay học sinh
```

- **Dual Provider**: `LocalTemplateProvider` (chi phí 0, cấu trúc) + `ExternalLlmProvider` (FPT AI `DeepSeek-V4-Flash`)
- **State Machine kiểm duyệt**: `DRAFT → IN_REVIEW → APPROVED → PUBLISHED` — nội dung AI **không bao giờ** đến học sinh mà chưa qua giáo viên
- **Content Validator** chặn output sai schema, raw JavaScript/HTML nguy hiểm, quiz không hợp lệ
- **Đo thời gian end-to-end**: generation latency, active teacher-edit time, review time — đánh giá trước/sau

---

## ✅ Đối chiếu Yêu cầu Đề bài

Bảng dưới đây đối chiếu **từng yêu cầu** trong đề bài với hiện trạng triển khai thực tế của hệ thống:

| # | Yêu cầu từ Đề bài | Trạng thái | Bằng chứng Triển khai |
|---|-------------------|-----------|----------------------|
| 1 | **Đề xuất lộ trình/bài tập phù hợp trình độ theo thời gian thực** | ✅ **Đạt** | FastAPI chạy BKT + forgetting + diagnosis + recommendation scoring sau mỗi attempt; mastery tách theo `studentId × conceptCode`; log đề xuất theo từng học sinh có candidate signals, rule ID, model version và reasons |
| 2 | **Rút ngắn thời gian tạo bài học bằng AI có human review** | ✅ **Đạt** | AI tạo structured draft 3 pha (lý thuyết, thực hành, quiz) từ nguồn VERIFIED; state machine `DRAFT → APPROVED → PUBLISHED`; UI đo generation time vs teacher edit/review time |
| 3 | **Prototype demo được (live URL hoặc video)** | ✅ **Đạt** | Demo local chạy đầy đủ 3 service trên Supabase PostgreSQL; smoke test tự động toàn bộ luồng |
| 4 | **Code repository (public GitHub)** | ✅ **Đạt** | Repository có cấu trúc monorepo chuyên nghiệp, Git history đầy đủ |
| 5 | **Kiến trúc AI giải thích được** | ✅ **Đạt** | Tài liệu `ai-architecture.md`, `ai-mechanisms.md`, `recommendation-explainability.md`, model card; mỗi recommendation có formula weights, evidence chain, model/rule version |
| 6 | **Pilot roadmap 1–2 trang với EduOne** | ✅ **Đạt** | `pilot-roadmap.md` chi tiết: scope 6 tuần, 1 khóa/1 lớp/20 HS, metrics, privacy, retraining gate |
| 7 | **Tiếng Việt bắt buộc** | ✅ **Đạt** | Toàn bộ UI, prompt, narration, draft, quiz bằng tiếng Việt tự nhiên, phù hợp K-12 |
| 8 | **Nội dung phù hợp K-12 Việt Nam** | ✅ **Đạt** | Khóa Python thiết kế cho lớp 6–9; ngôn ngữ đơn giản, dễ hiểu; animation an toàn |
| 9 | **Pilot: 1 khóa, 1 lớp, 20 học sinh** | ✅ **Đạt** | Seed có 1 khóa 4 module/12 bài/60 bài tập, 1 lớp, 20 hồ sơ pilot đa dạng trên Supabase |

---

## 🏗 Kiến trúc Hệ thống

Hệ thống được thiết kế theo kiến trúc **microservice 3-tier** rõ ràng, tách biệt trách nhiệm và dễ mở rộng:

```
┌─────────────────────────────────────────────────────────────────┐
│                    ⭐ EduRecall AI Architecture                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌──────────────┐     REST + JWT      ┌──────────────────┐    │
│   │  Next.js Web │ ◄──────────────────► │  NestJS Core API │    │
│   │   :3000      │                      │     :4000        │    │
│   │              │                      │                  │    │
│   │ • Student    │                      │ • Auth + RBAC    │    │
│   │   Dashboard  │                      │ • Course CRUD    │    │
│   │ • Teacher    │                      │ • Attempt Grading│    │
│   │   Studio     │                      │ • Content Review │    │
│   │ • AI Content │                      │ • Gamification   │    │
│   │ • Analytics  │                      │ • Audit Trail    │    │
│   └──────────────┘                      └────────┬─────────┘    │
│                                                  │              │
│                                    ┌─────────────┼──────────┐   │
│                                    │             │          │   │
│                              ┌─────▼─────┐  ┌───▼────────┐ │   │
│                              │ FastAPI AI │  │ Supabase   │ │   │
│                              │   :8001    │  │ PostgreSQL │ │   │
│                              │            │  │            │ │   │
│                              │ • BKT      │  │ • Users    │ │   │
│                              │ • Forget   │  │ • Courses  │ │   │
│                              │ • Diagnose │  │ • Attempts │ │   │
│                              │ • Predict  │  │ • States   │ │   │
│                              │ • Rank     │  │ • Content  │ │   │
│                              └────────────┘  │ • Audit    │ │   │
│                                              └────────────┘ │   │
│                                    LLM/TTS Providers        │   │
│                              ┌────────────────────────────┐ │   │
│                              │ • LocalTemplateProvider    │ │   │
│                              │   (zero-cost, structured)  │ │   │
│                              │ • FPT AI DeepSeek-V4-Flash │ │   │
│                              │ • FPT.AI-VITs TTS          │ │   │
│                              └────────────────────────────┘ │   │
│                                                             │   │
└─────────────────────────────────────────────────────────────────┘
```

### Phân lớp Trách nhiệm (Separation of Concerns)

| Layer | Công nghệ | Trách nhiệm |
|-------|----------|-------------|
| **Presentation** | Next.js 16 + React | UI học sinh & giảng viên, animation an toàn, không tự tạo AI state |
| **Business Logic** | NestJS + Prisma | Auth/RBAC, chấm bài, orchestration AI, human-review state machine, audit |
| **AI Engine** | FastAPI + scikit-learn | BKT, forgetting, diagnosis, prediction, recommendation scoring |
| **Data Layer** | Supabase PostgreSQL | Nguồn dữ liệu nghiệp vụ duy nhất — user, course, attempt, state, content |
| **AI Providers** | Local Template / FPT AI | Sinh nội dung có cấu trúc, luôn qua validator trước khi thành DRAFT |

> **Điểm nổi bật**: Python AI service là lõi cá nhân hóa thực sự nhưng **không được ghi thẳng database** và **không tự publish nội dung** — đây là phân lớp an toàn theo đúng tinh thần human-in-the-loop mà đề bài yêu cầu.

---

## 🧠 Kiến trúc AI — Giải thích được (Explainable AI Architecture)

Hệ thống AI của EduRecall **không phải black-box** — mỗi quyết định đều có thể truy vết và giải thích:

| Layer AI | Câu hỏi Trả lời | Cơ chế | Giải thích |
|----------|-----------------|--------|-----------|
| **Knowledge Tracing** | Học sinh hiểu khái niệm này ở mức nào? | Bayesian Knowledge Tracing | Cập nhật posterior từ prior, transition, guess, slip; giảm confidence cho hint, response time bất thường |
| **Forgetting** | Sau bao lâu học sinh sẽ quên? | Exponential Forgetting Model | `retrievability = exp(-elapsedDays / adjustedStability)` — tương thích FSRS |
| **Diagnosis** | Học sinh mắc lỗi gì cụ thể? | Domain Rule Engine | Rules có đăng ký, cần evidence; không bịa misconception — trả `UNKNOWN` / `NEED_MORE_EVIDENCE` khi chưa đủ |
| **Prediction** | Xác suất trả lời đúng lần sau? | Logistic Regression | 12 features: mastery, accuracy, difficulty, hint rate, response time, forgetting risk... |
| **Recommendation** | Hoạt động nào nên làm tiếp? | Weighted Deterministic Scoring | `0.35×gap + 0.25×forget + 0.20×error + 0.10×prereq + 0.10×relevance` |
| **Content Gen** | Tạo bài học thế nào? | Provider Abstraction + Schema | Structured JSON → Validator → DRAFT; không raw HTML/JS |

### Công thức Recommendation (Minh bạch & Có thể Kiểm chứng)

```
Priority Score = 0.35 × knowledgeGap
              + 0.25 × forgettingRisk
              + 0.20 × recentErrorRate
              + 0.10 × prerequisiteImportance
              + 0.10 × courseRelevance
```

Mỗi recommendation lưu đầy đủ: `action`, `priority`, `model_version`, `rule_id`, `attempt_ids`, `signal_snapshot`, `candidate_scores` và `reasons` bằng tiếng Việt. Giáo viên có thể xem formula weights **tách biệt** với evidence — hệ thống **không bao giờ** dùng LLM để giải thích ngược một kết quả số.

---

## 📊 Vấn đề 1: Cá nhân hóa Lộ trình Học (Personalization)

### Quy trình Cá nhân hóa End-to-End

```
1. ĐÁNH GIÁ ĐẦU VÀO
   └─► 5 câu placement test → chấm server-side → mastery khởi điểm theo concept
   └─► Lưu PersonalizationRun(placement-v1) + StudentConceptState + ConceptStateHistory

2. HỌC THEO LỘ TRÌNH CÁ NHÂN
   └─► Mỗi bài: Lý thuyết → Thực hành → Kiểm tra cuối bài
   └─► Animation an toàn (allowlist template) + AI Voice (FPT.AI-VITs / Web Speech fallback)

3. SAU MỖI ATTEMPT (real-time)
   JWT → Lấy Exercise + answer key + Enrollment từ Supabase
       → Server chấm đáp án (không tin client)
       → Ghi LearningEvent(PENDING_ANALYSIS) + Attempt
       → Gọi FastAPI với mastery, history, difficulty, hint, response time
       → FastAPI chạy BKT + Forgetting + Diagnosis + Prediction + Ranking
       → Ghi Diagnosis + Recommendation + Evidence + ReviewSchedule
       → Cập nhật StudentConceptState + ConceptStateHistory
       → Ghi PersonalizationRun → ANALYZED / FALLBACK_ANALYZED

4. KẾT QUẢ CHO HỌC SINH
   └─► Hoạt động tiếp theo được cá nhân hóa theo năng lực thực tế
   └─► Lý do đề xuất bằng tiếng Việt, dễ hiểu
   └─► Lịch ôn tập tối ưu theo mô hình forgetting
```

### Đặc điểm Nổi bật của Hệ thống Personalization

- **Per-student recommendation logs**: Mỗi học sinh có log riêng với candidate signals, rule ID, model version, reasons — đáp ứng chính xác yêu cầu "log đề xuất theo từng học viên" trong đề bài
- **Deterministic Fallback**: Nếu FastAPI tạm lỗi, NestJS tự động chạy luật xác định, gắn nhãn `DETERMINISTIC_FALLBACK` — attempt không bị mất, platform không crash
- **Observation Confidence**: Giảm confidence cho hint, attempt lặp, độ khó cực, phản hồi quá nhanh/chậm, attempt bị bỏ — **một lỗi đơn lẻ không đủ để gắn nhãn misconception**
- **Không nhân bản course**: AI điều chỉnh thứ tự/target bằng `Recommendation` + `ReviewSchedule`, không tạo course riêng cho mỗi học sinh
- **Idempotency**: Attempt dùng idempotency key + unique constraint — không nhân đôi dữ liệu

---

## ✍️ Vấn đề 2: AI Hỗ trợ Sản xuất Nội dung (Content Creation)

### Quy trình Soạn bài End-to-End

```
1. GIẢNG VIÊN TẢI NGUỒN
   └─► Upload TXT → API lưu ContentSource + SourceChunk trên Supabase
   └─► Giảng viên xác minh → chỉ nguồn VERIFIED được dùng trong prompt

2. AI TẠO DRAFT
   └─► AiGenerationJob ghi provider, prompt version, checksum, time, cost
   └─► Provider sinh JSON: mục tiêu, 3 pha, slides, narration, animation template, quiz
   └─► Content Validator chặn: sai schema, raw JS/HTML, remote URLs, quiz lỗi

3. GIẢNG VIÊN KIỂM DUYỆT (Human-in-the-Loop)
   └─► Sửa slide/narration/quiz → Gửi review
   └─► DRAFT → IN_REVIEW → APPROVED → PUBLISHED
   └─► Sửa bản đã approve → tự động REVISION_REQUIRED → vòng review mới

4. PHÁT HÀNH
   └─► Student endpoint CHỈ trả nội dung PUBLISHED
   └─► Mọi chuyển trạng thái có review history + audit log
```

### AI Course Planner (Tổ hợp Lộ trình Khóa học)

Giảng viên có thêm công cụ **AI Course Planner** để tạo kế hoạch khóa học từ catalog hiện có:

1. Chọn lớp pilot, khóa nguồn, khối lớp, số tuần, mục tiêu
2. `LOCAL_CATALOG_PLANNER` đọc catalog trên Supabase, tính `selectionScore` cho mỗi bài
3. Bổ sung bài tiên quyết, giữ thứ tự kiến thức, chia theo tuần
4. Lưu `CoursePlanDraft` ở trạng thái DRAFT — **không ghi đè course gốc**
5. Workflow: `DRAFT → IN_REVIEW → APPROVED → PUBLISHED` với review history

### So sánh Thời gian Soạn bài (Trước/Sau AI)

| Metric | Trước (Manual) | Sau (AI-Assisted) |
|--------|:-------------:|:----------------:|
| Thời gian cho 1 bài hoàn chỉnh | **40–50 giờ** | AI draft + teacher review |
| Quy trình | Soạn từ đầu, thủ công | AI tạo structured draft 3 pha, giảng viên chỉ sửa/duyệt |
| Tái sử dụng | Không | AI draft theo concept/misconception, reuse cho nhiều học sinh |
| Đo lường | Không tracking | Generation latency + active edit time + review time tách biệt |

> **Lưu ý minh bạch**: Hệ thống đo thời gian thật trong phiên demo. Phép so sánh chính thức cần chạy trên 2 bài hoàn chỉnh cùng phạm vi trong pilot thật, không suy ra từ timer micro-lesson.

---

## 📚 Khóa học Pilot

**Python căn bản: Từ câu lệnh đầu tiên đến trò chơi tương tác** — dành cho học sinh lớp 6–9, 6 tuần, ~16 giờ học.

| Module | Số bài | Kết quả Học tập Chính |
|--------|:------:|----------------------|
| 🟢 Khởi động cùng Python | 3 | `print`, biến, kiểu dữ liệu, `input`, phép tính |
| 🟡 Chương trình biết lựa chọn | 3 | Boolean, `if/elif/else`, mini project trợ lý học tập |
| 🔵 Lặp có kiểm soát | 3 | `for`, `range`, `while`, điều kiện dừng |
| 🟣 Dữ liệu, hàm và dự án | 3 | `list`, `function/return`, trò chơi hỏi–đáp cuối khóa |

### Dữ liệu Pilot trên Supabase

| Hạng mục | Số lượng |
|----------|-------:|
| Người dùng / Lớp / Khóa học | 21 / 1 / 1 |
| Enrollment | 20 |
| Bài học / Học liệu / Bài tập (có answer key) | 12 / 36 / 60 |
| Animation spec riêng theo bài | 12 |
| Câu đánh giá đầu vào (placement) | 5 |
| Hoạt động game học tập | 4 |
| Điểm lịch sử mastery | 444 |

> **20 hồ sơ học sinh pilot** được thiết kế **không đồng đều có chủ ý**: persona mạnh/yếu/không ổn định/nghỉ dài/ít dữ liệu/cải thiện sau ôn; event có `occurred_at` ≠ `received_at`, offline batch, sparse history, phản hồi bất thường — **không phải dữ liệu sạch lý tưởng** để đảm bảo tính thực tế.

---

## 🛡 Chống Anti-Pattern

Đề bài nêu rõ 4 anti-pattern cần tránh. Hệ thống **đã đáp ứng tất cả**:

| Anti-Pattern | Cách Hệ thống Xử lý | Trạng thái |
|-------------|---------------------|:----------:|
| ❌ Chỉ hoạt động tốt với dữ liệu mẫu sạch | ✅ Dataset pilot có thiết bị dùng chung, kết nối chập chờn, offline batch, event gửi muộn, missing history, phản hồi bất thường — tất cả đều có `data_quality_flags` | ✅ |
| ❌ AI content đi thẳng tới học sinh không qua kiểm duyệt | ✅ State machine bắt buộc `DRAFT → APPROVED → PUBLISHED`; student endpoint **chỉ đọc** `PUBLISHED`; API có JWT role guards | ✅ |
| ❌ Demo chỉ là mockup/slideshow, không có AI thật | ✅ FastAPI chạy BKT + forgetting + diagnosis thật; FPT AI tạo draft thật; content workflow end-to-end trên Supabase | ✅ |
| ❌ Phụ thuộc hoàn toàn vào paid API đắt tiền | ✅ `LocalTemplateProvider` là fallback chi phí 0 luôn sẵn sàng; FPT AI là provider mặc định nhưng không bắt buộc; recommendation engine **không dùng LLM** | ✅ |

---

## ⚡ Cài đặt & Chạy thử

### Yêu cầu

- **Node.js** ≥ 20.9, **npm** ≥ 10
- **Python** ≥ 3.11
- **Supabase PostgreSQL** (hoặc Docker Compose)

### Khởi chạy

```powershell
# 1. Cài đặt dependencies
npm install
npm run ai:install

# 2. Kiểm tra kết nối database
npm run db:check

# 3. Áp dụng migrations
npm run db:setup

# 4. Chạy toàn bộ hệ thống
npm run dev
```

### Truy cập

| Service | URL |
|---------|-----|
| 🌐 Web Application | http://localhost:3000 |
| 📡 API Documentation | http://localhost:4000/api/docs |
| 🤖 AI Service Docs | http://localhost:8001/docs |

### Tài khoản Demo

| Vai trò | Email | Mật khẩu |
|---------|-------|----------|
| 👨‍🏫 Giảng viên | `teacher@edurecall.local` | `Demo@123` |
| 👨‍🎓 Học sinh | `minh@edurecall.local` | `Demo@123` |

### Smoke Test Tự động

```powershell
# Chạy toàn bộ luồng tích hợp trên Supabase
powershell -ExecutionPolicy Bypass -File scripts/smoke-product.ps1
```

Smoke test thực hiện: `auth → course/exercise → attempt → AI diagnosis/recommendation → AI draft → teacher review → publish → student quiz → reuse`.

### Docker Compose (Tùy chọn)

```bash
docker-compose up --build
```

Compose khởi chạy: PostgreSQL `:5432`, FastAPI AI `:8001`, NestJS API `:4000`, Next.js Web `:3000`.

---

## 📈 Kết quả Kiểm chứng

> Ngày kiểm chứng: **18/07/2026** — Kết quả: **✅ PASSED**

| Hạng mục | Kết quả | Chi tiết |
|----------|:-------:|---------|
| Node Lint (ESLint) | ✅ PASS | Web + API |
| TypeScript Strict Typecheck | ✅ PASS | Tất cả workspace |
| API Unit Test | ✅ PASS | 4 suites, 7 tests |
| Web Unit Test | ✅ PASS | 2 files, 5 tests |
| Python AI Lint + Test | ✅ PASS | Ruff sạch, 17 pytest pass |
| Production Build | ✅ PASS | NestJS build + Next.js build (9 routes) |
| Supabase Connectivity | ✅ PASS | Transaction pooler + Session pooler |
| Prisma Migrations | ✅ PASS | 3/3 migration applied |
| Product Smoke Test | ✅ PASS | Full E2E luồng sản phẩm |
| Idempotency Guard | ✅ PASS | Gửi lại cùng key → không nhân đôi |
| AI Attempt Latency | ✅ PASS | 10,491ms → 7,574ms sau tối ưu |

### Bảo mật Prototype

- Bcrypt password hash + JWT access/refresh tokens
- RBAC guards + request validation + unknown-field rejection
- Rate limiting, Helmet headers, CSP
- Upload size/MIME allow-list + safe filenames + SHA-256 checksums
- **Không** `eval`, **không** provider-generated JavaScript, **không** raw HTML renderer
- Structured content validation + registered animation templates
- Student endpoint reject non-`PUBLISHED` content
- Secrets excluded from source ZIP
- Synthetic data only

---

## 📖 Tài liệu Kỹ thuật

Hệ thống có bộ tài liệu kỹ thuật đầy đủ và chuyên nghiệp:

| Tài liệu | Mô tả |
|-----------|--------|
| [`ai-mechanisms.md`](docs/ai-mechanisms.md) | Cơ chế AI chi tiết: BKT, forgetting, diagnosis, recommendation, content generation |
| [`ai-architecture.md`](docs/ai-architecture.md) | Bảng tổng hợp 7 lớp AI, công thức, failure mode |
| [`architecture.md`](docs/architecture.md) | Kiến trúc tổng thể hệ thống, attempt flow, deployment |
| [`recommendation-explainability.md`](docs/recommendation-explainability.md) | Chi tiết cách giải thích mỗi recommendation |
| [`product-blueprint.md`](docs/product-blueprint.md) | Blueprint sản phẩm, actor flows, contract AI |
| [`pilot-roadmap.md`](docs/pilot-roadmap.md) | Lộ trình pilot 6 tuần với EduOne |
| [`design-research.md`](docs/design-research.md) | Cơ sở nghiên cứu: UNESCO, UNICEF, IES/REL, EEF |
| [`model-card.md`](docs/model-card.md) | Model card: data, features, metrics, limitations |
| [`brief-fit-audit.md`](docs/brief-fit-audit.md) | Đối chiếu chi tiết từng yêu cầu đề bài |
| [`build-verification.md`](docs/build-verification.md) | Ma trận kiểm chứng build + test |
| [`domain-plugin-architecture.md`](docs/domain-plugin-architecture.md) | Kiến trúc plugin domain: thêm môn học không sửa core |
| [`security.md`](docs/security.md) | Controls bảo mật prototype + production requirements |
| [`demo-script.md`](docs/demo-script.md) | Kịch bản demo cho ban giám khảo |
| [`run-local-and-supabase.md`](docs/run-local-and-supabase.md) | Hướng dẫn chạy local + Supabase |

---

## 🗺 Pilot Roadmap với EduOne

> Chi tiết đầy đủ: [`docs/pilot-roadmap.md`](docs/pilot-roadmap.md)

### Phạm vi Pilot

| Hạng mục | Giá trị |
|----------|---------|
| Khóa học | 1 — Python căn bản (4 module, 12 bài, ~16 giờ) |
| Lớp | 1 |
| Học sinh (có đồng thuận) | 20 |
| Giảng viên | 1 |
| Thời gian | 6 tuần |

### Lịch trình 6 Tuần

| Tuần | Nội dung |
|:----:|---------|
| 1 | Đánh giá đầu vào, kiểm tra thiết bị/accessibility, hiệu chỉnh giảng viên |
| 2 | Sự kiện cá nhân hóa, theo dõi fallback, review giảng viên hàng tuần |
| 3 | Soạn bài đầy đủ + bổ trợ theo misconception, phản hồi định tính, audit |
| 4 | So sánh checkpoint, review retention, đánh giá an toàn |
| 5–6 | Mở rộng cho dữ liệu sparse, cải tiến intervention, phỏng vấn kết thúc |

### Metrics Đánh giá

- Tỉ lệ hoàn thành và quay lại học
- Thay đổi mastery và delayed recall (có uncertainty)
- Tỉ lệ chấp nhận/override recommendation
- Baseline thủ công vs thời gian edit/review có AI + content reuse
- Tỉ lệ fallback/error
- Nhận xét hữu ích từ học sinh/giảng viên
- Sự cố accessibility/privacy (mục tiêu = 0)

---

## 🏆 Điểm Nổi bật của Hệ thống

| Tiêu chí | Điểm Mạnh |
|----------|-----------|
| **Tính thực tế** | AI chạy thật trên dữ liệu thật ở Supabase — không mockup, không slideshow |
| **Tính giải thích** | Mỗi recommendation có formula, evidence, rule ID, model version — teacher và học sinh đều hiểu tại sao |
| **Human-in-the-Loop** | Nội dung AI luôn qua giảng viên trước khi đến học sinh — đúng tinh thần UNESCO/UNICEF |
| **Chi phí thấp** | LocalTemplateProvider + deterministic recommendation = chi phí AI ≈ 0 — phù hợp phi lợi nhuận |
| **Mở rộng dễ** | Domain Plugin Architecture: thêm Toán, Tiếng Anh chỉ cần thêm domain package, không sửa core |
| **Bền vững** | Fallback cho mọi failure mode — FastAPI down, LLM hết quota, mạng chậm — platform vẫn chạy |
| **Chuyên nghiệp** | Monorepo, TypeScript strict, Prisma migration, Docker Compose, 17+ tài liệu kỹ thuật |
| **An toàn** | Không eval, không raw HTML, animation template allowlist, content validator, RBAC guards |
| **Nghiên cứu** | Quyết định thiết kế dựa trên UNESCO, UNICEF, IES/REL, EEF — không tự sáng tạo guardrail |

---

## 🔧 Lệnh Chính

| Lệnh | Mục đích |
|-------|---------|
| `npm run dev` | Chạy Web + API + AI service đồng thời |
| `npm run db:check` | Kiểm tra kết nối Supabase |
| `npm run db:setup` | Áp dụng database migrations |
| `npm run ai:install` | Cài đặt Python dependencies |
| `npm run ai:train` | Train lại model AI |
| `npm run ai:evaluate` | Đánh giá model metrics |
| `npm run lint` | Kiểm tra mã nguồn (Node + Python) |
| `npm run typecheck` | TypeScript strict check |
| `npm run test` | Chạy unit tests |
| `npm run build` | Build production |
| `npm run verify` | Chạy toàn bộ pipeline kiểm chứng |

---

## 📁 Cấu trúc Dự án

```
edurecall-ai/
├── apps/
│   ├── web/                    # Next.js 16 — Student & Teacher UI
│   │   ├── features/
│   │   │   ├── student/        # Dashboard, learning view, progress
│   │   │   ├── teacher/        # Studio, analytics, course planner
│   │   │   └── product/        # API-only product context
│   │   ├── components/         # Shared UI + animation renderer
│   │   └── lib/                # API client, Vietnamese speech
│   ├── api/                    # NestJS — Core business logic
│   │   └── src/
│   │       ├── auth/           # JWT + RBAC guards
│   │       ├── database/       # Prisma module + service
│   │       ├── learning-events/# Attempt transaction + diagnostics
│   │       ├── personalization/# AI client + fallback
│   │       ├── generated-content/ # Content workflow + validation
│   │       ├── teacher/        # Course planner + review
│   │       ├── students/       # Lesson progress + dashboard
│   │       ├── games/          # Learning games
│   │       └── tts/            # Text-to-Speech service
│   └── ai-service/             # FastAPI — AI personalization engine
│       ├── app/
│       │   ├── services/       # BKT, forgetting, diagnosis, ranking
│       │   ├── api/            # REST endpoints
│       │   └── schemas/        # Request/response contracts
│       ├── ml/                 # Model artifacts
│       ├── scripts/            # Train, evaluate, generate data
│       └── tests/              # 17 pytest tests
├── packages/
│   ├── shared-types/           # TypeScript shared types
│   ├── lesson-schema/          # Lesson structure contracts
│   ├── domain-contracts/       # Domain plugin interfaces
│   ├── recommendation-contracts/ # Recommendation contracts
│   ├── api-contracts/          # API request/response types
│   ├── design-system/          # UI design tokens
│   ├── asset-library/          # Visual assets
│   └── slide-templates/        # Lesson slide templates
├── domains/
│   ├── python-foundations/     # Python domain (production)
│   ├── mathematics-foundations-example/ # Math domain (extensibility demo)
│   └── english-foundations-example/     # English domain (extensibility demo)
├── prisma/
│   ├── schema.prisma           # 1115-line comprehensive schema
│   └── migrations/             # 3 verified migrations
├── docs/                       # 17 technical documents
├── scripts/                    # Setup, verification, smoke test
├── docker-compose.yml          # Full-stack containerization
└── package.json                # Monorepo workspace config
```

---

## 🤝 Đóng góp

Dự án được phát triển cho Vietnam Innovation Challenge 2026. Mọi đóng góp và phản hồi đều được hoan nghênh.

---

## 📄 License

MIT License — Phù hợp với mô hình phi lợi nhuận của STEAM for Vietnam Foundation.

---

<div align="center">

**EduRecall AI** — *Cá nhân hóa học tập bằng AI, kiểm duyệt bởi con người, cho mọi học sinh Việt Nam.*

Built with ❤️ for **STEAM for Vietnam Foundation** · **Vietnam Innovation Challenge 2026**

</div>
