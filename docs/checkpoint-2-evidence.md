# Checkpoint 2 — Evidence index

Mục tiêu của bảng này là giúp người chấm đi từ claim đến màn hình, API và record thật. `Verified` nghĩa là đã có source/test hoặc dữ liệu Supabase; `Demo after deploy` cần live URL; `Missing` không được claim.

| Claim | Trạng thái | Demo/API | Artifact có thể kiểm tra |
| --- | --- | --- | --- |
| Mỗi attempt tạo phân tích cá nhân | Verified | Học sinh làm Practice; `POST /attempts` | `LearningEvent`, `Attempt`, `PersonalizationRun`, `StudentConceptState` |
| AI dùng mục tiêu/quỹ thời gian/progress thật | Verified | So sánh hai hồ sơ | `AiClientService` đọc `StudentProfile`, `Enrollment`, prerequisite states; unit test payload |
| Recommendation giải thích được | Verified | Trang AI đề xuất/evidence giảng viên | reasons, candidate scores, rule/model version, attempt ID |
| Target recommendation mở nội dung thật | Verified | Bấm target sau attempt | Resolver chỉ chọn `PUBLISHED MicroLesson`, `ACTIVE Exercise/Lesson`; metadata `targetResolution` |
| Nội dung không bypass giáo viên | Verified | Draft → Review → Approve → Publish | `ContentReview`, `ContentVersion`, `AuditLog`; student chỉ đọc `PUBLISHED` |
| AI giúp giảm thời gian thao tác | Demo measurement | Tạo rồi sửa một draft | `generationMs`, `teacherEditingSeconds`; không suy rộng thành 40–50 giờ |
| Dữ liệu pilot 1/1/20 không quá sạch | Verified synthetic | Dashboard lớp/heatmap | 1 course, 1 class, 20 enrollment, mastery/history khác nhau |
| Supabase là nguồn nghiệp vụ duy nhất | Verified | `/backend-api/health`, refresh sau write | Prisma services + smoke test; không có frontend demo store |
| Live URL | Demo after deploy | Render Web Service | Thêm URL thật vào README sau khi health PASS |
| External LLM | Demo after deploy | Tạo draft với provider `EXTERNAL_LLM` | `AiGenerationJob`/`GeneratedContent` provider/model/latency; cần key và quota thật |
| Video 60–90 giây | Missing | Golden path | Chủ dự án cần quay sau deploy |
| Tác động dropout/learning outcome | Missing | Pilot thật | Không claim ở Checkpoint 2 |

## Lệnh tái kiểm chứng

```powershell
npm run typecheck
npm run lint
npm run test
npm run build

$env:E2E_API_URL="https://<service>.onrender.com/backend-api"
npm run test:e2e
Remove-Item Env:E2E_API_URL
```

Luồng write đầy đủ hơn:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/smoke-product.ps1 `
  -ApiUrl "https://<service>.onrender.com/backend-api"
```

Smoke script ghi dữ liệu thật vào Supabase pilot. Không chạy trên dữ liệu trẻ em thật và không chỉnh output để làm bằng chứng.
