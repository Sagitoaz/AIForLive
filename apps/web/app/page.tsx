import Link from "next/link";
import { Asset } from "@/components/asset";
import { Logo } from "@/components/logo";
import { MotionReveal } from "@/components/motion-reveal";

export default function LandingPage() {
  const steps: Array<[string, string, string, string]> = [
    ["01", "Quan sát", "Mỗi lần làm bài được lưu thành bằng chứng học tập trên Supabase.", "learning-observe"],
    ["02", "Hiểu lỗ hổng", "AI ước lượng mức thành thạo, nguy cơ quên và sai lầm cụ thể.", "learning-brain"],
    ["03", "Chọn bước tiếp theo", "Học sinh nhận đúng bài ôn hoặc hoạt động phù hợp, kèm lý do.", "learning-path"],
    ["04", "Soạn và kiểm duyệt", "AI tạo bản nháp; giảng viên chỉnh sửa và duyệt trước khi xuất bản.", "teacher-review"]
  ];

  return (
    <main id="main-content" className="landing">
      <header className="landing-nav">
        <Logo />
        <nav aria-label="Điều hướng trang giới thiệu">
          <a href="#how">Cách hoạt động</a>
          <a href="#teacher">Cho giảng viên</a>
          <Link href="/design-system">Design system</Link>
        </nav>
        <Link className="button primary small" href="/login">Vào sản phẩm</Link>
      </header>

      <section className="hero">
        <Asset type="pattern" name="pattern-orbit" alt="" width={520} height={520} className="hero-pattern" priority />
        <MotionReveal className="hero-copy">
          <span className="hero-kicker"><Asset type="icon" name="ai-spark" alt="" width={20} height={20} /> AI có bằng chứng · Giảng viên kiểm duyệt</span>
          <h1>Học đúng phần<br /><em>mình đang cần.</em></h1>
          <p>EduRecall biến mỗi lần làm bài thành tín hiệu để điều chỉnh lộ trình, đồng thời giúp giảng viên tạo học liệu nhanh hơn mà vẫn giữ quyền quyết định cuối cùng.</p>
          <div className="hero-actions">
            <Link className="button primary large" href="/login">Bắt đầu học <span>→</span></Link>
            <Link className="button ghost large" href="/teacher">Không gian giảng viên</Link>
          </div>
          <div className="hero-proof">
            <div><strong>20</strong><span>học sinh pilot</span></div>
            <div><strong>12</strong><span>bài học thực tế</span></div>
            <div><strong>60</strong><span>bài tập đã duyệt</span></div>
          </div>
        </MotionReveal>
        <MotionReveal className="hero-art" delay={0.1}>
          <Asset type="illustration" name="illustration-hero" alt="Trợ lý dẫn học sinh qua bản đồ kiến thức" width={680} height={560} priority />
          <div className="floating-card float-mastery"><span>Mức thành thạo</span><strong>42% → 56%</strong><small>sau bài củng cố</small></div>
          <div className="floating-card float-streak"><Asset type="icon" name="gamify-streak" alt="" width={26} height={26} /><strong>7 ngày</strong><small>học đều đặn</small></div>
        </MotionReveal>
      </section>

      <section id="how" className="landing-section steps-section">
        <div className="section-intro"><span className="eyebrow">Vòng lặp cá nhân hóa</span><h2>Mỗi đề xuất đều có lý do.</h2><p>AI không thay giáo viên; AI xử lý tín hiệu liên tục để giáo viên tập trung vào quyết định sư phạm.</p></div>
        <div className="step-grid">
          {steps.map(([number, title, body, icon]) => (
            <article className="step-card" key={number}><span>{number}</span><Asset type="icon" name={icon} alt="" width={44} height={44} /><h3>{title}</h3><p>{body}</p></article>
          ))}
        </div>
      </section>

      <section id="teacher" className="landing-section teacher-showcase">
        <div className="showcase-art"><Asset type="illustration" name="illustration-teacher-review" alt="Giảng viên kiểm duyệt micro-lesson" width={600} height={440} /></div>
        <div className="showcase-copy"><span className="eyebrow light">Human in the loop</span><h2>AI soạn bản nháp.<br />Giảng viên quyết định.</h2><p>Nội dung đi qua kiểm tra cấu trúc, chỉnh sửa và quy trình duyệt. Học sinh không bao giờ nhìn thấy bản nháp.</p><ul><li>Tạo bài giảng, animation và câu hỏi từ nguồn đã xác minh</li><li>Chỉnh nội dung, lời đọc và đáp án trước khi duyệt</li><li>Tái sử dụng nội dung đã duyệt cho cùng lỗ hổng kiến thức</li></ul><Link href="/teacher/studio" className="button light">Mở AI Studio →</Link></div>
      </section>

      <section className="landing-cta">
        <Asset type="mascot" name="mam-celebrate" alt="Trợ lý học tập ăn mừng" width={180} height={180} />
        <div><span className="eyebrow">Pilot trên Supabase</span><h2>Sẵn sàng đi hết một luồng sản phẩm thật?</h2><p>Chọn tài khoản Minh hoặc Cô Mai để xem dữ liệu lớp và log AI được lưu trực tiếp.</p></div>
        <Link href="/login" className="button primary large">Chọn tài khoản pilot</Link>
      </section>

      <footer className="landing-footer"><Logo /><p>Cá nhân hóa có bằng chứng. Nội dung có người chịu trách nhiệm.</p><span>© 2026 EduRecall AI · Controlled pilot</span></footer>
    </main>
  );
}
