// Dev-only static server for local preview. Not part of the deployed website.
// Usage: node tools/preview-server.js [port] [rootDir]
const http = require("http");
const fs = require("fs");
const path = require("path");

const port = Number(process.argv[2]) || 8791;
const root = path.resolve(process.argv[3] || path.join(__dirname, ".."));

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
};

http
  .createServer((req, res) => {
    const urlPath = decodeURIComponent(req.url.split("?")[0]);
    let filePath = path.join(root, urlPath === "/" ? "index.html" : urlPath);

    if (!filePath.startsWith(root)) {
      res.writeHead(403).end("Forbidden");
      return;
    }
    fs.stat(filePath, (err, stat) => {
      if (err) {
        res.writeHead(404, { "Content-Type": "text/plain" }).end("404 " + urlPath);
        return;
      }
      if (stat.isDirectory()) filePath = path.join(filePath, "index.html");
      fs.readFile(filePath, (err2, buf) => {
        if (err2) {
          res.writeHead(404, { "Content-Type": "text/plain" }).end("404");
          return;
        }
        res.writeHead(200, {
          "Content-Type": MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream",
          "Cache-Control": "no-cache, must-revalidate",
        });
        res.end(buf);
      });
    });
  })
  .listen(port, () => {
    console.log("Preview server: http://localhost:" + port + "  (root: " + root + ")");
  });
