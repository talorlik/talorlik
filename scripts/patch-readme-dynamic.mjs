/**
 * Patches README.md between github_stats and activity markers using GitHub API.
 * Env: GITHUB_TOKEN (use repository PAT via GH_TOKEN secret in Actions).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const readmePath = join(root, "README.md");

const USER = process.env.GH_USERNAME || "talorlik";
const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
if (!token) {
  console.error("patch-readme-dynamic: skip (no GITHUB_TOKEN/GH_TOKEN)");
  process.exit(0);
}

async function ghJson(path) {
  const url = path.startsWith("http")
    ? path
    : `https://api.github.com${path}`;
  const r = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!r.ok) {
    throw new Error(`GitHub API ${r.status}: ${await r.text()}`);
  }
  return r.json();
}

async function sumRepoStars(login) {
  let page = 1;
  let total = 0;
  for (;;) {
    const data = await ghJson(
      `/users/${login}/repos?per_page=100&page=${page}&affiliation=owner`,
    );
    if (!Array.isArray(data) || data.length === 0) {
      break;
    }
    for (const repo of data) {
      total += repo.stargazers_count || 0;
    }
    if (data.length < 100) {
      break;
    }
    page += 1;
  }
  return total;
}

function staticBadge(label, message) {
  const p = new URLSearchParams({
    label,
    message: String(message),
    color: "00d9ff",
    labelColor: "1a1b27",
    style: "for-the-badge",
  });
  return `https://img.shields.io/static/v1?${p.toString()}`;
}

function replaceBlock(readme, startTag, endTag, content) {
  const si = readme.indexOf(startTag);
  const ei = readme.indexOf(endTag);
  if (si === -1 || ei === -1 || ei <= si) {
    throw new Error(`Missing markers ${startTag} / ${endTag}`);
  }
  return (
    readme.slice(0, si + startTag.length) +
    "\n" +
    content +
    "\n" +
    readme.slice(ei)
  );
}

async function main() {
  const user = await ghJson(`/users/${USER}`);
  const followers = user.followers ?? 0;
  const publicRepos = user.public_repos ?? 0;
  const totalStars = await sumRepoStars(USER);
  const created = user.created_at
    ? new Date(user.created_at).getFullYear()
    : "";

  const statsHtml = `<div align="center">

<p><em>Live metrics below are refreshed by GitHub Actions (followers, public repos, total stars on
owned repos, member since).</em></p>

<p align="center">
  <a href="https://github.com/${USER}?tab=followers"><img src="${staticBadge("Followers", followers)}" alt="GitHub followers" /></a>
  <a href="https://github.com/${USER}?tab=repositories"><img src="${staticBadge("Public repos", publicRepos)}" alt="Public repositories" /></a>
  <img src="${staticBadge("Stars (owned repos)", totalStars)}" alt="Total stars on owned repositories" />
  <img src="${staticBadge("GitHub since", created)}" alt="GitHub member since" />
</p>

</div>`;

  let readme = readFileSync(readmePath, "utf8");
  readme = replaceBlock(
    readme,
    "<!--START_SECTION:github_stats-->",
    "<!--END_SECTION:github_stats-->",
    statsHtml,
  );

  const events = await ghJson(`/users/${USER}/events/public?per_page=10`);
  const lines = [];
  for (const ev of events) {
    const type = ev.type;
    const repo = ev.repo?.name || "?";
    const url = `https://github.com/${repo}`;
    let line = "";
    if (type === "PushEvent") {
      const ref = ev.payload?.ref?.split("/").pop() || "main";
      const commits = ev.payload?.commits?.length || 0;
      line = `- 🚀 **Pushed** ${commits} commit(s) to [\`${repo}\`](${url}) (${ref})`;
    } else if (type === "CreateEvent") {
      line = `- ✨ **Created** ${ev.payload?.ref_type || "ref"} in [\`${repo}\`](${url})`;
    } else if (type === "WatchEvent") {
      line = `- ⭐ **Starred** [\`${repo}\`](${url})`;
    } else if (type === "PullRequestEvent") {
      const action = ev.payload?.action || "";
      line = `- 🔀 **PR ${action}** in [\`${repo}\`](${url})`;
    } else if (type === "IssuesEvent") {
      const action = ev.payload?.action || "";
      line = `- 📌 **Issue ${action}** in [\`${repo}\`](${url})`;
    } else {
      line = `- 📌 **${type}** in [\`${repo}\`](${url})`;
    }
    lines.push(line);
  }

  const activityMd =
    lines.length > 0
      ? `${lines.join("\n")}\n`
      : `_No recent public activity._\n`;

  readme = replaceBlock(
    readme,
    "<!--START_SECTION:activity-->",
    "<!--END_SECTION:activity-->",
    "\n" + activityMd,
  );

  writeFileSync(readmePath, readme, "utf8");
  console.error("patch-readme-dynamic: updated github_stats and activity");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
