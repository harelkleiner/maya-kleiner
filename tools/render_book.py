"""Render the CORA catalog and its cover into page images for the flip-book.

Usage:  python tools/render_book.py <catalog.pdf> <cover.pdf>

Page order: front cover, inside front cover, the catalog pages, inside back cover,
back cover. The cover PDF is a print spread: on the outside sheet the back cover is
the left half and the front cover the right half; the inside sheet is mirrored.
Writes docs/assets/book/cora/ and tools/book-cora.json (page list for build.mjs).
"""
import json
import os
import sys

import fitz  # PyMuPDF
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "docs", "assets", "book", "cora")
HEIGHTS = [900, 1600]


def render(page, clip, height):
    zoom = height / clip.height
    pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), clip=clip, alpha=False)
    return Image.frombytes("RGB", (pix.width, pix.height), pix.samples)


def crop_to(im, ratio):
    """Centre-crop an image to width/height = ratio."""
    w = round(im.height * ratio)
    if w >= im.width:
        return im
    x = (im.width - w) // 2
    return im.crop((x, 0, x + w, im.height))


def main():
    catalog, cover = fitz.open(sys.argv[1]), fitz.open(sys.argv[2])
    # Catalog pages carry bleed and crop marks around them; render only the trim box.
    ref = catalog[0].trimbox
    ratio = ref.width / ref.height
    outside, inside = cover[0], cover[1 if cover.page_count > 1 else 0]
    half = outside.rect.width / 2

    def left(p):
        return (p, fitz.Rect(0, 0, half, p.rect.height))

    def right(p):
        return (p, fitz.Rect(half, 0, p.rect.width, p.rect.height))

    pages = [("front-cover", *right(outside)), ("inside-front", *left(inside))]
    pages += [(f"page-{i + 1}", catalog[i], catalog[i].trimbox) for i in range(catalog.page_count)]
    pages += [("inside-back", *right(inside)), ("back-cover", *left(outside))]

    os.makedirs(OUT, exist_ok=True)
    manifest = []
    for n, (key, page, clip) in enumerate(pages, start=1):
        for h in HEIGHTS:
            im = crop_to(render(page, clip, h), ratio)
            im.save(os.path.join(OUT, f"p{n:02d}-{h}.webp"), "WEBP", quality=82, method=6)
        text = " ".join(page.get_text(clip=clip).split())
        manifest.append({"n": n, "key": key, "w": im.width, "h": im.height, "text": text[:220]})
        print(n, key, im.size, text[:60])
    json.dump({"ratio": ratio, "heights": HEIGHTS, "pages": manifest},
              open(os.path.join(ROOT, "tools", "book-cora.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
