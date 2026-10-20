(() => {
  const C = Object.assign({ name: "", role: "", intro: "", skills: [], email: "", links: [], owner: "", repo: "", branch: "", folder: "games" }, window.PORTFOLIO || {});
  const ROOT = String(C.folder || "games").replace(/^\/+|\/+$/g, "");
  const IMG = /\.(png|jpe?g|webp|gif|avif)$/i;
  const CACHE_KEY = "portfolio-tree-v1";
  const CACHE_MS = 5 * 60 * 1000;
  const app = document.getElementById("app");
  let games = null;
  let loadError = null;
  let loading = null;

  const naturally = (a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
  const urlOf = p => p.split("/").map(encodeURIComponent).join("/");

  function el(tag, attrs, ...kids) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === "class") n.className = v;
      else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v);
    }
    for (const k of kids.flat()) if (k != null && k !== false) n.append(k.nodeType ? k : document.createTextNode(String(k)));
    return n;
  }

  function repoInfo() {
    if (C.owner && C.repo) return { owner: C.owner, repo: C.repo };
    const host = location.hostname.toLowerCase();
    if (!host.endsWith(".github.io")) return null;
    const owner = host.slice(0, -".github.io".length);
    const first = location.pathname.split("/").filter(Boolean)[0];
    const repo = first && !/\.html?$/i.test(first) ? decodeURIComponent(first) : host;
    return { owner, repo };
  }

  function cacheGet() {
    try {
      const c = JSON.parse(sessionStorage.getItem(CACHE_KEY));
      if (c && Date.now() - c.t < CACHE_MS && Array.isArray(c.paths)) return c.paths;
    } catch (e) {}
    return null;
  }
  function cacheSet(paths) {
    try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), paths })); } catch (e) {}
  }

  async function gh(path) {
    const r = await fetch("https://api.github.com" + path, { headers: { Accept: "application/vnd.github+json" } });
    if (r.ok) return r.json();
    if (r.status === 403 || r.status === 429) throw new Error("GitHub is busy right now. Please refresh in a few minutes.");
    if (r.status === 404) throw new Error("Repository not found. Make sure it is public, or set owner and repo in config.js.");
    throw new Error("Could not load the portfolio (GitHub error " + r.status + ").");
  }

  async function fetchPaths() {
    const cached = cacheGet();
    if (cached) return cached;
    const info = repoInfo();
    if (!info) throw new Error("Open this site from GitHub Pages, or set owner and repo in config.js to preview it locally.");
    const base = "/repos/" + encodeURIComponent(info.owner) + "/" + encodeURIComponent(info.repo);
    const branch = C.branch || (await gh(base)).default_branch;
    const tree = await gh(base + "/git/trees/" + encodeURIComponent(branch) + "?recursive=1");
    const paths = (tree.tree || []).filter(t => t.type === "blob").map(t => t.path);
    cacheSet(paths);
    return paths;
  }

  function buildGames(paths) {
    const prefix = ROOT ? ROOT + "/" : "";
    const map = new Map();
    for (const p of paths) {
      if (!p.startsWith(prefix)) continue;
      const rel = p.slice(prefix.length).split("/");
      if (rel.length < 2 || !IMG.test(p) || rel.some(s => s.startsWith("."))) continue;
      const name = rel[0];
      if (!map.has(name)) map.set(name, { name, cover: null, shots: [] });
      const g = map.get(name);
      const file = rel.slice(1).join("/");
      if (rel.length === 2 && /^cover\.[a-z]+$/i.test(file)) g.cover = p;
      else g.shots.push({ path: p, key: file });
    }
    const list = [...map.values()].filter(g => g.shots.length || g.cover);
    for (const g of list) {
      g.shots.sort((a, b) => naturally(a.key, b.key));
      g.shots = g.shots.map(s => s.path);
      if (!g.shots.length) g.shots = [g.cover];
      if (!g.cover) g.cover = g.shots[0];
    }
    return list.sort((a, b) => naturally(a.name, b.name));
  }

  function load() {
    if (!loading) {
      loading = fetchPaths()
        .then(p => { games = buildGames(p); })
        .catch(e => { loadError = e; })
        .then(() => render(true));
    }
    return loading;
  }

  function nameTitle(name) {
    const parts = String(name).trim().split(/\s+/);
    if (parts.length < 2) return el("h1", {}, el("span", { class: "grad" }, name));
    const last = parts.pop();
    return el("h1", {}, parts.join(" ") + " ", el("span", { class: "grad" }, last));
  }

  function contactButtons() {
    const out = [];
    if (C.email) out.push(el("a", { class: "btn primary", href: "mailto:" + C.email }, "Email me"));
    for (const l of C.links || []) if (l && l.url) out.push(el("a", { class: "btn", href: l.url, target: "_blank", rel: "noopener" }, l.label || l.url));
    return out;
  }

  function workSection() {
    const sec = el("section", { class: "section", id: "work" });
    const head = el("div", { class: "section-head" }, el("h2", {}, el("small", {}, "Portfolio"), "Selected Work"));
    sec.append(head);
    if (loadError) {
      sec.append(el("div", { class: "state" }, loadError.message));
    } else if (!games) {
      sec.append(el("div", { class: "grid" }, [1, 2, 3].map(() => el("div", { class: "skeleton" }))));
    } else if (!games.length) {
      sec.append(el("div", { class: "state" }, "No games yet. Add a folder for each game inside ", el("code", {}, ROOT + "/"), " with its UI screenshots."));
    } else {
      head.append(el("span", { class: "count" }, games.length + (games.length === 1 ? " game" : " games")));
      sec.append(el("div", { class: "grid" }, games.map(g =>
        el("a", { class: "card", href: "#/game/" + encodeURIComponent(g.name) },
          el("div", { class: "thumb" },
            el("span", { class: "badge" }, g.shots.length + (g.shots.length === 1 ? " screen" : " screens")),
            el("img", { src: urlOf(g.cover), alt: g.name + " UI", loading: "lazy", decoding: "async" })),
          el("div", { class: "card-body" }, el("h3", {}, g.name), el("span", { class: "go" }, "VIEW ▸")))
      )));
    }
    return sec;
  }

  function renderHome(scrollTo, keepScroll) {
    const screens = games ? games.reduce((n, g) => n + g.shots.length, 0) : null;
    const cta = [el("a", { class: "btn primary", href: "#/work" }, "View Work ▸")];
    if (C.email || (C.links || []).some(l => l && l.url)) cta.push(el("a", { class: "btn", href: "#/contact" }, "Hire Me"));
    app.replaceChildren(
      el("section", { class: "hero" },
        el("span", { class: "tag" }, "Available for projects"),
        nameTitle(C.name || "Game UI Portfolio"),
        C.role ? el("p", { class: "role" }, C.role) : null,
        C.intro ? el("p", { class: "intro" }, C.intro) : null,
        games && games.length ? el("div", { class: "stats" },
          el("div", { class: "stat" }, el("b", {}, games.length), el("span", {}, "Games")),
          el("div", { class: "stat" }, el("b", {}, screens), el("span", {}, "UI Screens"))) : null,
        el("div", { class: "cta" }, cta)),
      workSection(),
      el("section", { class: "section", id: "about" },
        el("div", { class: "section-head" }, el("h2", {}, el("small", {}, "Profile"), "About")),
        el("div", { class: "about" },
          el("div", { class: "panel" }, el("h3", {}, "What I do"), el("p", {}, C.intro || "Game UI and UX design.")),
          (C.skills || []).length ? el("div", { class: "panel" }, el("h3", {}, "Skills"), el("div", { class: "chips" }, C.skills.map(s => el("span", { class: "chip" }, s)))) : null)),
      el("section", { class: "section contact", id: "contact" },
        el("h2", {}, "Let's build your game UI"),
        el("p", {}, "Open for freelance and full-time game UI work."),
        el("div", { class: "cta" }, contactButtons().length ? contactButtons() : el("span", { class: "dim" }, "Contact details coming soon.")))
    );
    document.title = (C.name ? C.name + " | " : "") + "Game UI Portfolio";
    if (scrollTo) {
      const t = document.getElementById(scrollTo);
      if (t) requestAnimationFrame(() => t.scrollIntoView({ behavior: "instant" }));
    } else if (!keepScroll) window.scrollTo({ top: 0, behavior: "instant" });
  }

  function renderGame(name, keepScroll) {
    if (!keepScroll) window.scrollTo({ top: 0, behavior: "instant" });
    const back = el("a", { class: "back", href: "#/work" }, "◂ All work");
    if (!games && !loadError) {
      app.replaceChildren(back, el("div", { class: "game-hero" }, el("h1", {}, name)), el("div", { class: "shots" }, [1, 2, 3, 4].map(() => el("div", { class: "skeleton" }))));
      return;
    }
    const g = games && games.find(x => x.name === name);
    if (!g) {
      app.replaceChildren(back, el("div", { class: "state", style: "margin-top:24px" }, loadError ? loadError.message : "Game not found."));
      return;
    }
    document.title = g.name + " | " + (C.name || "Game UI Portfolio");
    app.replaceChildren(
      back,
      el("div", { class: "game-hero" }, el("span", { class: "tag" }, "Game UI"), el("h1", {}, g.name), el("p", {}, g.shots.length + " screens")),
      el("div", { class: "shots" }, g.shots.map((p, i) =>
        el("button", { class: "shot", type: "button", "aria-label": "Open screen " + (i + 1), onclick: () => openLightbox(g.shots, i) },
          el("span", { class: "num" }, String(i + 1).padStart(2, "0")),
          el("img", { src: urlOf(p), alt: g.name + " screen " + (i + 1), loading: "lazy", decoding: "async" }))))
    );
  }

  function render(keepScroll) {
    keepScroll = keepScroll === true;
    closeLightbox();
    const h = location.hash.replace(/^#\/?/, "");
    if (h.startsWith("game/")) {
      let name;
      try { name = decodeURIComponent(h.slice(5)); } catch (e) { name = h.slice(5); }
      renderGame(name, keepScroll);
    } else {
      renderHome(["work", "about", "contact"].includes(h) ? h : null, keepScroll);
    }
  }

  // Lightbox
  const lb = document.getElementById("lightbox");
  const lbImg = lb.querySelector("img");
  const lbCount = lb.querySelector(".lb-count");
  let lbList = [], lbIndex = 0, touchX = null;

  function showLb() {
    lbImg.src = urlOf(lbList[lbIndex]);
    lbCount.textContent = (lbIndex + 1) + " / " + lbList.length;
    lb.querySelectorAll(".lb-nav").forEach(b => { b.hidden = lbList.length < 2; });
    [lbIndex - 1, lbIndex + 1].forEach(i => { if (lbList[i]) new Image().src = urlOf(lbList[i]); });
  }
  function openLightbox(list, i) {
    lbList = list; lbIndex = i;
    showLb();
    lb.hidden = false;
    document.body.classList.add("locked");
    lb.querySelector(".lb-close").focus();
  }
  function closeLightbox() {
    if (lb.hidden) return;
    lb.hidden = true;
    lbImg.removeAttribute("src");
    document.body.classList.remove("locked");
  }
  function step(d) {
    if (lbList.length < 2) return;
    lbIndex = (lbIndex + d + lbList.length) % lbList.length;
    showLb();
  }
  lb.querySelector(".lb-close").addEventListener("click", closeLightbox);
  lb.querySelector(".lb-prev").addEventListener("click", e => { e.stopPropagation(); step(-1); });
  lb.querySelector(".lb-next").addEventListener("click", e => { e.stopPropagation(); step(1); });
  lb.addEventListener("click", e => { if (e.target === lb) closeLightbox(); });
  lb.addEventListener("touchstart", e => { touchX = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener("touchend", e => {
    if (touchX == null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    touchX = null;
    if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
  });
  document.addEventListener("keydown", e => {
    if (lb.hidden) return;
    if (e.key === "Escape") closeLightbox();
    else if (e.key === "ArrowRight") step(1);
    else if (e.key === "ArrowLeft") step(-1);
  });

  document.getElementById("logo-name").textContent = C.name || "Portfolio";
  document.getElementById("footer-name").textContent = "© " + new Date().getFullYear() + " " + (C.name || "");
  window.addEventListener("hashchange", () => render());
  document.addEventListener("click", e => {
    const a = e.target.closest && e.target.closest("a[href^='#']");
    if (a && a.getAttribute("href") === (location.hash || "#/")) { e.preventDefault(); render(); }
  });
  render();
  load();
})();
