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
  function onIntro(fn) {
    var done = false;
    var run = function () { if (done) return; done = true; fn(); };
    if (introFired || !$("[data-splash]")) { run(); return; }
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
    var minDur = reduced ? 450 : 1400;
    var loaded = document.readyState === "complete";
    var start = null;
    var gone = false;

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
      // Se limpia para que no ralentice luego los efectos al pasar el ratón
      setTimeout(function () { el.style.removeProperty("--reveal-delay"); }, 2400);
    };

    var io = new IntersectionObserver(function (entries) {
      var batch = 0;
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        reveal(entry.target, Math.min(batch, 6) * 0.09);
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
     Cursor: crece sobre lo interactivo y se vuelve lente sobre imágenes
     --------------------------------------------------------- */
  function initCursor() {
    var root = $("[data-cursor-root]");
    if (!root || !fineHover) return;
    document.documentElement.classList.add("has-cursor");

    var dot = $(".cursor-dot", root);
    var ring = $(".cursor-ring", root);
    var tx = 0, ty = 0, rx = 0, ry = 0, first = false;

    window.addEventListener("mousemove", function (e) {
      tx = e.clientX; ty = e.clientY;
      if (dot) dot.style.transform = "translate3d(" + tx + "px," + ty + "px,0)";
      if (!first) {
        first = true;
        rx = tx; ry = ty;
        if (ring) ring.style.transform = "translate3d(" + rx + "px," + ry + "px,0)";
        root.classList.add("is-ready");
      }
    }, { passive: true });

    (function tick() {
      rx += (tx - rx) * 0.18;
      ry += (ty - ry) * 0.18;
      if (ring) ring.style.transform = "translate3d(" + rx + "px," + ry + "px,0)";
      requestAnimationFrame(tick);
    })();

    var HOVERABLES = "a[href], button, .card, .gallery-item, input, textarea, select, label";
    var MEDIA = ".gallery-item, .about-figure";
    document.addEventListener("mouseover", function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      root.classList.toggle("is-interactive", !!t.closest(HOVERABLES));
      root.classList.toggle("is-media", !!t.closest(MEDIA));
    });
    document.addEventListener("mouseleave", function () {
      root.classList.remove("is-interactive", "is-media");
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
    if (!fineHover) return;
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
      window.gsap.set(words, { yPercent: 118 });

      var tween = null;
      var play = function () {
        if (tween) return;
        tween = window.gsap.to(words, {
          yPercent: 0,
          duration: reduced ? 0.6 : (isHero ? 1.3 : 1.1),
          stagger: reduced ? 0.01 : (isHero ? 0.055 : 0.035),
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
    var items = $$("[data-intro]").filter(function (el) { return !el.hasAttribute("data-split"); });
    var heroImg = $(".hero-bg img");

    if (items.length) window.gsap.set(items, { y: 30, opacity: 0 });
    if (heroImg) window.gsap.set(heroImg, { scale: reduced ? 1.1 : 1.32 });
    root.classList.remove("intro");

    onIntro(function () {
      var tl = window.gsap.timeline({ defaults: { ease: "expo.out" } });
      if (heroImg) tl.to(heroImg, { scale: 1.04, duration: reduced ? 1 : 2.8 }, 0);
      if (items.length) {
        tl.to(items, {
          y: 0, opacity: 1,
          duration: reduced ? 0.6 : 1.3,
          stagger: reduced ? 0.03 : 0.1
        }, reduced ? 0 : 0.18);
      }
      setTimeout(function () { tl.progress(1); }, 6000);
    });
  }

  /* ---------------------------------------------------------
     Hero parallax (GSAP)
     --------------------------------------------------------- */
  function initHeroParallax() {
    if (!window.gsap || !window.ScrollTrigger) return;
    var bg = $(".hero-bg");
    var inner = $(".hero-inner");
    if (bg) {
      window.gsap.to(bg, {
        yPercent: reduced ? 6 : 18,
        scale: 1.08,
        ease: "none",
        scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true }
      });
    }
    if (inner) {
      window.gsap.to(inner, {
        yPercent: reduced ? -8 : -28,
        opacity: 0.15,
        ease: "none",
        scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true }
      });
    }
  }

  /* ---------------------------------------------------------
     Manifiesto: cada palabra se enciende al avanzar con el scroll
     --------------------------------------------------------- */
  function initManifesto() {
    var el = $("[data-manifesto]");
    if (!el || !window.gsap || !window.ScrollTrigger) return;
    var words = splitInto(el, "mf-word", false);
    if (!words.length) return;
    window.gsap.fromTo(words, { opacity: 0.14 }, {
      opacity: 1,
      ease: "none",
      stagger: 0.12,
      scrollTrigger: { trigger: el, start: "top 85%", end: "bottom 45%", scrub: 0.5 }
    });
  }

  /* ---------------------------------------------------------
     Proceso: el raíl se llena con el scroll y cada paso se activa
     --------------------------------------------------------- */
  function initSteps() {
    var wrap = $("[data-steps]");
    if (!wrap || !window.gsap || !window.ScrollTrigger) return;
    var fill = $("[data-steps-fill]", wrap);
    wrap.classList.add("is-live");
    if (fill) {
      window.gsap.fromTo(fill, { scaleY: 0 }, {
        scaleY: 1,
        ease: "none",
        scrollTrigger: { trigger: wrap, start: "top 70%", end: "bottom 65%", scrub: 0.4 }
      });
    }
    $$(".step", wrap).forEach(function (step) {
      window.ScrollTrigger.create({
        trigger: step,
        start: "top 70%",
        onEnter: function () { step.classList.add("is-active"); },
        onLeaveBack: function () { step.classList.remove("is-active"); }
      });
    });
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
        if (boxCap) boxCap.textContent = cap ? cap.textContent.replace(/\s+/g, " ").trim() : "";
        box.showModal();
      };
      item.addEventListener("click", open);
      item.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); }
      });
    });

    if (closeBtn) closeBtn.addEventListener("click", function () { box.close(); });
    box.addEventListener("click", function (e) {
      if (e.target === box) box.close();
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
    safe(initSplash, "initSplash");
    safe(initNav, "initNav");
    safe(initSmoothAnchors, "initSmoothAnchors");
    safe(initButtonRoll, "initButtonRoll");
    safe(initReveals, "initReveals");
    safe(initDrawMarks, "initDrawMarks");
    safe(initCursor, "initCursor");
    safe(initTilt, "initTilt");
    safe(initMagnetic, "initMagnetic");
    safe(initMarquee, "initMarquee");
    safe(initServiceRows, "initServiceRows");
    safe(initLightbox, "initLightbox");
    safe(setupContactForm, "setupContactForm");
    safe(setupNewsletterForm, "setupNewsletterForm");
    safe(initOpenNow, "initOpenNow");

    if (window.gsap) {
      if (window.ScrollTrigger) {
        try { window.gsap.registerPlugin(window.ScrollTrigger); } catch (err) {}
      }
      safe(initSplitText, "initSplitText");
      safe(initIntro, "initIntro");
      safe(initHeroParallax, "initHeroParallax");
      safe(initManifesto, "initManifesto");
      safe(initSteps, "initSteps");
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
