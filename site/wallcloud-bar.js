/*!
 * wall.cloud shared header + footer for every wall.cloud project site.
 * Matches the wall.cloud home page header: night background, "wall.cloud" wordmark with a sky-blue dot.
 *
 * Usage (one line, anywhere in <head> or <body>):
 *   <script src="/wallcloud-bar.js" data-site="bench" defer></script>
 *
 * Options (data-* attributes on the script tag):
 *   data-site    which project is current: home | snow | maps | comfort | bench | soundings
 *   data-footer  "false" to skip the shared footer (default: shown)
 *   data-sticky  "true" to keep the header pinned while scrolling (default: scrolls away)
 *
 * Renders inside Shadow DOM: the host page's CSS can't affect it and it can't affect the host page.
 * No external fonts, images or requests, so it is safe under CSP default-src 'self'.
 *
 * To change the project list or branding everywhere, edit PROJECTS / BRAND below.
 */
(function () {
  "use strict";

  var BRAND = {
    home: "https://wall.cloud/",
    tagline: "Weather projects by Jonathan Wall.",
    contact: "https://wall.cloud/#about",
    x: "https://x.com/wallcloud",
  };

  // Order here is the order in the header.
  var PROJECTS = [
    { id: "snow", name: "Snow Signal", short: "Snow", url: "https://snow.wall.cloud/" },
    { id: "maps", name: "Maps", short: "Maps", url: "https://maps.wall.cloud/" },
    { id: "comfort", name: "Comfort Index", short: "Comfort", url: "https://comfort.wall.cloud/" },
    { id: "bench", name: "Verification Bench", short: "Bench", url: "https://bench.wall.cloud/" },
    { id: "soundings", name: "Soundings", short: "Soundings", url: "https://soundings.wall.cloud/" },
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

  // The wall.cloud home page palette (styles.css :root).
  var TOKENS = {
    "--wc-night": "#08131b",
    "--wc-cloud": "#edf4f6",
    "--wc-cloud-soft": "#c4d2d8",
    "--wc-muted": "#91a7b2",
    "--wc-sky": "#74bdd8",
    "--wc-line": "rgba(196, 210, 216, 0.24)",
    "--wc-line-strong": "rgba(164, 208, 225, 0.42)",
  };

  var CSS = [
    ":host{all:initial;display:block;background:var(--wc-night);color:var(--wc-cloud);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;-webkit-font-smoothing:antialiased;font-synthesis:none}",
    ":host{" + Object.keys(TOKENS).map(function (k) { return k + ":" + TOKENS[k]; }).join(";") + "}",
    "*{box-sizing:border-box}",
    "a{color:inherit;text-decoration:none}",
    "a:focus-visible{outline:2px solid var(--wc-sky);outline-offset:3px;border-radius:4px}",
    ".in{width:min(100% - 3rem,1240px);margin-inline:auto}",
    ".head{min-height:70px;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:2rem;border-bottom:1px solid var(--wc-line)}",
    ".wordmark{width:max-content;color:var(--wc-cloud);font-size:1.1rem;font-weight:760;letter-spacing:-0.055em;min-height:44px;display:inline-flex;align-items:center}",
    ".wordmark span{color:var(--wc-sky)}",
    "nav{display:flex;align-items:center;gap:clamp(1.25rem,3vw,2.5rem)}",
    "nav a,.contact{min-width:44px;min-height:44px;display:inline-flex;align-items:center;justify-content:center;color:var(--wc-cloud-soft);font-size:0.8rem;font-weight:650;white-space:nowrap;transition:color 150ms ease}",
    "nav a:hover,.contact:hover{color:var(--wc-cloud)}",
    "nav a[aria-current=page]{color:var(--wc-cloud);box-shadow:inset 0 -1px 0 var(--wc-sky)}",
    ".contact{justify-self:end;gap:0.55rem;min-height:0;padding-bottom:0.35rem;border-bottom:1px solid var(--wc-line-strong)}",
    ".contact span{color:var(--wc-sky)}",
    "@media(max-width:820px){",
    ".in{width:min(100% - 2rem,1240px)}",
    ".head{grid-template-columns:1fr auto;gap:0 1rem;border-bottom:0;min-height:0;padding-top:6px}",
    "nav{grid-column:1/-1;grid-row:2;justify-content:space-between;gap:1rem;border-top:1px solid var(--wc-line);border-bottom:1px solid var(--wc-line);overflow-x:auto;scrollbar-width:none}",
    "nav::-webkit-scrollbar{display:none}",
    "}",
    "footer .in{display:flex;flex-wrap:wrap;align-items:baseline;gap:0.75rem 2rem;padding-block:2rem;border-top:1px solid var(--wc-line);color:var(--wc-muted);font-size:0.8rem}",
    "footer .wordmark{min-height:0}",
    "footer .links{display:flex;flex-wrap:wrap;gap:0.4rem 1.25rem;margin-left:auto}",
    "footer .links a{color:var(--wc-cloud-soft);font-weight:650}",
    "footer .links a:hover{color:var(--wc-cloud)}",
    "footer .fine{flex-basis:100%;margin:0;line-height:1.5}",
    "footer .fine a{text-decoration:underline;text-underline-offset:2px}",
    "footer p{margin:0}",
  ].join("\n");

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function cur(id) { return id === current ? ' aria-current="page"' : ""; }
  var WORDMARK = "wall<span>.</span>cloud";

  function headerHTML() {
    var links = PROJECTS.map(function (p) {
      return '<a href="' + p.url + '"' + cur(p.id) + ">" + esc(p.short) + "</a>";
    }).join("");
    return (
      '<header class="in head">' +
      '<a class="wordmark" href="' + BRAND.home + '" aria-label="wall.cloud home"' + cur("home") + ">" + WORDMARK + "</a>" +
      '<nav aria-label="wall.cloud projects">' + links + "</nav>" +
      '<a class="contact" href="' + BRAND.contact + '">Contact<span aria-hidden="true">↗</span></a>' +
      "</header>"
    );
  }

  function footerHTML() {
    var year = new Date().getFullYear();
    var links = PROJECTS.map(function (p) {
      return '<a href="' + p.url + '">' + esc(p.name) + "</a>";
    }).join("");
    return (
      '<footer><div class="in">' +
      '<a class="wordmark" href="' + BRAND.home + '" aria-label="wall.cloud home">' + WORDMARK + "</a>" +
      "<p>" + esc(BRAND.tagline) + "</p>" +
      '<div class="links" role="navigation" aria-label="All wall.cloud projects">' + links + '<a href="' + BRAND.x + '" rel="me noopener">X</a></div>' +
      '<p class="fine">© ' + year + " Jonathan Wall. For informational and educational use; forecasts are uncertain and may be delayed or unavailable. " +
      'Consult the <a href="https://www.weather.gov/" rel="noopener">National Weather Service</a> for official forecasts, watches and warnings. ' +
      "Third-party data remains subject to its providers’ terms.</p>" +
      "</div></footer>"
    );
  }

  function mount(html, where) {
    var host = document.createElement("div");
    host.setAttribute("data-wallcloud", where);
    var root = host.attachShadow({ mode: "open" });
    try {
      var sheet = new CSSStyleSheet();
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
    return host;
  }

  function init() {
    if (document.querySelector('[data-wallcloud="bar"]')) return; // already mounted
    var bar = mount(headerHTML(), "bar");
    bar.style.position = sticky ? "sticky" : "relative";
    if (sticky) bar.style.top = "0";
    bar.style.zIndex = "1000";
    // Keep the host page's own "skip to content" link first for keyboard users.
    var first = document.body.firstElementChild;
    var skip = first && first.matches && first.matches('a[href^="#"]') ? first : null;
    document.body.insertBefore(bar, skip ? skip.nextSibling : document.body.firstChild);
    if (showFooter) {
      var footer = mount(footerHTML(), "footer");
      document.body.appendChild(footer);
      keepLast(footer);
    }
  }

  // Apps that render with JavaScript (React, etc.) often add their page after this script has run,
  // which would leave the footer above the content. Keep the footer after the page's last visible element.
  function keepLast(footer) {
    var SKIP = { SCRIPT: 1, STYLE: 1, LINK: 1, TEMPLATE: 1, NOSCRIPT: 1, META: 1 };
    var queued = false;
    function check() {
      queued = false;
      for (var el = document.body.lastElementChild; el && el !== footer; el = el.previousElementSibling) {
        if (!SKIP[el.tagName]) { document.body.appendChild(footer); return; }
      }
    }
    new MutationObserver(function () {
      if (!queued) { queued = true; (window.requestAnimationFrame || setTimeout)(check); }
    }).observe(document.body, { childList: true });
  }

  if (document.body) init();
  else document.addEventListener("DOMContentLoaded", init);
})();
