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
          <div className="welcome-actions"><Link href="/student/exercise" className="button primary">Tiếp tục nhiệm vụ →</Link><Link href="/student/roadmap" className="button ghost">Xem bản đồ</Link></div>
        </div>
        <div className="welcome-mascot"><Asset type="mascot" name="mam-guide" alt="Mầm chỉ về nhiệm vụ hôm nay" width={230} height={210} /><span className="speech-bubble">Mình dừng <strong>trước</strong> số 5 nhé!</span></div>
        <Asset type="decoration" name="decoration-leaf-01" alt="" width={120} height={120} className="welcome-leaf" />
      </MotionReveal>

      <div className="metric-grid four">
        <Metric label="Tổng XP" value={`${demo.xp}`} note="+125 tuần này" icon="gamify-xp" tone="yellow" />
        <Metric label="Learning streak" value="7 ngày" note="Kỷ lục: 12 ngày" icon="gamify-streak" tone="orange" />
        <Metric label="Mastery trung bình" value="58%" note="+9% trong 2 tuần" icon="learning-brain" tone="green" />
        <Metric label="Bài ôn đến hạn" value={demo.lesson?.status === "PUBLISHED" ? "1" : "2"} note="Khoảng 8 phút" icon="nav-review" tone="blue" />
      </div>

      <div className="dashboard-columns">
        <section className="surface-card roadmap-preview">
          <SectionHeading eyebrow="Learning path cá nhân" title="Đường đến mini game đầu tiên" description="Node tiếp theo thay đổi theo mastery, recall risk và mục tiêu." action={<Link href="/student/roadmap" className="text-link">Mở toàn bộ →</Link>} />
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
          <h3>{demo.analysis ? "Ôn lại: stop không thuộc range" : "Thử thách: dãy range(1, 5)"}</h3>
          <p>{demo.analysis?.recommendation.reasons[0] ?? "Làm một câu để hệ thống kiểm tra giả thuyết về điểm dừng."}</p>
          <div className="signal-row"><span>Mastery <strong>{mastery}%</strong></span><span>Recall <strong>{Math.round((demo.analysis?.retrievability ?? 0.48) * 100)}%</strong></span></div>
          <ProgressBar value={mastery} />
          <Link className="button dark full" href={demo.analysis ? "/student/reviews" : "/student/exercise"}>{demo.analysis ? "Xem bài ôn" : "Làm thử thách"} →</Link>
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

      <section>
        <SectionHeading eyebrow="Bộ sưu tập tuần này" title="Mỗi kỹ năng để lại một dấu mốc" description="Badge không chỉ dựa trên tổng điểm." action={<Link href="/student/achievements" className="text-link">Xem tất cả 24 badge →</Link>} />
        <div className="badge-strip">
          {["badge-seed", "badge-streak", "badge-debugger", "badge-range", "badge-recall", "badge-helper"].map((badge, index) => (
            <div className={index > 2 ? "locked" : ""} key={badge}><Asset type="badge" name={badge} alt={`Badge ${index + 1}`} width={92} height={92} /><strong>{["Mầm đầu tiên", "Chuỗi 7 ngày", "Thợ săn bug", "Range rider", "Recall master", "Bạn học tốt"][index]}</strong><small>{index > 2 ? "Chưa mở khóa" : "Đã nhận"}</small></div>
          ))}
        </div>
      </section>
    </div>
  );
}
