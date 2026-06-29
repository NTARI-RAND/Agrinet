const { randomUUID } = require("crypto");
const fs = require("fs");
const path = require("path");

/*
 * Local on-disk storage for uploads (replaces Cloudflare R2).
 *
 * Files are written under <backend>/uploads/<folder>/ and served by Express as
 * static assets at /uploads (see server.js). Through the nginx reverse proxy the
 * browser reaches them at /api/uploads/<folder>/<file> — same-origin and portable
 * across local + public hosts, so no absolute base URL needs to be baked in.
 *
 * Persist /app/uploads with a Docker volume so files survive container rebuilds.
 */
const UPLOADS_DIR = path.join(__dirname, "..", "uploads");

// Public path prefix the browser uses. nginx maps /api/* -> backend /* (strips
// /api), so /api/uploads/<key> resolves to the Express /uploads static mount.
const PUBLIC_PREFIX = process.env.UPLOADS_PUBLIC_PREFIX || "/api/uploads";

async function uploadFile(buffer, mimetype, folder = "misc") {
  const ext = (mimetype && mimetype.split("/")[1]) || "bin";
  const key = `${folder}/${randomUUID()}.${ext}`;
  const dest = path.join(UPLOADS_DIR, key);

  await fs.promises.mkdir(path.dirname(dest), { recursive: true });
  await fs.promises.writeFile(dest, buffer);

  return `${PUBLIC_PREFIX}/${key}`;
}

module.exports = { uploadFile, UPLOADS_DIR };
