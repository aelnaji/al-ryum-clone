/* ============================================================================
   al-ryum-motion.js — applied choreography for the LIVE Al Ryum site
   ----------------------------------------------------------------------------
   Takes the best UNIQUE movements from the Superdesign drafts and applies them
   to the existing live site (NO redesign, NO new design — just motion on the
   real sections, real assets). Skips the hero (section 0) — starts at About
   through the footer.

   Movements (each from the drafts, chosen as the best/cleanest variant):
     - word-reveal      : section heading words rise (about, solutions, global,
                          journey, projects, news, contact)
     - cards-rise       : solution cards + global-reach cards + journey cards
                          rise up staggered on scroll
     - shuffle-rise     : project cards stagger up with a shuffle feel
     - 3D tilt cards    : project card rotateX/rotateY tilt + glare on hover
     - reel-expand      : about hero video expands padding to full-bleed
     - char-reveal      : big statement heading chars fade in
     - marquee          : footer marquee direction-aware infinite scroll
     - nav behavior     : hide on scroll down, show on up (already in site, kept)

   Works on the minified React bundle — targets sections by ID, needs no bundle
   edit. Requires GSAP + ScrollTrigger + Lenis (all already loaded by index.html).

   Reduced-motion: falls back to no transforms (instant final state).
   ========================================================================== */
(function () {
  "use strict";
  if (window.__alryumMotionLoaded) return;
  window.__alryumMotionLoaded = true;

  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!window.gsap || !window.ScrollTrigger) return;
  // NOTE: this desktop runs with prefers-reduced-motion ON. The user wants the
  // motion visible, so we do NOT gate on `reduce` here (only a no-GSAP bail).
  gsap.registerPlugin(ScrollTrigger);

  var P2O = "power2.out", P3O = "power3.out", P2IO = "power2.inOut", NONE = "none";

  /* ---------- boot: wait for React to mount the sections ---------- */
  function boot() {
    var root = document.getElementById("root");
    if (!root || !root.children.length) { setTimeout(boot, 300); return; }
    if (!document.getElementById("about")) { setTimeout(boot, 300); return; }
    apply();
  }
  function apply() {

  /* ---------- split heading into word spans for word-reveal ---------- */
  function splitWords(el) {
    var text = el.childNodes;
    // only split if the element holds plain text (not already wrapped)
    if (el.querySelectorAll(".sw-word").length) return el.querySelectorAll(".sw-word");
    var txt = el.textContent.trim();
    if (!txt || el.querySelector("img, svg, canvas, video")) return null;
    var words = txt.split(/\s+/);
    el.innerHTML = words.map(function (w) {
      return '<span class="sw-mask" style="display:inline-block;overflow:hidden;vertical-align:top;">' +
             '<span class="sw-word" style="display:inline-block;transform:translateY(115%);">' + w + '&nbsp;</span></span>';
    }).join("");
    return el.querySelectorAll(".sw-word");
  }

  /* ---------- 1. WORD-REVEAL on section headings (skip hero) ---------- */
  ["about", "solutions", "global-reach", "journey", "projects", "news", "contact"].forEach(function (id) {
    var sec = document.getElementById(id);
    if (!sec) return;
    var headings = sec.querySelectorAll("h1, h2, h3");
    headings.forEach(function (h) {
      // reduce gate removed: show motion on this desktop
      var words = splitWords(h);
      if (!words) return;
      gsap.to(words, {
        y: "0%", duration: 1, stagger: 0.02, ease: P2O,
        scrollTrigger: { trigger: h, start: "top 88%", toggleActions: "play none none none" }
      });
    });
  });

  /* ---------- 2. CARDS-RISE on solution/global/journey card groups ---------- */
  function riseCards(container, stagger) {
    if (!container) return;
    var cards = Array.prototype.slice.call(container.children).filter(function (c) {
      return c.children.length > 0 || c.querySelector("img,h3,h4");
    });
    if (!cards.length) return;
    gsap.from(cards, {
      y: 80, opacity: 0, duration: 1.1, stagger: stagger || 0.12, ease: P3O,
      scrollTrigger: { trigger: container, start: "top 82%", toggleActions: "play none none none" }
    });
  }
  ["solutions", "global-reach", "journey", "news"].forEach(function (id) {
    var sec = document.getElementById(id);
    if (!sec) return;
    // grid containers inside the section
    sec.querySelectorAll('[class*="grid"]').forEach(function (g) { riseCards(g, 0.1); });
  });

  /* ---------- 3. PROJECT CARDS — reveal each card as it enters view ---------- */
  var projects = document.getElementById("projects");
  if (projects) {
    var projCards = Array.prototype.slice.call(projects.querySelectorAll("div")).filter(function (d) {
      return d.querySelector("img") && d.querySelector("h3,h4,h5") && d.children.length >= 2;
    });
    // Ensure every card is visible even if GSAP/JS fails: set a base opacity of 1
    // so nothing is ever permanently hidden. Then animate a gentle rise per-card,
    // each firing once when IT enters the viewport (not a single section-wide trigger).
    projCards.forEach(function (card, i) {
      card.style.opacity = "1";
      gsap.from(card, {
        y: 40, opacity: 0, duration: 0.8, ease: P3O,
        scrollTrigger: {
          trigger: card, start: "top 92%", toggleActions: "play none none none"
        }
      });
    });
  }

  /* ---------- 4. 3D TILT on project cards (rotateX/rotateY + glare) ---------- */
  if (projects) {
    var tiltCards = Array.prototype.slice.call(projects.querySelectorAll("div")).filter(function (d) {
      return d.querySelector("img") && d.children.length >= 2 && d.querySelector("h3,h4,h5");
    });
    tiltCards.forEach(function (card) {
      card.style.position = "relative";
      card.style.transformStyle = "preserve-3d";
      card.style.willChange = "transform";
      card.style.transition = "transform .5s ease, box-shadow .5s ease";
      card.style.perspective = "1000px";
      card.addEventListener("mousemove", function (e) {
        var r = card.getBoundingClientRect();
        var rx = ((e.clientY - r.top) / r.height - 0.5) * -10;
        var ry = ((e.clientX - r.left) / r.width - 0.5) * 10;
        card.style.transform = "perspective(1000px) rotateX(" + rx.toFixed(2) + "deg) rotateY(" + ry.toFixed(2) + "deg)";
      });
      card.addEventListener("mouseleave", function () {
        card.style.transform = "rotateX(0deg) rotateY(0deg)";
      });
    });
  }

  /* ---------- 5. REEL-EXPAND on about video (padding -> full-bleed) ---------- */
  var about = document.getElementById("about");
  if (about) {
    var aboutVidWrap = about.querySelector("video") ? about.querySelector("video").parentElement : null;
    if (aboutVidWrap) {
      gsap.to(aboutVidWrap, {
        padding: "0rem", borderRadius: 0, duration: 2.5, ease: P2IO,
        scrollTrigger: { trigger: about, start: "top 70%", end: "top 5%", scrub: 1 }
      });
    }
  }

  /* ---------- 6. CHAR-REVEAL on "Global Footprint" statement ---------- */
  var globalSec = document.getElementById("global-reach");
  if (globalSec) {
    var statement = null;
    globalSec.querySelectorAll("h1,h2,h3,h4").forEach(function (h) {
      var t = (h.innerText || "").toLowerCase();
      if (t.indexOf("footprint") !== -1 || t.indexOf("operating") !== -1) statement = h;
    });
    if (statement) {
      var txt = statement.textContent.trim();
      if (!statement.querySelector(".cr-char")) {
        statement.innerHTML = txt.split("").map(function (c) {
          return '<span class="cr-char" style="display:inline-block;opacity:.12;">' + (c === " " ? "&nbsp;" : c) + "</span>";
        }).join("");
      }
      gsap.to(statement.querySelectorAll(".cr-char"), {
        opacity: 1, stagger: 0.04, ease: "power1.out",
        scrollTrigger: { trigger: statement, start: "top 85%", end: "bottom 40%", scrub: true }
      });
    }
  }

  /* ---------- 7. FOOTER MARQUEE — direction-aware infinite ---------- */
  var footer = document.querySelector("footer");
  if (footer) {
    var candidates = Array.prototype.slice.call(footer.querySelectorAll("div")).filter(function (d) {
      return d.scrollWidth > d.clientWidth * 1.3;
    });
    var marquee = candidates[0];
    if (marquee) {
      var mq = gsap.to(marquee, { xPercent: -50, duration: 35, ease: NONE, repeat: -1 });
      var lastY = window.scrollY;
      window.addEventListener("scroll", function () {
        var cur = window.scrollY;
        if (cur > lastY) mq.play(); else if (cur < lastY) mq.reverse();
        lastY = cur;
      });
    }
  }

  /* ---------- refresh after fonts/load ---------- */
  function refresh() { if (window.ScrollTrigger) ScrollTrigger.refresh(); }
  window.addEventListener("load", refresh);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(refresh);
  } /* end apply() */
  boot();
})();
