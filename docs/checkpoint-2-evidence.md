# Checkpoint 2 — evidence index

Ngày cập nhật: 19/07/2026. Bảng này là index ngắn; bảng rubric đầy đủ nằm tại [JUDGING-EVIDENCE.md](JUDGING-EVIDENCE.md).

| Claim | Nhãn | Demo/API | Artifact |
| --- | --- | --- | --- |
| Attempt tạo phân tích cá nhân và target thật | **Demonstrated** | `POST /attempts` rồi `GET /attempts/:id/analysis` | `LearningEvent`, `Attempt`, `PersonalizationRun`, `Recommendation`, `RecommendationEvidence` |
| Mã giả được chấm theo ý tưởng, bỏ qua syntax | **Demonstrated** | `EX-08-1`, strategy `IDEA_RUBRIC` | AI criterion evidence + server grading trace |
| Code order ghép thành chương trình | **Tested** | `EX-08-2`/checkpoint | Block allowlist + accepted order contract |
| AI dùng profile/state/goal/time/prerequisite | **Tested** | So sánh account học sinh | AI client payload tests và persisted input snapshot |
| Content không bypass giáo viên | **Demonstrated** | Author submit → reviewer approve/publish | `ContentVersion`, `ContentReview`, `AuditLog`; student chỉ đọc `PUBLISHED` |
| Author và reviewer tách biệt | **Tested** | Cô Mai → Cô Linh | Class roles, author/last-editor guards |
| Course plan không tự ghi đè course | **Demonstrated** | Draft → review → revision → publish artifact | `CoursePlanDraft.reviewHistory`; apply-to-course vẫn Planned |
| Fixture 1/1/20 có thể tái tạo | **Tested** | `npm run db:seed:check` | 23 users, 12 lessons, 60 exercises, 400 synthetic histories |
| Supabase là persistence runtime | **Demonstrated** | Health, E2E, smoke, refresh-after-write | Prisma/API code và linked IDs |
| AI giảm authoring time | **Planned measurement** | Timer/trace có sẵn | Chưa có paired complete-lesson baseline |
| External LLM/TTS live | **Planned demo artifact** | Chỉ khi credential/quota thật | Path/parser unit-tested; lần verify này không có live provider trace |
| Dropout/learning outcome | **Planned pilot** | Không demo bằng fixture | Không claim trước consented pilot |

## Lệnh tái kiểm chứng

```powershell
npm run lint
npm run typecheck
npm run test
npm run ai:test
npm run validate:synthetic
npm run validate:assets
npm run db:check
npm run db:seed:check

$env:E2E_API_URL="http://127.0.0.1:4000/api"
npm run test:e2e

powershell -ExecutionPolicy Bypass -File scripts/smoke-product.ps1
npm run build
```

Smoke ghi vào database demo synthetic. Không chỉnh output hoặc xóa failure để biến fixture thành bằng chứng tác động giáo dục.
