/**
 * Renders docs/SKILLS_MANIFEST.yaml into README.md between
 * <!--START_SECTION:skills_icons--> ... <!--END_SECTION:skills_icons-->
 * and optionally docs/index.html between
 * <!--START_TECH_STACK_WEB--> ... <!--END_TECH_STACK_WEB-->
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
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
  if (skill.link) {
    const rel =
      base === "web"
        ? ' rel="noopener noreferrer" target="_blank"'
        : "";
    return `<a href="${skill.link}" title="${titleAttr}"${rel}>${img}</a>`;
  }
  return `<span title="${titleAttr}">${img}</span>`;
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

/** GitHub profile README: table layout for reliable alignment on GitHub. */
function renderSkillsHtml(manifest) {
  const size = manifest.icon_size || 48;
  const { sections, bySection } = collectSections(manifest);

  const sectionCell = (secId) => {
    const rows = bySection.get(secId) || [];
    if (rows.length === 0) {
      return "";
    }
    const title = sections[secId] || secId;
    const emo = SECTION_EMOJI[secId] || "";
    const parts = [];
    parts.push('    <td align="center" valign="top" width="33%">\n');
    parts.push(`      <h3>${emo} ${escapeHtml(title)}</h3>\n`);
    parts.push("      <p>\n");
    for (const skill of rows) {
      parts.push(`        ${renderIconLinks(skill, size, "readme")}\n`);
    }
    parts.push("      </p>\n");
    parts.push("    </td>\n");
    return parts.join("");
  };

  const rowMarkup = (ids) => {
    const cells = ids.map((id) => sectionCell(id)).filter(Boolean);
    if (cells.length === 0) {
      return "";
    }
    return `  <tr>\n${cells.join("")}  </tr>\n`;
  };

  const aiRows = bySection.get("ai") || [];
  const aiTitle = sections.ai || "ai";
  const aiEmoji = SECTION_EMOJI.ai || "";

  const parts = [];
  parts.push('<table align="center">\n');
  parts.push(rowMarkup(["cloud", "iac", "data"]));
  parts.push(rowMarkup(["languages", "observability", "tooling"]));
  if (aiRows.length > 0) {
    parts.push("  <tr>\n");
    parts.push('    <td align="center" colspan="3">\n');
    parts.push(`      <h3>${aiEmoji} ${escapeHtml(aiTitle)}</h3>\n`);
    parts.push("      <p>\n");
    for (const skill of aiRows) {
      parts.push(`        ${renderIconLinks(skill, size, "readme")}\n`);
    }
    parts.push("      </p>\n");
    parts.push("    </td>\n");
    parts.push("  </tr>\n");
  }
  parts.push("</table>\n");
  return parts.join("");
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

function main() {
  const manifestPath = join(root, "docs", "SKILLS_MANIFEST.yaml");
  const readmePath = join(root, "README.md");
  const indexPath = join(root, "docs", "index.html");

  const manifest = parse(readFileSync(manifestPath, "utf8"));

  const readmeBlock = renderSkillsHtml(manifest);
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

main();
