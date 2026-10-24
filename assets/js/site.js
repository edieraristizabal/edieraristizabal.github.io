/* Edier Aristizábal — sitio personal.
   Idioma (EN/ES), tema claro/oscuro, menú móvil y render de los datos en data/*.json. */
(function () {
  const root = document.documentElement;
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ } },
  };

  // ---------- Idioma ----------
  const urlLang = new URLSearchParams(location.search).get("lang");
  let lang = urlLang || store.get("lang") || ((navigator.language || "en").toLowerCase().startsWith("es") ? "es" : "en");
  if (lang !== "es") lang = "en";
  const tr = (o) => (o && typeof o === "object" ? (o[lang] || o.en || o.es || "") : (o || ""));

  function setLang(l) {
    lang = l;
    root.dataset.lang = l;
    root.lang = l;
    store.set("lang", l);
    document.querySelectorAll("[data-lang-toggle]").forEach((b) => {
      b.textContent = l === "en" ? "ES" : "EN";
      b.setAttribute("aria-label", l === "en" ? "Ver en español" : "View in English");
    });
    document.querySelectorAll("option[data-en]").forEach((o) => { o.textContent = o.dataset[l]; });
    document.querySelectorAll("[data-ph-en]").forEach((el) => { el.placeholder = el.dataset["ph" + (l === "en" ? "En" : "Es")]; });
    document.querySelectorAll("[data-title-en]").forEach((el) => { document.title = el.dataset["title" + (l === "en" ? "En" : "Es")]; });
    renderers.forEach((fn) => fn());
  }

  // ---------- Tema ----------
  const savedTheme = store.get("theme");
  if (savedTheme) root.dataset.theme = savedTheme;
  function toggleTheme() {
    const dark = root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    root.dataset.theme = dark ? "light" : "dark";
    store.set("theme", root.dataset.theme);
  }

  // ---------- Utilidades ----------
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fold = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const cache = {};
  const getJSON = (url) => (cache[url] = cache[url] || fetch(url, { cache: "no-cache" }).then((r) => r.json()));
  const renderers = [];
  const fmt = (n) => Number(n).toLocaleString(lang === "es" ? "es-CO" : "en-US");

  function markMe(authors) {
    return esc(authors).replace(/((?:E|EV|EVA|É|Edier)\.?\s*(?:V\.?\s*)?Aristiz[aá]bal(?:[- ]Giraldo)?|E\s*ARISTIZ[AÁ]BAL|Aristiz[aá]bal\s+E(?:V)?\b|EVA Giraldo|EV Aristizábal Giraldo)/gi, '<span class="me">$1</span>');
  }

  const TYPE = {
    article: { en: "Journal article", es: "Artículo" },
    conference: { en: "Conference", es: "Congreso" },
    preprint: { en: "Preprint", es: "Preprint" },
    thesis: { en: "Thesis", es: "Tesis" },
  };

  function pubItem(p, opts) {
    const link = p.doi ? "https://doi.org/" + p.doi : p.scholar;
    const meta = [];
    meta.push(`<span class="chip ${p.type === "article" ? "" : "plain"}">${esc(tr(TYPE[p.type]))}</span>`);
    if (p.citations) meta.push(`<span class="chip plain">${fmt(p.citations)} ${lang === "es" ? "citas" : "citations"}</span>`);
    if (p.doi) meta.push(`<a href="https://doi.org/${esc(p.doi)}" target="_blank" rel="noopener">DOI</a>`);
    if (p.oa_url) meta.push(`<a href="${esc(p.oa_url)}" target="_blank" rel="noopener">${lang === "es" ? "Acceso abierto" : "Open access"}</a>`);
    meta.push(`<a href="${esc(p.scholar)}" target="_blank" rel="noopener">Scholar</a>`);
    const alt = p.alt_titles && p.alt_titles.length && !opts.compact
      ? `<div class="alt">${lang === "es" ? "También publicado como" : "Also published as"}: ${p.alt_titles.map(esc).join(" · ")}</div>` : "";
    return `<li class="pub${opts.hideYear ? " no-yr" : ""}">${opts.hideYear ? "" : `<div class="yr">${p.year}</div>`}<div>
      <a class="t" href="${esc(link)}" target="_blank" rel="noopener">${esc(p.title)}</a>
      <div class="a">${markMe(p.authors)}</div>
      <div class="v">${esc(p.venue)}</div>${alt}
      <div class="meta">${meta.join("")}</div></div></li>`;
  }

  // ---------- Portada ----------
  function renderHome() {
    const statsEl = document.getElementById("stats");
    const recentEl = document.getElementById("recent-pubs");
    if (!statsEl && !recentEl) return;
    getJSON("data/publications.json").then((d) => {
      if (statsEl) {
        const s = d.profile;
        const items = [
          [d.counts.article, { en: "Journal articles", es: "Artículos en revistas" }],
          [s.citations, { en: "Citations", es: "Citas" }],
          [s.h_index, { en: "h-index", es: "Índice h" }],
          [s.i10_index, { en: "i10-index", es: "Índice i10" }],
        ];
        statsEl.innerHTML = items.map(([n, l]) => `<div class="stat"><b>${fmt(n)}</b><span>${esc(tr(l))}</span></div>`).join("");
        const note = document.getElementById("stats-note");
        if (note) note.textContent = (lang === "es" ? "Fuente: Google Scholar, actualizado el " : "Source: Google Scholar, updated ") + d.updated;
      }
      if (recentEl) {
        const recent = d.publications.filter((p) => p.type === "article").slice(0, 6);
        recentEl.innerHTML = recent.map((p) => pubItem(p, { compact: true })).join("");
      }
    });
  }

  // ---------- Publicaciones ----------
  const pubState = { q: "", type: "all", sort: "year" };
  function renderPubs() {
    const list = document.getElementById("pub-list");
    if (!list) return;
    getJSON("data/publications.json").then((d) => {
      const q = fold(pubState.q);
      let items = d.publications.filter((p) => (pubState.type === "all" || p.type === pubState.type)
        && (!q || fold([p.title, p.authors, p.venue, p.year, (p.alt_titles || []).join(" ")].join(" ")).includes(q)));
      if (pubState.sort === "cites") items = items.slice().sort((a, b) => b.citations - a.citations);
      document.getElementById("pub-count").textContent = `${items.length} ${lang === "es" ? "publicaciones" : "publications"}`;
      if (pubState.sort === "year") {
        let html = "", y = null;
        items.forEach((p) => {
          if (p.year !== y) { if (y !== null) html += "</ul>"; y = p.year; html += `<h3 class="year-head">${y}</h3><ul class="pub-list">`; }
          html += pubItem(p, { hideYear: true });
        });
        list.innerHTML = html + (items.length ? "</ul>" : "");
      } else {
        list.innerHTML = `<ul class="pub-list">${items.map((p) => pubItem(p, {})).join("")}</ul>`;
      }
      if (!items.length) list.innerHTML = `<p class="muted">${lang === "es" ? "No hay resultados." : "No results."}</p>`;

      const s = d.profile;
      const sum = document.getElementById("pub-summary");
      if (sum) {
        sum.innerHTML = lang === "es"
          ? `${fmt(d.counts.article)} artículos en revistas, ${fmt(d.counts.conference || 0)} trabajos en congresos · ${fmt(s.citations)} citas · índice h ${s.h_index} · i10 ${s.i10_index}. Fuente: Google Scholar (${d.updated}).`
          : `${fmt(d.counts.article)} journal articles, ${fmt(d.counts.conference || 0)} conference contributions · ${fmt(s.citations)} citations · h-index ${s.h_index} · i10-index ${s.i10_index}. Source: Google Scholar (${d.updated}).`;
      }
      const spark = document.getElementById("pub-spark");
      if (spark && !spark.dataset.done) {
        const by = {};
        d.publications.filter((p) => p.type === "article").forEach((p) => { by[p.year] = (by[p.year] || 0) + 1; });
        const years = Object.keys(by).map(Number);
        const y0 = Math.min(...years), y1 = Math.max(...years), mx = Math.max(...Object.values(by));
        let bars = "";
        for (let y = y0; y <= y1; y++) bars += `<div style="height:${((by[y] || 0) / mx) * 100}%" title="${y}: ${by[y] || 0}"></div>`;
        spark.innerHTML = bars;
        document.getElementById("pub-spark-axis").innerHTML = `<span>${y0}</span><span>${y1}</span>`;
        spark.dataset.done = "1";
      }
    });
  }
  function bindPubControls() {
    const search = document.getElementById("pub-search");
    if (!search) return;
    search.addEventListener("input", () => { pubState.q = search.value; renderPubs(); });
    document.querySelectorAll("[data-type]").forEach((b) => b.addEventListener("click", () => {
      pubState.type = b.dataset.type;
      document.querySelectorAll("[data-type]").forEach((x) => x.setAttribute("aria-pressed", x === b));
      renderPubs();
    }));
    document.getElementById("pub-sort").addEventListener("change", (e) => { pubState.sort = e.target.value; renderPubs(); });
  }

  // ---------- Cursos ----------
  const LINK = { site: { en: "Course site", es: "Página del curso" }, book: { en: "Book", es: "Libro" }, slides: { en: "Slides", es: "Diapositivas" }, repo: { en: "GitHub", es: "GitHub" } };
  function courseCard(c) {
    const links = c.links.map((l, i) => `<a class="btn ${i === 0 ? "primary" : ""}" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(tr(LINK[l.kind]))}</a>`).join("");
    return `<article class="card"><div style="margin-bottom:8px"><span class="chip ${c.level === "grad" ? "accent" : ""}">${esc(tr(c.level === "grad" ? { en: "Graduate", es: "Posgrado" } : { en: "Undergraduate", es: "Pregrado" }))}</span></div>
      <h3>${esc(tr(c.name))}</h3><p class="muted" style="font-size:.85rem;margin-bottom:.5em">${esc(tr(c.program))}</p><p>${esc(tr(c.desc))}</p><div class="links">${links}</div></article>`;
  }
  function renderCourses() {
    const g = document.getElementById("courses-grad"), u = document.getElementById("courses-undergrad"), r = document.getElementById("resources"), h = document.getElementById("courses-home");
    if (!g && !u && !h) return;
    getJSON("data/courses.json").then((d) => {
      if (u) u.innerHTML = d.courses.filter((c) => c.level === "undergrad").map(courseCard).join("");
      if (g) g.innerHTML = d.courses.filter((c) => c.level === "grad").map(courseCard).join("");
      if (r) r.innerHTML = d.resources.map((x) => `<article class="card"><h3>${esc(tr(x.name))}</h3><p>${esc(tr(x.desc))}</p><div class="links"><a class="btn" href="${esc(x.url)}" target="_blank" rel="noopener">${lang === "es" ? "Abrir" : "Open"}</a></div></article>`).join("");
      if (h) h.innerHTML = d.courses.map((c) => `<a class="btn" href="${esc(c.links[0].url)}" target="_blank" rel="noopener">${esc(tr(c.name))}</a>`).join("");
    });
  }

  // ---------- Proyectos ----------
  const STATUS = { ongoing: { en: "Ongoing", es: "En curso" }, completed: { en: "Completed", es: "Finalizado" }, proposal: { en: "Proposal", es: "Propuesta" } };
  function renderProjects() {
    const el = document.getElementById("projects"), h = document.getElementById("projects-home");
    if (!el && !h) return;
    getJSON("data/projects.json").then((d) => {
      if (el) el.innerHTML = d.projects.map((p) => `<article class="project" id="${esc(p.id)}">
        <div class="side"><b>${esc(p.acronym)}</b>${p.years ? esc(p.years) + "<br>" : ""}<span class="chip ${p.status === "ongoing" ? "" : p.status === "proposal" ? "accent" : "plain"}">${esc(tr(STATUS[p.status]))}</span></div>
        <div><h3>${esc(tr(p.title))}</h3><p class="muted" style="font-size:.9rem">${esc(p.funder)} · ${esc(tr(p.role))}</p><p>${esc(tr(p.desc))}</p>
        <div class="links" style="display:flex;gap:8px;flex-wrap:wrap">${p.links.map((l) => `<a class="btn" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)}</a>`).join("")}</div></div></article>`).join("");
      if (h) h.innerHTML = d.projects.filter((p) => p.status !== "proposal").slice(0, 3).map((p) => `<article class="card">
        <div style="margin-bottom:8px"><span class="chip ${p.status === "ongoing" ? "" : "plain"}">${esc(tr(STATUS[p.status]))}</span></div>
        <h3>${esc(p.acronym)}</h3><p>${esc(tr(p.title))}</p><p class="muted" style="font-size:.85rem">${esc(p.funder)}</p>
        <div class="links"><a class="btn" href="projects.html#${esc(p.id)}">${lang === "es" ? "Más" : "More"}</a></div></article>`).join("");
    });
  }

  renderers.push(renderHome, renderPubs, renderCourses, renderProjects);

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-lang-toggle]").forEach((b) => b.addEventListener("click", () => setLang(lang === "en" ? "es" : "en")));
    document.querySelectorAll("[data-theme-toggle]").forEach((b) => b.addEventListener("click", toggleTheme));
    const nav = document.querySelector(".nav");
    document.querySelectorAll(".menu-toggle").forEach((b) => b.addEventListener("click", () => {
      nav.classList.toggle("open");
      b.setAttribute("aria-expanded", nav.classList.contains("open"));
    }));
    const y = document.getElementById("year");
    if (y) y.textContent = new Date().getFullYear();
    bindPubControls();
    setLang(lang);
  });
  root.dataset.lang = lang;
})();
