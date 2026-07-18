import Link from "next/link";
import { Asset } from "@/components/asset";
import { Logo } from "@/components/logo";
import { ProgressBar, StatusPill } from "@/components/ui";

export default function DesignSystemPage() {
  const colors = [
    ["Primary 500", "#4AAA64"], ["Forest", "#173622"], ["Surface soft", "#E7F6EB"],
    ["Yellow", "#FFD66E"], ["Blue", "#72B9F2"], ["Purple", "#AA8CE9"],
    ["Orange", "#FF9F66"], ["Danger", "#DF5E63"]
  ];
  return (
    <main id="main-content" className="design-page">
      <header className="design-nav"><Logo/><nav><a href="#colors">Colors</a><a href="#type">Typography</a><a href="#components">Components</a><a href="#mascot">Mầm</a><Link href="/design-system/assets">234+ assets</Link></nav><Link className="button ghost small" href="/">← Landing</Link></header>
      <section className="design-hero"><div><span className="eyebrow light">EduRecall design language · v1</span><h1>Ấm áp như một khu vườn.<br />Rõ ràng như một IDE.</h1><p>Một hệ thống hình ảnh nguyên bản cho student experience sinh động và teacher workspace đáng tin cậy.</p></div><Asset type="illustration" name="illustration-pilot-classroom" alt="Lớp học EduRecall" width={540} height={360}/></section>
      <section id="colors" className="design-section"><span className="eyebrow">01 · Foundations</span><h2>Màu sắc</h2><div className="color-grid">{colors.map(([name, value]) => <div key={name}><span style={{ background: value }}/><strong>{name}</strong><code>{value}</code></div>)}</div></section>
      <section id="type" className="design-section type-showcase"><span className="eyebrow">02 · Typography</span><h2>Chữ tròn, chắc và dễ quét</h2><div><article><small>DISPLAY / 64</small><h1>Học theo cách<br/>bộ não ghi nhớ.</h1></article><article><small>HEADING / 32</small><h2>Mỗi tín hiệu dẫn tới một bước học có lý do.</h2><small>BODY / 16</small><p>Khoảng cách thoáng, tương phản tốt và độ dài dòng phù hợp cả học sinh lẫn giảng viên.</p></article></div></section>
      <section id="components" className="design-section"><span className="eyebrow">03 · Components</span><h2>Primitive có trạng thái rõ</h2><div className="component-showcase"><article><h3>Buttons</h3><div><button className="button primary">Primary action</button><button className="button dark">Dark action</button><button className="button ghost">Secondary</button><button className="button primary" disabled>Disabled</button></div></article><article><h3>Status</h3><div><StatusPill tone="green">PUBLISHED</StatusPill><StatusPill tone="yellow">DRAFT</StatusPill><StatusPill tone="blue">APPROVED</StatusPill><StatusPill tone="red">HIGH RISK</StatusPill></div></article><article><h3>Progress</h3><ProgressBar label="Mastery" value={58}/><ProgressBar label="Retrievability" value={42} color="blue"/><ProgressBar label="Forgetting risk" value={67} color="orange"/></article></div></section>
      <section id="mascot" className="design-section mascot-section"><div><span className="eyebrow">04 · Mascot</span><h2>Mầm — robot mang một chồi tri thức</h2><p>12 pose được vẽ bằng SVG nguyên bản, dùng để hướng dẫn, phản hồi và làm empty state bớt lạnh.</p><Link className="button primary" href="/design-system/assets">Mở asset gallery →</Link></div><div className="mascot-line">{["mam-wave", "mam-thinking", "mam-code", "mam-trophy", "mam-teacher-review"].map((name) => <Asset type="mascot" name={name} alt="Một pose của Mầm" width={150} height={140} key={name}/>)}</div></section>
    </main>
  );
}
