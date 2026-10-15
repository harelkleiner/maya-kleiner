(() => {
  const root = document.documentElement;
  const rtl = root.dir === "rtl";
  const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

  // Without the animation libraries (or when motion is reduced) fall back to the static layout.
  if (!window.gsap || !window.ScrollTrigger) root.classList.add("reduced");
  const still = root.classList.contains("reduced");
  let lenis = null;

  setupVideos(still);
  setupLightbox();
  setupProjectNav();
  if (still) return;

  gsap.registerPlugin(ScrollTrigger);

  // ---------- smooth scroll ----------
  if (window.Lenis) {
    lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  // In-page links scroll smoothly and move focus to the target.
  $$('a[href*="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const url = new URL(a.href, location.href);
      if (url.pathname !== location.pathname || !url.hash) return;
      const target = document.getElementById(decodeURIComponent(url.hash.slice(1)));
      if (!target) return;
      e.preventDefault();
      history.pushState(null, "", url.hash);
      const done = () => {
        if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
        target.focus({ preventScroll: true });
      };
      if (lenis) lenis.scrollTo(target, { duration: 1.6, onComplete: done });
      else { target.scrollIntoView({ behavior: "smooth" }); done(); }
    });
  });

  // ---------- header + progress ----------
  const bar = $(".bar");
  ScrollTrigger.create({
    start: 0,
    end: "max",
    onUpdate(self) {
      root.style.setProperty("--p", self.progress.toFixed(4));
      const hide = self.direction === 1 && self.scroll() > 240 && !bar.contains(document.activeElement);
      bar.classList.toggle("is-hidden", hide);
    },
  });
  bar.addEventListener("focusin", () => bar.classList.remove("is-hidden"));

  // ---------- cursor + magnetic links ----------
  if (fine) {
    const cursor = $(".cursor");
    const label = $(".cursor-label");
    const defaultLabel = label.textContent;
    const pos = { x: -100, y: -100 };
    const cur = { x: -100, y: -100 };
    addEventListener("pointermove", (e) => { pos.x = e.clientX; pos.y = e.clientY; });
    gsap.ticker.add(() => {
      cur.x += (pos.x - cur.x) * 0.2;
      cur.y += (pos.y - cur.y) * 0.2;
      cursor.style.setProperty("--cx", cur.x + "px");
      cursor.style.setProperty("--cy", cur.y + "px");
    });
    document.addEventListener("pointerover", (e) => {
      const hit = e.target.closest("[data-cursor]");
      cursor.classList.toggle("is-big", !!hit);
      if (hit) label.textContent = hit.dataset.cursor || defaultLabel;
      cursor.classList.toggle("is-hidden", !hit && !!e.target.closest("[data-magnetic]"));
    });

    $$("[data-magnetic]").forEach((el) => {
      const xTo = gsap.quickTo(el, "x", { duration: 0.6, ease: "elastic.out(1, .4)" });
      const yTo = gsap.quickTo(el, "y", { duration: 0.6, ease: "elastic.out(1, .4)" });
      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        xTo((e.clientX - r.left - r.width / 2) * 0.35);
        yTo((e.clientY - r.top - r.height / 2) * 0.35);
      });
      el.addEventListener("pointerleave", () => { xTo(0); yTo(0); });
    });
  }

  // ---------- shared reveals ----------
  const charsOf = (el) => $$(".ch > span", el);

  function wordsScrub(textEl) {
    if (!textEl) return;
    gsap.to($$(".w", textEl), {
      color: "#f2efe8",
      stagger: 0.1,
      ease: "none",
      scrollTrigger: { trigger: textEl, start: "top 82%", end: "bottom 50%", scrub: true },
    });
  }

  function charsRise(el, trigger = el, start = "top 80%") {
    if (!el) return;
    gsap.from(charsOf(el), {
      yPercent: 115,
      rotate: rtl ? -8 : 8,
      duration: 1.1,
      ease: "expo.out",
      stagger: 0.035,
      scrollTrigger: { trigger, start, toggleActions: "play none none reverse" },
    });
  }

  charsRise($(".outro-title"), $(".outro"), "top 70%");

  if (document.body.classList.contains("home")) home();
  else project();

  // Recalculate once fonts and images have settled.
  document.fonts?.ready.then(() => ScrollTrigger.refresh());
  addEventListener("load", () => ScrollTrigger.refresh());

  // ================= home =================
  function home() {
    // Loader: quick count-up, then the curtain lifts and the name lands.
    const loader = $(".loader");
    const num = $(".loader-num");
    let seen = false;
    try { seen = sessionStorage.getItem("mk-next") === "1"; sessionStorage.setItem("mk-next", "1"); } catch (e) { /* private mode */ }
    lenis?.stop();
    const counter = { v: 0 };
    const intro = gsap.timeline({ onComplete: () => { loader.remove(); lenis?.start(); } });
    intro
      .to(counter, {
        v: 100,
        duration: seen ? 0.5 : 1.6,
        ease: "power2.inOut",
        onUpdate() {
          num.textContent = Math.round(counter.v);
          loader.style.setProperty("--l", counter.v / 100);
        },
      })
      .to(loader, { yPercent: -100, duration: 1, ease: "expo.inOut" })
      .from(charsOf($(".hero-title")), { yPercent: 120, rotateX: -70, duration: 1.3, ease: "expo.out", stagger: 0.045 }, "-=.55")
      .from(".float img", { opacity: 0, scale: 0.6, duration: 1.4, ease: "expo.out", stagger: 0.05 }, "<")
      .from(".hero-roles > *, .hero-hint", { opacity: 0, y: 16, duration: 0.8, stagger: 0.05 }, "-=1");

    // 3D fly-through: the camera travels through Maya's work while the name spins away 90 degrees (a nod to SPIN 90).
    const floats = $$(".float").map((el, i, all) => ({ el, z: +el.dataset.z, last: i === all.length - 1 }));
    const travel = 5250;
    const render = (p) => {
      const cam = p * travel;
      for (const f of floats) {
        const z = f.z + cam;
        let o = clamp((z + 5200) / 1100);
        if (!f.last && z > 300) o *= clamp(1 - (z - 300) / 420);
        f.el.style.setProperty("--z", z.toFixed(1) + "px");
        f.el.style.opacity = o.toFixed(3);
        f.el.style.visibility = o < 0.01 ? "hidden" : "visible";
      }
    };
    render(0);

    const heroTl = gsap.timeline({
      scrollTrigger: {
        trigger: ".hero",
        start: "top top",
        end: "+=380%",
        pin: ".hero-stage",
        scrub: true,
        onUpdate: (self) => render(self.progress),
      },
    });
    heroTl
      .to(charsOf($(".hero-title")), { rotationY: rtl ? -90 : 90, opacity: 0, duration: 0.18, ease: "power1.in", stagger: { each: 0.012, from: "center" } }, 0.02)
      .to(".hero-roles, .hero-hint", { opacity: 0, y: 24, duration: 0.08 }, 0)
      .to({}, { duration: 1 }, 0);

    // Idle float + pointer tilt on the 3D field.
    $$(".float img").forEach((im, i) => {
      gsap.to(im, { y: i % 2 ? 14 : -14, duration: 3 + (i % 4) * 0.6, ease: "sine.inOut", yoyo: true, repeat: -1 });
    });
    if (fine) {
      const inner = $(".field-inner");
      const rx = gsap.quickTo(inner, "rotationX", { duration: 1.2, ease: "power3.out" });
      const ry = gsap.quickTo(inner, "rotationY", { duration: 1.2, ease: "power3.out" });
      $(".hero").addEventListener("pointermove", (e) => {
        ry(((e.clientX / innerWidth) - 0.5) * 10);
        rx(-((e.clientY / innerHeight) - 0.5) * 8);
      });
    }

    // Manifesto: words light up as you read; the stars keep spinning.
    wordsScrub($(".manifesto-text"));
    gsap.to(".manifesto-stars", { rotate: 200, ease: "none", scrollTrigger: { trigger: ".manifesto", start: "top bottom", end: "bottom top", scrub: true } });

    // Marquee rows that speed up and lean with scroll velocity.
    const rows = $$(".marquee-row").map((row) => {
      const dir = +row.dataset.dir;
      const tween = gsap.fromTo(row.firstElementChild, { xPercent: dir > 0 ? 0 : -50 }, { xPercent: dir > 0 ? -50 : 0, duration: 38, ease: "none", repeat: -1 });
      return tween;
    });
    const skew = gsap.quickTo(".marquee-track", "skewX", { duration: 0.5, ease: "power3.out" });
    ScrollTrigger.create({
      trigger: ".marquee",
      start: "top bottom",
      end: "bottom top",
      onUpdate(self) {
        const v = self.getVelocity();
        const speed = 1 + Math.min(Math.abs(v) / 300, 6);
        rows.forEach((t) => gsap.to(t, { timeScale: speed * (self.direction || 1), duration: 0.3, overwrite: true }));
        skew(clamp(v / -120, -14, 14));
      },
      onLeave: () => rows.forEach((t) => gsap.to(t, { timeScale: 1, duration: 0.6 })),
      onLeaveBack: () => rows.forEach((t) => gsap.to(t, { timeScale: 1, duration: 0.6 })),
    });

    // Final project: a pinned scene where the film opens up and two looks slide in beside it.
    if ($(".feature")) {
      gsap.timeline({ scrollTrigger: { trigger: ".feature", start: "top top", end: "+=160%", pin: ".feature-pin", scrub: true } })
        .to(".feature-media", { clipPath: "inset(0% 0% round 0px)", ease: "none" }, 0)
        .to(".feature-side-a", { x: 0, rotate: -2, ease: "power2.out" }, 0.15)
        .to(".feature-side-b", { x: 0, rotate: 2, ease: "power2.out" }, 0.15)
        .fromTo(".feature-title", { scale: 1.6, yPercent: -10 }, { scale: 1, yPercent: 0, ease: "none" }, 0)
        .from(".feature-copy", { opacity: 0, y: 40, ease: "power2.out", duration: 0.3 }, 0.55)
        .to({}, { duration: 1 }, 0);
      ScrollTrigger.create({
        trigger: ".feature", start: "top 50%", end: "bottom 50%",
        onToggle: (self) => self.isActive && root.style.setProperty("--accent", getComputedStyle($(".feature")).getPropertyValue("--accent")),
      });
    }

    // Work: full-screen project cards stack on top of each other.
    charsRise($(".work-title"), $(".work-head"));
    const items = $$(".stack-item");
    const last = items[items.length - 1];
    items.forEach((item, i) => {
      const panel = $(".panel", item);
      const media = $(".panel-media img", item);
      gsap.fromTo(media, { scale: 1.3 }, { scale: 1, ease: "none", scrollTrigger: { trigger: item, start: "top bottom", end: "top top", scrub: true } });
      gsap.from(charsOf($(".panel-title", item)), {
        yPercent: 115, duration: 1.1, ease: "expo.out", stagger: 0.03,
        scrollTrigger: { trigger: item, start: "top 45%", toggleActions: "play none none reverse" },
      });
      gsap.from($$(".panel-top, .panel-cta", item), {
        opacity: 0, y: 20, duration: 0.8, stagger: 0.1,
        scrollTrigger: { trigger: item, start: "top 45%", toggleActions: "play none none reverse" },
      });
      ScrollTrigger.create({
        trigger: item,
        start: "top 50%",
        end: "bottom 50%",
        onToggle: (self) => self.isActive && root.style.setProperty("--accent", getComputedStyle(item).getPropertyValue("--accent")),
      });
      if (item !== last) {
        // Pin the card, not the list item, so the list markup stays valid.
        ScrollTrigger.create({ trigger: item, start: "top top", endTrigger: last, end: "top top", pin: panel, pinSpacing: false });
        gsap.fromTo(panel, { scale: 1, borderRadius: 0, filter: "brightness(1)" }, {
          scale: 0.86, borderRadius: 28, filter: "brightness(0.3)", ease: "none",
          scrollTrigger: { trigger: items[i + 1], start: "top bottom", end: "top top", scrub: true },
        });
      }
    });
    ScrollTrigger.create({ trigger: ".work", start: "bottom 50%", onEnter: () => root.style.setProperty("--accent", "#f2efe8"), onLeaveBack: () => {} });

    // Photography reel: vertical scroll drives a sideways film strip.
    const track = $(".reel-track");
    const dist = () => Math.max(0, track.scrollWidth - innerWidth);
    charsRise($(".reel-title"), $(".reel"));
    gsap.to(track, {
      x: () => (rtl ? 1 : -1) * dist(),
      ease: "none",
      scrollTrigger: { trigger: ".reel-pin", start: "top top", end: () => "+=" + dist(), pin: true, scrub: 1, invalidateOnRefresh: true },
    });
    $$(".reel-item").forEach((it, i) => {
      gsap.fromTo(it, { y: i % 2 ? 60 : -40 }, { y: i % 2 ? -60 : 40, ease: "none", scrollTrigger: { trigger: ".reel-pin", start: "top top", end: () => "+=" + dist(), scrub: true, invalidateOnRefresh: true } });
    });
  }

  // ================= project =================
  function project() {
    const title = $(".p-title");
    gsap.from(charsOf(title), { yPercent: 120, rotateX: -80, duration: 1.3, ease: "expo.out", stagger: 0.04, delay: 0.15 });
    gsap.from(".p-title-logo svg", { yPercent: 40, scale: 0.85, opacity: 0, duration: 1.4, ease: "expo.out", delay: 0.15 });
    gsap.from(".p-meta", { opacity: 0, y: 12, duration: 0.8, delay: 0.5 });

    // The cover opens from a framed card to full-bleed as you scroll.
    gsap.timeline({ scrollTrigger: { trigger: ".p-hero", start: "top top", end: "+=130%", pin: ".p-hero-pin", scrub: true } })
      .to(".p-cover", { clipPath: "inset(0% 0% round 0px)", ease: "none" }, 0)
      .fromTo(".p-cover img", { scale: 1.25 }, { scale: 1, ease: "none" }, 0)
      .to(title, { yPercent: -40, scale: 0.8, ease: "none" }, 0);

    wordsScrub($(".p-lede"));
    $$(".t-body").forEach(wordsScrub);
    $$(".g-text").forEach((g) => {
      gsap.from($$(".t-kicker, .t-heading, .t-items li", g), {
        opacity: 0, y: 30, duration: 1, ease: "expo.out", stagger: 0.08,
        scrollTrigger: { trigger: g, start: "top 80%" },
      });
    });

    // Images unmask upward and drift inside their frames.
    $$(".shot").forEach((shot) => {
      const media = $("img", shot);
      if (!media) return; // videos reveal themselves when they come into view (setupVideos)
      gsap.to(shot, { clipPath: "inset(0% 0 0 0 round 6px)", duration: 1.4, ease: "expo.out", scrollTrigger: { trigger: shot, start: "top 88%" } });
      gsap.fromTo(media, { scale: 1.35 }, { scale: 1.1, duration: 1.6, ease: "expo.out", scrollTrigger: { trigger: shot, start: "top 88%" } });
      gsap.fromTo(media, { yPercent: -4 }, { yPercent: 4, ease: "none", scrollTrigger: { trigger: shot, start: "top bottom", end: "bottom top", scrub: true } });
    });
    $$(".g-pair, .g-trio").forEach((g) => {
      $$(".shot", g).forEach((s, i) => {
        if (i) gsap.to(s, { y: -60 * i, ease: "none", scrollTrigger: { trigger: g, start: "top bottom", end: "bottom top", scrub: true } });
      });
    });

    // Next project: the preview grows to full screen as you arrive.
    gsap.timeline({ scrollTrigger: { trigger: ".p-next", start: "top bottom", end: "bottom bottom", scrub: true } })
      .to(".p-next-media", { clipPath: "inset(0% 0% round 0px)", ease: "none" }, 0)
      .from(".p-next-title", { scale: 0.7, ease: "none" }, 0);
  }

  // ================= shared, motion-independent =================

  // Floating prev / current / next pill and the full-screen project index.
  function setupProjectNav() {
    const nav = $(".pnav");
    const index = $("#project-index");
    if (!nav || !index) return;

    // Index overlay.
    const opener = $(".pnav-current", nav);
    opener.addEventListener("click", () => {
      if (typeof index.showModal !== "function") { location.href = $(".pindex-list a", index).href; return; }
      index.showModal();
      lenis?.stop();
    });
    $(".pindex-close", index).addEventListener("click", () => index.close());
    index.addEventListener("close", () => { lenis?.start(); opener.focus(); });
    $$(".pindex-list a", index).forEach((a) => a.addEventListener("click", (e) => {
      if (a.getAttribute("aria-current") === "page") { e.preventDefault(); index.close(); }
    }));

    // When the pill is visible, and which project it points at.
    const isHome = nav.classList.contains("pnav-home");
    const items = $$(".stack-item");
    const work = $(".work");
    const nextSection = $(".p-next");
    const num = $(".pnav-num", nav);
    const title = $(".pnav-title", nav);
    const prev = $(".pnav-prev", nav);
    const next = $(".pnav-next", nav);
    const prevLabel = prev.getAttribute("aria-label").split(":")[0];
    const nextLabel = next.getAttribute("aria-label").split(":")[0];
    let active = -1;
    let ticking = false;

    const setActive = (i) => {
      if (i === active) return;
      active = i;
      const it = items[i];
      const p = items[(i - 1 + items.length) % items.length];
      const n = items[(i + 1) % items.length];
      num.textContent = `${it.dataset.num} / ${String(items.length).padStart(2, "0")}`;
      title.textContent = it.dataset.title;
      title.classList.remove("is-swapping");
      void title.offsetWidth; // restart the swap animation
      title.classList.add("is-swapping");
      prev.href = "#" + p.id;
      next.href = "#" + n.id;
      prev.setAttribute("aria-label", `${prevLabel}: ${p.dataset.title}`);
      next.setAttribute("aria-label", `${nextLabel}: ${n.dataset.title}`);
    };

    const update = () => {
      ticking = false;
      const mid = innerHeight * 0.5;
      let on;
      if (isHome) {
        const r = work.getBoundingClientRect();
        on = r.top < mid && r.bottom > mid;
        let i = 0;
        items.forEach((it, k) => { if (it.getBoundingClientRect().top <= mid) i = k; });
        setActive(i);
      } else {
        on = scrollY > innerHeight * 0.6 && (!nextSection || nextSection.getBoundingClientRect().top > innerHeight * 0.55);
      }
      nav.classList.toggle("is-on", on);
    };
    addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    addEventListener("resize", update);
    update();
  }
  // Videos play while on screen (unless motion is reduced), each with a pause button,
  // plus a sound button on videos that have a soundtrack.
  function setupVideos(stillMode) {
    const featureVideo = $(".feature-video");
    if (featureVideo && !stillMode && "IntersectionObserver" in window) {
      new IntersectionObserver(([e]) => (e.isIntersecting ? featureVideo.play().catch(() => {}) : featureVideo.pause()), { threshold: 0.1 })
        .observe($(".feature"));
    }
    const he = root.lang === "he";
    // Watch the block around the video, not the video itself: the video sits inside the
    // reveal mask, and a masked element never counts as visible.
    const watcher = !stillMode && "IntersectionObserver" in window
      ? new IntersectionObserver((entries) => {
          for (const { target, isIntersecting } of entries) {
            const video = $("video", target);
            if (isIntersecting) {
              $(".shot", target).classList.add("is-open"); // never leave a video behind a closed mask
              if (!video.dataset.userPaused) video.play().catch(() => {});
            } else {
              video.pause();
            }
          }
        }, { threshold: 0.2 })
      : null;
    $$("video.loop").forEach((video) => {
      const shot = video.closest(".shot");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "vid-toggle";
      const sync = () => {
        const playing = !video.paused;
        btn.textContent = playing ? "❚❚" : "▶";
        btn.setAttribute("aria-label", playing ? (he ? "השהיית הווידאו" : "Pause video") : (he ? "הפעלת הווידאו" : "Play video"));
      };
      btn.addEventListener("click", () => {
        if (video.paused) { delete video.dataset.userPaused; video.play(); }
        else { video.dataset.userPaused = "1"; video.pause(); }
      });
      video.addEventListener("play", sync);
      video.addEventListener("pause", sync);
      shot.append(btn);
      sync();

      if (video.dataset.audio !== undefined) {
        const snd = document.createElement("button");
        snd.type = "button";
        snd.className = "vid-toggle vid-sound";
        snd.setAttribute("aria-label", he ? "שמע" : "Sound");
        const syncSound = () => {
          snd.textContent = video.muted ? "🔇" : "🔊";
          snd.setAttribute("aria-pressed", String(!video.muted));
        };
        snd.addEventListener("click", () => {
          video.muted = !video.muted;
          if (!video.muted && video.paused) { delete video.dataset.userPaused; video.play(); }
          syncSound();
        });
        shot.append(snd);
        syncSound();
      }
      if (watcher) watcher.observe(video.closest(".g"));
    });
  }

  function setupLightbox() {
    const links = $$("a[data-lightbox]");
    if (!links.length || typeof HTMLDialogElement !== "function") return;
    const he = root.lang === "he";
    const dlg = document.createElement("dialog");
    dlg.className = "lb";
    dlg.setAttribute("aria-label", he ? "תצוגת תמונות" : "Image viewer");
    dlg.innerHTML = `<img alt="">
      <button type="button" class="lb-x" aria-label="${he ? "סגירה" : "Close"}"><span aria-hidden="true">✕</span></button>
      <button type="button" class="lb-p" aria-label="${he ? "לתמונה הקודמת" : "Previous image"}"><span aria-hidden="true">←</span></button>
      <button type="button" class="lb-n" aria-label="${he ? "לתמונה הבאה" : "Next image"}"><span aria-hidden="true">→</span></button>`;
    document.body.append(dlg);
    const im = $("img", dlg);
    let idx = 0;
    let opener = null;
    const show = (i) => {
      idx = (i + links.length) % links.length;
      im.src = links[idx].href;
      im.alt = $("img", links[idx])?.alt || "";
    };
    links.forEach((a, i) => a.addEventListener("click", (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault();
      opener = a;
      show(i);
      dlg.showModal();
      lenis?.stop();
    }));
    $(".lb-x", dlg).addEventListener("click", () => dlg.close());
    $(".lb-p", dlg).addEventListener("click", () => show(idx - 1));
    $(".lb-n", dlg).addEventListener("click", () => show(idx + 1));
    dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
    dlg.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") show(idx + (rtl ? -1 : 1));
      if (e.key === "ArrowLeft") show(idx + (rtl ? 1 : -1));
    });
    dlg.addEventListener("close", () => { lenis?.start(); opener?.focus(); });
  }
})();
