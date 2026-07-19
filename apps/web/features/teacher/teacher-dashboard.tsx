"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Asset } from "@/components/asset";
import { Metric, SectionHeading, StatusPill } from "@/components/ui";
import { useProduct } from "@/features/product/product-context";
import { apiRequest } from "@/lib/api";

const pendingStatuses = new Set(["DRAFT", "IN_REVIEW", "REVISION_REQUIRED", "APPROVED"]);

function statusTone(status: string): "green" | "yellow" | "red" | "blue" | "purple" | "gray" {
  if (status === "PUBLISHED") return "green";
  if (status === "APPROVED") return "blue";
  if (status === "REVISION_REQUIRED") return "red";
  if (status === "IN_REVIEW") return "purple";
  return "yellow";
}

function statusLabel(status: string): string {
  return ({
    DRAFT: "Bản nháp",
    IN_REVIEW: "Đang chờ duyệt",
    REVISION_REQUIRED: "Cần chỉnh sửa",
    APPROVED: "Đã phê duyệt",
    PUBLISHED: "Đã xuất bản"
  } as Record<string, string>)[status] ?? status;
}

export function TeacherDashboard() {
  const product = useProduct();
  const data = product.teacher;
  const [teacherName, setTeacherName] = useState("Giảng viên");

  useEffect(() => {
    void apiRequest<{ displayName: string }>("/auth/me")
      .then((user) => setTeacherName(user.displayName))
      .catch(() => setTeacherName("Giảng viên"));
  }, []);

  if (!data) {
    return (
      <div className="surface-card">
        <h2>Chưa tải được dashboard lớp</h2>
        <p>{product.error}</p>
      </div>
    );
  }

  const pending = product.reviewQueue.filter((item) => pendingStatuses.has(item.status));
  const published = product.reviewQueue.filter((item) => item.status === "PUBLISHED");
  const verifiedSources = product.sources.filter((item) => item.status === "VERIFIED").length;

  return (
    <div className="page-stack teacher-dashboard">
      <header className="teacher-welcome">
        <div>
          <span className="eyebrow">{data.class.name} · dữ liệu Supabase</span>
          <h1>Chào {teacherName}.</h1>
          <p>
            Có <strong>{data.needsSupport} học sinh</strong> cần hỗ trợ theo nhiều signal,
            không chỉ một câu sai.
          </p>
        </div>
        <div className="teacher-actions">
          <Link href="/teacher/studio" className="button primary">
            <Asset type="icon" name="ai-spark" alt="" width={20} height={20} />
            Soạn nội dung
          </Link>
          <Link href="/teacher/reviews" className="button ghost">Duyệt bản nháp</Link>
        </div>
      </header>

      <div className="metric-grid four">
        <Metric
          label="Mastery trung bình"
          value={`${Math.round(data.averageMastery * 100)}%`}
          note={`${data.class.students} học sinh`}
          icon="learning-brain"
        />
        <Metric
          label="Hoạt động hôm nay"
          value={`${data.activeToday}/${data.class.students}`}
          note="Từ LearningEvent"
          icon="student-group"
          tone="blue"
        />
        <Metric
          label="Bản chờ xử lý"
          value={String(pending.length)}
          note="Bản nháp, chờ duyệt và đã duyệt"
          icon="nav-review"
          tone="purple"
        />
        <Metric
          label="Nguồn đã xác minh"
          value={String(verifiedSources)}
          note={`${published.length} nội dung đã xuất bản`}
          icon="teacher-source"
          tone="orange"
        />
      </div>

      <div className="teacher-grid-main">
        <section className="surface-card">
          <SectionHeading
            eyebrow="Khoảng trống kiến thức"
            title="Lớp đang mắc ở đâu?"
            action={<Link href="/teacher/heatmap" className="text-link">Mở heatmap →</Link>}
          />
          {data.topGaps.map((gap) => (
            <article className="misconception-row" key={gap.conceptCode}>
              <span className={`severity ${gap.mastery < 0.4 ? "red" : "yellow"}`} />
              <div>
                <strong>{gap.title}</strong>
                <small>{gap.students} học sinh dưới 50%</small>
              </div>
              <StatusPill tone={gap.mastery < 0.4 ? "red" : "yellow"}>
                {Math.round(gap.mastery * 100)}%
              </StatusPill>
            </article>
          ))}
        </section>

        <aside className="surface-card misconception-list">
          <SectionHeading
            eyebrow="Quy trình nội dung"
            title="Bản nháp cần quyết định"
            action={<Link href="/teacher/studio" className="text-link">Mở studio →</Link>}
          />
          {pending.length ? pending.slice(0, 4).map((item) => (
            <article className="misconception-row" key={item.id}>
              <span className={`severity ${item.status === "REVISION_REQUIRED" ? "red" : "yellow"}`} />
              <div>
                <strong>{item.title}</strong>
                <small>{item.draftKind === "FULL_LESSON" ? "Khung bài học 3 pha" : "Bài bổ trợ"} · v{item.version}</small>
              </div>
              <StatusPill tone={statusTone(item.status)}>{statusLabel(item.status)}</StatusPill>
            </article>
          )) : (
            <p>Không có bản nháp đang chờ. Có thể bắt đầu bằng cách chọn bài, nguồn đã xác minh và mục tiêu học tập.</p>
          )}
          <Link href="/teacher/studio" className="button primary small">Tạo hoặc tiếp tục bài →</Link>
        </aside>
      </div>

      {data.misconceptions.length > 0 && (
        <section className="surface-card">
          <SectionHeading
            eyebrow="Mẫu hình từ bài làm"
            title="Misconception có thể chuyển thành bài bổ trợ"
            description="Giáo viên vẫn chọn mục tiêu, nguồn và quyết định xuất bản."
          />
          <div className="analytics-grid">
            {data.misconceptions.slice(0, 4).map((item) => (
              <article className="context-row" key={item.code}>
                <span>{item.code}</span>
                <strong>{item.students} học sinh · {item.attempts} attempt</strong>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
