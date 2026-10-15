// Markup for a flip-book of rendered catalog pages, shared by both site builds.
// Page images come from tools/render_book.py (manifest: tools/book-<src>.json);
// docs/assets/js/flipbook.js turns the markup into the interactive book.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

const esc = (s = "") =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// assets: relative path from the page to docs/assets/ (ends with "/").
export function bookHTML({ b, lang, t, assets }) {
  const book = JSON.parse(readFileSync(join(HERE, `book-${b.src}.json`), "utf8"));
  const [small, large] = book.heights;
  const n = book.pages.length;
  const alt = (p) => {
    if (b.alts?.[p.key]) return b.alts[p.key][lang];
    const label = lang === "he" ? `עמוד ${p.n - 2} בקטלוג` : `Catalog page ${p.n - 2}`;
    return p.text ? `${label}: ${p.text}` : label;
  };
  const cover = (p) => p.key.endsWith("cover");
  const strings = ["book_prev", "book_next", "book_cover", "book_back", "book_pages", "book_page"];
  const data = strings.map((k) => `data-${k.replace("_", "-")}="${esc(t[k])}"`).join(" ");

  return `<section class="book" aria-labelledby="book-${b.src}-title" data-ratio="${book.ratio.toFixed(4)}" style="--ratio:${book.ratio.toFixed(4)}" ${data}>
  <div class="book-head">
    <h2 class="book-title" id="book-${b.src}-title">${esc(t.book_title)}</h2>
    <p class="book-hint">${esc(t.book_hint)}</p>
  </div>
  <div class="book-stage" dir="ltr" tabindex="0" role="group" aria-roledescription="book" aria-label="${esc(t.book_label)}">
    <div class="book-pages">
      ${book.pages
        .map(
          (p) => `<div class="book-page${cover(p) ? " is-cover" : ""}"${cover(p) ? ' data-density="hard"' : ""}><img src="${assets}book/${b.src}/p${String(p.n).padStart(2, "0")}-${small}.webp" srcset="${assets}book/${b.src}/p${String(p.n).padStart(2, "0")}-${small}.webp ${Math.round(small * book.ratio)}w, ${assets}book/${b.src}/p${String(p.n).padStart(2, "0")}-${large}.webp ${p.w}w" sizes="(min-width: 900px) 40vw, 90vw" width="${p.w}" height="${p.h}" alt="${esc(alt(p))}" ${p.n <= 4 ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async" draggable="false"></div>`
        )
        .join("\n      ")}
    </div>
  </div>
  <div class="book-controls" dir="ltr">
    <button type="button" class="book-btn book-prev" aria-label="${esc(t.book_prev)}"><span aria-hidden="true">←</span></button>
    <p class="book-status" aria-live="polite" dir="${lang === "he" ? "rtl" : "ltr"}">${esc(t.book_cover)}</p>
    <button type="button" class="book-btn book-next" aria-label="${esc(t.book_next)}"><span aria-hidden="true">→</span></button>
  </div>
</section>`;
}

export const hasBook = (p) => p.gallery?.some((b) => b.type === "book");
export const PAGE_FLIP = "https://cdn.jsdelivr.net/npm/page-flip@2.0.7/dist/js/page-flip.browser.js";
