"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Asset } from "@/components/asset";
import { Logo } from "@/components/logo";
import { useDemo } from "@/features/demo/demo-context";
import { apiRequest } from "@/lib/api";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const demo = useDemo();
  const [busy, setBusy] = useState<"student" | "teacher" | null>(null);
  const [notice, setNotice] = useState("");
  const choose = async (role: "student" | "teacher") => {
    setBusy(role);
    setNotice("");
    try {
      const email = role === "student" ? "minh@edurecall.local" : "teacher@edurecall.local";
      const session = await apiRequest<{ accessToken: string; refreshToken: string }>("/auth/login", { method: "POST", body: JSON.stringify({ email, password: "Demo@123" }) });
      window.localStorage.setItem("edurecall-access-token", session.accessToken);
      window.localStorage.setItem("edurecall-refresh-token", session.refreshToken);
      setNotice("Đã xác thực với API.");
    } catch {
      window.localStorage.removeItem("edurecall-access-token");
      window.localStorage.removeItem("edurecall-refresh-token");
      setNotice("API đang offline: mở UI ở chế độ local có nhãn; thao tác server được bảo vệ sẽ không giả thành công.");
    } finally {
      demo.setRole(role);
      setBusy(null);
      router.push(role === "student" ? "/student" : "/teacher");
    }
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
        <button className="account-card" disabled={busy !== null} onClick={() => void choose("student")}>
          <Asset type="avatar" name="avatar-01" alt="Minh" width={64} height={64} />
          <span><strong>Minh · Học sinh</strong><small>minh@edurecall.local</small><em>Tiếp tục bài range() →</em></span>
        </button>
        <button className="account-card teacher" disabled={busy !== null} onClick={() => void choose("teacher")}>
          <Asset type="avatar" name="avatar-24" alt="Cô Mai" width={64} height={64} />
          <span><strong>Cô Mai · Giảng viên</strong><small>teacher@edurecall.local</small><em>Mở class dashboard →</em></span>
        </button>
        <button className="reset-link" onClick={demo.resetDemo}>Đặt lại toàn bộ demo</button>
        {notice && <p className="login-notice" role="status">{notice}</p>}
        <div className="privacy-note"><Asset type="icon" name="ui-shield" alt="" width={22} height={22} /><span><strong>Không có dữ liệu trẻ em thật.</strong><small>Toàn bộ người học và attempt là synthetic.</small></span></div>
      </div>
    </main>
  );
}
