"""Turn the original Figma image files into responsive WebP files for the site.

Usage:  python tools/process_images.py <folder with original images>

tools/images.json maps a site image name to the Figma image hash it comes from.
Output goes to docs/assets/img/ and a size manifest
to tools/image-sizes.json, which build.mjs reads.
"""
import json
import os
import sys

from PIL import Image, ImageOps

Image.MAX_IMAGE_PIXELS = None

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "docs", "assets", "img")
WIDTHS = [640, 1200, 2000]
QUALITY = 80


def find_source(src_dir, h):
    for name in os.listdir(src_dir):
        if name.startswith(h):
            return os.path.join(src_dir, name)
    raise FileNotFoundError(h)


def main():
    src_dir = sys.argv[1]
    spec = json.load(open(os.path.join(ROOT, "tools", "images.json"), encoding="utf-8"))
    os.makedirs(OUT, exist_ok=True)
    sizes = {}
    for name, entry in spec.items():
        im = Image.open(find_source(src_dir, entry["hash"]))
        im = ImageOps.exif_transpose(im)
        has_alpha = im.mode in ("RGBA", "LA") or (im.mode == "P" and "transparency" in im.info)
        im = im.convert("RGBA" if has_alpha else "RGB")
        widths = [w for w in WIDTHS if w < im.width] + [min(im.width, WIDTHS[-1])]
        widths = sorted(set(widths))
        for w in widths:
            h = round(im.height * w / im.width)
            im.resize((w, h), Image.Resampling.LANCZOS).save(
                os.path.join(OUT, f"{name}-{w}.webp"), "WEBP", quality=QUALITY, method=6
            )
        sizes[name] = {"w": im.width, "h": im.height, "widths": widths}
        print(name, im.width, im.height, widths)
    json.dump(sizes, open(os.path.join(ROOT, "tools", "image-sizes.json"), "w"), indent=1)


if __name__ == "__main__":
    main()
