/* ============================================================================
   al-ryum-meamap.js — replaces the static GCC map SVG in the #global-reach
   section with a D3-built MENA map. Static (no pan/zoom controls), but the
   connection line animates and markers pulse, matching the mea-map.html design.
   Loads d3 + topojson from CDN if not already present.
   HARDENED: retries the world-geojson fetch + build until the map is drawn,
   so a load-time race can never leave the section blank.
   ========================================================================== */
(function () {
  "use strict";
  if (window.__alryumMeamapLoaded) return;
  window.__alryumMeamapLoaded = true;

  var TARGETS = [
    { name: "United Arab Emirates", label: "UAE",   order: 1 },
    { name: "Qatar",               label: "Qatar", order: 2 },
    { name: "Saudi Arabia",        label: "Saudi Arabia", order: 3 },
    { name: "Iraq",                label: "Iraq", order: 4 },
    { name: "Jordan",              label: "Jordan", order: 5 },
  ];
  var CONTEXT = [
    "Oman","Bahrain","Kuwait","Yemen","Egypt","Israel",
    "Lebanon","Syria","Turkey","Iran","Cyprus",
    "Sudan","Eritrea","Ethiopia","Djibouti"
  ];

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      if (document.querySelector('script[src="' + src + '"]')) return resolve();
      var s = document.createElement("script");
      s.src = src;
      s.onload = resolve;
      s.onerror = function () { reject(new Error("failed to load " + src)); };
      document.head.appendChild(s);
    });
  }
  var VENDOR = "/assets/vendor/";
  var D3_SRC = VENDOR + "d3.min.js";
  var TOPO_SRC = VENDOR + "topojson-client.min.js";
  var WORLD_SRC = VENDOR + "countries-110m.json";

  function boot() {
    var gr = document.getElementById("global-reach");
    if (!gr) return setTimeout(boot, 300);
    var oldSvg = gr.querySelector("svg");
    if (!oldSvg) return setTimeout(boot, 300);
    if (oldSvg.dataset.meaInjected) return;

    // Replace the static svg with a fresh one holding the interactive map
    var wrap = oldSvg.parentElement; // "relative w-full overflow-hidden"
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 1000 700");
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    svg.setAttribute("class", "absolute inset-0 w-full h-full");
    svg.setAttribute("aria-label", "Regional map of the Middle East");
    oldSvg.replaceWith(svg);

    var ns = "http://www.w3.org/2000/svg";
    function el(name) { return document.createElementNS(ns, name); }
    function set(attrs) { return function (node) { for (var k in attrs) node.setAttribute(k, attrs[k]); return node; }; }

    Promise.all([loadScript(D3_SRC), loadScript(TOPO_SRC)]).then(function () {
      var d3 = window.d3;
      var topojson = window.topojson;
      var W = 1000, H = 700;
      var g = el("g");
      var gGrat = el("g");
      var gCount = el("g");
      var gLine = el("g");
      var gOver = el("g");
      svg.appendChild(g); g.appendChild(gGrat); g.appendChild(gCount); g.appendChild(gLine); svg.appendChild(gOver);

      function drawMap(world) {
        var countries = topojson.feature(world, world.objects.countries);
        var targetNames = {};
        TARGETS.forEach(function (t) { targetNames[t.name] = true; });
        var contextSet = {};
        CONTEXT.forEach(function (n) { contextSet[n] = true; });
        var visible = countries.features.filter(function (f) {
          var n = f.properties.name;
          return targetNames[n] || contextSet[n];
        });
        var fc = { type: "FeatureCollection", features: visible };
        var projection = d3.geoMercator().fitExtent([[20, 20], [W - 20, H - 20]], fc);
        var path = d3.geoPath(projection);

        var grat = el("path");
        grat.setAttribute("class", "graticule");
        grat.setAttribute("d", path(d3.geoGraticule10()));
        grat.setAttribute("fill", "none");
        grat.setAttribute("stroke", "rgba(255,255,255,0.05)");
        gGrat.appendChild(grat);

        visible.forEach(function (f) {
          var p = el("path");
          var isTarget = !!targetNames[f.properties.name];
          p.setAttribute("d", path(f));
          if (isTarget) {
            p.setAttribute("fill", "#1f5a3a");
            p.setAttribute("stroke", "#5cffae");
            p.setAttribute("stroke-width", "0.9");
          } else {
            p.setAttribute("fill", "#102a1c");
            p.setAttribute("stroke", "#1f5236");
            p.setAttribute("stroke-width", "0.5");
          }
          gCount.appendChild(p);
        });

        var targets = TARGETS.map(function (t) {
          var f = visible.find(function (c) { return c.properties.name === t.name; });
          if (!f) return null;
          var c = path.centroid(f);
          return { name: t.name, label: t.label, order: t.order, cx: c[0], cy: c[1] };
        }).filter(Boolean);

        var lineData = targets.map(function (t) { return [t.cx, t.cy]; });
        var lineGen = d3.line().curve(d3.curveCatmullRom.alpha(0.5));
        var lp = el("path");
        lp.setAttribute("d", lineGen(lineData));
        lp.setAttribute("fill", "none");
        lp.setAttribute("stroke", "#5cffae");
        lp.setAttribute("stroke-width", "2.4");
        lp.setAttribute("stroke-linecap", "round");
        lp.setAttribute("stroke-dasharray", "6 5");
        lp.style.filter = "drop-shadow(0 0 5px rgba(255,181,71,0.7))";
        lp.style.animation = "arcMeaDash 18s linear infinite";
        gLine.appendChild(lp);

        var offsets = {
          "United Arab Emirates": [22, -4],
          "Qatar": [-6, -28],
          "Saudi Arabia": [-8, 34],
          "Iraq": [-6, -22],
          "Jordan": [-6, 22],
        };
        targets.forEach(function (t, i) {
          var ring = el("circle");
          ring.setAttribute("cx", t.cx); ring.setAttribute("cy", t.cy);
          ring.setAttribute("r", 6);
          ring.setAttribute("fill", "none");
          ring.setAttribute("stroke", "#5cffae");
          ring.setAttribute("stroke-width", "1.8");
          ring.style.animation = "arcMeaPulse 2.4s ease-out " + (i * 0.3) + "s infinite";
          gOver.appendChild(ring);

          var dot = el("circle");
          dot.setAttribute("cx", t.cx); dot.setAttribute("cy", t.cy);
          dot.setAttribute("r", 8);
          dot.setAttribute("fill", "#b8ffd9");
          dot.setAttribute("stroke", "#fff8e7");
          dot.setAttribute("stroke-width", "1.5");
          gOver.appendChild(dot);

          var bc = el("circle");
          bc.setAttribute("cx", t.cx + 13); bc.setAttribute("cy", t.cy - 13);
          bc.setAttribute("r", 11);
          bc.setAttribute("fill", "#ffb547");
          bc.setAttribute("stroke", "#fff8e7");
          bc.setAttribute("stroke-width", "1.5");
          gOver.appendChild(bc);

          var bt = el("text");
          bt.setAttribute("x", t.cx + 13); bt.setAttribute("y", t.cy - 13);
          bt.setAttribute("text-anchor", "middle");
          bt.setAttribute("dominant-baseline", "central");
          bt.setAttribute("font-size", "12");
          bt.setAttribute("font-weight", "800");
          bt.setAttribute("fill", "#0b1020");
          bt.textContent = t.order;
          gOver.appendChild(bt);

          var lb = el("text");
          var off = offsets[t.name] || [12, 0];
          lb.setAttribute("x", t.cx + off[0]); lb.setAttribute("y", t.cy + off[1]);
          lb.setAttribute("dominant-baseline", "central");
          lb.setAttribute("font-size", "15");
          lb.setAttribute("font-weight", "700");
          lb.setAttribute("fill", "#e8f7ee");
          lb.textContent = t.label;
          gOver.appendChild(lb);
        });

        svg.dataset.meaInjected = "1";
      }

      // Retry the world-geojson fetch + build until it actually draws,
      // so a transient load race can never leave the map blank.
      var tries = 0, MAX = 8;
      function loadWorld() {
        tries++;
        d3.json(WORLD_SRC).then(function (world) {
          try {
            drawMap(world);
            if (!svg.getAttribute("data-mea-injected") && tries < MAX) {
              setTimeout(loadWorld, 500 * tries);
            }
          } catch (e) {
            if (tries < MAX) setTimeout(loadWorld, 500 * tries);
          }
        }).catch(function () {
          if (tries < MAX) setTimeout(loadWorld, 500 * tries);
        });
      }
      loadWorld();
    }).catch(function (err) {
      console.error("[al-ryum-meamap]", err);
      setTimeout(boot, 800); // vendor script failed to load; retry boot
    });
  }

  function start() {
    var root = document.getElementById("root");
    if (!root || !root.children.length) return setTimeout(start, 300);
    setTimeout(boot, 1500);
  }
  start();
  window.addEventListener("load", function () { setTimeout(boot, 1500); });
})();
