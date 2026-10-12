# Maya Kleiner portfolio

A static, bilingual (English / Hebrew) portfolio website, built from the Figma prototype "תיק עבודות 2026".

- English: `/` and `/projects/<name>/`
- Hebrew (right-to-left): `/he/` and `/he/projects/<name>/`

The published site is the `docs/` folder. GitHub Pages serves it directly; there is no server code.

## Editing content

All text lives in `content/site.json`:

- `site`: contact details (`email`, `instagram`, `linkedin`, `phone`) and the site's public `url`. Empty fields are hidden.
- `ui`: interface text in both languages (navigation, bio, footer).
- `projects`: order, titles, categories, descriptions and the image layout of each project page.
  Gallery block types: `full`, `narrow`, `pair`, `trio`, `video`.
- `alt`: image descriptions for screen readers, in both languages.

After editing, rebuild the pages:

```bash
node build.mjs
```

Then commit and push; GitHub Pages updates within a minute or two.

## Adding or replacing images

1. Put the original image file in `tools/source/` (this folder is not committed).
2. Add an entry to `tools/images.json`: `"my-image": { "hash": "<file name without extension>" }`.
3. Run `python tools/process_images.py tools/source` (needs Pillow). It writes WebP versions to `docs/assets/img/` and updates `tools/image-sizes.json`.
4. Use `my-image` in a project gallery in `content/site.json`, add its `alt` text, and run `node build.mjs`.

## Preview locally

```bash
python -m http.server 4321 --directory docs
```

Then open http://localhost:4321.

## Accessibility

Semantic landmarks, a skip link, keyboard-operable lightbox, visible focus styles, alt text in both languages,
`lang`/`dir` set per page, reduced-motion support (the intro and animations switch off), and a pause button on the looping video.
Checked with axe-core: no violations.
