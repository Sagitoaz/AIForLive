"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Asset } from "@/components/asset";
import { Logo } from "@/components/logo";
import { useProduct } from "@/features/product/product-context";
import { apiRequest } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter(); const product = useProduct();
  const [busy, setBusy] = useState<"student" | "teacher" | null>(null); const [notice, setNotice] = useState("");
  const choose = async (role: "student" | "teacher") => {
    setBusy(role); setNotice("");
    try {
      const email = role === "student" ? "minh@edurecall.local" : "teacher@edurecall.local";
      const session = await apiRequest<{ accessToken: string; refreshToken: string }>("/auth/login", { method: "POST", body: JSON.stringify({ email, password: "Demo@123" }) });
      window.localStorage.setItem("edurecall-access-token", session.accessToken); window.localStorage.setItem("edurecall-refresh-token", session.refreshToken);
      await product.setRole(role); router.push(role === "student" ? "/student" : "/teacher");
    } catch (cause) { window.localStorage.removeItem("edurecall-access-token"); window.localStorage.removeItem("edurecall-refresh-token"); setNotice(cause instanceof Error ? cause.message : "Không kết nối được API/Supabase"); }
    finally { setBusy(null); }
  };
  return <main id="main-content" className="login-page"><div className="login-visual"><Logo/><div className="login-copy"><span className="eyebrow light">Một sản phẩm, hai vai trò</span><h1>Học đúng phần cần học.<br/>Soạn bài nhanh nhưng có kiểm duyệt.</h1><p>Đăng nhập vào dữ liệu pilot thật trên Supabase: 1 lớp Python, 20 học sinh và luồng AI có log giải thích.</p></div><Asset type="illustration" name="illustration-diagnostic" alt="Bản đồ học tập cá nhân" width={600} height={430}/></div><div className="login-panel"><Link href="/" className="back-link">← Về trang chủ</Link><span className="eyebrow">Tài khoản pilot</span><h2>Chọn không gian làm việc</h2><p className="muted">Mật khẩu pilot: <code>Demo@123</code></p><button className="account-card" disabled={busy !== null} onClick={() => void choose("student")}><Asset type="avatar" name="avatar-01" alt="Minh" width={64} height={64}/><span><strong>Minh · Học sinh</strong><small>minh@edurecall.local</small><em>Mở lộ trình cá nhân →</em></span></button><button className="account-card teacher" disabled={busy !== null} onClick={() => void choose("teacher")}><Asset type="avatar" name="avatar-24" alt="Cô Mai" width={64} height={64}/><span><strong>Cô Mai · Giảng viên</strong><small>teacher@edurecall.local</small><em>Mở lớp học →</em></span></button>{notice && <p className="login-notice" role="status">{notice}</p>}<div className="privacy-note"><Asset type="icon" name="ui-shield" alt="" width={22} height={22}/><span><strong>Dataset pilot có kiểm soát.</strong><small>Dữ liệu có cả lịch sử thiếu, kết nối không ổn định và mức năng lực khác nhau.</small></span></div></div></main>;
}
