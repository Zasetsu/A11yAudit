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

  /* ============================================================
     AUDERA ASSIST — live demo
     ============================================================ */
  var sample = document.getElementById("assistSample");
  if (sample) {
    var heading = document.getElementById("sampleHeading");
    var paras = sample.querySelectorAll("p");
    var links = sample.querySelectorAll("a");
    var media = sample.querySelector(".media");
    var stage = sample.closest(".demo-stage");
    var maskTop = document.getElementById("maskTop");
    var maskBottom = document.getElementById("maskBottom");
    var guide = document.getElementById("readGuide");

    // store originals for bionic restore
    paras.forEach(function (p) { p.dataset.orig = p.innerHTML; });

    var STEPS = {
      fontSize:      { base: 100, step: 10,   min: 80,  max: 170, unit: "%",  dec: 0 },
      lineHeight:    { base: 1.7, step: 0.15, min: 1.3, max: 2.6, unit: "",   dec: 2 },
      letterSpacing: { base: 0,   step: 0.5,  min: 0,   max: 4,   unit: "px", dec: 1 }
    };
    var defaults = function () {
      return {
        fontSize: 100, lineHeight: 1.7, letterSpacing: 0,
        dyslexia: false, bionic: false, contrast: false, grayscale: false, lowsat: false,
        links: false, cursor: false, mask: false, guide: false, stopmotion: false, hideimg: false
      };
    };
    var state = defaults();

    var BIG_CURSOR = "url(\"data:image/svg+xml;utf8," + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><path d="M6 4 L6 32 L13 25 L18 36 L23 34 L18 23 L28 23 Z" fill="black" stroke="white" stroke-width="2" stroke-linejoin="round"/></svg>'
    ) + "\") 4 2, auto";

    function bionicify() {
      paras.forEach(function (p) {
        var html = p.dataset.orig;
        // split on tags so we don't touch <a>…</a> markup
        var parts = html.split(/(<[^>]+>)/);
        var out = parts.map(function (seg) {
          if (seg.charAt(0) === "<") return seg;
          return seg.replace(/([A-Za-zÇĞİÖŞÜçğıöşü0-9]+)/g, function (w) {
            var n = Math.max(1, Math.ceil(w.length * 0.42));
            return "<b style='font-weight:700'>" + w.slice(0, n) + "</b>" + w.slice(n);
          });
        }).join("");
        p.innerHTML = out;
      });
    }
    function unbionic() { paras.forEach(function (p) { p.innerHTML = p.dataset.orig; }); }

    function apply() {
      var m = state.fontSize / 100;
      heading.style.fontSize = (26 * m) + "px";
      paras.forEach(function (p) {
        p.style.fontSize = (15 * m) + "px";
        p.style.lineHeight = state.lineHeight;
        p.style.letterSpacing = state.letterSpacing + "px";
      });
      heading.style.letterSpacing = (state.letterSpacing - 0.5) + "px";

      // font family (dyslexia-friendly stack)
      sample.style.fontFamily = state.dyslexia
        ? "'Verdana','Trebuchet MS','Comic Sans MS',sans-serif"
        : "";
      if (state.dyslexia) { sample.style.wordSpacing = "0.12em"; }
      else { sample.style.wordSpacing = ""; }

      // bionic
      if (state.bionic) bionicify(); else unbionic();

      // filters
      var f = [];
      if (state.grayscale) f.push("grayscale(1)");
      if (state.lowsat && !state.grayscale) f.push("saturate(0.45)");
      if (state.contrast) f.push("contrast(1.18)");
      sample.style.filter = f.join(" ");

      // contrast text/bg
      if (state.contrast) {
        sample.style.background = "#fffef9";
        sample.style.color = "#000";
        heading.style.color = "#000";
        paras.forEach(function (p) { p.style.color = "#111"; });
      } else {
        sample.style.background = "";
        sample.style.color = "";
        heading.style.color = "";
        paras.forEach(function (p) { p.style.color = ""; });
      }

      // links highlight
      links.forEach(function (a) {
        if (state.links) {
          a.style.background = "#fff3c4";
          a.style.boxShadow = "0 0 0 2px #f0c000";
          a.style.borderRadius = "3px";
          a.style.fontWeight = "700";
          a.style.textDecorationThickness = "2px";
        } else {
          a.style.background = ""; a.style.boxShadow = ""; a.style.borderRadius = ""; a.style.fontWeight = ""; a.style.textDecorationThickness = "";
        }
      });

      // big cursor
      sample.style.cursor = state.cursor ? BIG_CURSOR : "";

      // stop motion
      if (media) media.style.animationPlayState = state.stopmotion ? "paused" : "";

      // hide images
      if (media) media.style.visibility = state.hideimg ? "hidden" : "";

      // reading aids
      guide.style.display = state.guide ? "block" : "none";
      if (!state.mask) { maskTop.style.height = "0"; maskBottom.style.height = "0"; }
    }

    // mouse tracking for mask + guide
    function onMove(e) {
      if (!state.mask && !state.guide) return;
      var rect = stage.getBoundingClientRect();
      var y = e.clientY - rect.top;
      y = Math.max(50, Math.min(rect.height - 6, y));
      if (state.guide) { guide.style.top = (y - 17) + "px"; }
      if (state.mask) {
        var slit = 64;
        maskTop.style.top = "42px";
        maskTop.style.height = Math.max(0, y - slit / 2 - 42) + "px";
        maskBottom.style.height = Math.max(0, rect.height - (y + slit / 2)) + "px";
      }
    }
    stage.addEventListener("mousemove", onMove);

    // toggle buttons
    document.querySelectorAll(".ap-row [data-toggle]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var key = btn.dataset.toggle;
        state[key] = !state[key];
        btn.classList.toggle("on", state[key]);
        btn.setAttribute("aria-checked", state[key] ? "true" : "false");
        if (key === "mask" && !state.mask) { maskTop.style.height = "0"; maskBottom.style.height = "0"; }
        apply();
      });
    });

    // steppers
    document.querySelectorAll(".step-ctrl[data-step]").forEach(function (ctrl) {
      var key = ctrl.dataset.step;
      var cfg = STEPS[key];
      var valEl = ctrl.querySelector(".val");
      function render() {
        var v = state[key];
        valEl.textContent = (cfg.dec ? v.toFixed(cfg.dec) : Math.round(v)) + cfg.unit;
      }
      ctrl.querySelectorAll("button").forEach(function (b) {
        b.addEventListener("click", function () {
          var dir = parseInt(b.dataset.dir, 10);
          var v = Math.round((state[key] + dir * cfg.step) * 100) / 100;
          v = Math.max(cfg.min, Math.min(cfg.max, v));
          state[key] = v; render(); apply();
        });
      });
      render();
      ctrl._render = render;
    });

    // reset
    document.getElementById("assistReset").addEventListener("click", function () {
      state = defaults();
      document.querySelectorAll(".ap-row [data-toggle]").forEach(function (btn) {
        btn.classList.remove("on"); btn.setAttribute("aria-checked", "false");
      });
      document.querySelectorAll(".step-ctrl[data-step]").forEach(function (ctrl) { if (ctrl._render) ctrl._render(); });
      maskTop.style.height = "0"; maskBottom.style.height = "0";
      apply();
    });

    apply();
  }
})();
