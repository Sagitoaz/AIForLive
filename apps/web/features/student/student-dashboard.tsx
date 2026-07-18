"use client";

import Link from "next/link";
import { Asset } from "@/components/asset";
import { EmptyState, Metric, ProgressBar, SectionHeading, StatusPill } from "@/components/ui";
import { useProduct } from "@/features/product/product-context";
import styles from "./student-learning.module.css";

function DashboardSkeleton() {
  return (
    <div className={styles.skeletonPage} aria-label="Đang tải trang học hôm nay" aria-busy="true">
      <div className={styles.skeletonHero}/>
      <div className={styles.skeletonGrid}>
        {Array.from({ length: 3 }, (_, index) => <div className={styles.skeletonCard} key={index}/>) }
      </div>
    </div>
  );
}

export function StudentDashboard() {
  const product = useProduct();
  const dashboard = product.student;
  if (!dashboard && product.busy) return <DashboardSkeleton/>;
  if (!dashboard) return <div className="page-stack"><EmptyState illustration="activity" title="Chưa tải được hồ sơ học sinh" description={product.error ?? "Dữ liệu học tập chưa sẵn sàng."}/><button className="button primary" disabled={product.busy} onClick={() => void product.refresh()}>{product.busy ? "Đang tải lại…" : "Tải lại dữ liệu"}</button></div>;
  const average = product.concepts.length ? product.concepts.reduce((sum, item) => sum + item.mastery, 0) / product.concepts.length : 0;
  const recommendation = product.recommendations.find((item) => item.status === "ACTIVE");
  const lessonCount = product.course?.modules.reduce((sum, module) => sum + module.lessons.length, 0) ?? 0;
  const currentLessonHref = product.lesson ? `/student/lessons/${product.lesson.id}` : "/student/course";
  return <div className="page-stack">
    <header className="student-welcome"><div className="welcome-copy"><span className="eyebrow">Lộ trình cá nhân · dữ liệu từ Supabase</span><h1>Chào {dashboard.student.name},<br/>hôm nay mình học đúng một bước cần thiết.</h1><p>Mục tiêu: <strong>{dashboard.goal.objective}</strong> · {dashboard.goal.weeklyMinutes} phút/tuần.</p><div className="welcome-actions"><Link href={currentLessonHref} className="button primary">Học bài đang tập trung →</Link><Link href="/student/course" className="button ghost">{lessonCount ? `Xem ${lessonCount} bài` : "Xem khóa học"}</Link></div></div><Asset type="mascot" name="mam-guide" alt="Robot Mầm đang chỉ vào bài học hôm nay" width={230} height={210}/></header>
    <div className="metric-grid four"><Metric label="Tiến độ khóa" value={`${Math.round(dashboard.course.progress * 100)}%`} note={dashboard.course.title} icon="nav-roadmap" tone="yellow"/><Metric label="Tuần này" value={`${dashboard.weeklyActivity.reduce((a, b) => a + b, 0)} phút`} note={`Mục tiêu ${dashboard.goal.weeklyMinutes} phút`} icon="gamify-streak" tone="orange"/><Metric label="Mastery trung bình" value={`${Math.round(average * 100)}%`} note={`${product.concepts.length} kỹ năng`} icon="learning-brain" tone="green"/><Metric label="Bài ôn đến hạn" value={String(dashboard.dueReviews)} note="Từ lịch ôn Supabase" icon="nav-review" tone="blue"/></div>
    <div className="dashboard-columns"><section className="surface-card roadmap-preview"><SectionHeading eyebrow="Lộ trình cá nhân" title="Kỹ năng của bạn" description="Bài đã học luôn có thể mở lại; AI chỉ thay đổi thứ tự ưu tiên."/><div className="path-line">{product.concepts.map((concept) => <Link key={concept.id} href={`/student/concepts/${concept.code}`} className={`path-node ${concept.mastery >= .65 ? "completed" : "available"}`}><span className="node-icon"><Asset type="icon" name="concept-branch" alt="" width={28} height={28}/></span><span className="node-copy"><strong>{concept.title}</strong><small>Nắm vững {Math.round(concept.mastery * 100)}% · nhớ lại {Math.round(concept.retrievability * 100)}%</small></span></Link>)}</div></section><aside className="focus-card"><div className="focus-top"><StatusPill tone="yellow">AI đề xuất hôm nay</StatusPill><span>{recommendation ? Math.round(recommendation.priorityScore * 100) : 0}/100 ưu tiên</span></div><Asset type="illustration" name="illustration-personalized-path" alt="Minh họa lộ trình học cá nhân" width={260} height={160}/><h3>{recommendation?.conceptTitle ?? dashboard.focus?.conceptCode ?? "Chờ bài làm đầu tiên"}</h3><p>{recommendation?.reasons[0] ?? dashboard.focus?.reason ?? "Hãy làm bài đánh giá đầu vào để hệ thống có đủ bằng chứng."}</p><ProgressBar value={(dashboard.focus?.mastery ?? average) * 100}/><Link className="button dark full" href={recommendation ? "/student/reviews" : "/student/diagnostic"}>{recommendation ? "Mở đề xuất" : "Làm bài đầu vào"} →</Link></aside></div>
    {product.analysis && <section className="evidence-banner"><Asset type="icon" name="ai-evidence" alt="" width={40} height={40}/><div><StatusPill tone={product.analysis.mode === "AI_SERVICE" ? "green" : "yellow"}>{product.analysis.mode === "AI_SERVICE" ? "AI service" : "Chế độ dự phòng"}</StatusPill><h3>{product.analysis.diagnosis.misconception_code ?? product.analysis.diagnosis.status}</h3><p>{product.analysis.explanations.join(" · ")}</p></div></section>}
  </div>;
}
