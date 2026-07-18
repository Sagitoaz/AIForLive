"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Asset } from "@/components/asset";
import { Logo } from "@/components/logo";
import { useDemo } from "@/features/demo/demo-context";

export default function LoginPage() {
  const router = useRouter();
  const demo = useDemo();
  const choose = (role: "student" | "teacher") => {
    demo.setRole(role);
    router.push(role === "student" ? "/student" : "/teacher");
  };
  return (
    <main id="main-content" className="login-page">
      <div className="login-visual">
        <Logo />
        <div className="login-copy"><span className="eyebrow light">Một hành trình, hai góc nhìn</span><h1>Từ một lỗi sai<br />đến bài ôn đúng lúc.</h1><p>Đi luồng Minh làm sai range(), rồi chuyển sang Teacher workspace để tạo và duyệt micro-lesson.</p></div>
        <Asset type="illustration" name="illustration-diagnostic" alt="Mầm phân tích bản đồ học tập" width={600} height={430} />
      </div>
      <div className="login-panel">
        <Link href="/" className="back-link">← Về trang chủ</Link>
        <span className="eyebrow">Demo account selector</span>
        <h2>Bạn muốn vào vai nào?</h2>
        <p className="muted">Mật khẩu chung: <code>Demo@123</code></p>
        <button className="account-card" onClick={() => choose("student")}>
          <Asset type="avatar" name="avatar-01" alt="Minh" width={64} height={64} />
          <span><strong>Minh · Học sinh</strong><small>minh@edurecall.local</small><em>Tiếp tục bài range() →</em></span>
        </button>
        <button className="account-card teacher" onClick={() => choose("teacher")}>
          <Asset type="avatar" name="avatar-24" alt="Cô Mai" width={64} height={64} />
          <span><strong>Cô Mai · Giảng viên</strong><small>teacher@edurecall.local</small><em>Mở class dashboard →</em></span>
        </button>
        <button className="reset-link" onClick={demo.resetDemo}>Đặt lại toàn bộ demo</button>
        <div className="privacy-note"><Asset type="icon" name="ui-shield" alt="" width={22} height={22} /><span><strong>Không có dữ liệu trẻ em thật.</strong><small>Toàn bộ người học và attempt là synthetic.</small></span></div>
      </div>
    </main>
  );
}
