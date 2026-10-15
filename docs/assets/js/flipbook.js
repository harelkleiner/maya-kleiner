// Turns .book sections into a page-turning book (StPageFlip). Without the library the
// pages stay a plain horizontal gallery, so the content is always reachable.
(() => {
  const books = document.querySelectorAll(".book");
  if (!books.length || !window.St || !window.St.PageFlip) return;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  books.forEach((book) => {
    const stage = book.querySelector(".book-stage");
    const pagesEl = book.querySelector(".book-pages");
    const pages = [...pagesEl.querySelectorAll(".book-page")];
    const status = book.querySelector(".book-status");
    const prev = book.querySelector(".book-prev");
    const next = book.querySelector(".book-next");
    const d = book.dataset;
    const ratio = parseFloat(d.ratio) || 0.62;
    const total = pages.length;

    // Size limits are CSS on .is-ready, so set it before the engine measures the container.
    book.classList.add("is-ready");
    // A page may be at most ~68% of the window height (and never wider than 700px),
    // so a whole spread stays on screen. The engine applies these limits itself.
    const maxPageH = Math.max(320, Math.round(innerHeight * 0.68));
    const maxPageW = Math.min(700, Math.round(maxPageH * ratio));
    const width = Math.min(520, maxPageW);
    const flip = new St.PageFlip(pagesEl, {
      width,
      height: Math.round(width / ratio),
      size: "stretch",
      minWidth: 200,
      maxWidth: maxPageW,
      minHeight: Math.round(200 / ratio),
      maxHeight: Math.round(maxPageW / ratio),
      showCover: true,
      usePortrait: true,
      autoSize: true,
      mobileScrollSupport: true,
      drawShadow: !reduce,
      maxShadowOpacity: 0.5,
      flippingTime: reduce ? 250 : 900,
      showPageCorners: !reduce,
    });
    flip.loadFromHTML(pages);

    // Load every page soon after start so no page flashes blank mid-turn.
    const warm = () => pages.forEach((p) => { const img = p.querySelector("img"); if (img) img.loading = "eager"; });
    setTimeout(warm, 1200);

    // Status line and button states.
    const fmt = (s, a, b) => s.replace("{a}", a).replace("{b}", b).replace("{n}", total);
    const update = () => {
      const i = flip.getCurrentPageIndex();
      const portrait = flip.getOrientation() === "portrait";
      let text;
      if (i === 0) text = d.bookCover;
      else if (i === total - 1) text = d.bookBack;
      else if (portrait || i + 1 >= total - 1) text = fmt(d.bookPage, i + 1);
      else text = fmt(d.bookPages, i + 1, i + 2);
      status.textContent = text;
      prev.disabled = i === 0;
      next.disabled = i >= total - 1;
    };
    flip.on("init", update);
    flip.on("flip", update);
    flip.on("changeOrientation", update);
    update();

    prev.addEventListener("click", () => flip.flipPrev("top"));
    next.addEventListener("click", () => flip.flipNext("top"));
    stage.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") { e.preventDefault(); flip.flipNext("top"); }
      if (e.key === "ArrowLeft") { e.preventDefault(); flip.flipPrev("top"); }
      if (e.key === "Home") { e.preventDefault(); flip.turnToPage(0); update(); }
      if (e.key === "End") { e.preventDefault(); flip.turnToPage(total - 1); update(); }
    });
  });
})();
