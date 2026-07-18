"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useProduct } from "@/features/product/product-context";
import { Asset } from "./asset";
import { Logo } from "./logo";

const studentNav = [["/student", "Hôm nay", "nav-home"], ["/student/course", "Khóa học", "nav-roadmap"], ["/student/reviews", "AI đề xuất", "ai-spark"], ["/student/progress", "Tiến bộ", "nav-chart"], ["/student/games", "Luyện tập", "nav-game"]] as const;
const teacherNav = [["/teacher", "Tổng quan lớp", "nav-home"], ["/teacher/classes", "Học sinh", "nav-class"], ["/teacher/studio", "AI soạn bài", "ai-spark"], ["/teacher/reviews", "Kiểm duyệt", "nav-review"], ["/teacher/analytics", "Đo lường", "nav-chart"]] as const;

export function AppShell({ role, children }: { role: "student" | "teacher"; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const product = useProduct();
  const setRole = product.setRole;
  const nav = role === "student" ? studentNav : teacherNav;

  useEffect(() => { void setRole(role).catch(() => undefined); }, [role, setRole]);

  const profile = role === "student" ? product.student?.student : null;
  const logout = () => { if (product.busy) return; product.logout(); router.push("/login"); };
  const guardNavigation = (event: React.MouseEvent<HTMLAnchorElement>) => { if (product.busy) event.preventDefault(); };

  return (
    <div className={`app-shell ${role} ${product.busy ? "is-busy" : ""}`} aria-busy={product.busy}>
      <aside className="sidebar">
        <Logo/>
        <div className="workspace-label">{role === "student" ? "Khu học tập" : "Khu giảng viên"}</div>
        <nav aria-label="Điều hướng chính">
          {nav.map(([href, label, icon]) => {
            const active = href === `/${role}` ? pathname === href : pathname.startsWith(href);
            return <Link aria-disabled={product.busy} className={active ? "active" : ""} href={href} key={href} onClick={guardNavigation}><Asset type="icon" name={icon} alt="" width={22} height={22}/><span>{label}</span></Link>;
          })}
        </nav>
        <div className="sidebar-pilot"><Asset type="mascot" name={role === "student" ? "mam-study" : "mam-teacher-review"} alt="Trợ lý học tập" width={94} height={94}/><strong>{role === "student" ? "Lộ trình của riêng bạn" : "Pilot · 20 học sinh"}</strong><small>Dữ liệu đọc/ghi trực tiếp trên Supabase.</small></div>
      </aside>

      <div className="app-stage">
        <header className="topbar">
          <div className="mobile-logo"><Logo compact/></div>
          <div className="mode-status" title={product.error ?? product.message}><span className={`live-dot ${product.error ? "fallback" : ""}`}/><span>{product.operation ?? product.error ?? (product.backgroundLoading ? "Đang đồng bộ dữ liệu chi tiết…" : product.message)}</span></div>
          <div className="top-actions">
            {role === "student" && <><span className="xp-chip"><Asset type="icon" name="gamify-xp" alt="" width={20} height={20}/>{profile?.xp ?? 0} XP</span><span className="streak-chip"><Asset type="icon" name="gamify-streak" alt="" width={20} height={20}/>{profile?.streak ?? 0}</span></>}
            <span className="profile-chip"><Asset type="avatar" name={role === "student" ? profile?.avatar ?? "avatar-01" : "avatar-24"} alt="" width={36} height={36}/><span>{role === "student" ? profile?.name ?? "Học sinh" : "Cô Mai"}</span></span>
            <button className="switch-link" disabled={product.busy} onClick={logout}>Đăng xuất</button>
          </div>
        </header>

        <main id="main-content" className="app-content">
          {!product.ready && product.busy
            ? <div className="loading-page" role="status"><div className="skeleton skeleton-title"/><div className="skeleton-grid"><div className="skeleton skeleton-card"/><div className="skeleton skeleton-card"/><div className="skeleton skeleton-card"/></div><p>Đang tải dữ liệu học tập từ Supabase...</p></div>
            : children}
        </main>

        <nav className="mobile-nav">
          {nav.map(([href, label, icon]) => <Link aria-disabled={product.busy} className={pathname === href ? "active" : ""} href={href} key={href} onClick={guardNavigation}><Asset type="icon" name={icon} alt="" width={21} height={21}/><span>{label}</span></Link>)}
        </nav>
      </div>

      {product.busy && product.ready && <div className="operation-lock" role="status" aria-live="polite"><div className="operation-card"><span className="operation-spinner"/><div><strong>{product.operation ?? "Đang xử lý..."}</strong><small>Vui lòng chờ để tránh gửi thao tác nhiều lần.</small></div></div></div>}
    </div>
  );
}
