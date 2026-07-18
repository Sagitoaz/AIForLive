import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const base = path.join(root, "apps", "web", "public", "assets");
rmSync(base, { recursive: true, force: true });
mkdirSync(base, { recursive: true });

const palette = ["#4AAA64", "#72B9F2", "#AA8CE9", "#FFD66E", "#FF9F66", "#DF5E63", "#173622", "#8ED49E"];
const manifest = [];

const escapeXml = (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const svg = (width, height, body, label) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(label)}"><defs><linearGradient id="a" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#E7F6EB"/><stop offset="1" stop-color="#B7E5C1"/></linearGradient><linearGradient id="b" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#4AAA64"/><stop offset="1" stop-color="#245A37"/></linearGradient><filter id="s"><feDropShadow dx="0" dy="7" stdDeviation="7" flood-color="#173622" flood-opacity=".14"/></filter></defs>${body}</svg>`;

function add(category, name, width, height, body, description, usedIn = []) {
  const directory = path.join(base, category);
  mkdirSync(directory, { recursive: true });
  const file = `${name}.svg`;
  writeFileSync(path.join(directory, file), svg(width, height, body, description), "utf8");
  manifest.push({ name, category, path: `/assets/${category}/${file}`, format: "SVG", dimensions: `${width}x${height}`, usedIn, description });
}

function iconBody(index) {
  const color = palette[index % palette.length];
  const accent = palette[(index + 3) % palette.length];
  const variant = index % 8;
  const forms = [
    `<path d="M16 31 25 22l7 7 16-17" fill="none" stroke="${color}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="16" cy="31" r="4" fill="${accent}"/><circle cx="48" cy="12" r="4" fill="${accent}"/>`,
    `<rect x="11" y="12" width="42" height="40" rx="12" fill="${color}" opacity=".16"/><path d="M20 42V30m12 12V20m12 22V26" stroke="${color}" stroke-width="5" stroke-linecap="round"/>`,
    `<circle cx="32" cy="32" r="21" fill="${color}" opacity=".15"/><path d="m24 33 6 6 12-15" fill="none" stroke="${color}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`,
    `<path d="M14 22h36v28H14z" fill="${color}" opacity=".15"/><path d="M20 19h24M22 30h20M22 39h12" stroke="${color}" stroke-width="4" stroke-linecap="round"/>`,
    `<path d="M32 9c8 8 17 13 17 25a17 17 0 0 1-34 0c0-12 9-17 17-25Z" fill="${color}"/><path d="M25 38c4 4 10 4 14 0" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/>`,
    `<path d="m12 38 12-20 9 14 7-10 12 16" fill="none" stroke="${color}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 48h40" stroke="${accent}" stroke-width="4" stroke-linecap="round"/>`,
    `<circle cx="25" cy="28" r="13" fill="${color}" opacity=".18"/><circle cx="40" cy="37" r="12" fill="${accent}" opacity=".26"/><path d="M15 49c5-9 29-9 34 0" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round"/>`,
    `<path d="M18 18h28v28H18z" fill="none" stroke="${color}" stroke-width="4" rx="5"/><path d="m25 32 5 5 10-11" fill="none" stroke="${accent}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`
  ];
  return `<rect width="64" height="64" rx="18" fill="#F4FAF5"/>${forms[variant]}`;
}

const requiredIcons = [
  "nav-home", "nav-roadmap", "nav-review", "nav-game", "nav-chart", "nav-trophy", "nav-badge", "nav-class", "nav-grid", "nav-alert", "nav-spark", "nav-model",
  "gamify-xp", "gamify-streak", "ai-spark", "ai-evidence", "ai-reuse", "ai-cost", "ai-bkt", "ai-model",
  "learning-observe", "learning-brain", "learning-path", "learning-recall", "teacher-review", "teacher-support", "student-group",
  "concept-variable", "concept-operator", "concept-branch", "concept-loop", "concept-range", "concept-while", "concept-list", "concept-function",
  "ui-shield", "ui-check", "ui-alert", "ui-info", "ui-clock", "ui-search", "ui-filter", "ui-lock", "ui-unlock", "ui-settings", "ui-upload", "ui-download", "ui-edit", "ui-trash", "ui-close",
  "media-audio", "media-txt", "media-pdf", "media-docx", "media-pptx", "media-play", "media-pause", "media-volume", "media-image", "media-video",
  "domain-python", "domain-english", "domain-math", "domain-science", "domain-physics", "domain-chemistry", "domain-stem", "domain-career",
  "game-code-order", "game-predict", "game-bug", "game-range", "game-reward", "game-level", "game-heart", "game-flag",
  "teacher-course", "teacher-source", "teacher-student", "teacher-analytics"
];
requiredIcons.forEach((name, index) => add("icons", name, 64, 64, iconBody(index), `Custom ${name.replaceAll("-", " ")} icon`, [name.startsWith("teacher") ? "Teacher workspace" : name.startsWith("concept") ? "Roadmap and concept cards" : "Navigation and interface"]));

const robot = (pose, index) => {
  const armLeft = index % 3 === 0 ? "M110 155 72 105" : index % 3 === 1 ? "M110 155 66 170" : "M110 155 82 202";
  const armRight = index % 4 === 0 ? "M210 155 252 92" : index % 4 === 1 ? "M210 155 258 165" : index % 4 === 2 ? "M210 155 244 205" : "M210 155 264 130";
  const prop = pose.includes("trophy") ? `<path d="M238 74h44v35c0 25-44 25-44 0Z" fill="#FFD66E"/><path d="M247 133h26M260 118v15" stroke="#173622" stroke-width="6" stroke-linecap="round"/>` : pose.includes("book") || pose.includes("study") ? `<path d="M92 206q34-15 68 5v48q-34-20-68-5Zm136 0q-34-15-68 5v48q34-20 68-5Z" fill="#72B9F2" stroke="#173622" stroke-width="5"/>` : pose.includes("code") ? `<rect x="228" y="183" width="70" height="52" rx="8" fill="#12251A"/><path d="m247 202-8 8 8 8m26-16 8 8-8 8" fill="none" stroke="#8ED49E" stroke-width="4"/>` : pose.includes("error") ? `<path d="m252 70 28 49h-56Z" fill="#FFD66E" stroke="#173622" stroke-width="5"/><path d="M252 86v17m0 8v2" stroke="#173622" stroke-width="5" stroke-linecap="round"/>` : pose.includes("audio") ? `<path d="M251 91a28 28 0 0 1 0 40m13-51a42 42 0 0 1 0 62" fill="none" stroke="#72B9F2" stroke-width="7" stroke-linecap="round"/>` : pose.includes("teacher") ? `<rect x="229" y="79" width="64" height="78" rx="8" fill="#fff" stroke="#173622" stroke-width="5"/><path d="M244 99h34m-34 15h34m-34 15h24" stroke="#4AAA64" stroke-width="5" stroke-linecap="round"/>` : "";
  return `<ellipse cx="160" cy="279" rx="91" ry="18" fill="#173622" opacity=".12"/><path d="M160 55c-2-22 5-35 23-42m-23 42c-13-17-28-22-43-16" fill="none" stroke="#2A7041" stroke-width="8" stroke-linecap="round"/><path d="M183 13c20-4 29 10 18 25-15 0-22-9-18-25Zm-66 26c-2-16 12-24 27-14 1 15-10 21-27 14Z" fill="#67C080"/><rect x="83" y="56" width="154" height="116" rx="47" fill="url(#b)" filter="url(#s)"/><rect x="102" y="75" width="116" height="72" rx="28" fill="#E7F6EB"/><circle cx="136" cy="109" r="9" fill="#173622"/><circle cx="184" cy="109" r="9" fill="#173622"/><path d="M141 132q19 14 38 0" fill="none" stroke="#173622" stroke-width="5" stroke-linecap="round"/><rect x="104" y="158" width="112" height="102" rx="38" fill="#4AAA64" stroke="#245A37" stroke-width="6"/><circle cx="160" cy="204" r="21" fill="#E7F6EB"/><path d="M160 218v-22m0 4c-15 0-17-12-15-21 11 0 17 7 15 21Zm0 0c15 0 17-12 15-21-11 0-17 7-15 21Z" fill="#67C080" stroke="#2A7041" stroke-width="3"/> <path d="${armLeft}" stroke="#245A37" stroke-width="16" stroke-linecap="round"/><path d="${armRight}" stroke="#245A37" stroke-width="16" stroke-linecap="round"/><path d="M131 254 116 282m58-28 15 28" stroke="#245A37" stroke-width="18" stroke-linecap="round"/>${prop}`;
};
const mascotNames = ["mam-wave", "mam-study", "mam-thinking", "mam-celebrate", "mam-guide", "mam-trophy", "mam-book", "mam-code", "mam-error", "mam-remind", "mam-audio", "mam-teacher-review"];
mascotNames.forEach((name, index) => add("mascot", name, 320, 310, robot(name, index), `Mầm mascot pose: ${name.replace("mam-", "")}`, ["Student feedback", "Teacher guidance", "Empty states"]));

function illustrationBody(index, title) {
  const color = palette[index % palette.length];
  const accent = palette[(index + 2) % palette.length];
  const scene = index % 6;
  const extras = [
    `<path d="M90 350C180 230 270 420 390 250s210-40 250 80" fill="none" stroke="${color}" stroke-width="24" stroke-linecap="round" stroke-dasharray="18 18"/><circle cx="170" cy="292" r="35" fill="#fff" stroke="${accent}" stroke-width="8"/><circle cx="390" cy="250" r="35" fill="#fff" stroke="${color}" stroke-width="8"/>`,
    `<rect x="86" y="100" width="520" height="290" rx="36" fill="#fff" filter="url(#s)"/><path d="M130 320 210 230l80 44 84-112 128 158" fill="none" stroke="${color}" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/><circle cx="374" cy="162" r="16" fill="${accent}"/>`,
    `<g transform="translate(90 80)"><rect width="160" height="190" rx="28" fill="#fff" filter="url(#s)"/><rect x="28" y="35" width="104" height="18" rx="9" fill="${color}"/><rect x="28" y="76" width="76" height="14" rx="7" fill="#DCE8DF"/><rect x="28" y="105" width="96" height="14" rx="7" fill="#DCE8DF"/></g><g transform="translate(280 130)"><rect width="160" height="190" rx="28" fill="#fff" filter="url(#s)"/><circle cx="80" cy="70" r="36" fill="${accent}" opacity=".3"/><path d="m58 70 15 15 31-36" fill="none" stroke="${color}" stroke-width="10"/></g>`,
    `<path d="M105 315h490" stroke="#173622" stroke-width="18" stroke-linecap="round"/><g>${[0,1,2,3,4].map((n) => `<rect x="${145+n*88}" y="235" width="66" height="66" rx="18" fill="${n===4?"#FFD66E":"#fff"}" stroke="${n===4?"#DF5E63":color}" stroke-width="6"/><circle cx="${178+n*88}" cy="268" r="7" fill="${color}"/>`).join("")}</g>`,
    `<circle cx="340" cy="230" r="142" fill="#fff" filter="url(#s)"/><path d="M340 110v240M220 230h240" stroke="#DCE8DF" stroke-width="7"/><path d="M255 286c55-120 116-23 169-137" fill="none" stroke="${color}" stroke-width="13" stroke-linecap="round"/><circle cx="424" cy="149" r="18" fill="${accent}"/>`,
    `<path d="M130 340V178m110 162V112m110 228V225m110 115V152m110 188V90" stroke="${color}" stroke-width="42" stroke-linecap="round"/><path d="M115 365h480" stroke="#173622" stroke-width="8" stroke-linecap="round"/>`
  ][scene];
  return `<rect width="700" height="460" rx="48" fill="url(#a)"/><circle cx="590" cy="82" r="70" fill="${accent}" opacity=".22"/><circle cx="88" cy="92" r="32" fill="${color}" opacity=".28"/>${extras}<g transform="translate(450 180) scale(.52)">${robot(title, index)}</g><path d="M45 410c130-36 240 30 360 0s190-30 255 0" fill="none" stroke="#8ED49E" stroke-width="10" stroke-linecap="round" opacity=".7"/>`;
}

const illustrationNames = ["hero", "personalized-path", "ai-generation", "teacher-review", "diagnostic", "micro-lesson", "knowledge-graph", "spaced-review", "skill-mastery", "progress", "class-dashboard", "leaderboard", "game-center", "code-challenge", "bug-hunter", "empty-review", "empty-course", "empty-activity", "upload", "loading", "success", "error", "offline", "pilot-classroom"];
illustrationNames.forEach((name, index) => add("illustrations", `illustration-${name}`, 700, 460, illustrationBody(index, name), `EduRecall scene: ${name.replaceAll("-", " ")}`, ["Landing", name.includes("class") || name.includes("teacher") ? "Teacher workspace" : "Student workspace"]));

const emptyStates = ["review", "activity", "course-not-found", "system-error"];
emptyStates.forEach((name, index) => add("empty-states", `illustration-${name}`, 500, 350, illustrationBody(15 + index, name), `Empty state: ${name.replaceAll("-", " ")}`, ["Empty and error states"]));

function coverBody(index) {
  const color = palette[index % palette.length];
  const accent = palette[(index + 3) % palette.length];
  return `<rect width="560" height="340" rx="34" fill="#173622"/><circle cx="470" cy="70" r="115" fill="${color}" opacity=".45"/><path d="M60 255c110-180 230 70 360-100" fill="none" stroke="${accent}" stroke-width="18" stroke-linecap="round" stroke-dasharray="20 18"/><g transform="translate(295 64) scale(.55)">${robot("code", index)}</g><rect x="48" y="48" width="175" height="22" rx="11" fill="#fff" opacity=".9"/><rect x="48" y="86" width="120" height="14" rx="7" fill="${accent}"/><path d="m65 180 22 22 42-52" fill="none" stroke="#fff" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>`;
}
for (let index = 1; index <= 10; index += 1) add("course-covers", `course-cover-${String(index).padStart(2, "0")}`, 560, 340, coverBody(index), `Course or module cover ${index}`, ["Course cards", "Student dashboard"]);

function badgeBody(index) {
  const color = palette[index % palette.length];
  const accent = palette[(index + 2) % palette.length];
  const symbol = ["M80 55v55m-24-27h48", "m51 83 20 20 39-46", "M55 105 80 55l-10 64Z", "M50 70h60v54H50Z"][index % 4];
  return `<path d="M80 8 137 40v66l-57 46-57-46V40Z" fill="${color}" stroke="#fff" stroke-width="8" filter="url(#s)"/><circle cx="80" cy="80" r="45" fill="#fff" opacity=".9"/><path d="${symbol}" fill="none" stroke="${accent}" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/><path d="m52 130-10 28 32-16m34-12 10 28-32-16" fill="${accent}"/>`;
}
const namedBadges = ["badge-seed", "badge-streak", "badge-debugger", "badge-range", "badge-recall", "badge-helper"];
namedBadges.forEach((name, index) => add("badges", name, 160, 170, badgeBody(index), `Achievement badge: ${name.replace("badge-", "")}`, ["Dashboard achievements"]));
for (let index = 1; index <= 24; index += 1) add("badges", `badge-${String(index).padStart(2, "0")}`, 160, 170, badgeBody(index + 5), `Achievement badge ${index}`, ["Achievement gallery"]);

function gameBody(index) {
  const color = palette[index % palette.length];
  const accent = palette[(index + 3) % palette.length];
  return `<rect width="480" height="300" rx="38" fill="#12251A"/><circle cx="405" cy="55" r="100" fill="${color}" opacity=".32"/><path d="M50 240h380" stroke="#8ED49E" stroke-width="12" stroke-linecap="round"/><g>${[0,1,2,3].map((n) => `<rect x="${64+n*88}" y="145" width="70" height="70" rx="18" fill="${n===3?accent:"#fff"}" transform="rotate(${n%2?3:-3} ${99+n*88} 180)"/><path d="M${82+n*88} ${170+n%2*12}h34" stroke="${color}" stroke-width="8" stroke-linecap="round"/>`).join("")}</g><g transform="translate(285 60) scale(.46)">${robot(index % 4 === 2 ? "error" : "code", index)}</g>`;
}
for (let index = 1; index <= 20; index += 1) add("games", `game-asset-${String(index).padStart(2, "0")}`, 480, 300, gameBody(index), `Original game asset ${index}`, ["Game center", "Mini games"]);

function avatarBody(index) {
  const skin = ["#F4C7A1", "#D99B73", "#8D5A3C", "#FFD2B5"][index % 4];
  const color = palette[index % palette.length];
  const hair = ["#173622", "#49342D", "#2C2624", "#8A5B38"][index % 4];
  return `<rect width="160" height="160" rx="80" fill="url(#a)"/><circle cx="80" cy="72" r="42" fill="${skin}"/><path d="M38 66c2-47 77-63 88-7-25-12-49-8-70 8Z" fill="${hair}"/><circle cx="66" cy="77" r="4" fill="#173622"/><circle cx="95" cy="77" r="4" fill="#173622"/><path d="M69 95q12 9 24 0" fill="none" stroke="#8D5A3C" stroke-width="4" stroke-linecap="round"/><path d="M20 160c5-55 115-55 120 0" fill="${color}"/><path d="M78 18c-1-15 5-20 13-25m-13 25c-8-10-15-12-22-9" fill="none" stroke="#2A7041" stroke-width="5" stroke-linecap="round"/><path d="M91-7c12-2 17 7 11 16-9 0-14-6-11-16Z" fill="#67C080"/>`;
}
for (let index = 1; index <= 24; index += 1) add("avatars", `avatar-${String(index).padStart(2, "0")}`, 160, 160, avatarBody(index), `Synthetic learner avatar ${index}`, ["Class list", "Leaderboard", "Profile"]);

function backgroundBody(index) {
  const color = palette[index % palette.length];
  return `<rect width="1440" height="900" fill="#F4FAF5"/><circle cx="180" cy="140" r="180" fill="${color}" opacity=".12"/><circle cx="1280" cy="720" r="250" fill="#72B9F2" opacity=".12"/><path d="M0 720c220-130 420 80 650-40s430-70 790 50v170H0Z" fill="#D9F1DF"/><path d="M40 620c200-110 320 70 520-30s390-120 840-10" fill="none" stroke="${color}" stroke-width="14" stroke-linecap="round" stroke-dasharray="20 25" opacity=".45"/>`;
}
const backgrounds = ["roadmap", "landing", "student", "teacher", "game", "lesson", "celebration", "login"];
backgrounds.forEach((name, index) => add("backgrounds", `background-${name}`, 1440, 900, backgroundBody(index), `${name} page background`, ["Page background"]));

function patternBody(index) {
  const color = palette[index % palette.length];
  const variant = index % 3;
  const content = variant === 0 ? Array.from({ length: 7 }, (_, n) => `<circle cx="${35+n*70}" cy="${35+(n%2)*45}" r="10" fill="${color}" opacity=".${3+(n%5)}"/>`).join("") : variant === 1 ? Array.from({ length: 6 }, (_, n) => `<path d="M${n*90} 90q45-80 90 0t90 0" fill="none" stroke="${color}" stroke-width="8" opacity=".35"/>`).join("") : Array.from({ length: 6 }, (_, n) => `<path d="M${30+n*80} 20v70M${10+n*80} 55h40" stroke="${color}" stroke-width="7" stroke-linecap="round" opacity=".35"/>`).join("");
  return `<rect width="520" height="180" fill="none"/>${content}`;
}
const patterns = ["orbit", "dots", "waves", "plus", "code", "leaves", "grid", "stars", "loops", "confetti", "numbers", "sprouts"];
patterns.forEach((name, index) => add("patterns", `pattern-${name}`, 520, 180, patternBody(index), `${name} decorative pattern`, ["Landing", "Cards", "Headers"]));

function decorationBody(index) {
  const color = palette[index % palette.length];
  return index % 2 === 0 ? `<path d="M100 210c-15-90 10-155 70-190m-70 190c-58-45-80-100-55-164m55 164c45-45 89-50 132-23" fill="none" stroke="${color}" stroke-width="16" stroke-linecap="round"/><path d="M170 20c42 0 55 31 27 63-40-4-51-30-27-63ZM45 46c38 7 43 38 10 63-37-11-41-36-10-63Zm187 141c-10-37 17-55 53-36 5 36-18 52-53 36Z" fill="${color}" opacity=".7"/>` : `<circle cx="120" cy="120" r="90" fill="${color}" opacity=".16"/><path d="m42 126 39-39 33 33 58-67 35 40" fill="none" stroke="${color}" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>`;
}
for (let index = 1; index <= 20; index += 1) add("decorations", index === 1 ? "decoration-leaf-01" : `decoration-${String(index).padStart(2, "0")}`, 300, 260, decorationBody(index), `Decorative shape ${index}`, ["Cards and hero sections"]);

for (let index = 1; index <= 8; index += 1) add("domains", `domain-asset-${String(index).padStart(2, "0")}`, 260, 180, `<rect width="260" height="180" rx="32" fill="${palette[index % palette.length]}" opacity=".18"/><path d="M52 126 98 74l35 39 48-67 35 80" fill="none" stroke="${palette[index % palette.length]}" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/><circle cx="98" cy="74" r="13" fill="#173622"/>`, `Domain package art ${index}`, ["Future domain catalog"]);

add("brand", "logo-mark", 96, 96, `<rect x="8" y="8" width="80" height="80" rx="28" fill="#173622"/><path d="M48 69V40m0 6c-20 0-24-15-20-28 15 0 23 10 20 28Zm0 0c20 0 24-15 20-28-15 0-23 10-20 28Z" fill="#8ED49E"/><path d="M31 70h34" stroke="#fff" stroke-width="7" stroke-linecap="round"/>`, "EduRecall original sprout mark", ["All navigation"]);
add("brand", "favicon", 64, 64, `<rect x="3" y="3" width="58" height="58" rx="20" fill="#173622"/><path d="M32 50V27m0 5c-14 0-17-11-14-20 11 0 16 7 14 20Zm0 0c14 0 17-11 14-20-11 0-16 7-14 20Z" fill="#8ED49E"/>`, "EduRecall favicon", ["Browser tab"]);

const names = new Set();
for (const item of manifest) {
  if (names.has(item.name)) throw new Error(`Duplicate asset name: ${item.name}`);
  names.add(item.name);
}
writeFileSync(path.join(base, "asset-manifest.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8");
console.log(`Generated ${manifest.length} original SVG assets (${requiredIcons.length} icons).`);
