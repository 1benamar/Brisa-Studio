# Brisa Tattoo Studio

Web estática del estudio de tatuaje, piercing y micropigmentación **Brisa Tattoo Studio**
(Carrer Dr. Antic Roca, 20 · 17003 Girona).

HTML, CSS y JavaScript sin dependencias ni compilación: se sube tal cual por FTP a
Hostinger o a cualquier alojamiento estático.

## Ver la web

Abre `index.html` con doble clic. No necesita servidor ni instalar nada.

Para verla servida por HTTP (recomendado si tocas el código):

```bash
node tools/preview-server.js 8791
```

## Estructura

| Archivo | Qué es |
|---|---|
| `index.html` | La web completa: portada, estudio, servicios, portfolio, artistas, proceso, opiniones y contacto |
| `privacidad.html` | Política de privacidad y aviso legal |
| `creditos.html` | Créditos de las imágenes de muestra |
| `404.html` | Página de error |
| `styles.css` | Todos los estilos |
| `main.js` | Animaciones e interacciones |
| `lib/manifest.js` | Datos del estudio (teléfono, horario, envío del formulario) |
| `lib/` | GSAP y ScrollTrigger |
| `assets/img/` | Imágenes |
| `.htaccess` | Cabeceras de caché y página de error para Apache/LiteSpeed |
| `tools/` | Utilidades de desarrollo, no hace falta subirlas al hosting |

## Pendiente antes de publicar

Está detallado en [`LEEME.txt`](LEEME.txt). En resumen:

1. Sustituir las **imágenes de muestra** (Creative Commons) por fotos reales del estudio.
2. Revisar **precios**, **biografías** de las artistas y **testimonios**, que son de ejemplo.
3. Rellenar los **datos legales** de `privacidad.html` (titular, NIF, email y hosting).
4. Opcional: activar el **envío del formulario por email** rellenando `formEndpoint` en
   `lib/manifest.js`. Mientras esté vacío, el formulario entrega el mensaje por WhatsApp
   ya redactado.

## Notas técnicas

- Sin módulos ES: todos los scripts son clásicos con `defer`, así funciona también
  abriendo el archivo directamente (`file://`).
- La web se lee completa aunque falle el JavaScript.
- Las animaciones no se desactivan con `prefers-reduced-motion` salvo las intrusivas,
  para que no se vea plana en los Windows que traen esa opción activada de fábrica.
- Al cambiar `styles.css` o `main.js`, sube el `?v=AAAAMMDD` de las cuatro páginas HTML
  para que el hosting no siga sirviendo la versión antigua.
