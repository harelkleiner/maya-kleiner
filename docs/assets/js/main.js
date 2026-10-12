(() => {
  const root = document.documentElement;
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let t = {};
  try { t = JSON.parse(document.getElementById("i18n").textContent); } catch (e) { /* defaults below */ }
  const say = (key, fallback) => t[key] || fallback;

  // Remove the intro overlay from the accessibility tree and layout once it has played.
  const intro = document.querySelector(".intro");
  if (intro && root.classList.contains("show-intro")) {
    intro.addEventListener("animationend", (e) => { if (e.target === intro) intro.remove(); });
  }

  // Cover preview that follows the pointer over the project list.
  const list = document.querySelector(".project-list");
  if (list && matchMedia("(hover: hover) and (pointer: fine)").matches) {
    list.addEventListener("pointermove", (e) => {
      list.style.setProperty("--x", e.clientX + "px");
      list.style.setProperty("--y", e.clientY + "px");
    });
  }

  // Reveal blocks as they scroll into view.
  if (!reduceMotion && "IntersectionObserver" in window) {
    const targets = document.querySelectorAll(".block, .project-row, .project-head, .about > :not(.stars)");
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) { entry.target.classList.add("is-in"); io.unobserve(entry.target); }
      }
    }, { rootMargin: "0px 0px -8% 0px" });
    targets.forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.top < innerHeight) return; // already on screen, leave it alone
      el.classList.add("reveal");
      io.observe(el);
    });
  }

  // Looping videos: autoplay unless the visitor prefers reduced motion; always offer a pause button.
  const icons = {
    pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>',
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4v16l13-8z"/></svg>',
  };
  document.querySelectorAll(".loop-video").forEach((video) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "video-toggle";
    const sync = () => {
      const playing = !video.paused;
      btn.innerHTML = playing ? icons.pause : icons.play;
      btn.setAttribute("aria-label", playing ? say("pause_video", "Pause video") : say("play_video", "Play video"));
    };
    btn.addEventListener("click", () => (video.paused ? video.play() : video.pause()));
    video.addEventListener("play", sync);
    video.addEventListener("pause", sync);
    video.after(btn);
    sync();
    if (!reduceMotion) video.play().catch(sync);
  });

  // Lightbox for project images.
  const links = [...document.querySelectorAll("a[data-lightbox]")];
  if (!links.length || typeof HTMLDialogElement !== "function") return;

  const dialog = document.createElement("dialog");
  dialog.className = "lightbox";
  dialog.setAttribute("aria-label", say("lightbox_label", "Image viewer"));
  dialog.innerHTML = `
    <figure><img alt=""><figcaption aria-live="polite"></figcaption></figure>
    <button type="button" class="lb-btn lb-close" aria-label="${say("close", "Close")}"><span aria-hidden="true">✕</span></button>
    <button type="button" class="lb-btn lb-prev" aria-label="${say("prev", "Previous image")}"><span aria-hidden="true">←</span></button>
    <button type="button" class="lb-btn lb-next" aria-label="${say("next", "Next image")}"><span aria-hidden="true">→</span></button>`;
  document.body.append(dialog);

  const image = dialog.querySelector("img");
  const caption = dialog.querySelector("figcaption");
  const rtl = root.dir === "rtl";
  let index = 0;
  let opener = null;

  function show(i) {
    index = (i + links.length) % links.length;
    const link = links[index];
    const thumb = link.querySelector("img");
    image.src = link.href;
    image.alt = thumb ? thumb.alt : "";
    const counter = say("image_of", "Image {i} of {n}").replace("{i}", index + 1).replace("{n}", links.length);
    caption.textContent = (thumb && thumb.alt ? thumb.alt + " — " : "") + counter;
  }

  links.forEach((link, i) => {
    link.addEventListener("click", (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      opener = link;
      show(i);
      dialog.showModal();
      dialog.querySelector(".lb-close").focus();
    });
  });

  dialog.querySelector(".lb-close").addEventListener("click", () => dialog.close());
  dialog.querySelector(".lb-prev").addEventListener("click", () => show(index - 1));
  dialog.querySelector(".lb-next").addEventListener("click", () => show(index + 1));
  dialog.addEventListener("click", (e) => { if (e.target === dialog || e.target.tagName === "FIGURE") dialog.close(); });
  dialog.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") show(index + (rtl ? -1 : 1));
    if (e.key === "ArrowLeft") show(index + (rtl ? 1 : -1));
  });
  dialog.addEventListener("close", () => {
    image.removeAttribute("src");
    if (opener) opener.focus();
  });
})();
