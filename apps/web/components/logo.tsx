import Link from "next/link";
import { Asset } from "./asset";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link className={`logo ${compact ? "compact" : ""}`} href="/" aria-label="EduRecall AI — trang chủ">
      <Asset type="brand" name="logo-mark" alt="" width={42} height={42} priority />
      {!compact && <span><strong>EduRecall</strong><small>AI learning lab</small></span>}
    </Link>
  );
}
