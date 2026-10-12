// Experimental scroll-driven redesign. Reads the same content as the live site
// (content/site.json, tools/image-sizes.json, docs/assets) without changing them,
// and writes a self-contained site to next/dist/.
// Run with: node next/build.mjs            (local preview in next/dist/)
//           node next/build.mjs --publish  (writes docs/next/, served at /next/ beside the main
//                                           site and reusing its images instead of copying them)
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(HERE);
const PUBLISH = process.argv.includes("--publish");
const OUT = PUBLISH ? join(ROOT, "docs", "next") : join(HERE, "dist");
const MEDIA = PUBLISH ? "../" : ""; // published pages share docs/assets with the main site
const content = JSON.parse(readFileSync(join(ROOT, "content", "site.json"), "utf8"));
const sizes = JSON.parse(readFileSync(join(ROOT, "tools", "image-sizes.json"), "utf8"));
const { site, ui, projects, alt } = content;
const LANGS = ["en", "he"];
const V = Date.now().toString(36);

const GSAP = "https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5";
const LENIS = "https://cdn.jsdelivr.net/npm/lenis@1.1.13/dist/lenis.min.js";

// Text that only exists in this design.
const T = {
  en: {
    scroll: "Scroll",
    work: "Selected work",
    view: "View",
    open: "Open project",
    lens: "Through my lens",
    lens_cta: "All photography",
    talk: "Let's create",
    top: "Back to top",
    next: "Next project",
    loading: "Loading",
    prev_project: "Previous project",
    all_projects: "All projects",
    close: "Close",
    marquee: ["Designer", "Photographer", "Branding", "Typography", "Book design", "UX & UI", "Illustration"],
  },
  he: {
    scroll: "גללו",
    work: "עבודות נבחרות",
    view: "צפייה",
    open: "לפרויקט",
    lens: "דרך העדשה שלי",
    lens_cta: "לכל הצילומים",
    talk: "בואו ניצור",
    top: "חזרה למעלה",
    next: "הפרויקט הבא",
    loading: "טוען",
    prev_project: "הפרויקט הקודם",
    all_projects: "כל הפרויקטים",
    close: "סגירה",
    marquee: ["מעצבת", "צלמת", "מיתוג", "טיפוגרפיה", "עיצוב ספרים", "UX & UI", "איור"],
  },
};

// Accent colour per project, picked from the work itself.
const ACCENT = {
  "co-blanche": "#e8e3d6",
  "spin-90": "#ffffff",
  "vintage-collage": "#8cc4f0",
  moon: "#9b8cff",
  fringe: "#ff4a2b",
  memory: "#e0262f",
  nay: "#ff7a1a",
  illustration: "#ff5aa8",
  photography: "#e3b04b",
};

// Images flying through the 3D hero: [name, x (vw), y (vh), depth (px), width (vw)].
const FIELD = [
  ["ill-vinyl", -27, -14, -250, 22],
  ["cob-tickets", 21, -20, -650, 13],
  ["vin-igloo", 30, 14, -1050, 15],
  ["spin-poster", -22, 21, -1450, 13],
  ["moon-phones-2", 3, 25, -1850, 21],
  ["fringe-poster", -33, -6, -2250, 12],
  ["nay-blue", 25, -12, -2650, 12],
  ["ph-ramen", -9, -24, -3050, 11],
  ["mem-cover", 33, 20, -3450, 20],
  ["ill-synth", -25, 13, -3850, 13],
  ["vin-hill", 13, -5, -4250, 13],
  ["ph-fuji", -2, 4, -4750, 30],
];

const REEL = ["ph-street", "ph-kimono", "ph-ginkgo", "ph-girls", "ph-ramen", "ph-fuji", "ph-pagoda", "ph-boy", "ph-mirror", "ph-shrine"];

// ---------- helpers ----------

const esc = (s = "") =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const pad = (n) => String(n).padStart(2, "0");

const pagePath = (lang, slug) => `${lang === "en" ? "" : `${lang}/`}${slug ? `projects/${slug}/` : ""}index.html`;
const prefixFor = (path) => "../".repeat(path.split("/").length - 1) || "./";
const linkTo = (prefix, path) => prefix + path.replace(/index\.html$/, "") || "./";

// Splits text into spans for animation; screen readers get the plain text from a hidden copy.
// Letters are grouped per word so a line can only break between words.
const chars = (text) =>
  text
    .split(" ")
    .map((word) => `<span class="cw">${[...word].map((c) => `<span class="ch"><span>${esc(c)}</span></span>`).join("")}</span>`)
    .join(" ");
const words = (text) => text.split(/\s+/).map((w) => `<span class="w">${esc(w)}</span>`).join(" ");
const splitTitle = (text, cls, tag = "span", attrs = "") =>
  `<${tag} class="${cls}"${attrs}><span class="visually-hidden">${esc(text)}</span><span aria-hidden="true">${chars(text)}</span></${tag}>`;

function img(prefix, name, lang, { sizesAttr = "100vw", eager = false, cls = "", decorative = false, vt = "" } = {}) {
  const info = sizes[name];
  if (!info) throw new Error(`Unknown image: ${name}`);
  const mid = info.widths.find((w) => w >= 1200) ?? info.widths.at(-1);
  const set = info.widths.map((w) => `${prefix}${MEDIA}assets/img/${name}-${w}.webp ${w}w`).join(", ");
  const a = decorative ? "" : alt[name]?.[lang] ?? "";
  return `<img${cls ? ` class="${cls}"` : ""}${vt ? ` style="view-transition-name:${vt}"` : ""} src="${prefix}${MEDIA}assets/img/${name}-${mid}.webp" srcset="${set}" sizes="${sizesAttr}" width="${info.w}" height="${info.h}" alt="${esc(a)}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">`;
}
const largest = (prefix, name) => `${prefix}${MEDIA}assets/img/${name}-${sizes[name].widths.at(-1)}.webp`;

// ---------- chrome ----------

function head({ lang, title, description, prefix, accent = "#f2efe8" }) {
  const t = ui[lang];
  const fonts =
    lang === "he"
      ? "family=Unbounded:wght@400;600;800&family=Heebo:wght@300;400;600;800&family=Rubik:wght@500;800"
      : "family=Unbounded:wght@400;600;800&family=Inter+Tight:wght@300;400;500;700";
  return `<!doctype html>
<html lang="${t.lang}" dir="${t.dir}" class="no-js" style="--accent:${accent}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">${PUBLISH ? '\n<meta name="robots" content="noindex">' : ""}
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="theme-color" content="#0b0b0b">
<meta name="view-transition" content="same-origin">
<link rel="icon" href="${prefix}${MEDIA}assets/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?${fonts}&display=swap">
<link rel="stylesheet" href="${prefix}assets/next.css?v=${V}">
<script>document.documentElement.classList.replace("no-js","js");if(matchMedia("(prefers-reduced-motion: reduce)").matches)document.documentElement.classList.add("reduced")</script>
<script src="${GSAP}/gsap.min.js" defer></script>
<script src="${GSAP}/ScrollTrigger.min.js" defer></script>
<script src="${LENIS}" defer></script>
<script src="${prefix}assets/next.js?v=${V}" defer></script>
</head>`;
}

function header({ lang, prefix, altPath }) {
  const t = ui[lang];
  const other = lang === "en" ? "he" : "en";
  const home = linkTo(prefix, pagePath(lang));
  return `<a class="skip" href="#main">${esc(t.skip)}</a>
<div class="progress" aria-hidden="true"></div>
<header class="bar">
  <a class="bar-mark" href="${home}" aria-label="${esc(t.home_label)}" lang="en" dir="ltr">MAYA<span>✦</span>KLEINER</a>
  <nav aria-label="${esc(t.nav_label)}">
    <ul>
      <li><a href="${home}#work" data-magnetic>${esc(t.nav_projects)}</a></li>
      <li><a href="${home}#about" data-magnetic>${esc(t.nav_about)}</a></li>
      <li><a href="#contact" data-magnetic>${esc(t.nav_contact)}</a></li>
      <li><a class="bar-lang" href="${linkTo(prefix, altPath)}" lang="${other}" hreflang="${other}" aria-label="${esc(t.switch_aria)}" data-magnetic>${other === "he" ? "עב" : "EN"}</a></li>
    </ul>
  </nav>
</header>
<div class="cursor" aria-hidden="true"><span class="cursor-label">${esc(T[lang].view)}</span></div>`;
}

// Floating prev / current / next pill plus a full-screen index of all projects.
// `current` is the project index on project pages, or null on the home page
// (where the script keeps the pill in sync with the card in view).
function navigator({ lang, prefix, current }) {
  const n = T[lang];
  const he = lang === "he";
  const count = pad(projects.length);
  const onHome = current === null;
  const at = onHome ? 0 : current;
  const prev = projects[(at - 1 + projects.length) % projects.length];
  const next = projects[(at + 1) % projects.length];
  const href = (p) => (onHome ? `#p-${p.slug}` : linkTo(prefix, pagePath(lang, p.slug)));
  return `<nav class="pnav${onHome ? " pnav-home" : ""}" aria-label="${esc(n.all_projects)}">
  <a class="pnav-btn pnav-prev" href="${href(prev)}" aria-label="${esc(n.prev_project)}: ${esc(prev.title)}"><span aria-hidden="true">${he ? "→" : "←"}</span></a>
  <button class="pnav-current" type="button" aria-haspopup="dialog" aria-controls="project-index">
    <span class="pnav-num" dir="ltr">${pad(at + 1)} / ${count}</span>
    <span class="pnav-title" lang="en" dir="ltr">${esc(projects[at].title)}</span>
    <span class="pnav-grid" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
    <span class="visually-hidden">${esc(n.all_projects)}</span>
  </button>
  <a class="pnav-btn pnav-next" href="${href(next)}" aria-label="${esc(n.next)}: ${esc(next.title)}"><span aria-hidden="true">${he ? "←" : "→"}</span></a>
</nav>
<dialog class="pindex" id="project-index" aria-labelledby="pindex-title">
  <div class="pindex-head">
    <h2 class="pindex-title" id="pindex-title">${esc(n.all_projects)}</h2>
    <button class="pindex-close" type="button" aria-label="${esc(n.close)}"><span aria-hidden="true">✕</span></button>
  </div>
  <ol class="pindex-list">
    ${projects
      .map(
        (p, i) => `<li style="--i:${i};--accent:${ACCENT[p.slug]}"><a href="${linkTo(prefix, pagePath(lang, p.slug))}"${i === current ? ' aria-current="page"' : ""}>
      <span class="pindex-num" aria-hidden="true">${pad(i + 1)}</span>
      <span class="pindex-name" lang="en" dir="ltr">${esc(p.title)}</span>
      <span class="pindex-cat">${esc(p.category[lang])}</span>
      ${img(prefix, p.cover, lang, { cls: "pindex-thumb", decorative: true, sizesAttr: "240px" })}
    </a></li>`
      )
      .join("\n    ")}
  </ol>
</dialog>`;
}

function footer({ lang, prefix }) {
  const t = ui[lang];
  const n = T[lang];
  const links = [];
  if (site.email) links.push(`<li><a href="mailto:${esc(site.email)}" data-magnetic>${esc(site.email)}</a></li>`);
  if (site.instagram) links.push(`<li><a href="https://instagram.com/${esc(site.instagram.replace(/^@/, ""))}" rel="me noopener" data-magnetic>Instagram</a></li>`);
  if (site.linkedin) links.push(`<li><a href="${esc(site.linkedin)}" rel="me noopener" data-magnetic>LinkedIn</a></li>`);
  return `<footer class="outro" id="contact">
  <p class="outro-kicker">${esc(t.contact_heading)}</p>
  ${splitTitle(n.talk, "outro-title", "h2")}
  ${links.length ? `<p class="outro-text">${esc(t.contact_text)}</p><ul class="outro-links">${links.join("")}</ul>` : `<p class="outro-text">${esc(t.contact_missing)}</p>`}
  <div class="outro-row">
    <small>© ${new Date().getFullYear()} <span lang="en" dir="ltr">Maya Kleiner</span>. ${esc(t.rights)}</small>
    <a class="to-top" href="#main" data-magnetic><span aria-hidden="true">↑</span> ${esc(n.top)}</a>
  </div>
</footer>`;
}

function page({ lang, path, altPath, title, description, accent, bodyClass, main, current = null }) {
  const prefix = prefixFor(path);
  return `${head({ lang, title, description, prefix, accent })}
<body class="${bodyClass}">
${header({ lang, prefix, altPath })}
${main(prefix)}
${navigator({ lang, prefix, current })}
${footer({ lang, prefix })}
</body>
</html>
`;
}

// ---------- home ----------

function homeMain(lang) {
  const t = ui[lang];
  const n = T[lang];
  return (prefix) => `<div class="loader" aria-hidden="true">
  <div class="loader-count"><span class="loader-num">0</span>%</div>
  <div class="loader-line"></div>
</div>
<main id="main" tabindex="-1">
  <section class="hero" aria-labelledby="hero-title">
    <div class="hero-stage">
      <div class="field" aria-hidden="true">
        <div class="field-inner">
          ${FIELD.map(([name, x, y, z, w]) => `<div class="float" style="--x:${x}vw;--y:${y}vh;--z:${z}px;--w:${w}vw" data-z="${z}">${img(prefix, name, lang, { decorative: true, sizesAttr: `${Math.round(w * 2)}vw`, eager: z > -1500 })}</div>`).join("\n          ")}
        </div>
      </div>
      <h1 class="hero-title" id="hero-title">
        <span class="visually-hidden" lang="en">Maya Kleiner</span>
        <span class="hero-line" aria-hidden="true" lang="en" dir="ltr">${chars("MAYA")}</span>
        <span class="hero-line" aria-hidden="true" lang="en" dir="ltr">${chars("KLEINER")}</span>
      </h1>
      <p class="hero-roles">${t.roles.map((r) => `<span>${esc(r)}</span>`).join('<span class="dot" aria-hidden="true">✦</span>')}</p>
      <p class="hero-hint" aria-hidden="true"><span>${esc(n.scroll)}</span><i></i></p>
    </div>
  </section>

  <section class="manifesto" id="about" aria-labelledby="about-title">
    ${img(prefix, "home-stars", lang, { cls: "manifesto-stars", decorative: true, sizesAttr: "40vw" })}
    <h2 class="manifesto-kicker" id="about-title">${esc(t.hello)}</h2>
    <p class="manifesto-text">${words(t.bio)}</p>
  </section>

  <div class="marquee" aria-hidden="true">
    ${[0, 1]
      .map(
        (row) => `<div class="marquee-row" data-dir="${row ? -1 : 1}"><div class="marquee-track">${Array.from({ length: 2 }, () =>
          n.marquee
            .map((m, i) => `<span class="marquee-word">${esc(m)}</span><span class="marquee-pic">${img(prefix, projects[(i + row * 3) % projects.length].cover, lang, { decorative: true, sizesAttr: "12vw" })}</span>`)
            .join("")
        ).join("")}</div></div>`
      )
      .join("\n    ")}
  </div>

  <section class="work" id="work" aria-labelledby="work-title">
    <header class="work-head">
      <h2 id="work-title" class="work-title">${splitTitle(n.work, "split")}</h2>
      <p class="work-count" aria-hidden="true">(${pad(projects.length)})</p>
    </header>
    <ol class="stack">
      ${projects
        .map(
          (p, i) => `<li class="stack-item" id="p-${p.slug}" style="--accent:${ACCENT[p.slug]};--i:${i}" data-num="${pad(i + 1)}" data-title="${esc(p.title)}">
        <a class="panel" href="${linkTo(prefix, pagePath(lang, p.slug))}" data-cursor="${esc(n.view)}">
          <span class="panel-media">${img(prefix, p.cover, lang, { decorative: true, sizesAttr: "100vw", vt: `cover-${p.slug}` })}</span>
          <span class="panel-shade"></span>
          <span class="panel-top"><span class="panel-num">${pad(i + 1)} / ${pad(projects.length)}</span><span class="panel-cat">${esc(p.category[lang])}</span></span>
          ${splitTitle(p.title, "panel-title", "span", ' lang="en" dir="ltr"')}
          <span class="panel-cta">${esc(n.open)} <span aria-hidden="true">${lang === "he" ? "←" : "→"}</span></span>
        </a>
      </li>`
        )
        .join("\n      ")}
    </ol>
  </section>

  <section class="reel" aria-labelledby="reel-title">
    <div class="reel-pin">
      <h2 class="reel-title" id="reel-title">${splitTitle(n.lens, "split")}</h2>
      <div class="reel-track">
        ${REEL.map((name, i) => `<figure class="reel-item" style="--r:${(i % 3) - 1}">${img(prefix, name, lang, { sizesAttr: "40vw" })}</figure>`).join("\n        ")}
        <a class="reel-cta" href="${linkTo(prefix, pagePath(lang, "photography"))}" data-magnetic>${esc(n.lens_cta)} <span aria-hidden="true">${lang === "he" ? "←" : "→"}</span></a>
      </div>
    </div>
  </section>
</main>`;
}

// ---------- project ----------

function shot(prefix, name, lang, sizesAttr, crop) {
  let pic = img(prefix, name, lang, { sizesAttr });
  if (crop) pic = pic.replace("<img ", `<img style="aspect-ratio:${crop};object-fit:cover" `);
  return `<figure class="shot"><a href="${largest(prefix, name)}" data-lightbox data-cursor="+">${pic}<span class="visually-hidden"> (${esc(ui[lang].open_image)})</span></a></figure>`;
}

function block(prefix, b, lang) {
  if (b.type === "video") {
    return `<div class="g g-video g-${b.layout || "narrow"}"><figure class="shot"><video class="loop" src="${prefix}${MEDIA}assets/video/${b.src}.mp4" poster="${prefix}${MEDIA}assets/video/${b.poster}" width="${b.width}" height="${b.height}" muted loop playsinline preload="metadata"${b.audio ? " data-audio" : ""} aria-label="${esc(b.label[lang])}"></video></figure></div>`;
  }
  const s = { full: "100vw", narrow: "(min-width: 900px) 50vw, 100vw", pair: "(min-width: 900px) 50vw, 100vw", trio: "(min-width: 900px) 33vw, 100vw" }[b.type];
  return `<div class="g g-${b.type}">${b.images.map((n) => shot(prefix, n, lang, s, b.crop)).join("")}</div>`;
}

function projectMain(lang, p, i) {
  const n = T[lang];
  const next = projects[(i + 1) % projects.length];
  return (prefix) => `<main id="main" tabindex="-1">
  <section class="p-hero">
    <div class="p-hero-pin">
      <p class="p-meta"><span>${pad(i + 1)} / ${pad(projects.length)}</span><span>${esc(p.category[lang])}</span></p>
      ${splitTitle(p.title, "p-title", "h1", ' lang="en" dir="ltr"')}
      <div class="p-cover">${img(prefix, p.cover, lang, { eager: true, sizesAttr: "100vw", vt: `cover-${p.slug}` })}</div>
    </div>
  </section>
  ${p.description[lang] ? `<section class="p-intro"><p class="p-lede">${words(p.description[lang])}</p></section>` : ""}
  <section class="p-gallery" aria-label="${esc(p.title)}">
    ${p.gallery.map((b) => block(prefix, b, lang)).join("\n    ")}
  </section>
  <a class="p-next" href="${linkTo(prefix, pagePath(lang, next.slug))}" style="--accent:${ACCENT[next.slug]}" data-cursor="${esc(n.view)}">
    <span class="p-next-label">${esc(n.next)}</span>
    <span class="p-next-media">${img(prefix, next.cover, lang, { decorative: true, sizesAttr: "100vw" })}</span>
    <span class="p-next-title" lang="en" dir="ltr">${esc(next.title)}</span>
  </a>
</main>`;
}

// ---------- write ----------

rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, "assets"), { recursive: true });
if (!PUBLISH) {
  cpSync(join(ROOT, "docs", "assets", "img"), join(OUT, "assets", "img"), { recursive: true });
  cpSync(join(ROOT, "docs", "assets", "video"), join(OUT, "assets", "video"), { recursive: true });
  cpSync(join(ROOT, "docs", "assets", "favicon.svg"), join(OUT, "assets", "favicon.svg"));
}
cpSync(join(HERE, "src", "next.css"), join(OUT, "assets", "next.css"));
cpSync(join(HERE, "src", "next.js"), join(OUT, "assets", "next.js"));

const write = (path, html) => {
  mkdirSync(dirname(join(OUT, path)), { recursive: true });
  writeFileSync(join(OUT, path), html);
};

for (const lang of LANGS) {
  const other = lang === "en" ? "he" : "en";
  const t = ui[lang];
  write(pagePath(lang), page({ lang, path: pagePath(lang), altPath: pagePath(other), title: t.title, description: t.description, bodyClass: "home", main: homeMain(lang) }));
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
        accent: ACCENT[p.slug],
        bodyClass: "project",
        main: projectMain(lang, p, i),
        current: i,
      })
    );
  });
}

console.log(`Built ${LANGS.length * (projects.length + 1)} pages into ${PUBLISH ? "docs/next/" : "next/dist/"}`);
