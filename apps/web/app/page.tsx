import Link from "next/link";
import { Asset } from "@/components/asset";
import { Logo } from "@/components/logo";
import { MotionReveal } from "@/components/motion-reveal";

export default function LandingPage() {
  return (
    <main id="main-content" className="landing">
      <header className="landing-nav">
        <Logo />
        <nav aria-label="Điều hướng trang giới thiệu">
          <a href="#how">Cách hoạt động</a>
          <a href="#teacher">Cho giảng viên</a>
          <Link href="/design-system">Design system</Link>
        </nav>
        <Link className="button primary small" href="/login">Trải nghiệm demo</Link>
      </header>
      <section className="hero">
        <Asset type="pattern" name="pattern-orbit" alt="" width={520} height={520} className="hero-pattern" priority />
        <MotionReveal className="hero-copy">
          <span className="hero-kicker"><Asset type="icon" name="ai-spark" alt="" width={20} height={20} /> AI có evidence · Teacher kiểm duyệt</span>
          <h1>Học theo cách<br /><em>bộ não bạn ghi nhớ.</em></h1>
          <p>EduRecall biến mỗi lần làm bài thành tín hiệu để chọn đúng hoạt động tiếp theo—và giúp giáo viên tạo micro-lesson an toàn, có thể chỉnh sửa, tái sử dụng.</p>
          <div className="hero-actions">
            <Link className="button primary large" href="/login">Bắt đầu hành trình <span>→</span></Link>
            <Link className="button ghost large" href="/teacher">Mở teacher dashboard</Link>
          </div>
          <div className="hero-proof">
            <div><strong>20</strong><span>học viên pilot</span></div>
            <div><strong>8</strong><span>learning concept</span></div>
            <div><strong>0₫</strong><span>để chạy local demo</span></div>
          </div>
        </MotionReveal>
        <MotionReveal className="hero-art" delay={0.1}>
          <Asset type="illustration" name="illustration-hero" alt="Robot Mầm dẫn học sinh qua bản đồ tri thức" width={680} height={560} priority />
          <div className="floating-card float-mastery"><span>Mastery</span><strong>42% → 56%</strong><small>sau micro-lesson</small></div>
          <div className="floating-card float-streak"><Asset type="icon" name="gamify-streak" alt="" width={26} height={26} /><strong>7 ngày</strong><small>learning streak</small></div>
        </MotionReveal>
      </section>
      <section id="how" className="landing-section steps-section">
        <div className="section-intro"><span className="eyebrow">Vòng lặp cá nhân hóa</span><h2>Mỗi tín hiệu dẫn tới một bước học có lý do.</h2><p>Không gọi mọi thứ là AI: mỗi lớp có một nhiệm vụ rõ ràng.</p></div>
        <div className="step-grid">
          {[
            ["01", "Quan sát", "Attempt, hint, tốc độ và lịch sử được lưu có idempotency.", "learning-observe"],
            ["02", "Hiểu & nhớ", "BKT đo mức hiểu; forgetting model đo nguy cơ quên.", "learning-brain"],
            ["03", "Chọn hoạt động", "Recommendation score chọn bài ôn, game hay teacher support.", "learning-path"],
            ["04", "Tạo & duyệt", "AI tạo JSON; giáo viên sửa, approve rồi mới publish.", "teacher-review"]
          ].map(([number, title, body, icon]) => (
            <article className="step-card" key={number}><span>{number}</span><Asset type="icon" name={icon ?? "learning-observe"} alt="" width={44} height={44} /><h3>{title}</h3><p>{body}</p></article>
          ))}
        </div>
      </section>
      <section id="teacher" className="landing-section teacher-showcase">
        <div className="showcase-art"><Asset type="illustration" name="illustration-teacher-review" alt="Giảng viên kiểm duyệt micro-lesson" width={600} height={440} /></div>
        <div className="showcase-copy"><span className="eyebrow light">Human in the loop</span><h2>AI soạn bản nháp.<br />Giáo viên quyết định.</h2><p>Content luôn đi qua schema, educational validation và review workflow. Học viên không bao giờ nhìn thấy DRAFT.</p><ul><li>Chỉnh từng slide, narration và quiz</li><li>So sánh AI draft với teacher version</li><li>Tái sử dụng nội dung đã duyệt cho cùng misconception</li></ul><Link href="/teacher/studio" className="button light">Xem content studio →</Link></div>
      </section>
      <section className="landing-cta">
        <Asset type="mascot" name="mam-celebrate" alt="Robot Mầm ăn mừng" width={180} height={180} />
        <div><span className="eyebrow">Hackathon-ready</span><h2>Sẵn sàng đi trọn demo 34 bước?</h2><p>Chọn tài khoản Minh hoặc Cô Mai. Không cần API key trả phí.</p></div>
        <Link href="/login" className="button primary large">Chọn tài khoản demo</Link>
      </section>
      <footer className="landing-footer"><Logo /><p>Personalization có evidence. Content có người chịu trách nhiệm.</p><span>© 2026 EduRecall AI · Synthetic pilot</span></footer>
    </main>
  );
}
