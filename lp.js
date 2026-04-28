(() => {
  // Sticky nav scrolled state
  const nav = document.querySelector(".lp-nav");
  if (nav) {
    const onScroll = () => {
      nav.classList.toggle("scrolled", window.scrollY > 4);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  // Auto-tag elements outside hero with .reveal so we can stagger fade-up
  const candidates = document.querySelectorAll(
    ".section .section-marker, .section .section-title, .section .section-lead, .section .section-fineprint, .why-grid > *, .feature-card, .flow-step, .spec-row, .privacy-list li, .privacy-figure, .cta-eyebrow, .cta-title, .cta-lead, .section-cta .btn, .cta-fineprint"
  );
  candidates.forEach((el, i) => {
    el.classList.add("reveal");
    el.style.transitionDelay = `${Math.min(i * 30, 240)}ms`;
  });

  // IntersectionObserver for scroll reveal (skip hero, which uses CSS-only animation)
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) {
    document.querySelectorAll(".reveal").forEach((el) => el.classList.add("is-in"));
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-in");
          io.unobserve(entry.target);
        }
      });
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.05 }
  );

  document.querySelectorAll(".reveal").forEach((el) => {
    if (el.closest(".hero")) return;
    io.observe(el);
  });

  // Smooth-scroll offset compensate for sticky nav
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const id = a.getAttribute("href").slice(1);
      if (!id) return;
      const target = document.getElementById(id);
      if (!target) return;
      e.preventDefault();
      const navH = nav?.offsetHeight || 0;
      const top = target.getBoundingClientRect().top + window.scrollY - navH - 12;
      window.scrollTo({ top, behavior: "smooth" });
      history.replaceState(null, "", `#${id}`);
    });
  });
})();
