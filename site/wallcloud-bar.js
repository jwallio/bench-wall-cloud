/*!
 * wall.cloud network bar + footer — one shared header/footer for every wall.cloud site.
 *
 * Usage (one line, anywhere in <head> or <body>):
 *   <script src="/wallcloud-bar.js" data-site="bench" defer></script>
 *
 * Options (data-* attributes on the script tag):
 *   data-site    which project is current: home | snow | maps | comfort | bench | soundings | radar
 *   data-footer  "false" to skip the shared footer (default: shown)
 *   data-sticky  "true" to keep the bar pinned at the top while scrolling (default: scrolls away)
 *
 * Everything renders inside Shadow DOM, so the host page's CSS can't break it and it can't
 * leak styles into the host page. No external fonts, images or requests: safe under
 * CSP `default-src 'self'`.
 *
 * To change the project list or branding for every site, edit PROJECTS / BRAND below and
 * copy this one file into each site.
 */
(function () {
  "use strict";

  var BRAND = {
    name: "wall.cloud",
    home: "https://wall.cloud/",
    tagline: "Weather projects by Jonathan Wall",
    x: "https://x.com/wallcloud",
    contact: "https://wall.cloud/#about",
  };

  // Order here is the order in the menu.
  var PROJECTS = [
    { id: "snow", name: "Snow Signal", short: "Snow", url: "https://snow.wall.cloud/" },
    { id: "maps", name: "Maps", short: "Maps", url: "https://maps.wall.cloud/" },
    { id: "comfort", name: "Comfort Index", short: "Comfort", url: "https://comfort.wall.cloud/" },
    { id: "bench", name: "Verification Bench", short: "Bench", url: "https://bench.wall.cloud/" },
    { id: "soundings", name: "Soundings", short: "Soundings", url: "https://soundings.wall.cloud/" },
    { id: "radar", name: "Radar Replay", short: "Radar", url: "https://radar.wall.cloud/" },
  ];

  var script = document.currentScript;
  function opt(name, fallback) {
    var v = script && script.getAttribute("data-" + name);
    return v == null || v === "" ? fallback : v;
  }
  function guessSite() {
    var host = location.hostname.toLowerCase();
    for (var i = 0; i < PROJECTS.length; i++) {
      if (host.indexOf(PROJECTS[i].id + ".") === 0) return PROJECTS[i].id;
    }
    return host === "wall.cloud" || host === "www.wall.cloud" ? "home" : "";
  }
  var current = opt("site", guessSite());
  var showFooter = opt("footer", "true") !== "false";
  var sticky = opt("sticky", "false") === "true";

  // Shared palette. Hosts may read these too: they are mirrored onto :root as --wc-*.
  var TOKENS = {
    "--wc-bg": "#08131b",
    "--wc-panel": "#0f2230",
    "--wc-line": "#1f3546",
    "--wc-ink": "#eef3f8",
    "--wc-mute": "#9fb1c1",
    "--wc-accent": "#59c8f5",
  };

  var CSS = [
    ":host{all:initial;display:block;font:14px/1.4 Inter,ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:var(--wc-ink);-webkit-font-smoothing:antialiased}",
    ":host{" + Object.keys(TOKENS).map(function (k) { return k + ":" + TOKENS[k]; }).join(";") + "}",
    "*{box-sizing:border-box}",
    "a{color:inherit;text-decoration:none}",
    "a:focus-visible,summary:focus-visible{outline:2px solid var(--wc-accent);outline-offset:2px;border-radius:6px}",
    ".bar{background:var(--wc-bg);border-bottom:1px solid var(--wc-line)}",
    ".in{max-width:1480px;margin:0 auto;padding:0 max(2.5vw,14px);min-height:44px;display:flex;align-items:center;gap:18px}",
    ".logo{display:inline-flex;align-items:center;gap:8px;font-weight:700;font-size:15px;letter-spacing:-.01em;white-space:nowrap;min-height:44px}",
    ".logo svg{width:22px;height:22px;flex:0 0 auto}",
    ".logo:hover{color:var(--wc-accent)}",
    "nav{display:flex;align-items:center;gap:2px;margin-left:auto;overflow-x:auto;scrollbar-width:none}",
    "nav::-webkit-scrollbar{display:none}",
    "nav a{color:var(--wc-mute);padding:6px 10px;border-radius:7px;white-space:nowrap;font-size:13.5px;min-height:32px;display:inline-flex;align-items:center}",
    "nav a:hover{color:var(--wc-ink);background:var(--wc-panel)}",
    "nav a[aria-current=page]{color:var(--wc-ink);background:var(--wc-panel);box-shadow:inset 0 -2px 0 var(--wc-accent)}",
    ".menu{display:none;margin-left:auto;position:relative}",
    ".menu summary{list-style:none;cursor:pointer;color:var(--wc-ink);padding:6px 12px;border:1px solid var(--wc-line);border-radius:8px;min-height:36px;display:inline-flex;align-items:center;gap:6px;font-size:13.5px}",
    ".menu summary::-webkit-details-marker{display:none}",
    ".menu summary::after{content:'';width:7px;height:7px;border-right:1.5px solid currentColor;border-bottom:1.5px solid currentColor;transform:translateY(-2px) rotate(45deg)}",
    ".menu[open] summary::after{transform:translateY(2px) rotate(-135deg)}",
    ".menu .list{position:absolute;right:0;top:calc(100% + 6px);min-width:220px;background:var(--wc-bg);border:1px solid var(--wc-line);border-radius:10px;padding:6px;box-shadow:0 12px 32px rgba(0,0,0,.45);z-index:1000}",
    ".menu .list a{display:flex;justify-content:space-between;padding:10px 12px;border-radius:7px;color:var(--wc-mute);min-height:44px;align-items:center}",
    ".menu .list a:hover,.menu .list a[aria-current=page]{background:var(--wc-panel);color:var(--wc-ink)}",
    ".menu .list a[aria-current=page]::after{content:'';width:6px;height:6px;border-radius:50%;background:var(--wc-accent)}",
    ".menu .list hr{border:0;border-top:1px solid var(--wc-line);margin:6px 4px}",
    "@media(max-width:760px){nav{display:none}.menu{display:block}}",
    "footer{background:var(--wc-bg);border-top:1px solid var(--wc-line);color:var(--wc-mute);font-size:13px}",
    "footer .in{flex-wrap:wrap;gap:10px 24px;padding-block:18px;align-items:flex-start}",
    "footer .who{display:flex;flex-direction:column;gap:2px;margin-right:auto}",
    "footer .who .logo{min-height:0;color:var(--wc-ink)}",
    "footer .links{display:flex;flex-wrap:wrap;gap:4px 14px}",
    "footer .links a:hover{color:var(--wc-ink)}",
    "footer .fine{flex-basis:100%;font-size:12px;opacity:.85}",
    "footer .fine a{text-decoration:underline}",
  ].join("\n");

  // Small mark: a wall cloud lowering from a cloud base. Inline SVG, no request.
  var MARK =
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<path d="M3 10.5c0-2.3 1.9-4.2 4.2-4.2.5 0 1 .1 1.5.3C9.6 4.5 11.6 3 14 3c3 0 5.4 2.3 5.6 5.2 1.4.4 2.4 1.7 2.4 3.2 0 1.8-1.5 3.3-3.3 3.3H6.3C4.5 14.7 3 13.2 3 11.4z" fill="var(--wc-ink)"/>' +
    '<path d="M8.5 14.7h7l-1.2 3.3H9.7z" fill="var(--wc-accent)"/>' +
    '<path d="M10.6 18h2.8l-.9 3h-1z" fill="var(--wc-accent)" opacity=".7"/>' +
    "</svg>";

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function cur(id) { return id === current ? ' aria-current="page"' : ""; }
  var homeLabel = current === "home" ? "" : ' aria-label="wall.cloud home"';

  function barHTML() {
    var links = PROJECTS.map(function (p) {
      return '<a href="' + p.url + '"' + cur(p.id) + ">" + esc(p.short) + "</a>";
    }).join("");
    var mobile = PROJECTS.map(function (p) {
      return '<a href="' + p.url + '"' + cur(p.id) + ">" + esc(p.name) + "</a>";
    }).join("");
    var here = PROJECTS.filter(function (p) { return p.id === current; })[0];
    return (
      '<div class="bar"><div class="in">' +
      '<a class="logo" href="' + BRAND.home + '"' + homeLabel + cur("home") + ">" + MARK + "<span>" + esc(BRAND.name) + "</span></a>" +
      '<nav aria-label="wall.cloud projects">' + links + "</nav>" +
      '<details class="menu"><summary>' + esc(here ? here.short : "Projects") + "</summary>" +
      '<div class="list" role="menu"><a href="' + BRAND.home + '"' + cur("home") + ">wall.cloud home</a><hr>" + mobile + "</div></details>" +
      "</div></div>"
    );
  }

  function footerHTML() {
    var year = new Date().getFullYear();
    var links = PROJECTS.map(function (p) {
      return '<a href="' + p.url + '">' + esc(p.name) + "</a>";
    }).join("");
    return (
      '<footer><div class="in">' +
      '<div class="who"><a class="logo" href="' + BRAND.home + '">' + MARK + "<span>" + esc(BRAND.name) + "</span></a><span>" + esc(BRAND.tagline) + "</span></div>" +
      '<div class="links" role="navigation" aria-label="All wall.cloud projects">' + links + '<a href="' + BRAND.x + '" rel="me noopener">@wallcloud on X</a></div>' +
      '<div class="fine">\u00a9 ' + year + " Jonathan Wall \u00b7 For informational and educational use. For official forecasts, watches and warnings, see the " +
      '<a href="https://www.weather.gov/" rel="noopener">National Weather Service</a>.</div>' +
      "</div></footer>"
    );
  }

  function mount(html, where) {
    var host = document.createElement("div");
    host.setAttribute("data-wallcloud", where);
    var root = host.attachShadow({ mode: "open" });
    var sheet = null;
    try {
      sheet = new CSSStyleSheet();
      sheet.replaceSync(CSS);
      root.adoptedStyleSheets = [sheet];
    } catch (e) {
      var st = document.createElement("style");
      st.textContent = CSS;
      root.appendChild(st);
    }
    var wrap = document.createElement("div");
    wrap.innerHTML = html;
    while (wrap.firstChild) root.appendChild(wrap.firstChild);
    return { host: host, root: root };
  }

  function init() {
    if (document.querySelector('[data-wallcloud="bar"]')) return; // already mounted
    // Mirror tokens to :root so host pages can match the shared palette if they want.
    for (var k in TOKENS) document.documentElement.style.setProperty(k, TOKENS[k]);

    var bar = mount(barHTML(), "bar");
    if (sticky) {
      bar.host.style.position = "sticky";
      bar.host.style.top = "0";
      bar.host.style.zIndex = "1000";
    } else {
      bar.host.style.position = "relative";
      bar.host.style.zIndex = "1000";
    }
    // Keep the host page's own "skip to content" link first for keyboard users.
    var first = document.body.firstElementChild;
    var skip = first && first.matches && first.matches('a[href^="#"]') ? first : null;
    document.body.insertBefore(bar.host, skip ? skip.nextSibling : document.body.firstChild);

    // Close the mobile menu on outside click / Escape.
    var menu = bar.root.querySelector(".menu");
    document.addEventListener("click", function (e) {
      if (menu.open && e.composedPath().indexOf(menu) === -1) menu.open = false;
    });
    bar.root.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && menu.open) { menu.open = false; menu.querySelector("summary").focus(); }
    });

    if (showFooter) document.body.appendChild(mount(footerHTML(), "footer").host);
  }

  if (document.body) init();
  else document.addEventListener("DOMContentLoaded", init);
})();
