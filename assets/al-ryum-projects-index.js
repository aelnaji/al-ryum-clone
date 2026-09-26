/* ==== AL RYUM @astra ==== Projects index restyle.
   Turns /projects from six sector "category" blocks + white dropdowns into one uniform
   portfolio grid on the site's ink background, with gold accents matching the project
   viewer. React's markup, filtering and card clicks are untouched — only presentation. */

(function () {
  "use strict";
  if (window.__alryumProjectsIndex) return;
  window.__alryumProjectsIndex = true;

  var CLASS = "ar-proj-index";
  var originalPush = history.pushState;
  var originalReplace = history.replaceState;

  function isProjects() {
    return location.pathname === "/projects" || location.pathname === "/projects/";
  }

  function sync() {
    var on = isProjects();
    document.documentElement.classList.toggle(CLASS, on);
    if (on) hideEmptyValues();
  }

  // A lone "-" stands in for an unknown contract value; it reads as a mistake in a card row.
  function hideEmptyValues() {
    var root = document.getElementById("root");
    if (!root) return;
    var spans = root.querySelectorAll("span, p, div");
    for (var i = 0; i < spans.length; i++) {
      var node = spans[i];
      if (node.children.length) continue;
      if (node.textContent.trim() !== "-") continue;
      if (node.getAttribute("data-ar-hidden-dash")) continue;
      node.setAttribute("data-ar-hidden-dash", "1");
      node.style.display = "none";
    }
  }

  history.pushState = function () {
    var r = originalPush.apply(this, arguments);
    sync();
    return r;
  };
  history.replaceState = function () {
    var r = originalReplace.apply(this, arguments);
    sync();
    return r;
  };
  window.addEventListener("popstate", sync);
  window.addEventListener("pageshow", sync);
  sync();
  setInterval(sync, 1000);
})();
