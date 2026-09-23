/**
 * Tiny static file server for the built web app (no external dependencies).
 * Serves web/ (index.html, styles.css, dist/bundle.js). Run with `npm start`
 * (builds first) for a local preview.
 */
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT) || 8081;
const WEB_ROOT = path.join(__dirname, "..");

const MIME_TYPES = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

const server = http.createServer((req, res) => {
  const urlPath = req.url === "/" ? "/index.html" : req.url.split("?")[0];
  const filePath = path.join(WEB_ROOT, urlPath);

  // Never serve a path that escapes web/ (e.g. "..%2F..%2Fpackage.json").
  if (!filePath.startsWith(WEB_ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": MIME_TYPES[path.extname(filePath)] || "application/octet-stream" });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`The Resistance running at http://localhost:${PORT}/index.html`);
});
