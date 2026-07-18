"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { studentNav, teacherNav } from "@/lib/demo-data";
import { useDemo } from "@/features/demo/demo-context";
import { Asset } from "./asset";
import { Logo } from "./logo";

export function AppShell({ role, children }: { role: "student" | "teacher"; children: React.ReactNode }) {
  const pathname = usePathname();
  const demo = useDemo();
  const nav = role === "student" ? studentNav : teacherNav;

  useEffect(() => demo.setRole(role), [role, demo.setRole]);

  return (
    <div className={`app-shell ${role}`}>
      <aside className="sidebar">
        <Logo />
        <div className="workspace-label">{role === "student" ? "Khu học tập" : "Teacher workspace"}</div>
        <nav aria-label={role === "student" ? "Điều hướng học sinh" : "Điều hướng giảng viên"}>
          {nav.map(([href, label, icon]) => {
            const active = href === `/${role}` ? pathname === href : pathname.startsWith(href);
            return (
              <Link className={active ? "active" : ""} href={href} key={href} aria-current={active ? "page" : undefined}>
                <Asset type="icon" name={icon} alt="" width={22} height={22} />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-pilot">
          <Asset type="mascot" name={role === "student" ? "mam-remind" : "mam-teacher-review"} alt="Robot Mầm" width={94} height={94} />
          <strong>{role === "student" ? "7 ngày liên tiếp!" : "Pilot 20 học viên"}</strong>
          <small>{role === "student" ? "Giữ nhịp bằng một bài ôn 5 phút." : "Dữ liệu hoàn toàn synthetic."}</small>
        </div>
      </aside>
      <div className="app-stage">
        <header className="topbar">
          <div className="mobile-logo"><Logo compact /></div>
          <div className="mode-status" title={demo.lastMessage}>
            <span className={`live-dot ${demo.analysis?.mode === "DETERMINISTIC_FALLBACK" ? "fallback" : ""}`} />
            <span>{demo.lastMessage}</span>
          </div>
          <div className="top-actions">
            {role === "student" ? (
              <>
                <span className="xp-chip"><Asset type="icon" name="gamify-xp" alt="" width={20} height={20} /> {demo.xp} XP</span>
                <span className="streak-chip"><Asset type="icon" name="gamify-streak" alt="" width={20} height={20} /> 7</span>
                <Link className="profile-chip" href="/student/profile"><Asset type="avatar" name="avatar-01" alt="Minh" width={36} height={36} /><span>Minh</span></Link>
                <Link className="switch-link" href="/teacher">Teacher demo</Link>
              </>
            ) : (
              <>
                <span className="provider-chip"><Asset type="icon" name="ai-spark" alt="" width={20} height={20} /> Local demo provider</span>
                <Link className="profile-chip" href="/teacher"><Asset type="avatar" name="avatar-24" alt="Cô Mai" width={36} height={36} /><span>Cô Mai</span></Link>
                <Link className="switch-link" href="/student">Student demo</Link>
              </>
            )}
          </div>
        </header>
        <main id="main-content" className="app-content">{children}</main>
        <nav className="mobile-nav" aria-label="Điều hướng nhanh">
          {nav.slice(0, 5).map(([href, label, icon]) => (
            <Link className={pathname === href ? "active" : ""} href={href} key={href}>
              <Asset type="icon" name={icon} alt="" width={21} height={21} /><span>{label}</span>
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
