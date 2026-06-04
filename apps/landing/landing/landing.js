/* ============================================================
   AUDERA — Landing interactions
   ============================================================ */
(function () {
  "use strict";

  /* ---------- console mockup builder ----------
     Static, inert replica of the Audera dashboard Overview page.
     No live data — mirrors apps/web/src/pages/overview.tsx visually. */

  // Severity palette mirrors the web app overview severity colors.
  var SEV = { critical: "#c0392b", serious: "#e67e22", moderate: "#d4a017", minor: "#7f8c8d" };

  function ringSVG(score, size) {
    var r = (size - 9) / 2, c = 2 * Math.PI * r, off = c * (1 - score / 100);
    // Score band: amber for the "needs improvement" range (>=70), green high, red low.
    var color = score >= 85 ? "#2f7c4d" : score >= 70 ? "#c97a00" : score >= 50 ? "#bf5e16" : "#c0392b";
    return '<div class="c-ring" style="width:' + size + 'px;height:' + size + 'px">' +
      '<svg width="' + size + '" height="' + size + '" style="transform:rotate(-90deg)">' +
      '<circle cx="' + size/2 + '" cy="' + size/2 + '" r="' + r + '" fill="none" stroke="#efebe4" stroke-width="9"/>' +
      '<circle cx="' + size/2 + '" cy="' + size/2 + '" r="' + r + '" fill="none" stroke="' + color + '" stroke-width="9" stroke-linecap="round" stroke-dasharray="' + c + '" stroke-dashoffset="' + off + '"/>' +
      '</svg>' +
      '<div class="c-ring-c">' +
      '<span class="c-ring-n" style="font-size:' + (size*0.3) + 'px">' + score + '</span>' +
      '<span class="c-ring-max">/100</span></div></div>';
  }

  var navItems = [
    { l: "Genel Bakış", on: true }, { l: "Projeler" }, { l: "Yeni Tarama" },
    { l: "Bulgular" }, { l: "Raporlar" }
  ];

  var severityRows = [
    { l: "Kritik", n: 8, k: "critical" },
    { l: "Ciddi", n: 14, k: "serious" },
    { l: "Orta", n: 9, k: "moderate" },
    { l: "Düşük", n: 5, k: "minor" }
  ];

  var statCards = [
    { l: "Benzersiz sorun", v: 36 },
    { l: "Etkilenen sayfa", v: 11 },
    { l: "Tekrar", v: 248 },
    { l: "Kritik", v: 8, crit: true }
  ];

  var recentRuns = [
    { id: "run-7f3a", st: "Tamamlandı", on: "done", date: "3 Haz 2026", occ: 248 },
    { id: "run-6b1c", st: "Tamamlandı", on: "done", date: "27 May 2026", occ: 271 },
    { id: "run-5d09", st: "Denetleniyor", on: "running", date: "20 May 2026", occ: 263 }
  ];

  function buildConsole(el, full) {
    var nav = navItems.map(function (n) {
      return '<div class="it' + (n.on ? " on" : "") + '"><span class="d"></span>' + n.l + '</div>';
    }).join("");

    var sidebar =
      '<div class="c-sb"><div class="c-brand">' +
      '<svg width="24" height="24" viewBox="0 0 64 64" fill="none"><rect width="64" height="64" rx="16" fill="#232020"/><path d="M16 41 L32 19 L48 41" fill="none" stroke="#FAF8F5" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><path d="M22.5 45.5 L32 32 L41.5 45.5" fill="none" stroke="#6F9BF0" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
      '<div class="nm">Audera<small>WCAG 2.2 KONSOL</small></div></div>' +
      '<div class="c-nav">' + nav + '</div></div>';

    var top =
      '<div class="c-top">' +
      '<div class="c-chip"><span class="pl">Ö</span>Örnek Belediye Portalı</div>' +
      '<div class="c-newbtn"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#faf8f5" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>Yeni Tarama</div>' +
      '<div class="c-search">Bulgu, URL veya WCAG kriteri ara…</div></div>';

    var stats = statCards.map(function (s) {
      return '<div class="c-st"><div class="l">' + s.l + '</div><div class="v' + (s.crit ? " crit" : "") + '">' + s.v + '</div></div>';
    }).join("");

    var scoreCard =
      '<div class="c-card c-score">' + ringSVG(73, 92) +
      '<div class="c-score-meta">' +
      '<div class="l">Erişilebilirlik skoru</div>' +
      '<div class="c-band">Geliştirilmeli</div>' +
      '<div class="c-score-sub">Otomatik denetlenebilir kriterlere dayalı teknik skor.</div>' +
      '</div></div>';

    var severityCard =
      '<div class="c-card c-sevcard">' +
      '<div class="c-cap">Önem dağılımı</div>' +
      '<div class="c-meter">' +
      severityRows.map(function (r, i) {
        var w = [16, 28, 18, 10][i];
        return '<i style="width:' + w + '%;background:' + SEV[r.k] + '"></i>';
      }).join("") +
      '</div>' +
      '<div class="c-sevrows">' +
      severityRows.map(function (r) {
        return '<span class="c-sev-pill"><span class="dot" style="background:' + SEV[r.k] + '"></span>' + r.l + ' <b>' + r.n + '</b></span>';
      }).join("") +
      '</div></div>';

    var body =
      '<div class="c-body">' +
      '<div class="c-ptitle">Örnek Belediye Portalı</div>' +
      '<div class="c-pdom">ornekbelediye.gov.tr · son tarama 3 Haz 2026</div>' +
      '<div class="c-cards">' + scoreCard + '<div class="c-stats">' + stats + '</div></div>' +
      severityCard;

    if (full) {
      body +=
        '<div class="c-runs">' +
        '<div class="c-cap">Son taramalar</div>' +
        '<div class="c-table">' +
        '<div class="c-tr h"><span>Tarama</span><span>Durum</span><span>Tarih</span><span class="num">Tekrar</span></div>' +
        recentRuns.map(function (r) {
          return '<div class="c-tr">' +
            '<span class="mono">' + r.id + '</span>' +
            '<span><span class="c-badge ' + r.on + '">' + r.st + '</span></span>' +
            '<span class="c-date">' + r.date + '</span>' +
            '<span class="num mono">' + r.occ + '</span></div>';
        }).join("") +
        '</div></div>';
    }
    body += '</div>';

    el.innerHTML = sidebar + '<div class="c-main">' + top + body + '</div>';
  }

  document.querySelectorAll(".console").forEach(function (el) {
    buildConsole(el, el.dataset.full === "true");
  });

  /* ---------- theme toggle ---------- */
  var themeBtn = document.getElementById("themeBtn");
  if (themeBtn) {
    themeBtn.addEventListener("click", function () {
      var light = document.documentElement.classList.toggle("theme-light");
      try { localStorage.setItem("audera-theme", light ? "light" : "dark"); } catch (e) {}
    });
  }

  /* ---------- nav scroll + mobile menu ---------- */
  var nav = document.getElementById("nav");
  var onScroll = function () { nav.classList.toggle("scrolled", window.scrollY > 12); };
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  var navToggle = document.getElementById("navToggle");
  var mobileMenu = document.getElementById("mobileMenu");
  navToggle.addEventListener("click", function () {
    var open = mobileMenu.classList.toggle("open");
    navToggle.setAttribute("aria-expanded", open ? "true" : "false");
  });
  mobileMenu.querySelectorAll("a").forEach(function (a) {
    a.addEventListener("click", function () { mobileMenu.classList.remove("open"); navToggle.setAttribute("aria-expanded", "false"); });
  });

  /* ---------- FAQ accordion ---------- */
  document.querySelectorAll(".faq-item").forEach(function (item) {
    var q = item.querySelector(".faq-q");
    var a = item.querySelector(".faq-a");
    q.addEventListener("click", function () {
      var open = item.classList.contains("open");
      document.querySelectorAll(".faq-item").forEach(function (other) {
        other.classList.remove("open");
        other.querySelector(".faq-a").style.maxHeight = null;
      });
      if (!open) { item.classList.add("open"); a.style.maxHeight = a.scrollHeight + "px"; }
    });
  });

  /* ---------- contact form ---------- */
  var form = document.getElementById("contactForm");
  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var req = form.querySelectorAll("[required]");
      var ok = true;
      req.forEach(function (f) { if (!f.value.trim() || (f.type === "email" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.value))) { ok = false; f.style.borderColor = "rgba(239,114,100,.7)"; } });
      if (!ok) return;
      document.getElementById("formFields").style.display = "none";
      document.getElementById("formSuccess").classList.add("show");
    });
    form.querySelectorAll("input,textarea").forEach(function (f) {
      f.addEventListener("input", function () { f.style.borderColor = ""; });
    });
  }

  /* ---------- scroll reveal ---------- */
  var revealEls = document.querySelectorAll(".reveal");
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } });
  }, { threshold: 0.08, rootMargin: "0px 0px -30px 0px" });
  revealEls.forEach(function (el) { io.observe(el); });
  // fallback: ensure everything becomes visible even if IO never fires (e.g. offscreen render)
  setTimeout(function () { revealEls.forEach(function (el) { el.classList.add("in"); }); }, 1400);
})();
