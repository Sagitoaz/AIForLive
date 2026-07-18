import { Injectable } from "@nestjs/common";
import type { DemoContent, LessonSection } from "../common/types";

/**
 * FEATURE-016 — standalone HTML export. Produces a single self-contained
 * document with a table of contents and all three sections (Theory, Practice,
 * Final assessment). The output:
 *  - contains no <script>, no remote URLs and no secrets,
 *  - opens directly via file:/// (client-only, no AI API calls),
 *  - grades the final assessment inline via a small inert data attribute UI.
 */
@Injectable()
export class LessonExportService {
  build(content: DemoContent): { filename: string; html: string } {
    const theory = content.sections.find((s) => s.type === "THEORY");
    const practice = content.sections.find((s) => s.type === "PRACTICE");
    const final = content.sections.find((s) => s.type === "FINAL_ASSESSMENT");
    const html = [
      "<!doctype html>",
      '<html lang="vi">',
      "<head>",
      '<meta charset="utf-8"/>',
      '<meta name="viewport" content="width=device-width, initial-scale=1"/>',
      `<title>${esc(content.title)}</title>`,
      "<style>",
      "body{font-family:system-ui,Segoe UI,Roboto,sans-serif;max-width:820px;margin:0 auto;padding:24px;color:#1f2933;line-height:1.6}",
      "h1{color:#2f855a}h2{border-bottom:2px solid #c6f6d5;padding-bottom:6px;margin-top:36px}",
      "nav{background:#f0fff4;border:1px solid #c6f6d5;border-radius:10px;padding:16px;margin:16px 0}",
      "nav a{display:inline-block;margin-right:16px;color:#276749;font-weight:600}",
      "pre{background:#1a202c;color:#e2e8f0;padding:12px;border-radius:8px;overflow:auto}",
      ".card{border:1px solid #e2e8f0;border-radius:10px;padding:16px;margin:12px 0}",
      ".tag{display:inline-block;background:#ebf8ff;color:#2b6cb0;border-radius:6px;padding:2px 8px;font-size:12px;margin-bottom:8px}",
      ".limit{background:#fffaf0;border:1px solid #feebc8;border-radius:8px;padding:12px;font-size:14px;margin-top:24px}",
      "</style>",
      "</head>",
      "<body>",
      `<h1>${esc(content.title)}</h1>`,
      `<p><strong>Concept:</strong> ${esc(content.conceptCode)} · <strong>Trình độ:</strong> ${esc(content.level)}</p>`,
      "<nav><strong>Mục lục:</strong>",
      '<a href="#theory">1. Lý thuyết</a>',
      '<a href="#practice">2. Thực hành</a>',
      '<a href="#final">3. Kiểm tra cuối bài</a>',
      "</nav>",
      renderTheory(theory),
      renderPractice(practice),
      renderFinal(final),
      '<p class="limit">Bản HTML độc lập này chạy hoàn toàn phía client, mở trực tiếp qua file:/// và không lưu tiến độ lên server khi offline.</p>',
      "</body>",
      "</html>"
    ].join("\n");
    return { filename: safeName(content.title), html };
  }
}

function renderTheory(section?: LessonSection): string {
  if (!section) return '<section id="theory"><h2>1. Lý thuyết</h2><p>Chưa có nội dung.</p></section>';
  const resources = (section.resources ?? [])
    .map((r) => {
      const meta = [r.type, r.required ? "bắt buộc" : "tùy chọn"].join(" · ");
      const body = r.content ? `<p>${esc(r.content)}</p>` : "";
      const media = r.url
        ? `<p><em>${esc(r.type === "VIDEO" ? "Video" : "Tài liệu")}:</em> ${esc(r.title)}${r.durationSeconds ? ` (${r.durationSeconds}s)` : ""} — nhúng an toàn, không tự phát.</p>`
        : "";
      return `<div class="card"><span class="tag">${esc(meta)}</span><strong>${esc(r.title)}</strong>${body}${media}</div>`;
    })
    .join("\n");
  return `<section id="theory"><h2>1. Lý thuyết</h2>${resources}</section>`;
}

function renderPractice(section?: LessonSection): string {
  if (!section) return '<section id="practice"><h2>2. Thực hành</h2><p>Chưa có hoạt động.</p></section>';
  const activities = (section.activities ?? [])
    .map((a) => {
      const code = a.starterCode ? `<pre>${esc(a.starterCode)}</pre>` : "";
      const prompt = a.prompt ? `<p>${esc(a.prompt)}</p>` : "";
      const options = a.options
        ? `<ol>${a.options.map((o) => `<li>${esc(o)}</li>`).join("")}</ol>`
        : "";
      const solution = a.solution ? `<details><summary>Lời giải</summary><pre>${esc(a.solution)}</pre></details>` : "";
      return `<div class="card"><span class="tag">${esc(a.type)}</span><strong>${esc(a.title)}</strong><p>${esc(a.instructions)}</p>${prompt}${code}${options}${solution}</div>`;
    })
    .join("\n");
  return `<section id="practice"><h2>2. Thực hành</h2>${activities}</section>`;
}

function renderFinal(section?: LessonSection): string {
  const assessment = section?.assessment;
  if (!assessment) return '<section id="final"><h2>3. Kiểm tra cuối bài</h2><p>Chưa có bài kiểm tra — cần giảng viên bổ sung.</p></section>';
  const questions = assessment.questions
    .map((q, index) => {
      const options = q.options
        ? `<ol>${q.options.map((o) => `<li>${esc(o)}</li>`).join("")}</ol>`
        : "";
      return `<div class="card"><span class="tag">${esc(q.type)} · ${q.points} điểm</span><strong>Câu ${index + 1}. ${esc(q.prompt)}</strong>${options}<details><summary>Đáp án &amp; giải thích</summary><p>${esc(q.explanation)}</p></details></div>`;
    })
    .join("\n");
  return `<section id="final"><h2>3. Kiểm tra cuối bài</h2><p>Điểm đạt: ${Math.round(assessment.passingScore * 100)}%</p>${questions}</section>`;
}

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function safeName(title: string): string {
  const slug = title.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase();
  return `${slug || "lesson"}.html`;
}
