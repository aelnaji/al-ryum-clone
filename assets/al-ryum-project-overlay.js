/* Project card detail overlay. Keeps the current project rail in place while
   a detail is open, so wheel/touch input cannot move the page underneath it. */
(function () {
  "use strict";

  var OVERLAY_ID = "arc-project-overlay";
  var scrollY = 0;
  var active = false;

  function setScrollLocked(locked) {
    if (locked) {
      scrollY = window.scrollY || window.pageYOffset;
      document.documentElement.style.overflow = "hidden";
      document.body.style.position = "fixed";
      document.body.style.top = "-" + scrollY + "px";
      document.body.style.width = "100%";
      if (window.lenis && typeof window.lenis.stop === "function") window.lenis.stop();
      return;
    }

    document.documentElement.style.overflow = "";
    document.body.style.position = "";
    document.body.style.top = "";
    document.body.style.width = "";
    if (window.lenis && typeof window.lenis.start === "function") window.lenis.start();
    window.scrollTo(0, scrollY);
  }

  function close() {
    var overlay = document.getElementById(OVERLAY_ID);
    if (!overlay || !active) return;
    active = false;
    overlay.remove();
    setScrollLocked(false);
  }

  function open(card) {
    if (active) return;
    var title = card.querySelector(".icreon-card__title");
    var eyebrow = card.querySelector(".icreon-card__eyebrow");
    var description = card.querySelector(".icreon-card__desc");
    var image = card.querySelector(".icreon-card__asset img");
    var client = card.querySelectorAll(".icreon-card__value")[0];
    var value = card.querySelectorAll(".icreon-card__value")[1];
    if (!title || !image) return;

    var overlay = document.createElement("section");
    overlay.id = OVERLAY_ID;
    overlay.className = "arc-project-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "arc-project-overlay-title");
    overlay.innerHTML =
      '<div class="arc-project-overlay__backdrop"></div>' +
      '<article class="arc-project-overlay__panel" tabindex="-1">' +
        '<button class="arc-project-overlay__close" type="button" aria-label="Close project details">Close <span aria-hidden="true">&times;</span></button>' +
        '<img class="arc-project-overlay__image" alt="" />' +
        '<div class="arc-project-overlay__content">' +
          '<p class="arc-project-overlay__eyebrow"></p>' +
          '<h2 id="arc-project-overlay-title"></h2>' +
          '<p class="arc-project-overlay__description"></p>' +
          '<dl class="arc-project-overlay__facts">' +
            '<div><dt>Client</dt><dd></dd></div>' +
            '<div><dt>Value / Year</dt><dd></dd></div>' +
          '</dl>' +
        '</div>' +
      '</article>';

    overlay.querySelector(".arc-project-overlay__image").src = image.currentSrc || image.src;
    overlay.querySelector(".arc-project-overlay__image").alt = image.alt;
    overlay.querySelector(".arc-project-overlay__eyebrow").textContent = eyebrow ? eyebrow.textContent : "";
    overlay.querySelector("#arc-project-overlay-title").textContent = title.textContent;
    overlay.querySelector(".arc-project-overlay__description").textContent = description ? description.textContent : "";
    overlay.querySelectorAll(".arc-project-overlay__facts dd")[0].textContent = client ? client.textContent : "Al Ryum Group";
    overlay.querySelectorAll(".arc-project-overlay__facts dd")[1].textContent = value ? value.textContent : "";
    overlay.querySelector(".arc-project-overlay__close").addEventListener("click", close);
    overlay.querySelector(".arc-project-overlay__backdrop").addEventListener("click", close);

    document.body.appendChild(overlay);
    active = true;
    setScrollLocked(true);
    overlay.querySelector(".arc-project-overlay__close").focus();
  }

  document.addEventListener("click", function (event) {
    var card = event.target.closest(".icreon-card");
    if (!card) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    open(card);
  }, true);

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") close();
  });
})();
