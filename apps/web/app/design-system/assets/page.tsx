import { readFile } from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import { Logo } from "@/components/logo";

interface ManifestItem {
  name: string;
  category: string;
  path: string;
  format: string;
  dimensions: string;
  usedIn: string[];
  description: string;
}

export default async function AssetGalleryPage() {
  const manifestPath = path.join(process.cwd(), "public", "assets", "asset-manifest.json");
  const items = JSON.parse(await readFile(manifestPath, "utf8")) as ManifestItem[];
  const groups = Object.groupBy(items, (item) => item.category);
  return (
    <main id="main-content" className="asset-gallery-page">
      <header className="design-nav"><Logo/><div><strong>{items.length} original assets</strong><small>Không hotlink · Không remote URL · SVG validated</small></div><Link className="button ghost small" href="/design-system">← Design system</Link></header>
      <section className="gallery-hero"><span className="eyebrow">Asset library</span><h1>Mỗi trạng thái học tập có một hình ảnh riêng.</h1><p>Manifest ghi category, path, dimensions, usedIn và description cho từng file.</p><div>{Object.entries(groups).map(([category, assets]) => <a href={`#${category}`} key={category}>{category} <strong>{assets?.length ?? 0}</strong></a>)}</div></section>
      {Object.entries(groups).map(([category, assets]) => (
        <section id={category} className="asset-group" key={category}>
          <div className="asset-group-title"><span className="eyebrow">{category}</span><h2>{assets?.length ?? 0} files</h2></div>
          <div className={`asset-gallery ${category === "icons" ? "icons" : ""}`}>{assets?.map((asset) => <article key={asset.name}><div><img src={asset.path.replace("/public", "")} alt={asset.description}/></div><strong>{asset.name}</strong><small>{asset.dimensions} · {asset.format}</small><p>{asset.description}</p><span>{asset.usedIn.join(" · ")}</span></article>)}</div>
        </section>
      ))}
    </main>
  );
}
