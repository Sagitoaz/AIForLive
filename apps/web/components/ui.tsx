import Link from "next/link";
import type { ReactNode } from "react";
import { Asset } from "./asset";

export function SectionHeading({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="section-heading">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

export function Metric({ label, value, note, tone = "green", icon }: { label: string; value: string; note: string; tone?: string; icon: string }) {
  return (
    <article className={`metric-card tone-${tone}`}>
      <span className="metric-icon"><Asset type="icon" name={icon} alt="" width={26} height={26} /></span>
      <div><span>{label}</span><strong>{value}</strong><small>{note}</small></div>
    </article>
  );
}

export function ProgressBar({ value, label, color = "green" }: { value: number; label?: string; color?: string }) {
  return (
    <div className="progress-wrap">
      {label && <div className="progress-label"><span>{label}</span><strong>{Math.round(value)}%</strong></div>}
      <div className="progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value)}>
        <span className={`progress-fill ${color}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}

export function StatusPill({ children, tone = "green" }: { children: ReactNode; tone?: "green" | "yellow" | "red" | "blue" | "purple" | "gray" }) {
  return <span className={`status-pill ${tone}`}>{children}</span>;
}

export function EmptyState({ illustration, title, description, href, action }: { illustration: string; title: string; description: string; href?: string; action?: string }) {
  return (
    <div className="empty-state">
      <Asset type="empty" name={`illustration-${illustration}`} alt="" width={260} height={190} />
      <h3>{title}</h3>
      <p>{description}</p>
      {href && action && <Link href={href} className="button primary">{action}</Link>}
    </div>
  );
}

export function AssetIcon({ name, size = 22 }: { name: string; size?: number }) {
  return <Asset type="icon" name={name} alt="" width={size} height={size} />;
}
