(function () {
  "use strict";

  var data = window.__BRAND__ || {};
  var reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var fineHover = matchMedia("(hover: hover) and (pointer: fine)").matches;

  function $(sel, scope) { return (scope || document).querySelector(sel); }
  function $$(sel, scope) { return Array.prototype.slice.call((scope || document).querySelectorAll(sel)); }
  function escHTML(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function safe(fn, name) {
    try { fn(); } catch (e) { console.warn("[" + name + "]", e); }
  }

  /* ---------------------------------------------------------
     Señal de intro: la precarga la emite al retirarse y la portada
     entra a partir de ahí. Sin precarga (otras páginas) arranca ya.
     --------------------------------------------------------- */
  var introFired = false;
  function fireIntro() {
    if (introFired) return;
    introFired = true;
    document.dispatchEvent(new CustomEvent("brisa:intro"));
  }
  var pageEnter = document.documentElement.classList.contains("page-enter");
  function onIntro(fn) {
    var done = false;
    var run = function () { if (done) return; done = true; fn(); };
    if (introFired) { run(); return; }
    if (!$("[data-splash]")) { setTimeout(run, pageEnter && !reduced ? 520 : 0); return; }
    document.addEventListener("brisa:intro", run);
    setTimeout(run, 4300);
  }

  /* ---------------------------------------------------------
     Precarga: contador 000→100 ligado a la carga real, y cortinilla.
     La animación CSS de seguridad la retira aunque este código falle.
     --------------------------------------------------------- */
  function initSplash() {
    var splash = $("[data-splash]");
    if (!splash) return;
    var count = $("[data-splash-count]", splash);
    var bar = $("[data-splash-bar]", splash);
    var minDur = reduced ? 400 : 900;
    var loaded = document.readyState === "complete";
    var start = null;
    var gone = false;

    // La presentación es para la primera visita. Al volver o al pasar a otra
    // página de la web, entrar de nuevo por una cuenta atrás sería un peaje.
    var seen = false;
    try { seen = sessionStorage.getItem("brisa:intro") === "1"; } catch (err) {}
    if (seen || pageEnter) {
      splash.style.display = "none";
      try { sessionStorage.setItem("brisa:intro", "1"); } catch (err) {}
      // Si se llega por la cortinilla, la portada entra cuando ésta se levanta
      if (pageEnter && !reduced) setTimeout(fireIntro, 520);
      else fireIntro();
      return;
    }
    try { sessionStorage.setItem("brisa:intro", "1"); } catch (err) {}

    window.addEventListener("load", function () { loaded = true; });

    function hide() {
      if (gone) return;
      gone = true;
      splash.classList.add("is-out");
      fireIntro();
      setTimeout(function () { splash.style.display = "none"; }, 1500);
    }

    function frame(t) {
      if (gone) return;
      if (start === null) start = t;
      var p = Math.min((t - start) / minDur, loaded ? 1 : 0.9);
      var eased = 1 - Math.pow(1 - p, 3);
      if (count) count.textContent = String(Math.round(eased * 100)).padStart(3, "0");
      if (bar) bar.style.transform = "scaleX(" + eased.toFixed(3) + ")";
      if (p >= 1) { setTimeout(hide, reduced ? 60 : 260); return; }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    setTimeout(hide, 3800);
  }

  /* ---------------------------------------------------------
     Nav: sólida al bajar, se esconde al bajar y vuelve al subir,
     barra de progreso de lectura y menú móvil.
     --------------------------------------------------------- */
  function initNav() {
    var nav = $("[data-nav]");
    var burger = $("[data-burger]");
    var menu = $("[data-mobile-menu]");
    var bar = $("[data-scroll-progress]");

    if (nav) {
      var lastY = window.scrollY;
      var ticking = false;
      var update = function () {
        ticking = false;
        var y = window.scrollY;
        var dy = y - lastY;
        nav.classList.toggle("is-scrolled", y > 70);
        var menuOpen = burger && burger.getAttribute("aria-expanded") === "true";
        if (y > 480 && dy > 4 && !menuOpen) nav.classList.add("is-hidden");
        else if (dy < -4 || y <= 480) nav.classList.remove("is-hidden");
        lastY = y;
        if (bar) {
          var max = document.documentElement.scrollHeight - window.innerHeight;
          bar.style.transform = "scaleX(" + (max > 0 ? Math.min(y / max, 1) : 0).toFixed(4) + ")";
        }
      };
      update();
      window.addEventListener("scroll", function () {
        if (!ticking) { ticking = true; requestAnimationFrame(update); }
      }, { passive: true });
      nav.addEventListener("focusin", function () { nav.classList.remove("is-hidden"); });
    }

    if (!burger || !menu) return;

    var setOpen = function (open) {
      burger.setAttribute("aria-expanded", open ? "true" : "false");
      burger.setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú");
      menu.setAttribute("aria-hidden", open ? "false" : "true");
      document.body.style.overflow = open ? "hidden" : "";
      if (open && nav) nav.classList.remove("is-hidden");
    };

    burger.addEventListener("click", function () {
      setOpen(burger.getAttribute("aria-expanded") !== "true");
    });
    $$("a", menu).forEach(function (a) {
      a.addEventListener("click", function () { setOpen(false); });
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && burger.getAttribute("aria-expanded") === "true") setOpen(false);
    });
  }

  /* ---------------------------------------------------------
     Anchors — native smooth scroll with nav offset
     --------------------------------------------------------- */
  function initSmoothAnchors() {
    document.addEventListener("click", function (e) {
      var a = e.target.closest ? e.target.closest('a[href^="#"]') : null;
      if (!a) return;
      var id = a.getAttribute("href");
      if (!id || id === "#") return;
      var el = document.querySelector(id);
      if (!el) return;
      e.preventDefault();
      window.scrollTo({
        top: el.getBoundingClientRect().top + window.scrollY - 74,
        behavior: reduced ? "auto" : "smooth"
      });
    });
  }

  /* ---------------------------------------------------------
     Revelado al hacer scroll. Lo que entra a la vez se escalona.
     Variantes por CSS: data-reveal (fundido), ="mask" (cortina), ="rise".
     --------------------------------------------------------- */
  function initReveals() {
    var els = $$("[data-reveal]");
    if (!els.length) return;

    if (typeof IntersectionObserver === "undefined") {
      els.forEach(function (el) { el.classList.add("is-revealed"); });
      return;
    }

    var reveal = function (el, delay) {
      // El retardo va en una variable CSS para que lo hereden también la cortina
      // (pseudo-elemento) y la imagen de dentro.
      if (delay) el.style.setProperty("--reveal-delay", delay + "s");
      el.classList.add("is-revealed");
      setTimeout(function () {
        el.style.removeProperty("--reveal-delay");
        // Al acabar se retira el atributo: si no, la transición lenta del
        // revelado seguiría pisando la del hover (tarjetas, botones, fotos).
        el.removeAttribute("data-reveal");
      }, 2400);
    };

    var io = new IntersectionObserver(function (entries) {
      var batch = 0;
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        reveal(entry.target, Math.min(batch, 6) * 0.07);
        batch++;
        io.unobserve(entry.target);
      });
    }, { threshold: 0.01, rootMargin: "0px 0px -4% 0px" });

    els.forEach(function (el) { io.observe(el); });

    // Red de seguridad: nada visible en pantalla se queda oculto
    setTimeout(function () {
      $$("[data-reveal]:not(.is-revealed)").forEach(function (el) {
        if (el.getBoundingClientRect().top < window.innerHeight) reveal(el, 0);
      });
    }, 6000);
  }

  /* ---------------------------------------------------------
     La rosa de línea fina se dibuja sola
     --------------------------------------------------------- */
  function initDrawMarks() {
    $$("[data-draw]").forEach(function (svg) {
      var paths = $$("path", svg);
      paths.forEach(function (path, i) {
        var len;
        try { len = path.getTotalLength(); } catch (err) { len = 0; }
        if (!len) return;
        path.style.strokeDasharray = len;
        path.style.strokeDashoffset = len;
        path.style.transition = "stroke-dashoffset " + (reduced ? 0.5 : 1.2) + "s cubic-bezier(0.65, 0, 0.35, 1) " +
                                (i * (reduced ? 0.04 : 0.11)) + "s";
      });

      var draw = function () {
        paths.forEach(function (path) { path.style.strokeDashoffset = "0"; });
      };

      if (svg.getAttribute("data-draw") === "intro") {
        onIntro(function () { setTimeout(draw, reduced ? 0 : 420); });
        return;
      }

      if (typeof IntersectionObserver === "undefined") { draw(); return; }
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          draw();
          io.unobserve(entry.target);
        });
      }, { threshold: 0.01 });
      io.observe(svg);
      setTimeout(draw, 6000);
    });
  }

  /* ---------------------------------------------------------
     Cursor: máquina de tatuar con la punta de la aguja en el puntero.
     Se inclina con el movimiento, vibra sobre lo que se puede pulsar,
     se hunde al hacer clic y deja un punto de tinta.
     --------------------------------------------------------- */
  function initCursor() {
    var root = $("[data-cursor-root]");
    if (!root || !fineHover) return;
    document.documentElement.classList.add("has-cursor");

    var machine = $(".cursor-machine", root);
    var ring = $(".cursor-ring", root);
    var ink = $(".cursor-ink", root);
    var label = $("[data-cursor-label]", root);
    var tx = 0, ty = 0, rx = 0, ry = 0, lastX = 0, tilt = 0, first = false;
    var maxTilt = reduced ? 6 : 16;

    window.addEventListener("mousemove", function (e) {
      tx = e.clientX; ty = e.clientY;
      // La máquina va pegada al puntero, sin retraso: la aguja marca dónde se pulsa
      if (machine) machine.style.transform = "translate3d(" + tx + "px," + ty + "px,0)";
      if (!first) {
        first = true;
        rx = tx; ry = ty; lastX = tx;
        if (ring) ring.style.transform = "translate3d(" + rx + "px," + ry + "px,0)";
      }
      root.classList.add("is-ready");
    }, { passive: true });

    (function tick() {
      rx += (tx - rx) * 0.18;
      ry += (ty - ry) * 0.18;
      if (ring) ring.style.transform = "translate3d(" + rx + "px," + ry + "px,0)";
      var vx = tx - lastX;
      lastX = tx;
      var target = Math.max(-maxTilt, Math.min(maxTilt, vx * 0.9));
      tilt += (target - tilt) * 0.12;
      root.style.setProperty("--tilt", tilt.toFixed(2) + "deg");
      requestAnimationFrame(tick);
    })();

    window.addEventListener("mousedown", function (e) {
      root.classList.add("is-pressed");
      if (!ink) return;
      ink.style.transform = "translate3d(" + e.clientX + "px," + e.clientY + "px,0)";
      ink.classList.remove("is-splash");
      void ink.offsetWidth; // reinicia la animación aunque se pulse varias veces seguidas
      ink.classList.add("is-splash");
    });
    window.addEventListener("mouseup", function () { root.classList.remove("is-pressed"); });

    var HOVERABLES = "a[href], button, .gallery-item, select, label, input[type=checkbox]";
    var TEXT = "input:not([type=checkbox]):not([type=radio]), textarea";
    var MEDIA = ".gallery-item, .about-figure";
    document.addEventListener("mouseover", function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      root.classList.toggle("is-text", !!t.closest(TEXT));
      root.classList.toggle("is-interactive", !!t.closest(HOVERABLES));
      root.classList.toggle("is-media", !!t.closest(MEDIA));
      // Etiqueta de acción ("Ver", "Siguiente"…): el halo se vuelve un disco
      var withLabel = t.closest("[data-cursor]");
      root.classList.toggle("is-label", !!withLabel);
      if (withLabel && label) label.textContent = withLabel.getAttribute("data-cursor");
    });
    document.documentElement.addEventListener("mouseleave", function () {
      root.classList.remove("is-ready", "is-interactive", "is-media", "is-label", "is-pressed");
    });
  }

  /* ---------------------------------------------------------
     Tilt 3D + cursor halo on cards
     --------------------------------------------------------- */
  function initTilt() {
    if (!fineHover) return;
    $$("[data-tilt]").forEach(function (card) {
      if (card.dataset.tiltBound) return;
      card.dataset.tiltBound = "1";

      var MAX = 6;
      var tx = 0, ty = 0, cx = 0, cy = 0, raf = null;

      var loop = function () {
        cx += (tx - cx) * 0.15;
        cy += (ty - cy) * 0.15;
        card.style.setProperty("--rx", cx.toFixed(2) + "deg");
        card.style.setProperty("--ry", cy.toFixed(2) + "deg");
        raf = (Math.abs(tx - cx) > 0.05 || Math.abs(ty - cy) > 0.05) ? requestAnimationFrame(loop) : null;
      };

      card.addEventListener("mousemove", function (e) {
        var r = card.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - 0.5;
        var py = (e.clientY - r.top) / r.height - 0.5;
        tx = -py * MAX; ty = px * MAX;
        card.style.setProperty("--mx", ((e.clientX - r.left) / r.width * 100).toFixed(1) + "%");
        card.style.setProperty("--my", ((e.clientY - r.top) / r.height * 100).toFixed(1) + "%");
        if (!raf) raf = requestAnimationFrame(loop);
      });

      card.addEventListener("mouseleave", function () {
        tx = 0; ty = 0;
        if (!raf) raf = requestAnimationFrame(loop);
      });
    });
  }

  /* ---------------------------------------------------------
     Botones magnéticos (nunca en los de enviar formularios)
     Usa la propiedad "translate" para no pisar el "transform" del hover.
     --------------------------------------------------------- */
  function initMagnetic() {
    // Es decoración: con movimiento reducido no se aplica
    if (!fineHover || reduced) return;
    $$("[data-magnetic]").forEach(function (el) {
      if (el.dataset.magBound) return;
      el.dataset.magBound = "1";
      var strength = parseFloat(el.getAttribute("data-magnetic")) || 0.25;
      var tx = 0, ty = 0, cx = 0, cy = 0, raf = null;
      var loop = function () {
        cx += (tx - cx) * 0.18;
        cy += (ty - cy) * 0.18;
        el.style.translate = cx.toFixed(2) + "px " + cy.toFixed(2) + "px";
        raf = (Math.abs(tx - cx) > 0.1 || Math.abs(ty - cy) > 0.1) ? requestAnimationFrame(loop) : null;
      };
      el.addEventListener("mousemove", function (e) {
        var r = el.getBoundingClientRect();
        tx = (e.clientX - r.left - r.width / 2) * strength;
        ty = (e.clientY - r.top - r.height / 2) * strength;
        if (!raf) raf = requestAnimationFrame(loop);
      });
      el.addEventListener("mouseleave", function () {
        tx = 0; ty = 0;
        if (!raf) raf = requestAnimationFrame(loop);
      });
    });
  }

  /* ---------------------------------------------------------
     Texto de los botones que rueda al pasar el ratón.
     Solo en botones de texto plano (no en los que llevan spinner).
     --------------------------------------------------------- */
  function initButtonRoll() {
    $$(".btn").forEach(function (btn) {
      if (btn.getAttribute("data-roll") || btn.children.length) return;
      var text = btn.textContent.replace(/\s+/g, " ").trim();
      if (!text) return;
      btn.setAttribute("data-roll", "1");
      btn.innerHTML = '<span class="btn-roll"><span>' + escHTML(text) +
        '</span><span aria-hidden="true">' + escHTML(text) + "</span></span>";
    });
  }

  /* ---------------------------------------------------------
     La banda tipográfica se inclina según la velocidad del scroll
     --------------------------------------------------------- */
  function initMarquee() {
    var band = $("[data-marquee-band]");
    if (!band) return;
    var lastY = window.scrollY;
    var skew = 0, target = 0, raf = null;
    var loop = function () {
      skew += (target - skew) * 0.14;
      target *= 0.86;
      if (Math.abs(skew) < 0.02 && Math.abs(target) < 0.02) {
        band.style.setProperty("--skew", "0deg");
        raf = null;
        return;
      }
      band.style.setProperty("--skew", skew.toFixed(2) + "deg");
      raf = requestAnimationFrame(loop);
    };
    window.addEventListener("scroll", function () {
      var y = window.scrollY;
      var d = y - lastY;
      lastY = y;
      var max = reduced ? 3 : 8;
      target = Math.max(-max, Math.min(max, d * 0.22));
      if (!raf) raf = requestAnimationFrame(loop);
    }, { passive: true });
  }

  /* ---------------------------------------------------------
     Pulsar un servicio lleva al formulario con ese servicio elegido
     --------------------------------------------------------- */
  function initServiceRows() {
    var select = $("#f-servicio");
    if (!select) return;
    $$("[data-service]").forEach(function (row) {
      row.addEventListener("click", function () {
        var val = row.getAttribute("data-service");
        for (var i = 0; i < select.options.length; i++) {
          if (select.options[i].text === val) { select.selectedIndex = i; break; }
        }
      });
    });
  }

  /* ---------------------------------------------------------
     Partir texto en palabras conservando <br> y <em>.
     El texto completo queda para lectores de pantalla en .sr-only.
     --------------------------------------------------------- */
  function splitInto(el, wordClass, masked) {
    var full = el.textContent.trim().replace(/\s+/g, " ");
    var wrap = function (text) {
      return text.split(/(\s+)/).map(function (w) {
        if (/^\s*$/.test(w)) return w;
        var word = '<span class="' + wordClass + '">' + escHTML(w) + "</span>";
        return masked ? '<span class="split-mask">' + word + "</span>" : word;
      }).join("");
    };
    var html = Array.prototype.slice.call(el.childNodes).map(function (node) {
      if (node.nodeType === 3) return wrap(node.textContent);
      if (node.nodeName === "BR") return "<br>";
      if (node.nodeType === 1) {
        if (node.hasAttribute("data-keep")) return node.outerHTML;
        var tag = node.tagName.toLowerCase();
        return "<" + tag + ">" + wrap(node.textContent) + "</" + tag + ">";
      }
      return "";
    }).join("");
    el.innerHTML = '<span class="sr-only">' + escHTML(full) + '</span><span aria-hidden="true">' + html + "</span>";
    return $$("." + wordClass, el);
  }

  /* ---------------------------------------------------------
     Títulos: las palabras emergen tras una máscara.
     data-split="hero" espera a la intro; el resto, a entrar en pantalla.
     --------------------------------------------------------- */
  function initSplitText() {
    if (!window.gsap) return;
    $$("[data-split]").forEach(function (el) {
      if (el.getAttribute("data-split-done")) return;
      el.setAttribute("data-split-done", "1");
      var isHero = el.getAttribute("data-split") === "hero";
      var words = splitInto(el, "split-word", true);
      if (!words.length) return;
      // Con movimiento reducido las palabras sólo aparecen, no se desplazan
      window.gsap.set(words, reduced ? { opacity: 0 } : { yPercent: 118 });

      var tween = null;
      var play = function () {
        if (tween) return;
        tween = window.gsap.to(words, reduced
          ? { opacity: 1, duration: 0.4, stagger: 0.01, ease: "power1.out" }
          : {
              yPercent: 0,
              duration: isHero ? 1.2 : 1,
              stagger: isHero ? 0.045 : 0.03,
              ease: "expo.out"
            });
      };

      if (isHero) {
        onIntro(function () { setTimeout(play, reduced ? 0 : 260); });
        // Red de seguridad: pase lo que pase, el titular acaba visible
        setTimeout(function () { play(); tween.progress(1); }, 6500);
        return;
      }

      if (typeof IntersectionObserver === "undefined") { play(); return; }
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) { play(); io.disconnect(); }
        });
      }, { threshold: 0.01, rootMargin: "0px 0px -6% 0px" });
      io.observe(el);
      setTimeout(function () {
        if (!tween && el.getBoundingClientRect().top < window.innerHeight) play();
      }, 6000);
    });
  }

  /* ---------------------------------------------------------
     Intro de la portada: la imagen se asienta y los textos entran
     escalonados en cuanto se levanta la cortinilla.
     --------------------------------------------------------- */
  function initIntro() {
    var root = document.documentElement;
    if (!window.gsap) { root.classList.remove("intro"); return; }
    var gsap = window.gsap;
    var items = $$("[data-intro]").filter(function (el) { return !el.hasAttribute("data-split"); });
    var title = $("[data-split='hero']");
    var arch = $(".hero-arch");
    var orbit = $(".hero-orbit");
    var float = $(".hero-float");
    var badge = $(".hero-badge");
    var thumbs = $(".hero-thumbs");
    var mark = $(".hero-watermark");

    // Con movimiento reducido entra sólo el fundido, sin desplazamiento
    if (items.length) gsap.set(items, { y: reduced ? 0 : 30, opacity: 0 });
    if (title && !reduced) gsap.set(title, { filter: "blur(7px)" });
    if (arch) gsap.set(arch, reduced ? { opacity: 0 } : { clipPath: "inset(100% 0% 0% 0%)" });
    if (orbit) gsap.set(orbit, { opacity: 0, scale: reduced ? 1 : 0.8 });
    if (float) gsap.set(float, reduced ? { opacity: 0 } : { opacity: 0, scale: 0.2, rotation: -24 });
    if (badge) gsap.set(badge, reduced ? { opacity: 0 } : { opacity: 0, scale: 0.3, rotation: -140 });
    if (thumbs) gsap.set(thumbs, { opacity: 0, y: reduced ? 0 : 20 });
    if (mark) gsap.set(mark, { opacity: 0, yPercent: reduced ? 0 : 24 });
    root.classList.remove("intro");

    onIntro(function () {
      var tl = gsap.timeline({ defaults: { ease: "expo.out" } });
      // El desenfoque une las palabras al entrar en lugar de verse una a una
      if (title && !reduced) tl.to(title, { filter: "blur(0px)", duration: 1.4 }, 0.25);
      if (items.length) {
        tl.to(items, {
          y: 0, opacity: 1,
          duration: reduced ? 0.5 : 1.2,
          stagger: reduced ? 0.03 : 0.08
        }, reduced ? 0 : 0.16);
      }
      if (arch) {
        tl.to(arch, reduced
          ? { opacity: 1, duration: 0.6 }
          : { clipPath: "inset(0% 0% 0% 0%)", duration: 1.6, ease: "power4.inOut", clearProps: "clipPath" }, 0.05);
      }
      if (orbit) tl.to(orbit, { opacity: 1, scale: 1, duration: 1.6 }, 0.7);
      if (float) tl.to(float, reduced ? { opacity: 1, duration: 0.5 } : { opacity: 1, scale: 1, rotation: 0, duration: 1.3, ease: "back.out(1.5)" }, 0.95);
      if (badge) tl.to(badge, reduced ? { opacity: 1, duration: 0.5 } : { opacity: 1, scale: 1, rotation: 0, duration: 1.5 }, 1.05);
      if (thumbs) tl.to(thumbs, { opacity: 1, y: 0, duration: 1 }, 1.15);
      if (mark) tl.to(mark, { opacity: 1, yPercent: 0, duration: 2.2 }, 0.3);
      setTimeout(function () { tl.progress(1); }, 6000);
    });
  }

  /* ---------------------------------------------------------
     Manifiesto: cada palabra se enciende al avanzar con el scroll
     --------------------------------------------------------- */
  function initManifesto() {
    var el = $("[data-manifesto]");
    if (!el || !window.gsap || !window.ScrollTrigger) return;
    splitInto(el, "mf-word", false);
    var words = $$(".mf-word, .mf-img", el);
    if (!words.length) return;
    window.gsap.fromTo(words, { opacity: 0.14 }, {
      opacity: 1,
      ease: "none",
      stagger: 0.12,
      scrollTrigger: { trigger: el, start: "top 85%", end: "bottom 45%", scrub: 0.5 }
    });
  }

  /* ---------------------------------------------------------
     Cortinilla entre las páginas de la web: sube al salir y, al llegar,
     la página nueva la levanta (eso último es sólo CSS).
     --------------------------------------------------------- */
  function initPageTransitions() {
    var root = document.documentElement;
    if (!$(".page-curtain")) return;
    document.addEventListener("click", function (e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var a = e.target.closest ? e.target.closest("a[href]") : null;
      if (!a) return;
      if ((a.target && a.target !== "_self") || a.hasAttribute("download")) return;
      var href = a.getAttribute("href") || "";
      // Sólo enlaces relativos a otras páginas .html de la propia web
      if (!/^[\w\-./]+\.html(#.*)?$/i.test(href)) return;
      var url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return;
      e.preventDefault();
      try { sessionStorage.setItem("brisa:nav", "1"); } catch (err) {}
      root.classList.remove("page-enter");
      void root.offsetWidth;
      root.classList.add("is-leaving");
      setTimeout(function () { window.location.href = a.href; }, reduced ? 180 : 640);
    });
    // Al volver con el botón "atrás" la página sale de la caché con la cortina bajada
    window.addEventListener("pageshow", function (e) {
      if (e.persisted) root.classList.remove("is-leaving", "page-enter");
    });
  }

  /* ---------------------------------------------------------
     Capas que se desplazan al mover el ratón (portada y llamada final).
     Usa la propiedad "translate" para convivir con otras animaciones.
     --------------------------------------------------------- */
  function initDepth() {
    if (!fineHover || reduced) return;
    $$("[data-depth-scope]").forEach(function (scope) {
      var layers = $$("[data-depth]", scope).map(function (el) {
        return { el: el, d: parseFloat(el.getAttribute("data-depth")) || 10 };
      });
      if (!layers.length) return;
      var tx = 0, ty = 0, cx = 0, cy = 0, raf = null;
      var loop = function () {
        cx += (tx - cx) * 0.08;
        cy += (ty - cy) * 0.08;
        layers.forEach(function (l) {
          l.el.style.translate = (-cx * l.d).toFixed(1) + "px " + (-cy * l.d).toFixed(1) + "px";
        });
        raf = (Math.abs(tx - cx) > 0.001 || Math.abs(ty - cy) > 0.001) ? requestAnimationFrame(loop) : null;
      };
      scope.addEventListener("pointermove", function (e) {
        if (e.pointerType && e.pointerType !== "mouse") return;
        var r = scope.getBoundingClientRect();
        tx = (e.clientX - r.left) / r.width - 0.5;
        ty = (e.clientY - r.top) / r.height - 0.5;
        if (!raf) raf = requestAnimationFrame(loop);
      });
      scope.addEventListener("pointerleave", function () {
        tx = 0; ty = 0;
        if (!raf) raf = requestAnimationFrame(loop);
      });
    });
  }

  /* ---------------------------------------------------------
     Portada: las piezas se turnan dentro del arco. Avanza sola, se para
     si la portada no se ve y se puede elegir con las miniaturas.
     --------------------------------------------------------- */
  function initHeroSlides() {
    var arch = $("[data-slides]");
    if (!arch) return;
    var slides = $$(".hero-slide", arch);
    var thumbs = $$(".hero-thumb");
    var caption = $(".hero-caption", arch);
    var num = caption && $(".hc-num", caption);
    var name = caption && $(".hc-name", caption);
    if (slides.length < 2) return;

    var DUR = 5200;
    var cur = 0, timer = null, inView = true, running = false;
    document.documentElement.style.setProperty("--slide-time", DUR / 1000 + "s");

    function schedule() {
      clearTimeout(timer);
      thumbs.forEach(function (t) { t.classList.remove("is-running"); });
      if (!running || !inView || document.hidden) return;
      var t = thumbs[cur];
      if (t) { void t.offsetWidth; t.classList.add("is-running"); }
      timer = setTimeout(function () { go(cur + 1); }, DUR);
    }

    function go(i) {
      i = (i + slides.length) % slides.length;
      if (i !== cur) {
        var prev = cur;
        slides[prev].classList.remove("is-active");
        slides[prev].classList.add("was-active");
        slides[i].classList.remove("was-active");
        void slides[i].offsetWidth;
        slides[i].classList.add("is-active");
        setTimeout(function () {
          if (!slides[prev].classList.contains("is-active")) slides[prev].classList.remove("was-active");
        }, 1400);
        cur = i;
        thumbs.forEach(function (t, k) {
          t.classList.toggle("is-active", k === i);
          t.setAttribute("aria-pressed", k === i ? "true" : "false");
        });
        if (caption) {
          if (num) num.textContent = (i + 1 < 10 ? "0" : "") + (i + 1);
          if (name) name.textContent = slides[i].getAttribute("data-name") || "";
          caption.classList.remove("is-swap");
          void caption.offsetWidth;
          caption.classList.add("is-swap");
        }
      }
      schedule();
    }

    thumbs.forEach(function (t, i) {
      t.addEventListener("click", function () { go(i); });
      t.addEventListener("keydown", function (e) {
        var n = null;
        if (e.key === "ArrowRight" || e.key === "ArrowDown") n = (i + 1) % thumbs.length;
        if (e.key === "ArrowLeft" || e.key === "ArrowUp") n = (i - 1 + thumbs.length) % thumbs.length;
        if (n !== null) { e.preventDefault(); thumbs[n].focus(); go(n); }
      });
    });
    arch.addEventListener("click", function () { go(cur + 1); });
    document.addEventListener("visibilitychange", schedule);

    if (typeof IntersectionObserver !== "undefined") {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { inView = en.isIntersecting; schedule(); });
      }, { threshold: 0.25 }).observe(arch);
    }
    onIntro(function () {
      setTimeout(function () { running = true; schedule(); }, reduced ? 400 : 1600);
    });
  }

  /* ---------------------------------------------------------
     Portada: gotas de tinta. Unas pocas flotan siempre; al mover el
     ratón salpican y caen, y un clic suelta una salpicadura mayor.
     --------------------------------------------------------- */
  function initHeroInk() {
    var hero = $("[data-hero]");
    var canvas = hero && $("[data-hero-ink]", hero);
    if (!canvas || !canvas.getContext) return;
    if (reduced) { canvas.style.display = "none"; return; }

    var ctx = canvas.getContext("2d");
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var W = 0, H = 0, parts = [], visible = true, raf = null, lx = null, ly = null;
    var COLORS = ["232,174,198", "211,134,168", "199,169,141", "244,236,233"];

    function size() {
      var r = hero.getBoundingClientRect();
      W = Math.round(r.width); H = Math.round(r.height);
      canvas.width = W * dpr; canvas.height = H * dpr;
      canvas.style.width = W + "px"; canvas.style.height = H + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function spawn(x, y, burst, power) {
      var a = Math.random() * Math.PI * 2;
      var sp = burst ? (0.5 + Math.random() * 2) * (power || 1) : 0;
      parts.push({
        x: x, y: y,
        vx: burst ? Math.cos(a) * sp : (Math.random() - 0.5) * 0.18,
        vy: burst ? Math.sin(a) * sp - 1.2 : -0.06 - Math.random() * 0.2,
        g: burst ? 0.055 : 0,
        life: 1,
        decay: burst ? 0.012 + Math.random() * 0.014 : 0.0022 + Math.random() * 0.003,
        r: burst ? 1 + Math.random() * 2.6 : 0.6 + Math.random() * 1.4,
        c: COLORS[(Math.random() * COLORS.length) | 0]
      });
      if (parts.length > 200) parts.shift();
    }

    function frame() {
      raf = null;
      if (!visible || document.hidden) return;
      if (parts.length < 60 && Math.random() < 0.12) spawn(Math.random() * W, H * (0.3 + Math.random() * 0.7), false);
      ctx.clearRect(0, 0, W, H);
      for (var i = parts.length - 1; i >= 0; i--) {
        var p = parts[i];
        p.vy += p.g; p.x += p.vx; p.y += p.vy; p.vx *= 0.985;
        p.life -= p.decay;
        if (p.life <= 0 || p.y > H + 12 || p.y < -12) { parts.splice(i, 1); continue; }
        var alpha = Math.min(1, p.life * 1.4) * (p.g ? 0.95 : 0.5);
        ctx.fillStyle = "rgba(" + p.c + "," + alpha.toFixed(3) + ")";
        ctx.beginPath();
        if (p.g) {
          // La gota se estira en la dirección en la que cae
          var speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
          ctx.ellipse(p.x, p.y, p.r * (1 + Math.min(speed, 6) * 0.35), p.r, Math.atan2(p.vy, p.vx), 0, Math.PI * 2);
        } else {
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        }
        ctx.fill();
      }
      raf = requestAnimationFrame(frame);
    }
    function start() { if (!raf && visible && !document.hidden) raf = requestAnimationFrame(frame); }

    size();
    var resizeTimer = null;
    window.addEventListener("resize", function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(size, 150);
    });
    window.addEventListener("load", size);

    if (fineHover) {
      hero.addEventListener("pointermove", function (e) {
        var r = hero.getBoundingClientRect();
        var x = e.clientX - r.left, y = e.clientY - r.top;
        if (lx === null || Math.abs(x - lx) + Math.abs(y - ly) > 18) {
          var n = 1 + ((Math.random() * 2) | 0);
          while (n--) spawn(x + (Math.random() - 0.5) * 10, y + (Math.random() - 0.5) * 10, true, 1);
          lx = x; ly = y;
        }
      }, { passive: true });
      hero.addEventListener("pointerdown", function (e) {
        var r = hero.getBoundingClientRect();
        for (var k = 0; k < 16; k++) spawn(e.clientX - r.left, e.clientY - r.top, true, 1.6);
      });
    }
    if (typeof IntersectionObserver !== "undefined") {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { visible = en.isIntersecting; if (visible) start(); });
      }, { threshold: 0.02 }).observe(hero);
    }
    document.addEventListener("visibilitychange", start);
    start();
  }

  /* ---------------------------------------------------------
     Portfolio: en escritorio la sección se queda fija y la tira avanza
     con el scroll vertical (suavizado). En móvil, carrusel nativo.
     --------------------------------------------------------- */
  function initHScroll() {
    var sec = $("[data-hscroll]");
    var track = sec && $("[data-hscroll-track]", sec);
    if (!track) return;
    var bar = $("[data-hscroll-bar]", sec);
    var imgs = $$(".hcard-img", sec);
    var mq = window.matchMedia("(min-width: 960px)");
    var active = false, dist = 0, target = 0, cur = 0, raf = null;

    var setBar = function (p) {
      if (bar) bar.style.setProperty("--p", Math.max(0.08, p).toFixed(3));
    };
    var progress = function () {
      var r = sec.getBoundingClientRect();
      return dist > 0 ? Math.max(0, Math.min(1, -r.top / dist)) : 0;
    };

    function render(instant) {
      raf = null;
      cur = instant ? target : cur + (target - cur) * 0.14;
      if (Math.abs(target - cur) < 0.0004) cur = target;
      track.style.transform = "translate3d(" + (-cur * dist).toFixed(1) + "px,0,0)";
      setBar(cur);
      if (!reduced) {
        var vw = window.innerWidth;
        imgs.forEach(function (im) {
          var r = im.parentElement.getBoundingClientRect();
          if (r.right < -100 || r.left > vw + 100) return;
          var off = (r.left + r.width / 2 - vw / 2) / vw;
          im.style.transform = "translate3d(" + (-off * 44).toFixed(1) + "px,0,0)";
        });
      }
      if (cur !== target) raf = requestAnimationFrame(function () { render(false); });
    }

    function measure() {
      var before = sec.style.height;
      active = mq.matches;
      sec.classList.toggle("is-pinned", active);
      if (!active) {
        sec.style.height = "";
        track.style.transform = "";
        imgs.forEach(function (im) { im.style.transform = ""; });
      } else {
        dist = Math.max(0, track.offsetWidth - document.documentElement.clientWidth);
        sec.style.height = Math.round(dist + window.innerHeight) + "px";
        target = progress();
        render(true);
      }
      return before !== sec.style.height;
    }

    var remeasure = function () {
      if (measure() && window.ScrollTrigger) window.ScrollTrigger.refresh();
    };
    measure();
    var resizeTimer = null;
    window.addEventListener("resize", function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(remeasure, 160);
    });
    window.addEventListener("load", remeasure);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(remeasure);

    window.addEventListener("scroll", function () {
      if (!active) return;
      target = progress();
      if (!raf) raf = requestAnimationFrame(function () { render(false); });
    }, { passive: true });

    // Móvil: la barra sigue al carrusel
    track.addEventListener("scroll", function () {
      if (active) return;
      var max = track.scrollWidth - track.clientWidth;
      setBar(max > 0 ? track.scrollLeft / max : 0);
    }, { passive: true });

    // Con teclado: al enfocar una pieza fuera de la vista, se lleva el scroll hasta ella
    track.addEventListener("focusin", function (e) {
      if (!active || dist <= 0) return;
      var card = e.target.closest ? e.target.closest(".hcard") : null;
      if (!card) return;
      var p = Math.max(0, Math.min(1, (card.offsetLeft - window.innerWidth * 0.3) / dist));
      var top = sec.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: top + p * dist, behavior: "auto" });
    });
  }

  /* ---------------------------------------------------------
     Proceso: al llegar cada tarjeta, la anterior se encoge y se apaga
     --------------------------------------------------------- */
  function initStackCards() {
    var cards = $$(".scard");
    if (cards.length < 2 || reduced) return;
    var ticking = false;
    var update = function () {
      ticking = false;
      for (var i = 0; i < cards.length - 1; i++) {
        var top = cards[i].getBoundingClientRect().top;
        var next = cards[i + 1].getBoundingClientRect().top;
        var h = cards[i].offsetHeight || 1;
        var p = Math.max(0, Math.min(1, 1 - (next - top) / h));
        cards[i].style.setProperty("--p", p.toFixed(3));
      }
    };
    window.addEventListener("scroll", function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    window.addEventListener("resize", update);
    update();
  }

  /* ---------------------------------------------------------
     Servicios: una foto acompaña al ratón y cambia con cada fila
     --------------------------------------------------------- */
  function initSvcFloat() {
    var list = $(".svc-list");
    var float = $("[data-svc-float]");
    if (!list || !float || !fineHover) return;
    var inner = $(".svc-float-inner", float);
    var items = inner ? Array.prototype.slice.call(inner.children) : [];
    var rows = $$(".svc", list);
    var x = 0, y = 0, cx = 0, cy = 0, rot = 0, on = false, raf = null;

    var loop = function () {
      var dx = x - cx;
      cx += dx * 0.16;
      cy += (y - cy) * 0.16;
      var targetRot = reduced ? 0 : Math.max(-8, Math.min(8, dx * 0.06));
      rot += (targetRot - rot) * 0.12;
      float.style.transform = "translate3d(" + cx.toFixed(1) + "px," + cy.toFixed(1) + "px,0) rotate(" + rot.toFixed(2) + "deg)";
      raf = (on || Math.abs(dx) > 0.5 || Math.abs(rot) > 0.05) ? requestAnimationFrame(loop) : null;
    };

    list.addEventListener("pointermove", function (e) {
      if (e.pointerType && e.pointerType !== "mouse") return;
      x = e.clientX; y = e.clientY;
      if (!float.classList.contains("is-on") && !raf) { cx = x; cy = y; }
      // Cerca del borde derecho, la foto pasa al otro lado del puntero
      float.classList.toggle("is-left", x > window.innerWidth - 210);
      if (!raf) raf = requestAnimationFrame(loop);
    });
    rows.forEach(function (row, i) {
      row.addEventListener("pointerenter", function (e) {
        if (e.pointerType && e.pointerType !== "mouse") return;
        items.forEach(function (m, k) { m.classList.toggle("is-active", k === i); });
        on = true;
        float.classList.add("is-on");
      });
    });
    list.addEventListener("pointerleave", function () {
      on = false;
      float.classList.remove("is-on");
    });
  }

  /* ---------------------------------------------------------
     Botón de WhatsApp: aparece cuando termina la entrada
     --------------------------------------------------------- */
  function initFloatWa() {
    var btn = $(".wa-float");
    if (!btn) return;
    onIntro(function () {
      setTimeout(function () { btn.classList.add("is-visible"); }, reduced ? 0 : 1400);
    });
  }

  /* ---------------------------------------------------------
     Portada al hacer scroll: el texto sube y se apaga, el arco baja
     un poco y se encoge (sólo escritorio).
     --------------------------------------------------------- */
  function initHeroScroll() {
    if (!window.gsap || !window.ScrollTrigger || reduced) return;
    var hero = $("[data-hero]");
    if (!hero) return;
    var gsap = window.gsap;
    var copy = $("[data-hero-copy]", hero);
    var visual = $("[data-hero-visual]", hero);
    var mark = $(".hero-watermark", hero);
    var st = function () { return { trigger: hero, start: "top top", end: "bottom top", scrub: true }; };
    gsap.matchMedia().add("(min-width: 960px)", function () {
      if (copy) gsap.to(copy, { y: -90, opacity: 0, ease: "none", scrollTrigger: st() });
      if (visual) gsap.to(visual, { y: 60, scale: 0.94, ease: "none", scrollTrigger: st() });
      if (mark) gsap.to(mark, { y: -80, ease: "none", scrollTrigger: st() });
    });
  }

  /* ---------------------------------------------------------
     Parallax suave para fotos marcadas con data-parallax
     --------------------------------------------------------- */
  function initParallax() {
    if (!window.gsap || !window.ScrollTrigger || reduced) return;
    $$("[data-parallax]").forEach(function (el) {
      var s = parseFloat(el.getAttribute("data-parallax")) || 0.1;
      window.gsap.fromTo(el, { yPercent: s * 100 }, {
        yPercent: -s * 100,
        ease: "none",
        scrollTrigger: { trigger: el.parentElement, start: "top bottom", end: "bottom top", scrub: true }
      });
    });
  }

  /* ---------------------------------------------------------
     Foto que crece desde un marco pequeño hasta llenar la pantalla
     y deja ver la frase del estudio
     --------------------------------------------------------- */
  function initZoomBand() {
    var sec = $("[data-zoom]");
    if (!sec || !window.gsap || !window.ScrollTrigger || reduced) return;
    var gsap = window.gsap;
    var media = $("[data-zoom-media]", sec);
    var img = $("[data-zoom-img]", sec);
    var text = $("[data-zoom-text]", sec);
    if (!media) return;
    var narrow = function () { return window.innerWidth < 720; };
    var tl = gsap.timeline({
      scrollTrigger: { trigger: sec, start: "top top", end: "bottom bottom", scrub: 0.6, invalidateOnRefresh: true }
    });
    tl.fromTo(media,
      { clipPath: function () { return narrow() ? "inset(22% 7% 22% 7% round 24px)" : "inset(17% 29% 17% 29% round 44px)"; } },
      { clipPath: "inset(0% 0% 0% 0% round 0px)", ease: "power2.inOut", duration: 0.7 }, 0);
    if (img) tl.fromTo(img, { scale: 1.35 }, { scale: 1, ease: "power2.inOut", duration: 0.7 }, 0);
    if (text) tl.fromTo(text, { opacity: 0, y: 50 }, { opacity: 1, y: 0, ease: "power2.out", duration: 0.25 }, 0.5);
    tl.to({}, { duration: 0.15 });
  }

  /* ---------------------------------------------------------
     Gallery lightbox
     --------------------------------------------------------- */
  function initLightbox() {
    var box = $("[data-lightbox]");
    var boxImg = $("[data-lightbox-img]");
    var boxCap = $("[data-lightbox-caption]");
    var closeBtn = $("[data-lightbox-close]");
    if (!box || !boxImg || typeof box.showModal !== "function") return;

    $$(".gallery-item").forEach(function (item) {
      item.setAttribute("role", "button");
      item.setAttribute("tabindex", "0");
      var open = function () {
        var img = $("img", item);
        var cap = $("figcaption", item);
        if (!img) return;
        boxImg.src = img.getAttribute("src");
        boxImg.alt = img.getAttribute("alt") || "";
        if (boxCap) boxCap.textContent = item.getAttribute("data-caption") || (cap ? cap.textContent.replace(/\s+/g, " ").trim() : "");
        box.showModal();
      };
      item.addEventListener("click", open);
      item.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); }
      });
    });

    // Cerrar también se anima: desaparecer de golpe se lee como un fallo.
    // La salida es más rápida que la entrada.
    var close = function () {
      if (box.classList.contains("is-closing")) return;
      if (reduced) { box.close(); return; }
      box.classList.add("is-closing");
      setTimeout(function () {
        box.classList.remove("is-closing");
        box.close();
      }, 200);
    };

    if (closeBtn) closeBtn.addEventListener("click", close);
    box.addEventListener("click", function (e) {
      if (e.target === box) close();
    });
    // Escape lo cierra el navegador: se acompaña con la misma animación
    box.addEventListener("cancel", function (e) {
      if (reduced || box.classList.contains("is-closing")) return;
      e.preventDefault();
      close();
    });
  }

  /* ---------------------------------------------------------
     Formulario de contacto
     - Con data.formEndpoint configurado: envía por email (Web3Forms/Formspree).
     - Sin configurar: entrega el mensaje por WhatsApp ya redactado, para no
       prometer un envío que un hosting estático no puede hacer por sí solo.
     --------------------------------------------------------- */
  function setupContactForm() {
    var form = $("[data-contact-form]");
    var success = $("[data-contact-success]");
    if (!form || !success) return;

    var btn = form.querySelector("[type=submit]");
    var title = $("[data-contact-success-title]");
    var msg = $("[data-contact-success-msg]");
    var waBtn = $("[data-contact-wa]");
    var altNote = $("[data-contact-alt]");
    var endpoint = (data.formEndpoint || "").trim();
    var waNumber = (data.whatsapp || "").replace(/\D/g, "") || "34695717519";

    function values() {
      var el = form.elements;
      return {
        name: el.name ? el.name.value.trim() : "",
        email: el.email ? el.email.value.trim() : "",
        phone: el.phone ? el.phone.value.trim() : "",
        service: el.service ? el.service.value : "",
        message: el.message ? el.message.value.trim() : ""
      };
    }

    function whatsappUrl(v) {
      var lines = [
        "Hola, soy " + v.name + ".",
        "Me interesa: " + v.service + ".",
        v.message,
        "",
        "Email: " + v.email + (v.phone ? " · Tel: " + v.phone : "")
      ];
      return "https://wa.me/" + waNumber + "?text=" + encodeURIComponent(lines.join("\n"));
    }

    function show(titleText, msgText, waUrl) {
      if (title) title.textContent = titleText;
      if (msg) msg.textContent = msgText;
      if (waBtn) {
        if (waUrl) { waBtn.href = waUrl; waBtn.hidden = false; }
        else waBtn.hidden = true;
      }
      if (altNote) altNote.hidden = !waUrl;
      form.classList.remove("is-sending");
      form.classList.add("is-sent");
      success.setAttribute("aria-hidden", "false");
      success.classList.add("is-visible");
      if (waBtn && !waBtn.hidden) setTimeout(function () { waBtn.focus(); }, 400);
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (form.classList.contains("is-sending")) return;
      if (!form.reportValidity()) return;

      var v = values();
      var firstName = v.name.split(/\s+/)[0] || "";

      form.classList.add("is-sending");
      if (btn) btn.disabled = true;

      if (!endpoint) {
        // Sin servicio de email: se entrega por WhatsApp con el texto ya escrito
        setTimeout(function () {
          show(
            "Ya casi está",
            (firstName ? firstName + ", tu" : "Tu") +
              " mensaje está listo. Pulsa el botón y se abre WhatsApp con todo escrito: solo tienes que darle a enviar.",
            whatsappUrl(v)
          );
        }, 500);
        return;
      }

      var payload = {
        nombre: v.name,
        email: v.email,
        telefono: v.phone,
        servicio: v.service,
        mensaje: v.message,
        subject: "Solicitud de cita desde la web — " + v.name
      };
      // Web3Forms necesita la clave dentro del envío
      if (data.accessKey) payload.access_key = data.accessKey;

      fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload)
      })
        .then(function (res) {
          if (!res.ok) throw new Error("HTTP " + res.status);
          show(
            "Recibido",
            (firstName ? firstName + ", tenemos" : "Tenemos") +
              " tu solicitud. Te escribimos en 24–48 h laborables.",
            null
          );
        })
        .catch(function (err) {
          console.warn("[contacto] fallo el envío por email:", err);
          show(
            "No hemos podido enviarlo",
            "El correo no ha salido. Pulsa el botón y nos llega por WhatsApp con el mismo texto.",
            whatsappUrl(v)
          );
        });
    });
  }

  /* ---------------------------------------------------------
     Abierto / cerrado en tiempo real
     Usa la hora del estudio (Europe/Madrid), no la del dispositivo, para que
     el cartel sea correcto también para quien mire la web desde otro país.
     --------------------------------------------------------- */
  function initOpenNow() {
    var badge = $("[data-open-badge]");
    if (!badge || !data.schedule) return;

    var note = $("[data-hours-note]");
    var list = $("[data-hours]");
    var tz = data.timezone || "Europe/Madrid";
    var DAY_NAMES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
    var WEEKDAY_INDEX = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

    function studioNow() {
      try {
        var parts = new Intl.DateTimeFormat("en-US", {
          timeZone: tz, weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false
        }).formatToParts(new Date());
        var got = {};
        parts.forEach(function (p) { got[p.type] = p.value; });
        var day = WEEKDAY_INDEX[got.weekday];
        var h = parseInt(got.hour, 10) % 24;
        var m = parseInt(got.minute, 10);
        if (day === undefined || isNaN(h) || isNaN(m)) throw new Error("sin partes");
        return { day: day, mins: h * 60 + m };
      } catch (err) {
        var d = new Date();
        return { day: d.getDay(), mins: d.getHours() * 60 + d.getMinutes() };
      }
    }

    function toMins(hhmm) {
      var p = String(hhmm).split(":");
      return parseInt(p[0], 10) * 60 + parseInt(p[1], 10);
    }

    function nextOpening(fromDay) {
      for (var i = 1; i <= 7; i++) {
        var d = (fromDay + i) % 7;
        if (data.schedule[d]) return { day: d, at: data.schedule[d][0], isTomorrow: i === 1 };
      }
      return null;
    }

    function update() {
      var now = studioNow();
      var today = data.schedule[now.day];
      var isOpen = false;
      var msg = "";

      if (today) {
        var opens = toMins(today[0]);
        var closes = toMins(today[1]);
        if (now.mins >= opens && now.mins < closes) {
          isOpen = true;
          msg = "Cierra a las " + today[1];
        } else if (now.mins < opens) {
          msg = "Abre hoy a las " + today[0];
        }
      }
      if (!isOpen && !msg) {
        var next = nextOpening(now.day);
        if (next) {
          msg = next.isTomorrow
            ? "Abre mañana a las " + next.at
            : "Abre el " + DAY_NAMES[next.day] + " a las " + next.at;
        }
      }

      $$("[data-open-dot]").forEach(function (dot) { dot.classList.toggle("is-shut", !isOpen); });
      $$("[data-open-pill]").forEach(function (el) { el.textContent = isOpen ? "Abierto ahora" : "Cerrado ahora"; });

      badge.hidden = false;
      badge.textContent = isOpen ? "Abierto ahora" : "Cerrado ahora";
      badge.classList.toggle("is-open", isOpen);
      badge.classList.toggle("is-shut", !isOpen);

      if (note) {
        note.textContent = msg;
        note.hidden = !msg;
      }
      if (list) {
        $$("li", list).forEach(function (li) {
          li.classList.toggle("is-today", Number(li.getAttribute("data-day")) === now.day);
        });
      }
    }

    update();
    setInterval(update, 60000);
  }

  /* ---------------------------------------------------------
     Alta en el boletín (newsletter.html)
     - Con data.newsletterEndpoint: da de alta en Brevo/Mailchimp.
     - Sin configurar: lo dice claramente y ofrece apuntarse por WhatsApp,
       en vez de fingir un alta que no existe.
     --------------------------------------------------------- */
  function setupNewsletterForm() {
    var form = $("[data-news-form]");
    var success = $("[data-news-success]");
    if (!form || !success) return;

    var btn = form.querySelector("[type=submit]");
    var title = $("[data-news-success-title]");
    var msg = $("[data-news-success-msg]");
    var waBtn = $("[data-news-wa]");
    var endpoint = (data.newsletterEndpoint || "").trim();
    var waNumber = (data.whatsapp || "").replace(/\D/g, "") || "34695717519";

    function show(titleText, msgText, waUrl) {
      if (title) title.textContent = titleText;
      if (msg) msg.textContent = msgText;
      if (waBtn) {
        if (waUrl) { waBtn.href = waUrl; waBtn.hidden = false; }
        else waBtn.hidden = true;
      }
      form.classList.remove("is-sending");
      form.classList.add("is-sent");
      success.setAttribute("aria-hidden", "false");
      success.classList.add("is-visible");
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (form.classList.contains("is-sending")) return;
      if (!form.reportValidity()) return;

      var email = form.elements.email ? form.elements.email.value.trim() : "";
      form.classList.add("is-sending");
      if (btn) btn.disabled = true;

      if (!endpoint) {
        setTimeout(function () {
          show(
            "Casi",
            "El alta automática todavía no está conectada. Escríbenos por WhatsApp y te apuntamos a mano en un momento.",
            "https://wa.me/" + waNumber + "?text=" +
              encodeURIComponent("Hola, quiero apuntarme al boletín. Mi email es " + email + ".")
          );
        }, 500);
        return;
      }

      var body = new FormData();
      body.append("email", email);

      fetch(endpoint, { method: "POST", body: body, mode: "no-cors" })
        .then(function () {
          show("Apuntada", "Gracias. El próximo número te llegará a " + email + ".", null);
        })
        .catch(function (err) {
          console.warn("[boletín] fallo el alta:", err);
          show(
            "No hemos podido apuntarte",
            "Algo ha fallado. Escríbenos por WhatsApp y lo hacemos a mano.",
            "https://wa.me/" + waNumber + "?text=" +
              encodeURIComponent("Hola, quiero apuntarme al boletín. Mi email es " + email + ".")
          );
        });
    });
  }

  /* ---------------------------------------------------------
     Boot
     --------------------------------------------------------- */
  function boot() {
    safe(initPageTransitions, "initPageTransitions");
    safe(initSplash, "initSplash");
    safe(initNav, "initNav");
    safe(initSmoothAnchors, "initSmoothAnchors");
    safe(initButtonRoll, "initButtonRoll");
    safe(initReveals, "initReveals");
    safe(initDrawMarks, "initDrawMarks");
    safe(initCursor, "initCursor");
    safe(initTilt, "initTilt");
    safe(initMagnetic, "initMagnetic");
    safe(initDepth, "initDepth");
    safe(initMarquee, "initMarquee");
    safe(initServiceRows, "initServiceRows");
    safe(initSvcFloat, "initSvcFloat");
    // Antes que ScrollTrigger: fija la altura de la sección horizontal
    safe(initHScroll, "initHScroll");
    safe(initStackCards, "initStackCards");
    safe(initHeroSlides, "initHeroSlides");
    safe(initHeroInk, "initHeroInk");
    safe(initLightbox, "initLightbox");
    safe(setupContactForm, "setupContactForm");
    safe(setupNewsletterForm, "setupNewsletterForm");
    safe(initOpenNow, "initOpenNow");
    safe(initFloatWa, "initFloatWa");

    if (window.gsap) {
      if (window.ScrollTrigger) {
        try { window.gsap.registerPlugin(window.ScrollTrigger); } catch (err) {}
      }
      safe(initSplitText, "initSplitText");
      safe(initIntro, "initIntro");
      safe(initHeroScroll, "initHeroScroll");
      safe(initParallax, "initParallax");
      safe(initManifesto, "initManifesto");
      safe(initZoomBand, "initZoomBand");
      if (window.ScrollTrigger) {
        window.addEventListener("load", function () { window.ScrollTrigger.refresh(); });
      }
    }

    // Pase lo que pase arriba, la portada nunca se queda oculta
    document.documentElement.classList.remove("intro");
    document.documentElement.classList.add("is-ready");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
