"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Asset } from "@/components/asset";
import { Logo } from "@/components/logo";
import { useProduct } from "@/features/product/product-context";
import { apiRequest } from "@/lib/api";

type DemoRole = "STUDENT" | "TEACHER";

interface DemoAccount {
  id: string;
  displayName: string;
  email: string;
  role: DemoRole;
  avatar: string | null;
  description: string;
  classRoles?: Array<"OWNER" | "INSTRUCTOR" | "REVIEWER">;
}

interface LoginSession {
  accessToken: string;
  refreshToken: string;
  user: { id: string; displayName: string; email: string; role: DemoRole };
}

const fallbackAccounts: DemoAccount[] = [
  { id: "student-fallback", displayName: "Minh", email: "minh@edurecall.local", role: "STUDENT", avatar: "avatar-01", description: "Học sinh demo chính", classRoles: [] },
  { id: "teacher-fallback", displayName: "Cô Mai", email: "teacher@edurecall.local", role: "TEACHER", avatar: "avatar-24", description: "Giảng viên demo chính", classRoles: ["OWNER"] }
];

function demoRoleLabel(account: DemoAccount): string {
  if (account.role === "STUDENT") return "Học sinh";
  const role = account.classRoles?.[0];
  return ({ OWNER: "Chủ lớp / tác giả", INSTRUCTOR: "Giảng viên hỗ trợ", REVIEWER: "Kiểm duyệt độc lập" } as Record<string, string>)[role ?? ""] ?? "Giảng viên";
}

function safeAvatar(account: DemoAccount, index: number): string {
  if (/^avatar-\d{2}$/.test(account.avatar ?? "")) return account.avatar!;
  const fixtureNumber = account.avatar?.match(/(\d{1,2})$/)?.[1];
  if (account.role === "STUDENT" && fixtureNumber) return `avatar-${fixtureNumber.padStart(2, "0")}`;
  if (account.role === "TEACHER") return `avatar-${String(Math.max(22, 24 - index)).padStart(2, "0")}`;
  return `avatar-${String((index % 21) + 1).padStart(2, "0")}`;
}

export default function LoginPage() {
  const router = useRouter();
  const product = useProduct();
  const [accounts, setAccounts] = useState<DemoAccount[]>([]);
  const [roleFilter, setRoleFilter] = useState<DemoRole>("STUDENT");
  const [query, setQuery] = useState("");
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [usingFallback, setUsingFallback] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    void apiRequest<DemoAccount[]>("/auth/demo-accounts")
      .then((rows) => {
        if (!active) return;
        setAccounts(rows.length ? rows : fallbackAccounts);
        setUsingFallback(!rows.length);
      })
      .catch(() => {
        if (!active) return;
        setAccounts(fallbackAccounts);
        setUsingFallback(true);
      })
      .finally(() => { if (active) setLoadingAccounts(false); });
    return () => { active = false; };
  }, []);

  const visibleAccounts = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("vi");
    return accounts.filter((account) => account.role === roleFilter && (!normalizedQuery
      || account.displayName.toLocaleLowerCase("vi").includes(normalizedQuery)
      || account.email.toLocaleLowerCase("vi").includes(normalizedQuery)));
  }, [accounts, query, roleFilter]);

  const counts = useMemo(() => ({
    STUDENT: accounts.filter((account) => account.role === "STUDENT").length,
    TEACHER: accounts.filter((account) => account.role === "TEACHER").length
  }), [accounts]);

  const choose = async (account: DemoAccount) => {
    setBusyId(account.id);
    setNotice("");
    product.logout();
    try {
      const session = await apiRequest<LoginSession>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: account.email, password: "Demo@123" })
      });
      window.localStorage.setItem("edurecall-access-token", session.accessToken);
      window.localStorage.setItem("edurecall-refresh-token", session.refreshToken);
      const role = session.user.role === "TEACHER" ? "teacher" : "student";
      await product.setRole(role);
      router.push(role === "student" ? "/student" : "/teacher");
    } catch (cause) {
      window.localStorage.removeItem("edurecall-access-token");
      window.localStorage.removeItem("edurecall-refresh-token");
      setNotice(cause instanceof Error ? cause.message : "Không kết nối được API/Supabase");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <main id="main-content" className="login-page">
      <div className="login-visual">
        <Logo/>
        <div className="login-copy">
          <span className="eyebrow light">Một sản phẩm, hai vai trò</span>
          <h1>Học đúng phần cần học.<br/>Soạn bài nhanh nhưng có kiểm duyệt.</h1>
          <p>Chọn nhiều hồ sơ tổng hợp để trình diễn sự khác biệt về năng lực, lịch sử học và quyền giảng viên trong cùng một lớp pilot.</p>
        </div>
        <Asset type="illustration" name="illustration-diagnostic" alt="Bản đồ học tập cá nhân" width={600} height={430}/>
      </div>
      <div className="login-panel">
        <Link href="/" className="back-link">← Về trang chủ</Link>
        <span className="eyebrow">Tài khoản demo tổng hợp</span>
        <h2>Chọn hồ sơ để bắt đầu</h2>
        <p className="muted">Mật khẩu chung: <code>Demo@123</code>. Không dùng dữ liệu trẻ em thật.</p>
        <div className="account-role-tabs" role="group" aria-label="Lọc theo vai trò demo">
          <button type="button" aria-pressed={roleFilter === "STUDENT"} className={roleFilter === "STUDENT" ? "active" : ""} onClick={() => setRoleFilter("STUDENT")}>Học sinh <span>{counts.STUDENT}</span></button>
          <button type="button" aria-pressed={roleFilter === "TEACHER"} className={roleFilter === "TEACHER" ? "active" : ""} onClick={() => setRoleFilter("TEACHER")}>Giảng viên <span>{counts.TEACHER}</span></button>
        </div>
        <label className="account-search">
          <span>Tìm theo tên hoặc email</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ví dụ: Minh, Cô Mai…"/>
        </label>
        {loadingAccounts ? <div className="account-loading" aria-live="polite">Đang tải danh sách tài khoản…</div> : (
          <div className="account-list">
            {visibleAccounts.map((account, accountIndex) => (
              <button type="button" className={`account-card compact ${account.role === "TEACHER" ? "teacher" : ""}`} disabled={busyId !== null} onClick={() => void choose(account)} key={account.id}>
                <Asset type="avatar" name={safeAvatar(account, accountIndex)} alt="" width={52} height={52}/>
                <span>
                  <strong>{account.displayName} · {demoRoleLabel(account)}</strong>
                  <small>{account.email}</small>
                  <em>{busyId === account.id ? "Đang đăng nhập…" : account.description}</em>
                </span>
              </button>
            ))}
            {!visibleAccounts.length && <p className="account-empty">Không tìm thấy hồ sơ phù hợp.</p>}
          </div>
        )}
        {usingFallback && <p className="login-notice" role="status">API danh sách demo chưa sẵn sàng; đang hiển thị hai tài khoản tương thích cũ.</p>}
        {notice && <p className="login-notice" role="alert">{notice}</p>}
        <div className="privacy-note">
          <Asset type="icon" name="ui-shield" alt="" width={22} height={22}/>
          <span><strong>Dataset chỉ phục vụ demo.</strong><small>Các hồ sơ được gắn nhãn synthetic; không phải bằng chứng tác động giáo dục.</small></span>
        </div>
      </div>
    </main>
  );
}
