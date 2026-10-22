import { spawnSync } from "node:child_process";
import { access, copyFile, mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";

const packageManager = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const build = spawnSync(packageManager, ["build"], {
  stdio: "inherit",
  shell: process.platform === "win32",
});

if (build.error) throw build.error;
if (build.status !== 0) process.exit(build.status ?? 1);

const sourceRoot = path.resolve("dist", "public");
const publicRoot = path.resolve("public");
const htmlShell = path.join(sourceRoot, "index.html");
await access(htmlShell);

async function copyCdnAssets(source, target, relative = "") {
  await mkdir(target, { recursive: true });
  const entries = await readdir(source, { withFileTypes: true });

  for (const entry of entries) {
    const childRelative = relative ? `${relative}/${entry.name}` : entry.name;
    // The SSR shell is included in the Function bundle; runtime configuration stays dynamic.
    if (
      childRelative === "index.html"
      || childRelative === "api/platform/config.js"
      || childRelative === ".gitkeep"
      || childRelative === "__manus__"
      || childRelative.startsWith("__manus__/")
    ) continue;

    const childSource = path.join(source, entry.name);
    const childTarget = path.join(target, entry.name);
    if (entry.isDirectory()) {
      await copyCdnAssets(childSource, childTarget, childRelative);
    } else if (entry.isFile()) {
      await copyFile(childSource, childTarget);
    }
  }
}

await rm(publicRoot, { recursive: true, force: true });
await mkdir(publicRoot, { recursive: true });
await copyCdnAssets(sourceRoot, publicRoot);
console.log(`Prepared Vercel CDN assets from ${path.relative(process.cwd(), sourceRoot)}.`);
