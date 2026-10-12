// Generates the static site into docs/ from content/site.json.
// Run with: node build.mjs
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const OUT = join(ROOT, "docs");
const content = JSON.parse(readFileSync(join(ROOT, "content", "site.json"), "utf8"));
const sizes = JSON.parse(readFileSync(join(ROOT, "tools", "image-sizes.json"), "utf8"));
const { site, ui, projects, alt, collage } = content;
const LANGS = ["en", "he"];
const ASSET_VERSION = Date.now().toString(36);

// ---------- helpers ----------

const esc = (s = "") =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const pad = (n) => String(n).padStart(2, "0");

// Path (relative to docs/) of a page, e.g. "he/projects/nay/index.html".
function pagePath(lang, slug) {
  const base = lang === "en" ? "" : `${lang}/`;
  return slug ? `${base}projects/${slug}/index.html` : `${base}index.html`;
}

// Relative prefix from a page back to docs/.
function prefixFor(path) {
  const depth = path.split("/").length - 1;
  return depth ? "../".repeat(depth) : "./";
}

// Link to another page, written relative to the current one, without "index.html".
function linkTo(prefix, path) {
  const clean = path.replace(/index\.html$/, "");
  return (prefix + clean) || "./";
}

function srcset(prefix, name) {
  const info = sizes[name];
  if (!info) throw new Error(`Unknown image: ${name}`);
  return info.widths.map((w) => `${prefix}assets/img/${name}-${w}.webp ${w}w`).join(", ");
}

function largest(prefix, name) {
  const info = sizes[name];
  return `${prefix}assets/img/${name}-${info.widths[info.widths.length - 1]}.webp`;
}

function img(prefix, name, lang, { sizesAttr = "100vw", eager = false, cls = "", decorative = false } = {}) {
  const info = sizes[name];
  const mid = info.widths.find((w) => w >= 1200) ?? info.widths[info.widths.length - 1];
  const altText = decorative ? "" : alt[name]?.[lang] ?? "";
  return `<img${cls ? ` class="${cls}"` : ""} src="${prefix}assets/img/${name}-${mid}.webp" srcset="${srcset(prefix, name)}" sizes="${sizesAttr}" width="${info.w}" height="${info.h}" alt="${esc(altText)}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">`;
}

// ---------- shared chrome ----------

function head({ lang, title, description, prefix, path, altPath, theme, ogImage }) {
  const t = ui[lang];
  const other = lang === "en" ? "he" : "en";
  const fonts =
    lang === "he"
      ? "family=Heebo:wght@300;400;500;700;800&family=Inter:wght@300;400;500;700;800"
      : "family=Inter:wght@300;400;500;700;800";
  const abs = (p) => (site.url ? site.url.replace(/\/$/, "") + "/" + p.replace(/index\.html$/, "") : "");
  return `<!doctype html>
<html lang="${t.lang}" dir="${t.dir}" class="no-js">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="theme-color" content="${theme === "dark" ? "#000000" : "#ffffff"}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:locale" content="${lang === "he" ? "he_IL" : "en_US"}">
${site.url ? `<meta property="og:image" content="${abs(`assets/img/${ogImage}-1200.webp`)}">\n<link rel="canonical" href="${abs(path)}">\n<link rel="alternate" hreflang="${lang}" href="${abs(path)}">\n<link rel="alternate" hreflang="${other}" href="${abs(altPath)}">` : ""}
<link rel="icon" href="${prefix}assets/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?${fonts}&display=swap">
<link rel="stylesheet" href="${prefix}assets/css/style.css?v=${ASSET_VERSION}">
<script>(function(d){d.classList.replace("no-js","js");try{if(!sessionStorage.getItem("mk-intro")&&!matchMedia("(prefers-reduced-motion: reduce)").matches){d.classList.add("show-intro");sessionStorage.setItem("mk-intro","1")}}catch(e){}})(document.documentElement)</script>
<script type="application/json" id="i18n">${JSON.stringify(Object.fromEntries(["close", "prev", "next", "image_of", "play_video", "pause_video", "lightbox_label", "sound"].map((k) => [k, t[k]])))}</script>
<script src="${prefix}assets/js/main.js?v=${ASSET_VERSION}" defer></script>
</head>`;
}

function header({ lang, prefix, altPath }) {
  const t = ui[lang];
  const other = lang === "en" ? "he" : "en";
  const home = linkTo(prefix, pagePath(lang));
  return `<a class="skip-link" href="#main">${esc(t.skip)}</a>
<header class="site-header">
  <a class="wordmark" href="${home}" aria-label="${esc(t.home_label)}" lang="en" dir="ltr">MAYA KLEINER</a>
  <p class="roles">${t.roles.map((r) => `<span>${esc(r)}</span>`).join("")}</p>
  <nav class="site-nav" aria-label="${esc(t.nav_label)}">
    <ul>
      <li><a href="${home}#projects">${esc(t.nav_projects)}</a></li>
      <li class="nav-stack"><a href="${home}#about">${esc(t.nav_about)}</a><a href="${home}#contact">${esc(t.nav_contact)}</a></li>
      <li><a class="lang-switch" href="${linkTo(prefix, altPath)}" lang="${other}" hreflang="${other}" aria-label="${esc(t.switch_aria)}">${esc(t.switch_label)}</a></li>
    </ul>
  </nav>
</header>`;
}

function footer({ lang }) {
  const t = ui[lang];
  const links = [];
  if (site.email) links.push(`<li><a href="mailto:${esc(site.email)}">${esc(site.email)}</a></li>`);
  if (site.instagram) links.push(`<li><a href="https://instagram.com/${esc(site.instagram.replace(/^@/, ""))}" rel="me noopener">Instagram</a></li>`);
  if (site.linkedin) links.push(`<li><a href="${esc(site.linkedin)}" rel="me noopener">LinkedIn</a></li>`);
  if (site.phone) links.push(`<li><a href="tel:${esc(site.phone.replace(/[^+\d]/g, ""))}" dir="ltr">${esc(site.phone)}</a></li>`);
  return `<footer class="site-footer" id="contact">
  <h2 class="footer-title">${esc(t.contact_heading)}</h2>
  ${links.length ? `<p>${esc(t.contact_text)}</p>\n  <ul class="contact-links">${links.join("")}</ul>` : `<p>${esc(t.contact_missing)}</p>`}
  <p class="copyright"><small>© ${new Date().getFullYear()} <span lang="en" dir="ltr">Maya Kleiner</span>. ${esc(t.rights)}</small></p>
</footer>`;
}

function page({ lang, path, altPath, title, description, theme = "dark", bodyClass = "", ogImage = "cob-exhibition", main }) {
  const prefix = prefixFor(path);
  return `${head({ lang, title, description, prefix, path, altPath, theme, ogImage })}
<body class="theme-${theme} ${bodyClass}">
${header({ lang, prefix, altPath })}
${main(prefix)}
${footer({ lang })}
</body>
</html>
`;
}

// ---------- home ----------

function homeMain(lang) {
  const t = ui[lang];
  return (prefix) => `<div class="intro" aria-hidden="true"><span lang="en" dir="ltr">MAYA KLEINER</span></div>
<main id="main" tabindex="-1">
  <section class="hero" aria-label="${esc(t.collage_label)}">
    <ul class="collage">
      ${collage
        .map((c, i) => {
          const p = projects.find((x) => x.slug === c.project);
          return `<li class="card slot-${c.slot}" style="--i:${i}"><a href="${linkTo(prefix, pagePath(lang, p.slug))}">${img(prefix, c.image, lang, { sizesAttr: "(min-width: 900px) 30vw, 50vw", eager: i < 3, decorative: true })}<span class="visually-hidden">${esc(p.title)}: ${esc(alt[c.image][lang])}</span></a></li>`;
        })
        .join("\n      ")}
    </ul>
  </section>

  <section class="about" id="about" aria-labelledby="hello">
    ${img(prefix, "home-stars", lang, { cls: "stars", decorative: true, sizesAttr: "(min-width: 900px) 30vw, 60vw" })}
    <h1 id="hello" class="hello">${esc(t.hello)}</h1>
    <p class="bio">${esc(t.bio)}</p>
  </section>

  <section class="projects" id="projects" aria-labelledby="projects-title">
    <h2 id="projects-title" class="visually-hidden">${esc(t.projects_heading)}</h2>
    <ol class="project-list">
      ${projects
        .map(
          (p, i) => `<li>
        <a class="project-row" href="${linkTo(prefix, pagePath(lang, p.slug))}">
          <span class="num" aria-hidden="true">${pad(i + 1)}</span>
          <span class="title" lang="en" dir="ltr">${esc(p.title)}</span>
          <span class="cat">${esc(p.category[lang])}</span>
          ${img(prefix, p.cover, lang, { cls: "peek", decorative: true, sizesAttr: "320px" })}
        </a>
      </li>`
        )
        .join("\n      ")}
    </ol>
  </section>
</main>`;
}

// ---------- project ----------

function figure(prefix, name, lang, sizesAttr, crop) {
  const t = ui[lang];
  const pic = img(prefix, name, lang, { sizesAttr, cls: crop ? "cropped" : "" });
  const styled = crop ? pic.replace("<img ", `<img style="aspect-ratio: ${crop}" `) : pic;
  return `<figure class="shot"><a class="zoom" href="${largest(prefix, name)}" data-lightbox>${styled}<span class="visually-hidden"> (${esc(t.open_image)})</span></a></figure>`;
}

function block(prefix, b, lang) {
  if (b.type === "video") {
    return `<div class="block block-video block-${b.layout || "narrow"}">
      <video class="loop-video" src="${prefix}assets/video/${b.src}.mp4" poster="${prefix}assets/video/${b.poster}" width="${b.width}" height="${b.height}" muted loop playsinline preload="metadata"${b.audio ? " data-audio" : ""} aria-label="${esc(b.label[lang])}"></video>
    </div>`;
  }
  const sizesFor = { full: "(min-width: 1200px) 1100px, 100vw", narrow: "(min-width: 900px) 620px, 100vw", pair: "(min-width: 900px) 50vw, 100vw", trio: "(min-width: 900px) 33vw, 100vw" };
  return `<div class="block block-${b.type}">
      ${b.images.map((n) => figure(prefix, n, lang, sizesFor[b.type], b.crop)).join("\n      ")}
    </div>`;
}

function projectMain(lang, p, i) {
  const t = ui[lang];
  const next = projects[(i + 1) % projects.length];
  return (prefix) => `<main id="main" class="project" tabindex="-1">
  <header class="project-head">
    <p class="eyebrow"><span aria-hidden="true">${pad(i + 1)}</span><span>${esc(p.category[lang])}</span></p>
    <h1 class="project-title" lang="en" dir="ltr">${esc(p.title)}</h1>
    ${p.description[lang] ? `<p class="lede">${esc(p.description[lang])}</p>` : ""}
  </header>
  <div class="gallery">
    ${p.gallery.map((b) => block(prefix, b, lang)).join("\n    ")}
  </div>
  <nav class="project-nav" aria-label="${esc(t.nav_projects)}">
    <a class="back" href="${linkTo(prefix, pagePath(lang))}#projects">${esc(t.back_to_projects)}</a>
    <a class="next" href="${linkTo(prefix, pagePath(lang, next.slug))}"><span class="next-label">${esc(t.next_project)}</span> <span class="next-title" lang="en" dir="ltr">${esc(next.title)}</span></a>
  </nav>
</main>`;
}

// ---------- write ----------

function write(path, html) {
  const file = join(OUT, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, html);
}

// Remove previously generated pages but keep assets.
for (const dir of ["projects", "he"]) rmSync(join(OUT, dir), { recursive: true, force: true });

for (const lang of LANGS) {
  const other = lang === "en" ? "he" : "en";
  const t = ui[lang];
  write(
    pagePath(lang),
    page({ lang, path: pagePath(lang), altPath: pagePath(other), title: t.title, description: t.description, theme: "dark", bodyClass: "home", main: homeMain(lang) })
  );
  projects.forEach((p, i) => {
    const path = pagePath(lang, p.slug);
    write(
      path,
      page({
        lang,
        path,
        altPath: pagePath(other, p.slug),
        title: `${p.title} — ${p.category[lang]} | ${lang === "he" ? "מאיה קליינר" : "Maya Kleiner"}`,
        description: p.description[lang] || `${p.title}: ${p.category[lang]}. ${t.description}`,
        theme: p.theme,
        ogImage: p.cover,
        main: projectMain(lang, p, i),
      })
    );
  });
}

// 404 page (GitHub Pages serves docs/404.html for unknown URLs).
const homeHref = site.url || "/";
write(
  "404.html",
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(ui.en.not_found_title)} | Maya Kleiner</title>
<style>body{margin:0;min-height:100vh;display:grid;place-content:center;gap:1rem;background:#000;color:#fff;font:400 1.125rem/1.5 system-ui,sans-serif;text-align:center;padding:1.5rem}a{color:#fff}h1{letter-spacing:.08em;text-transform:uppercase}</style></head>
<body><main><h1>${esc(ui.en.not_found_title)}</h1><p>${esc(ui.en.not_found_text)}</p><p><a href="${esc(homeHref)}">${esc(ui.en.not_found_link)}</a></p>
<p lang="he" dir="rtl">${esc(ui.he.not_found_text)} <a href="${esc(homeHref)}he/">${esc(ui.he.not_found_link)}</a></p></main></body></html>
`
);

writeFileSync(join(OUT, ".nojekyll"), "");
writeFileSync(join(OUT, "robots.txt"), `User-agent: *\nAllow: /\n${site.url ? `Sitemap: ${site.url.replace(/\/$/, "")}/sitemap.xml\n` : ""}`);
if (site.url) {
  const base = site.url.replace(/\/$/, "") + "/";
  const urls = LANGS.flatMap((l) => [pagePath(l), ...projects.map((p) => pagePath(l, p.slug))]).map((p) => base + p.replace(/index\.html$/, ""));
  writeFileSync(join(OUT, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${u}</loc></url>`).join("\n")}\n</urlset>\n`);
} else if (existsSync(join(OUT, "sitemap.xml"))) {
  rmSync(join(OUT, "sitemap.xml"));
}

console.log(`Built ${LANGS.length * (projects.length + 1)} pages into docs/`);
