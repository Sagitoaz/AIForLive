# Build verification

- Ngày kiểm chứng: **19/07/2026**
- Host: Windows, Node `v24.13.0`, Python `3.12.0`
- Kết luận: **product flow và production build pass; clean-install trên host hiện tại chưa được chứng minh**.

## Ma trận kiểm chứng

| Hạng mục | Kết quả | Bằng chứng lần chạy này |
| --- | --- | --- |
| `npm run lint` | PASS | Web/API ESLint và Python Ruff: `All checks passed!` |
| `npm run typecheck` | PASS | Next/Web và Nest/API đều `tsc --noEmit` pass |
| `npm run test` | PASS | Web: 7 files/16 tests; API: 16 suites/59 tests — tổng 75 Node tests |
| `npm run ai:test` | PASS | 23 pytest pass; 43 warning không làm test fail |
| `npm run validate:synthetic` | PASS | 20 students, 8 concepts, 48 dataset exercises, 400 attempts/events |
| `npm run ai:evaluate` | PASS | accuracy 0,6703; ROC-AUC 0,5691; Brier 0,2169 — synthetic artifact |
| `npm run validate:assets` | PASS | 254 SVG, 80 custom icons |
| `npm run db:check` | PASS | Transaction pooler và session pooler đều `OK` |
| Prisma schema/migrations | PASS | Schema valid; 5 migration directories được áp dụng, gồm RLS và class memberships |
| `npm run db:seed:check` | PASS | Toàn bộ fixture count/label/topology/grading/target/no-future-evidence checks |
| `npm run test:e2e` | PASS | 1 live HTTP test: login → attempt → persisted analysis → DB-backed target |
| Product smoke | PASS | Full flow Supabase pass trong 110,4 giây |
| Release runtime smoke | PASS | Build artifact khởi động API + AI; DB ready, 23 demo account và anonymous TTS bị chặn `401` |
| `npm run build` | PASS | NestJS + Next.js 16.2.10, TypeScript và static generation; 9 route |
| `npm run render:check` | PASS | Docker/standalone paths, Python runtime deps, supervisor ports, health path, Blueprint secrets và stale-env guard |
| npm `10.9.8 ci --dry-run` | PASS | Manifest/lockfile đồng bộ bằng đúng npm trong Render image; có đủ `@emnapi/core` và `@emnapi/runtime` |
| `npm ci` | **FAIL (host-specific)** | Workspace/junction trên filesystem Windows trả `EISDIR`/“Incorrect function”; không được ghi thành clean-clone pass |
| `npm audit --omit=dev --audit-level=high` | PASS | `found 0 vulnerabilities` |

Production build trong sandbox compile thành công nhưng Next worker bị `spawn EPERM`; cùng lệnh chạy ngoài sandbox pass đầy đủ. Lockfile ban đầu thiếu hai optional transitive record mà npm 10 yêu cầu; lỗi này đã được tái hiện bằng đúng npm `10.9.8`, sau đó lockfile được tạo lại bằng cùng version và exact-version dry-run pass. Clean install thực trong context tạm đã vượt qua kiểm tra đồng bộ nhưng host Windows vẫn dừng ở workspace symlink `EISDIR`; context tạm được dọn sạch. Linux CI/Render sau commit là bằng chứng clean-install cuối cùng.

## Unit/integration coverage đáng chú ý

- Pseudocode `IDEA_RUBRIC`: structured evidence, syntax ignored, server recompute, deterministic fallback.
- `CODE_ORDER`: reject block lạ/trùng/thiếu và chấm accepted order.
- Attempt idempotency, persistence transaction, cross-user collision và target resolution.
- Auth demo gating, live `classRoles`, class/course/source/content object authorization.
- Author/last-editor không thể tự approve; non-published content không tới học sinh.
- Reviewer không đọc learner rows; student projection không lộ answer key/provider trace.
- Multi-enrollment/multi-class regression: fixture primary context không bị legacy MVP record chiếm.
- Web practice workspaces, pending retry payload và account-session reset.
- Web refresh-token retry; authenticated TTS quota boundary và legacy TTS-key compatibility.
- AI Voice student control: narration normalization, FPT provider status và empty-narration guard.
- Registered lesson animations: branch/list/function template keys khớp domain contract.
- Render contract gate kiểm tra runtime Python deps, cổng nội bộ cố định, health path, Blueprint và secret placeholders.

## Fixture Supabase được xác minh

Các count dưới đây lọc theo `metadataJson.fixture = pilot-v1`; smoke test có thể tạo thêm artifact ngoài fixture mà không làm thay đổi contract này.

| Nhóm | Số lượng |
| --- | ---: |
| Users / teacher profiles / student profiles | 23 / 3 / 20 |
| Organization / domain / course / class | 1 / 1 / 1 / 1 |
| Teacher memberships / enrollments | 3 / 20 |
| Modules / lessons / resources / exercises | 4 / 12 / 36 / 60 |
| Verified source / chunks | 1 / 3 |
| Concept states / histories | 160 / 400 |
| Linked events / attempts | 20 / 20 |
| Recommendations / evidence / schedules | 20 / 20 / 20 |

Seed cold run gần nhất mất **476,2 giây** qua Supabase. Verifier xác nhận:

- 12 pseudocode exercise dùng `IDEA_RUBRIC`, chỉ ở Practice và `syntaxPolicy=IGNORE`;
- 24 exercise dùng `CODE_ORDER` với block-order contract;
- mọi exercise active có teacher-reviewed answer contract và primary concept;
- mọi recommendation fixture có target exercise active cùng course và một linked attempt;
- 400 history là unique, không ở tương lai và gắn nhãn model-snapshot/synthetic;
- class/enrollment demo được đánh dấu primary context để tránh record legacy cũ.
- 12/12 bài có đúng một registered theory animation với `animationData` và narration không rỗng.

## Database/RLS

`scripts/audit-database-state.mjs` xác nhận RLS bật trên tất cả business tables, gồm `ClassTeacherMembership`. Mô hình hiện tại là API-only:

- `anon` và `authenticated` bị revoke table privileges;
- không có permissive client policy;
- Prisma/API kết nối bằng server credential và vẫn phải thực hiện object authorization theo JWT/course/class.

Migration history giữ lại một attempt `202607180004_supabase_rls_policies` đã rollback vì Supabase không cho sửa schema `auth`; migration cùng tên sau đó được dựng lại chỉ cho public business tables và áp dụng thành công. Lịch sử rollback không được xóa để giữ audit trail.

## Smoke/E2E đã chứng minh

```text
health/database/AI
→ student primary enrollment
→ course progress + registered animation
→ pseudocode IDEA_RUBRIC
→ deterministic scored attempt + RANGE_STOP_INCLUDED
→ persisted recommendation/evidence/real target
→ VERIFIED source + full lesson generation
→ author submit + independent reviewer approve/publish
→ student-safe published projection
→ course-plan draft/review/edit→REVISION_REQUIRED/re-review/publish
```

Smoke ghi dữ liệu thật vào database demo nhưng các record đó vẫn là hoạt động trên fixture synthetic, không phải dữ liệu học sinh EduOne thật.

## Supply-chain gate

`npm audit --omit=dev --audit-level=high` trong lần kiểm chứng 19/07/2026 trả `found 0 vulnerabilities`. GitHub Actions vẫn giữ production dependency audit làm release gate để kết quả thay đổi theo advisory/lockfile mới không bị che giấu.

## Giới hạn chưa được che giấu

- Clean clone/install cần được chạy lại trong CI Linux hoặc Windows filesystem không có lỗi junction trước submission.
- Chưa có browser E2E chạy trên deployment công khai; live test hiện là HTTP contract vào API local/Supabase.
- External LLM generation, student TTS và pseudocode feedback đã được chủ dự án chạy thành công trên Render; repo vẫn cần pin URL hiện hành và lưu video/Network artifact để bên thứ ba tái kiểm chứng.
- Model metrics là synthetic và ROC-AUC còn thấp; không phải chứng cứ pedagogical effectiveness.
- Chưa có load test 20 học sinh đồng thời, paired teacher-time baseline hoặc real pilot.
- `LOCAL_TEMPLATE` là deterministic provider, không được tính là LLM call.
