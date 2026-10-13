import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

function getDistMetrics(distDir) {
  let totalBytes = 0;
  let totalGzipBytes = 0;
  const files = [];

  function walk(dir) {
    for (const item of fs.readdirSync(dir)) {
      const full = path.join(dir, item);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        walk(full);
      } else if (item.endsWith(".js") || item.endsWith(".css")) {
        const content = fs.readFileSync(full);
        const gzipped = zlib.gzipSync(content);
        totalBytes += stat.size;
        totalGzipBytes += gzipped.length;
        files.push({
          rel: path.relative(distDir, full).replace(/\\/g, "/"),
          size: stat.size,
          gzip: gzipped.length,
        });
      }
    }
  }

  walk(distDir);
  return { totalBytes, totalGzipBytes, files };
}

console.log("=== PHASE 5 TARGET BUILD & TREE-SHAKING ASSERTIONS ===");

// 1. Build PUBLIC target
console.log("\n>>> Building PUBLIC target...");
execSync("node scripts/build-target.mjs public", { stdio: "inherit" });

const publicDist = path.resolve(process.cwd(), "dist");
const publicFiles = fs.readdirSync(path.join(publicDist, "assets"));

// Assert no AdminPage chunk
const adminChunks = publicFiles.filter((f) => /Admin/i.test(f));
if (adminChunks.length > 0) {
  console.error(`FAIL: Public build contains Admin chunks: ${adminChunks.join(", ")}`);
  process.exit(1);
}

// Assert no AdminPage component string in any JS bundle
let adminStringFound = false;
for (const file of publicFiles) {
  if (file.endsWith(".js")) {
    const content = fs.readFileSync(path.join(publicDist, "assets", file), "utf-8");
    if (content.includes("AdminPage") || content.includes("Super Admin Access")) {
      console.error(`FAIL: Public JS bundle ${file} leaked AdminPage references`);
      adminStringFound = true;
    }
  }
}
if (adminStringFound) process.exit(1);

const publicMetrics = getDistMetrics(publicDist);
console.log(`PASS: Public target contains NO AdminPage chunks or strings.`);
console.log(`Public Target Total JS/CSS: ${(publicMetrics.totalBytes / 1024).toFixed(2)} kB (gzip: ${(publicMetrics.totalGzipBytes / 1024).toFixed(2)} kB)`);

// 2. Build ADMIN target
console.log("\n>>> Building ADMIN target...");
execSync("node scripts/build-target.mjs admin", { stdio: "inherit" });

const adminDist = path.resolve(process.cwd(), "dist");
const adminAssets = fs.readdirSync(path.join(adminDist, "assets"));

// Assert no PublicMenu, Landing, DashboardLayout or AnalyticsSection chunks
const publicLeakedChunks = adminAssets.filter((f) =>
  /PublicMenu|LandingPage|DashboardLayout|AnalyticsSection/i.test(f)
);
if (publicLeakedChunks.length > 0) {
  console.error(`FAIL: Admin build contains public/dashboard chunks: ${publicLeakedChunks.join(", ")}`);
  process.exit(1);
}

// Assert no sw.js or workbox files
if (fs.existsSync(path.join(adminDist, "sw.js"))) {
  console.error("FAIL: Admin build emitted sw.js service worker");
  process.exit(1);
}

// Assert robots.txt has Disallow: /
const adminRobots = fs.readFileSync(path.join(adminDist, "robots.txt"), "utf-8");
if (!adminRobots.includes("Disallow: /")) {
  console.error("FAIL: Admin build robots.txt does not contain Disallow: /");
  process.exit(1);
}

// Assert index.html has noindex,nofollow
const adminHtml = fs.readFileSync(path.join(adminDist, "index.html"), "utf-8");
if (!adminHtml.includes('content="noindex,nofollow"')) {
  console.error("FAIL: Admin build index.html missing noindex,nofollow meta tag");
  process.exit(1);
}

const adminMetrics = getDistMetrics(adminDist);
console.log(`PASS: Admin target contains NO public menu/landing/analytics chunks, NO service worker, and HAS noindex,nofollow + disallow-all robots.txt.`);
console.log(`Admin Target Total JS/CSS: ${(adminMetrics.totalBytes / 1024).toFixed(2)} kB (gzip: ${(adminMetrics.totalGzipBytes / 1024).toFixed(2)} kB)`);

console.log("\n=== ALL TARGET BUILD ASSERTIONS PASSED ===");
