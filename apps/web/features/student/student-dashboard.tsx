"use client";

import Link from "next/link";
import { Asset } from "@/components/asset";
import { MotionReveal } from "@/components/motion-reveal";
import { Metric, ProgressBar, SectionHeading, StatusPill } from "@/components/ui";
import { useDemo } from "@/features/demo/demo-context";
import { concepts } from "@/lib/demo-data";

export function StudentDashboard() {
  const demo = useDemo();
  const mastery = Math.round(demo.mastery * 100);
  return (
    <div className="page-stack">
      <MotionReveal className="student-welcome">
        <div className="welcome-copy">
          <span className="eyebrow">Thứ bảy · Nhiệm vụ ngày 18</span>
          <h1>Chào Minh, sẵn sàng<br />cho một bước tiến nhỏ?</h1>
          <p>Mầm đã xem lại nhịp học của bạn. Chỉ cần <strong>15 phút</strong> để giữ đúng lộ trình 4 tuần.</p>
          <div className="welcome-actions"><Link href="/student/lesson" className="button primary">Học tiếp bài 8 →</Link><Link href="/student/course" className="button ghost">Xem khóa học</Link></div>
        </div>
        <div className="welcome-mascot"><Asset type="mascot" name="mam-guide" alt="Mầm chỉ về nhiệm vụ hôm nay" width={230} height={210} /><span className="speech-bubble">Mình dừng <strong>trước</strong> số 5 nhé!</span></div>
        <Asset type="decoration" name="decoration-leaf-01" alt="" width={120} height={120} className="welcome-leaf" />
      </MotionReveal>

      <div className="metric-grid four">
        <Metric label="Tiến độ khóa" value="7/12 bài" note="Đang học module 3" icon="nav-roadmap" tone="yellow" />
        <Metric label="Thời gian tuần" value="96 phút" note="Mục tiêu 120 phút" icon="gamify-streak" tone="orange" />
        <Metric label="Mastery trung bình" value="58%" note="+9% trong 2 tuần" icon="learning-brain" tone="green" />
        <Metric label="Bài ôn đến hạn" value={demo.lesson?.status === "PUBLISHED" ? "1" : "2"} note="Khoảng 8 phút" icon="nav-review" tone="blue" />
      </div>

      <div className="dashboard-columns">
        <section className="surface-card roadmap-preview">
          <SectionHeading eyebrow="Learning path cá nhân" title="Đường đến sản phẩm cuối khóa" description="Node tiếp theo thay đổi theo mastery, recall risk, quỹ thời gian và mục tiêu tạo trò chơi hỏi–đáp." action={<Link href="/student/roadmap" className="text-link">Mở toàn bộ →</Link>} />
          <div className="path-line">
            {concepts.slice(0, 6).map((concept, index) => {
              const value = concept.code === "PYTHON_RANGE" ? mastery : concept.mastery;
              return (
                <Link key={concept.code} href={`/student/concepts/${concept.code}`} className={`path-node ${concept.status}`}>
                  <span className="node-icon"><Asset type="icon" name={concept.icon} alt="" width={28} height={28} /></span>
                  <span className="node-copy"><strong>{concept.title}</strong><small>{index < 4 ? `${value}% mastery` : index === 4 ? "Nhiệm vụ hiện tại" : "Cần mở khóa"}</small></span>
                </Link>
              );
            })}
          </div>
        </section>

        <aside className="focus-card">
          <div className="focus-top"><StatusPill tone="yellow">AI đề xuất hôm nay</StatusPill><span>{demo.analysis?.recommendation.priority_score ? Math.round(demo.analysis.recommendation.priority_score * 100) : 87}/100 ưu tiên</span></div>
          <Asset type="illustration" name="illustration-micro-lesson" alt="Bài học ngắn về range" width={260} height={160} />
          <h3>{demo.analysis?.recommendation.target?.title ?? "Bài 8: Khám phá range()"}</h3>
          <p>{demo.analysis?.recommendation.reasons[0] ?? "Bắt đầu bằng lý thuyết ngắn, sau đó thực hành để hệ thống kiểm tra cách bạn hiểu điểm dừng."}</p>
          <div className="signal-row"><span>Mastery <strong>{mastery}%</strong></span><span>Recall <strong>{Math.round((demo.analysis?.retrievability ?? 0.48) * 100)}%</strong></span></div>
          <ProgressBar value={mastery} />
          <Link className="button dark full" href={demo.analysis ? "/student/reviews" : "/student/lesson"}>{demo.analysis ? "Mở hoạt động được đề xuất" : "Mở bài học 3 pha"} →</Link>
          <Link className="reason-link" href="/student/concepts/PYTHON_RANGE">Vì sao mình nhận đề xuất này?</Link>
        </aside>
      </div>

      {demo.analysis && (
        <MotionReveal className="evidence-banner">
          <Asset type="icon" name="ai-evidence" alt="" width={40} height={40} />
          <div><StatusPill tone={demo.analysis.mode === "AI_SERVICE" ? "green" : "yellow"}>{demo.analysis.mode === "AI_SERVICE" ? "Python AI service" : "Fallback mode"}</StatusPill><h3>{demo.analysis.diagnosis.misconception_code}</h3><p>{demo.analysis.diagnosis.evidence.join(" · ")}</p></div>
          <Link href="/student/concepts/PYTHON_RANGE" className="button ghost small">Xem evidence</Link>
        </MotionReveal>
      )}

      <section className="surface-card weekly-learning-summary">
        <SectionHeading eyebrow="Tuần học hiện tại" title="Tiến bộ theo hoạt động học" description="Hệ thống theo dõi từng pha để tránh trường hợp chỉ xem bài giảng nhưng chưa luyện hoặc kiểm tra." action={<Link href="/student/progress" className="text-link">Xem phân tích →</Link>} />
        <div>{[["Lý thuyết", "2/3", 67, "Bài giảng · video · tài liệu"], ["Thực hành", "5/7", 71, "Code · dự đoán · sửa lỗi"], ["Kiểm tra cuối bài", "1/2", 50, "Còn checkpoint range()"]].map(([label, value, progress, note]) => <article key={String(label)}><span>{label}</span><strong>{value}</strong><ProgressBar value={Number(progress)}/><small>{note}</small></article>)}</div>
      </section>
    </div>
  );
}
