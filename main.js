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
     Splash — CSS keyframe is the safety net, this is the fast path
     --------------------------------------------------------- */
  function initSplash() {
    var splash = $("[data-splash]");
    if (!splash) return;
    var hide = function () { splash.classList.add("is-out"); };
    if (document.readyState === "complete") setTimeout(hide, 500);
    else window.addEventListener("load", function () { setTimeout(hide, 350); });
    setTimeout(hide, 3800);
  }

  /* ---------------------------------------------------------
     Nav — solid on scroll + mobile menu
     --------------------------------------------------------- */
  function initNav() {
    var nav = $("[data-nav]");
    if (nav) {
      var onScroll = function () {
        if (window.scrollY > 70) nav.classList.add("is-scrolled");
        else nav.classList.remove("is-scrolled");
      };
      onScroll();
      window.addEventListener("scroll", onScroll, { passive: true });
    }

    var burger = $("[data-burger]");
    var menu = $("[data-mobile-menu]");
    if (!burger || !menu) return;

    var setOpen = function (open) {
      burger.setAttribute("aria-expanded", open ? "true" : "false");
      burger.setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú");
      menu.setAttribute("aria-hidden", open ? "false" : "true");
      document.body.style.overflow = open ? "hidden" : "";
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
     Reveal on scroll
     --------------------------------------------------------- */
  function initReveals() {
    var els = $$("[data-reveal]");
    if (!els.length) return;

    if (typeof IntersectionObserver === "undefined") {
      els.forEach(function (el) { el.classList.add("is-revealed"); });
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-revealed");
        io.unobserve(entry.target);
      });
    }, { threshold: 0.01, rootMargin: "0px 0px -2% 0px" });

    els.forEach(function (el) { io.observe(el); });

    // Safety net: nothing stays invisible
    setTimeout(function () {
      $$("[data-reveal]:not(.is-revealed)").forEach(function (el) {
        if (el.getBoundingClientRect().top < window.innerHeight) el.classList.add("is-revealed");
      });
    }, 6000);
  }

  /* ---------------------------------------------------------
     Signature effect — line-art mark draws itself
     --------------------------------------------------------- */
  function initDrawMarks() {
    var marks = $$("[data-draw]");
    if (!marks.length) return;

    marks.forEach(function (svg) {
      var paths = $$("path", svg);
      paths.forEach(function (path, i) {
        var len;
        try { len = path.getTotalLength(); } catch (err) { len = 0; }
        if (!len) return;
        path.style.strokeDasharray = len;
        path.style.strokeDashoffset = len;
        path.style.transition = "stroke-dashoffset " + (reduced ? 0.5 : 1.1) + "s var(--ease-soft) " +
                                (i * (reduced ? 0.05 : 0.13)) + "s";
      });

      var draw = function () {
        paths.forEach(function (path) { path.style.strokeDashoffset = "0"; });
      };

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
     Custom cursor
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

    var HOVERABLES = "a[href], button, .card, .gallery-item, summary, input, textarea, select";
    document.addEventListener("mouseover", function (e) {
      if (e.target.closest && e.target.closest(HOVERABLES)) root.classList.add("is-interactive");
    });
    document.addEventListener("mouseout", function (e) {
      if (!e.target.closest || !e.target.closest(HOVERABLES)) return;
      var to = e.relatedTarget;
      if (!to || !to.closest || !to.closest(HOVERABLES)) root.classList.remove("is-interactive");
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
     Split text (hero headline) — preserves <br> and <em>
     --------------------------------------------------------- */
  function splitWords(el) {
    el.setAttribute("aria-label", el.textContent.trim().replace(/\s+/g, " "));
    var wrap = function (text) {
      return text.split(/(\s+)/).map(function (w) {
        return /^\s*$/.test(w) ? w : '<span class="split-word" aria-hidden="true">' + escHTML(w) + "</span>";
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
    el.innerHTML = html;
    return $$(".split-word", el);
  }

  function initSplitText() {
    if (!window.gsap) return;
    $$("[data-split]").forEach(function (el) {
      var parts = splitWords(el);
      if (!parts.length) return;
      // gsap.from: si GSAP fallara antes de crear el tween, el texto sigue visible
      var tween = window.gsap.from(parts, {
        yPercent: 105,
        opacity: 0,
        duration: reduced ? 0.5 : 1.1,
        stagger: reduced ? 0.015 : 0.045,
        ease: "expo.out",
        delay: 0.35
      });
      // Red de seguridad: si el tween se queda a medias, se salta al final
      setTimeout(function () {
        if (tween && tween.progress() < 1) tween.progress(1);
      }, 5000);
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
    safe(initReveals, "initReveals");
    safe(initDrawMarks, "initDrawMarks");
    safe(initCursor, "initCursor");
    safe(initTilt, "initTilt");
    safe(initLightbox, "initLightbox");
    safe(setupContactForm, "setupContactForm");
    safe(setupNewsletterForm, "setupNewsletterForm");
    safe(initOpenNow, "initOpenNow");

    if (window.gsap) {
      if (window.ScrollTrigger) {
        try { window.gsap.registerPlugin(window.ScrollTrigger); } catch (err) {}
      }
      safe(initSplitText, "initSplitText");
      safe(initHeroParallax, "initHeroParallax");
    }

    document.documentElement.classList.add("is-ready");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
