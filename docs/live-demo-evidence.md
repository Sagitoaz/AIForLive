# Live demo evidence — Render

- Ngày xác minh: **19/07/2026**
- Dữ liệu: fixture synthetic `pilot-v1`, không phải dữ liệu học sinh thật
- Phạm vi: website Render do chủ dự án vận hành
- Cách đọc nhãn: **Demonstrated (owner-observed)** là hành vi đã được chủ dự án chạy trực tiếp trên deployment; mạnh hơn source/unit test nhưng vẫn cần lưu URL, ảnh Network hoặc video vào hồ sơ nộp để giám khảo tái kiểm chứng độc lập.

## Evidence map

| Luồng | Trạng thái | Bằng chứng runtime đã quan sát | Bằng chứng repository/database |
| --- | --- | --- | --- |
| External LLM tạo bài | **Demonstrated (owner-observed)** | Bản nháp lưu Supabase hiển thị `External LLM`, model `DeepSeek-V4-Flash`, `1938 tokens`, generation `7s`, trace prefix `b69e656a`, trạng thái `DRAFT` | `ExternalLlmProvider`, structured parser/validator, generation trace persistence và review gate |
| Animation + AI Voice cho học sinh | **Demonstrated (owner-observed)** | Chủ dự án đăng nhập account học sinh, mở khóa demo và xác nhận AI Voice phát narration thành công | `db:seed:check` xác nhận 12/12 lesson có một registered theory animation và narration không rỗng; component AI Voice có success/fallback status; authenticated TTS endpoint có unit test |
| AI phản hồi mã giả | **Demonstrated (owner-observed)** | Chủ dự án nộp mã giả trên account học sinh và nhận rubric feedback thành công trên deployment | `IDEA_RUBRIC`, `syntaxPolicy=IGNORE`, FastAPI external evaluator, NestJS recompute, trace persistence và deterministic fallback có nhãn riêng |
| Human review | **Demonstrated** | External LLM chỉ tạo `DRAFT`; ảnh runtime hiển thị bước tiếp theo là giáo viên kiểm tra và gửi duyệt | Transition/auth tests; student endpoint chỉ trả `PUBLISHED`; author/last editor không tự approve |
| Fixture demo | **Tested** | 20 account học sinh và 3 account giáo viên dùng chung Supabase demo | `db:seed:check`: 23 users, 12 lessons, 36 resources, 60 exercises, 400 synthetic histories |

## Runtime acceptance criteria đã đạt

1. External generation không bị nhận nhầm thành `LOCAL_TEMPLATE`: UI có provider, model, token, latency và trace thật.
2. Nội dung LLM không đi thẳng tới học sinh: output được lưu ở `DRAFT` và vẫn phải qua reviewer/publish.
3. Mỗi bài học demo có animation template do hệ thống đăng ký, không chạy JavaScript/HTML do model sinh.
4. Mỗi bài có narration và nút **AI Voice · Nghe bài**; UI công khai FPT provider hoặc browser fallback sau khi phát.
5. Mã giả nhận feedback theo ý tưởng/rubric; syntax không phải tiêu chí và fallback không giả thành external LLM.

## Automated verification cùng ngày

| Gate | Kết quả |
| --- | --- |
| Lint + Ruff | PASS |
| TypeScript Web/API | PASS |
| Web tests | 7 files / 16 tests PASS |
| API tests | 16 suites / 59 tests PASS |
| Python tests | 23 tests PASS |
| Production build | PASS ngoài sandbox Windows |
| Synthetic validation | 20 students / 8 concepts / 48 dataset exercises / 400 attempts-events PASS |
| Supabase seed verifier | 12 lessons / 36 resources / 60 exercises và animation+narration contract PASS |
| Render contract | Docker/npm 10/Python/supervisor/health/secret boundaries PASS |
| Production dependency audit | 0 vulnerability |

## Artifact cần lưu trước khi nộp

Hành vi live đã chạy thành công, nhưng repository chưa chứa URL Render hiện hành hoặc video/ảnh Network có thể mở độc lập. Trước submission, lưu ba artifact không chứa secret:

1. ảnh External LLM gồm provider/model/token/trace;
2. ảnh Network `/backend-api/tts/speech` trả `200` và `Content-Type: audio/...` trên account học sinh;
3. ảnh pseudocode mở “Chi tiết chấm để kiểm tra”, thấy mode/provider/model và không có `fallbackReason`.

Không quay API key, JWT, database URL hoặc request authorization header.
