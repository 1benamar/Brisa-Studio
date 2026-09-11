// Dev-only helper. Searches Openverse (commercial-safe licenses) and downloads a
// chosen result into assets/img/, updating assets/credits.json correctly.
//
//   node tools/openverse.js search "fine line tattoo" [count]
//   node tools/openverse.js pick <slot> "<query>" <index>
//
// Not part of the deployed website.
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const IMG_DIR = path.join(ROOT, "assets", "img");
const CREDITS = path.join(ROOT, "assets", "credits.json");
const LICENSES = "cc0,by,by-sa,pdm";
const UA = "Premium-Website-Skill/1.0";

async function search(query, count = 8) {
  const url = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(query)}` +
    `&license=${LICENSES}&mature=false&page_size=${count}`;
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!res.ok) throw new Error("Openverse HTTP " + res.status);
  const json = await res.json();
  return (json.results || []).filter((r) => /\.(jpe?g|png|webp)(\?|$)/i.test(r.url || ""));
}

function line(r, i) {
  const kb = r.filesize ? Math.round(r.filesize / 1024) + "KB" : "?KB";
  const dim = r.width && r.height ? `${r.width}x${r.height}` : "?";
  return `[${i}] ${r.license.toUpperCase()} ${r.license_version || ""} | ${dim} ${kb} | ${r.source}\n` +
    `     ${r.title}\n     tags: ${(r.tags || []).map((t) => t.name).slice(0, 10).join(", ")}\n     ${r.url}`;
}

async function download(url, dest) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error("download HTTP " + res.status);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(dest, buf);
  return buf.length;
}

function saveCredit(slot, r, filename) {
  const credits = fs.existsSync(CREDITS) ? JSON.parse(fs.readFileSync(CREDITS, "utf8")) : {};
  credits[slot] = {
    src: "assets/img/" + filename,
    title: r.title || "",
    creator: r.creator || r.source || "",
    creator_url: r.creator_url || r.foreign_landing_url || "",
    license: r.license || "",
    license_version: r.license_version || "",
    license_url: r.license_url || "",
    foreign_landing_url: r.foreign_landing_url || "",
    source: r.source || "",
  };
  fs.writeFileSync(CREDITS, JSON.stringify(credits, null, 2) + "\n");
}

(async () => {
  const [mode, a, b, c] = process.argv.slice(2);
  if (mode === "search") {
    const results = await search(a, Number(b) || 8);
    console.log(`\n"${a}" → ${results.length} renderable results\n`);
    results.forEach((r, i) => console.log(line(r, i) + "\n"));
  } else if (mode === "pick") {
    const results = await search(b, 10);
    const r = results[Number(c)];
    if (!r) throw new Error("index out of range (" + results.length + " results)");
    const ext = (r.url.match(/\.(jpe?g|png|webp)/i) || [".jpg"])[0].toLowerCase().replace("jpeg", "jpg");
    const filename = a + ext;
    const bytes = await download(r.url, path.join(IMG_DIR, filename));
    saveCredit(a, r, filename);
    console.log(`OK ${filename} ${Math.round(bytes / 1024)}KB | ${r.license} | ${r.title}`);
  } else {
    console.log("usage: search <query> [n] | pick <slot> <query> <index>");
  }
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
