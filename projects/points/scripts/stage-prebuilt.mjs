// Copies a `vercel build` output plus every file its functions reference
// into a standalone folder, so it can be deployed with `vercel deploy
// --prebuilt` from outside the repo. Needed because the repo root's
// .vercelignore (for the subscribe site) excludes projects/points.
//
// Usage: node scripts/stage-prebuilt.mjs <repo-root> <stage-dir>
import fs from "node:fs";
import path from "node:path";

const [root, stage] = process.argv.slice(2).map((p) => path.resolve(p));
if (!root || !stage) throw new Error("usage: stage-prebuilt.mjs <repo-root> <stage-dir>");

const out = path.join(root, ".vercel/output");
fs.rmSync(stage, { recursive: true, force: true });
fs.mkdirSync(path.join(stage, ".vercel"), { recursive: true });
fs.cpSync(out, path.join(stage, ".vercel/output"), { recursive: true, dereference: true });

const files = new Set();
const walk = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name === ".vc-config.json") for (const src of Object.values(JSON.parse(fs.readFileSync(p, "utf8")).filePathMap ?? {})) files.add(src);
  }
};
walk(path.join(stage, ".vercel/output/functions"));

let bytes = 0;
for (const rel of files) {
  const from = path.join(root, rel);
  const to = path.join(stage, rel);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(fs.realpathSync(from), to);
  bytes += fs.statSync(to).size;
}
console.log(`staged ${files.size} files (${(bytes / 1e6).toFixed(1)} MB) into ${stage}`);
