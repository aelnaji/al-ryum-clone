/* ==== AL RYUM @astra ==== mist opening screen. */

(function () {
  "use strict";
  if (window.__alryumMistGuard) return;

  /*
   * Separate fixed opening screen; consumes no document scroll distance.
   * Native inert suspends the underlying app only while this screen is open.
   * Set data-video on this script to the cloud-mist video URL.
   */
  var script = document.currentScript;
  var src = script && script.getAttribute("data-video");
  var api = { destroy: function () {} };
  window.__alryumMistGuard = api;
  if (!src) return;

  var cancel = false;
  api.destroy = function () { cancel = true; };

  function mount() {
    if (cancel) return;
    var root = document.getElementById("root");

    // Do not hide an unsupported, restored, or deep-linked page.
    if (!root || !("inert" in root) ||
        window.scrollY > 1 || location.hash) return;

    var host = document.createElement("div");
    host.id = "al-ryum-mist-opening";
    host.style.cssText =
      "position:fixed;inset:0;z-index:2147483647;" +
      "display:block;isolation:isolate;pointer-events:auto;" +
      "touch-action:none;overscroll-behavior:contain;";
    // Lenis's documented per-element opt-out; never stop/start its instance.
    host.setAttribute("data-lenis-prevent", "");

    var shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML =
      '<style>' +
      ':host{color:#fff;font-family:system-ui,sans-serif}' +
      '.screen{position:absolute;inset:0;overflow:hidden;background:#17242b}' +
      'video{display:block;width:100%;height:100%;object-fit:cover;pointer-events:none}' +
      'button{position:absolute;bottom:32px;left:50%;transform:translateX(-50%);' +
      'padding:12px 20px;border:1px solid #ffffff80;border-radius:30px;' +
      'background:#0007;color:#fff;font:inherit;cursor:pointer}' +
      'button:focus-visible{outline:3px solid white;outline-offset:4px}' +
      '</style>' +
      '<section class="screen" role="dialog" aria-modal="true" aria-label="Cloud mist introduction">' +
      '<video muted autoplay loop playsinline aria-hidden="true"></video>' +
      '<button type="button">Scroll to enter ↓</button>' +
      '</section>';

    var video = shadow.querySelector("video");
    var button = shadow.querySelector("button");
    video.muted = true;
    video.defaultMuted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = "auto";
    video.src = src;

    var oldInert = root.inert;
    var oldFocus = document.activeElement;
    var closing = false, dead = false, timer, animation;
    var removers = [];
    var startY = null;

    function listen(target, type, fn, options) {
      target.addEventListener(type, fn, options);
      removers.push(function () {
        target.removeEventListener(type, fn, options);
      });
    }

    function cleanup() {
      if (dead) return;
      dead = true;
      clearTimeout(timer);
      if (animation) animation.cancel();
      removers.forEach(function (remove) { remove(); });
      root.inert = oldInert;
      var restoreFocus = document.activeElement === host;
      video.pause();
      video.removeAttribute("src");
      video.load();
      host.remove();
      if (restoreFocus && oldFocus && oldFocus.isConnected &&
          typeof oldFocus.focus === "function") {
        oldFocus.focus({ preventScroll: true });
      }
    }

    function dismiss() {
      if (closing || dead) return;
      closing = true;
      var reduced = window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduced || !host.animate) {
        cleanup();
        return;
      }
      // Slide only this sibling: no transforms on root/body/canvas.
      animation = host.animate(
        [{ transform: "translateY(0)" }, { transform: "translateY(-100%)" }],
        { duration: 520, easing: "cubic-bezier(.22,.7,.2,1)", fill: "forwards" }
      );
      animation.onfinish = cleanup;
      timer = setTimeout(cleanup, 700);
    }

    function swallow(event) {
      if (event.cancelable) event.preventDefault();
      event.stopImmediatePropagation();
    }

    // Installed before app scripts so opening input never reaches Lenis.
    listen(window, "wheel", function (event) {
      swallow(event);
      if (event.deltaY > 0) dismiss();
    }, { capture: true, passive: false });

    listen(window, "touchstart", function (event) {
      startY = event.touches.length === 1 ? event.touches[0].clientY : null;
      event.stopImmediatePropagation();
    }, { capture: true, passive: true });

    listen(window, "touchmove", function (event) {
      swallow(event);
      if (startY !== null && event.touches.length === 1 &&
          startY - event.touches[0].clientY > 12) dismiss();
    }, { capture: true, passive: false });

    listen(window, "touchend", function () { startY = null; },
      { capture: true, passive: true });
    listen(window, "touchcancel", function () { startY = null; },
      { capture: true, passive: true });

    listen(window, "keydown", function (event) {
      var key = event.key;
      if (["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End",
           " ", "Escape"].indexOf(key) === -1) return;
      swallow(event);
      if (["ArrowDown", "PageDown", "End", " ", "Escape"].indexOf(key) !== -1)
        dismiss();
    }, { capture: true, passive: false });

    listen(button, "click", dismiss);
    listen(video, "error", cleanup);
    // Fail open if another script/restoration changes the actual scroll.
    listen(window, "scroll", function () {
      if (window.scrollY > 1) cleanup();
    }, { passive: true });
    listen(window, "pagehide", cleanup);

    api.destroy = cleanup;
    document.body.appendChild(host);
    root.inert = true;
    button.focus({ preventScroll: true });

    var playback = video.play();
    if (playback && playback.catch) playback.catch(cleanup);
  }

  if (document.readyState === "loading" &&
      !document.getElementById("root")) {
    document.addEventListener("DOMContentLoaded", mount, { once: true });
  } else {
    mount();
  }
})();

