// Size budget for index.html. Run: node tests/size.js
// Fails when the file is over 1 MB raw. Prints the raw and gzip size.
// GitHub Pages sends the file gzip-compressed, so the gzip size is what goes over Wi-Fi.
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const LIMIT = 1024 * 1024; // 1 MB raw
const buf = fs.readFileSync(path.join(__dirname, "..", "index.html"));
const gz = zlib.gzipSync(buf, { level: 9 }).length;
const kb = (n) => (n / 1024).toFixed(1) + " KB";
const pct = Math.round((buf.length / LIMIT) * 100);

console.log(`index.html: ${kb(buf.length)} raw, ${kb(gz)} gzip. Budget: ${kb(LIMIT)} raw (${pct}% used).`);
if (process.env.GITHUB_STEP_SUMMARY) {
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,
    `### Size budget\n\n| File | Raw | Gzip | Budget | Used |\n|---|---|---|---|---|\n| index.html | ${kb(buf.length)} | ${kb(gz)} | ${kb(LIMIT)} | ${pct}% |\n`);
}
if (buf.length > LIMIT) {
  console.error(`::error file=index.html::index.html is ${kb(buf.length)}, over the budget of ${kb(LIMIT)}.`);
  process.exit(1);
}
