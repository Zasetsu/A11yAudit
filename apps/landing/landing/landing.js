/* ============================================================
   AUDERA — Landing interactions
   ============================================================ */
(function () {
  "use strict";

  /* ---------- console mockup builder ---------- */
  function ringSVG(score, size) {
    var r = (size - 9) / 2, c = 2 * Math.PI * r, off = c * (1 - score / 100);
    var color = score >= 85 ? "#2f7c4d" : score >= 70 ? "#a37d10" : score >= 50 ? "#bf5e16" : "#be3525";
    var grade = score >= 90 ? "A" : score >= 80 ? "B" : score >= 70 ? "C" : score >= 60 ? "D" : "E";
    return '<div style="position:relative;width:' + size + 'px;height:' + size + 'px;flex:none">' +
      '<svg width="' + size + '" height="' + size + '" style="transform:rotate(-90deg)">' +
      '<circle cx="' + size/2 + '" cy="' + size/2 + '" r="' + r + '" fill="none" stroke="#efebe4" stroke-width="9"/>' +
      '<circle cx="' + size/2 + '" cy="' + size/2 + '" r="' + r + '" fill="none" stroke="' + color + '" stroke-width="9" stroke-linecap="round" stroke-dasharray="' + c + '" stroke-dashoffset="' + off + '"/>' +
      '</svg>' +
      '<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center">' +
      '<span style="font-size:' + (size*0.3) + 'px;font-weight:600;letter-spacing:-0.03em;line-height:1;color:#1d1b18">' + score + '</span>' +
      '<span style="font-size:9px;color:#8b867d;font-weight:600;margin-top:2px">NOT ' + grade + '</span></div></div>';
  }

  var navItems = [
    { l: "Genel Bakış", on: true }, { l: "Projeler" }, { l: "Yeni Tarama" },
    { l: "Bulgular" }, { l: "Raporlar" }
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

    var body =
      '<div class="c-body">' +
      '<div class="c-ptitle">Örnek Belediye Portalı</div>' +
      '<div class="c-pdom">ornekbelediye.gov.tr · skor 74 · 248 sayfa</div>' +
      '<div class="c-cards">' +
        '<div class="c-card c-ring-wrap">' + ringSVG(74, 84) + '</div>' +
        '<div class="c-stats">' +
          '<div class="c-st"><div class="l">Toplam bulgu</div><div class="v">613</div></div>' +
          '<div class="c-st"><div class="l">Kritik</div><div class="v crit">42</div></div>' +
          '<div class="c-st"><div class="l">Yeni</div><div class="v">58</div></div>' +
        '</div>' +
      '</div>' +
      '<div class="c-meter"><i style="width:7%;background:#be3525"></i><i style="width:31%;background:#bf5e16"></i><i style="width:47%;background:#a37d10"></i><i style="width:15%;background:#566f8c"></i></div>' +
      '<div class="c-legend">' +
        '<span class="c-lg"><span class="sq" style="background:#be3525"></span>Kritik 42</span>' +
        '<span class="c-lg"><span class="sq" style="background:#bf5e16"></span>Ciddi 189</span>' +
        '<span class="c-lg"><span class="sq" style="background:#a37d10"></span>Orta 291</span>' +
        '<span class="c-lg"><span class="sq" style="background:#566f8c"></span>Küçük 91</span>' +
      '</div>';

    if (full) {
      body +=
        '<div class="c-table">' +
        '<div class="c-tr h"><span>En çok tekrar eden sorun</span><span>WCAG</span><span>Örnek</span></div>' +
        '<div class="c-tr"><span class="c-sev"><span class="sq" style="background:#bf5e16"></span>Yetersiz metin kontrastı</span><span class="mono">1.4.3</span><span>214</span></div>' +
        '<div class="c-tr"><span class="c-sev"><span class="sq" style="background:#be3525"></span>Form alanı etiketsiz</span><span class="mono">1.3.1</span><span>118</span></div>' +
        '<div class="c-tr"><span class="c-sev"><span class="sq" style="background:#be3525"></span>Simge butonun erişilebilir adı yok</span><span class="mono">4.1.2</span><span>73</span></div>' +
        '</div>';
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
