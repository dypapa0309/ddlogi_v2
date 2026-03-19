// build.js
const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const DIST = path.join(ROOT, "dist");

function rmDir(p) { if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true }); }
function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }
function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    ensureDir(dest);
    for (const file of fs.readdirSync(src)) copyRecursive(path.join(src, file), path.join(dest, file));
  } else {
    ensureDir(path.dirname(dest));
    fs.copyFileSync(src, dest);
  }
}

rmDir(DIST);
ensureDir(DIST);
copyRecursive(path.join(ROOT, "assets"), path.join(DIST, "assets"));
copyRecursive(path.join(ROOT, "en"), path.join(DIST, "en"));
copyRecursive(path.join(ROOT, "ddclean"), path.join(DIST, "ddclean"));
copyRecursive(path.join(ROOT, "admin"), path.join(DIST, "admin"));
copyRecursive(path.join(ROOT, "netlify"), path.join(DIST, "netlify"));
if (fs.existsSync(path.join(ROOT, "config.js"))) fs.copyFileSync(path.join(ROOT, "config.js"), path.join(DIST, "config.js"));
if (fs.existsSync(path.join(ROOT, "index.html"))) fs.copyFileSync(path.join(ROOT, "index.html"), path.join(DIST, "index.html"));

// 안정성 우선: 외부 툴 없이 그대로 복사한 뒤 .min 파일명만 맞춘다.
const cssIn = path.join(ROOT, "assets", "css", "style.css");
const cssOut = path.join(DIST, "assets", "css", "style.min.css");
ensureDir(path.dirname(cssOut));
if (fs.existsSync(cssIn)) fs.copyFileSync(cssIn, cssOut);

const jsIn = path.join(ROOT, "assets", "js", "app.js");
const jsOut = path.join(DIST, "assets", "js", "app.min.js");
ensureDir(path.dirname(jsOut));
if (fs.existsSync(jsIn)) fs.copyFileSync(jsIn, jsOut);

const indexPath = path.join(DIST, "index.html");
if (fs.existsSync(indexPath)) {
  let html = fs.readFileSync(indexPath, "utf8");
  html = html.replace(/<link\s+rel="stylesheet"\s+href="\/assets\/css\/style\.css"\s*\/?>/g, `<link rel="stylesheet" href="/assets/css/style.min.css" />`);
  html = html.replace(/<script\s+src="\/assets\/js\/app\.js"\s+defer><\/script>/g, `<script src="/assets/js/app.min.js" defer></script>`);
  fs.writeFileSync(indexPath, html, "utf8");
}

console.log("\n✅ Build done. dist/ is ready.\n");
