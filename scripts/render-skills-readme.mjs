/**
 * Renders docs/SKILLS_MANIFEST.yaml into README.md between
 * <!--START_SECTION:skills_icons--> ... <!--END_SECTION:skills_icons-->
 * and optionally docs/index.html between
 * <!--START_TECH_STACK_WEB--> ... <!--END_TECH_STACK_WEB-->
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { parse } from "yaml";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const RATING_LABELS = {
  1: "Had appropriate training only",
  2: "Limited practical experience",
  3: "Solid practical experience",
  4: "Well-versed, extensive experience",
};

const SECTION_EMOJI = {
  cloud: "☁️",
  iac: "🔧",
  data: "💾",
  languages: "💻",
  observability: "📊",
  tooling: "🧰",
  ai: "🤖",
};

const SECTION_ORDER = [
  "cloud",
  "iac",
  "data",
  "languages",
  "observability",
  "tooling",
  "ai",
];

function escapeAttr(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;");
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** @param {"readme" | "web"} base */
function iconSrc(skill, size, base) {
  if (skill.icon_kind === "skillicons") {
    const id = skill.icon_ref;
    return `https://skillicons.dev/icons?i=${encodeURIComponent(id)}&perline=1`;
  }
  if (skill.icon_kind === "simpleicons") {
    const slug = skill.icon_slug.toLowerCase();
    const color = String(skill.icon_color).replace(/^#/, "");
    return `https://cdn.simpleicons.org/${slug}/${color}`;
  }
  if (skill.icon_kind === "local") {
    if (skill.icon_ref.startsWith("http")) {
      return skill.icon_ref;
    }
    let p = skill.icon_ref.replace(/^\.\//, "");
    if (base === "web" && p.startsWith("docs/")) {
      p = p.slice("docs/".length);
    }
    return `./${p}`;
  }
  throw new Error(`Unknown icon_kind for ${skill.id}`);
}

function buildTooltip(skill) {
  const label = skill.label;
  const last = skill.last_used;
  const r = Number(skill.rating);
  const legend =
    skill.rating_label?.trim() || RATING_LABELS[r] || `Level ${r}`;
  return `${label} | Last used: ${last} | Rating: ${r}/4 – ${legend}`;
}

function renderIconLinks(skill, size, base) {
  const src = iconSrc(skill, size, base);
  const titleAttr = escapeAttr(buildTooltip(skill));
  const alt = escapeAttr(skill.label);
  const img = `<img src="${src}" width="${size}" height="${size}" alt="${alt}" />`;
  const readmeIconStyle =
    base === "readme"
      ? ' style="display: inline-block; margin: 2px;"'
      : "";
  if (skill.link) {
    const rel =
      base === "web"
        ? ' rel="noopener noreferrer" target="_blank"'
        : "";
    return `<a href="${skill.link}" title="${titleAttr}"${rel}${readmeIconStyle}>${img}</a>`;
  }
  return `<span title="${titleAttr}"${readmeIconStyle}>${img}</span>`;
}

function collectSections(manifest) {
  const sections = manifest.sections || {};
  const bySection = new Map();
  for (const id of SECTION_ORDER) {
    bySection.set(id, []);
  }
  for (const s of manifest.skills || []) {
    const sec = s.section;
    if (!bySection.has(sec)) {
      bySection.set(sec, []);
    }
    bySection.get(sec).push(s);
  }
  return { sections, bySection };
}

function renderSkillsHtml() {
  return `<div align="center">
  <img src="./docs/generated/tech-stack.svg" alt="Tech stack grouped by category" width="100%" />
</div>`;
}

function escapeTextNode(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function toDataUri(contentType, bytes) {
  if (contentType.includes("svg")) {
    const raw = Buffer.from(bytes).toString("utf8");
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(raw)}`;
  }
  return `data:${contentType};base64,${Buffer.from(bytes).toString("base64")}`;
}

function hashSource(src) {
  return createHash("sha256").update(src).digest("hex").slice(0, 24);
}

function extensionFromContentType(contentType) {
  if (contentType.includes("svg")) {
    return "svg";
  }
  if (contentType.includes("png")) {
    return "png";
  }
  if (contentType.includes("jpeg") || contentType.includes("jpg")) {
    return "jpg";
  }
  if (contentType.includes("webp")) {
    return "webp";
  }
  return "bin";
}

function mimeFromExtension(ext) {
  if (ext === "svg") {
    return "image/svg+xml";
  }
  if (ext === "png") {
    return "image/png";
  }
  if (ext === "jpg" || ext === "jpeg") {
    return "image/jpeg";
  }
  if (ext === "webp") {
    return "image/webp";
  }
  return "application/octet-stream";
}

async function fetchIconDataUri(src) {
  if (src.startsWith("./")) {
    const abs = join(root, src.slice(2));
    const file = readFileSync(abs);
    const mime = abs.endsWith(".svg")
      ? "image/svg+xml"
      : abs.endsWith(".png")
        ? "image/png"
        : "image/svg+xml";
    return toDataUri(mime, file);
  }

  const cacheDir = join(root, "docs", "generated", "skill-icons");
  mkdirSync(cacheDir, { recursive: true });
  const key = hashSource(src);
  const cachedSvg = join(cacheDir, `${key}.svg`);
  const cachedPng = join(cacheDir, `${key}.png`);
  const cachedJpg = join(cacheDir, `${key}.jpg`);
  const cachedWebp = join(cacheDir, `${key}.webp`);
  const cachedPaths = [cachedSvg, cachedPng, cachedJpg, cachedWebp];
  for (const p of cachedPaths) {
    try {
      const bytes = readFileSync(p);
      const ext = p.split(".").pop();
      return toDataUri(mimeFromExtension(ext), bytes);
    } catch {
      // continue to next cache candidate
    }
  }

  let res;
  let lastStatus = "";
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    res = await fetch(src, {
      headers: {
        "User-Agent": "talorlik-readme-generator/1.0 (+https://github.com/talorlik/talorlik)",
        Accept: "image/svg+xml,image/png,image/*;q=0.8,*/*;q=0.5",
      },
    });
    if (res.ok) {
      break;
    }
    lastStatus = String(res.status);
    if (attempt < 3) {
      await new Promise((resolve) => {
        setTimeout(resolve, 250 * attempt);
      });
    }
  }
  if (!res || !res.ok) {
    throw new Error(`Failed to fetch icon: ${src} (${lastStatus || "unknown"})`);
  }
  const type = (res.headers.get("content-type") || "image/svg+xml")
    .split(";")[0]
    .trim();
  const bytes = new Uint8Array(await res.arrayBuffer());
  const ext = extensionFromContentType(type);
  const cachePath = join(cacheDir, `${key}.${ext}`);
  writeFileSync(cachePath, bytes);
  return toDataUri(type, bytes);
}

async function renderTechStackSvg(manifest) {
  const size = manifest.icon_size || 48;
  const { sections, bySection } = collectSections(manifest);

  const topRows = [
    ["cloud", "iac", "data"],
    ["languages", "observability", "tooling"],
  ];
  const aiRow = ["ai"];

  const width = 1200;
  const colWidth = 360;
  const colGap = 18;
  const marginX = Math.floor((width - (colWidth * 3 + colGap * 2)) / 2);
  const titleFontSize = 16.8;
  const titleTopPadding = 24;
  const titleToIconsGap = 16;
  const iconGap = 10;
  const iconsPerRow = 4;
  const aiIconsPerRow = 7;
  const lineHeight = size + iconGap + 2;
  const sectionBottomPadding = 20;
  const iconsOffsetY = titleTopPadding + titleFontSize + titleToIconsGap;
  const sectionHeights = new Map();
  for (const secId of SECTION_ORDER) {
    const count = (bySection.get(secId) || []).length;
    const iconCols = secId === "ai" ? aiIconsPerRow : iconsPerRow;
    const rows = Math.max(1, Math.ceil(count / iconCols));
    sectionHeights.set(
      secId,
      iconsOffsetY + rows * lineHeight + sectionBottomPadding,
    );
  }

  const rowGap = 18;
  const topHeight = Math.max(
    ...topRows[0].map((id) => sectionHeights.get(id) || 0),
  );
  const middleHeight = Math.max(
    ...topRows[1].map((id) => sectionHeights.get(id) || 0),
  );
  const aiHeight = sectionHeights.get("ai") || 220;
  const height = 24 + topHeight + rowGap + middleHeight + rowGap + aiHeight + 24;

  const iconCache = new Map();
  const iconFor = async (skill) => {
    const src = iconSrc(skill, size, "readme");
    if (!iconCache.has(src)) {
      iconCache.set(src, await fetchIconDataUri(src));
    }
    return iconCache.get(src);
  };

  const drawSection = async (secId, x, y, w) => {
    const items = bySection.get(secId) || [];
    if (items.length === 0) {
      return "";
    }
    const title = sections[secId] || secId;
    const emoji = SECTION_EMOJI[secId] || "";
    const titleText = `${emoji} ${title}`;
    const iconCols = secId === "ai" ? aiIconsPerRow : iconsPerRow;

    const out = [];
    out.push(
      `<text x="${Math.round(x + w / 2)}" y="${y + titleTopPadding}" text-anchor="middle" dominant-baseline="middle" font-family="system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif" font-size="${titleFontSize}" font-weight="700" fill="#e5e7eb">${escapeTextNode(titleText)}</text>`,
    );
    const rows = Math.max(1, Math.ceil(items.length / iconCols));
    for (let row = 0; row < rows; row += 1) {
      const start = row * iconCols;
      const rowItems = items.slice(start, start + iconCols);
      const iconsInRow = rowItems.length;
      const rowWidth = iconsInRow * size + (iconsInRow - 1) * iconGap;
      const rowX = Math.round(x + (w - rowWidth) / 2);
      for (let col = 0; col < rowItems.length; col += 1) {
        const ix = rowX + col * (size + iconGap);
        const iy = y + iconsOffsetY + row * lineHeight;
        const uri = await iconFor(rowItems[col]);
        out.push(
          `<image x="${ix}" y="${iy}" width="${size}" height="${size}" href="${uri}" />`,
        );
      }
    }
    return out.join("\n");
  };

  const parts = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Tech stack by category">`,
  );
  parts.push(`<rect width="${width}" height="${height}" fill="transparent" />`);

  let y = 24;
  for (const row of topRows) {
    const rowH = Math.max(...row.map((id) => sectionHeights.get(id) || 0));
    for (let i = 0; i < row.length; i += 1) {
      const secId = row[i];
      const x = marginX + i * (colWidth + colGap);
      parts.push(await drawSection(secId, x, y, colWidth));
    }
    y += rowH + rowGap;
  }

  const aiX = marginX;
  const aiW = colWidth * 3 + colGap * 2;
  parts.push(await drawSection(aiRow[0], aiX, y, aiW));
  parts.push("</svg>");
  return parts.join("\n");
}

/** docs/index.html: semantic grid + styles.css */
function renderTechStackWeb(manifest) {
  const size = manifest.icon_size || 48;
  const { sections, bySection } = collectSections(manifest);

  const parts = [];
  parts.push('<div class="tech-stack__grid">\n');

  for (const secId of SECTION_ORDER) {
    const rows = bySection.get(secId) || [];
    if (rows.length === 0) {
      continue;
    }
    const title = sections[secId] || secId;
    const emo = SECTION_EMOJI[secId] || "";
    parts.push('  <div class="tech-stack__category">\n');
    parts.push(
      `    <h3>${emo} ${escapeHtml(title)}</h3>\n`,
    );
    parts.push('    <p class="tech-stack__icons">\n');
    for (const skill of rows) {
      parts.push(`      ${renderIconLinks(skill, size, "web")}\n`);
    }
    parts.push("    </p>\n");
    parts.push("  </div>\n");
  }

  parts.push("</div>\n");
  return parts.join("");
}

function replaceBetweenMarkers(filePath, startMarker, endMarker, block) {
  const text = readFileSync(filePath, "utf8");
  const si = text.indexOf(startMarker);
  const ei = text.indexOf(endMarker);
  if (si === -1 || ei === -1 || ei <= si) {
    return false;
  }
  const before = text.slice(0, si + startMarker.length);
  const after = text.slice(ei);
  const next = `${before}\n${block}\n${after}`;
  writeFileSync(filePath, next, "utf8");
  return true;
}

async function main() {
  const manifestPath = join(root, "docs", "SKILLS_MANIFEST.yaml");
  const readmePath = join(root, "README.md");
  const indexPath = join(root, "docs", "index.html");
  const generatedDir = join(root, "docs", "generated");
  const techStackSvgPath = join(generatedDir, "tech-stack.svg");

  const manifest = parse(readFileSync(manifestPath, "utf8"));

  mkdirSync(generatedDir, { recursive: true });
  const techStackSvg = await renderTechStackSvg(manifest);
  writeFileSync(techStackSvgPath, techStackSvg, "utf8");
  console.error("render-skills-readme: updated docs/generated/tech-stack.svg");

  const readmeBlock = renderSkillsHtml();
  const okReadme = replaceBetweenMarkers(
    readmePath,
    "<!--START_SECTION:skills_icons-->",
    "<!--END_SECTION:skills_icons-->",
    readmeBlock,
  );
  if (!okReadme) {
    throw new Error(
      "README.md must contain skills_icons start/end section markers",
    );
  }
  console.error("render-skills-readme: updated README.md skills block");

  const webBlock = renderTechStackWeb(manifest);
  const webOk = replaceBetweenMarkers(
    indexPath,
    "<!--START_TECH_STACK_WEB-->",
    "<!--END_TECH_STACK_WEB-->",
    webBlock,
  );
  if (webOk) {
    console.error("render-skills-readme: updated docs/index.html tech stack");
  } else {
    console.error(
      "render-skills-readme: skipped docs/index.html (markers not found)",
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
