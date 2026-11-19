// A tiny static server for game/ (Node 22, standard library only), so
// the entry can be played locally without a build step:
//   node serve.ts              serves game/ on http://localhost:8080
//   node serve.ts --port 8081  a second instance on another port
//   node serve.ts --verbose    log every request line to stderr
// It sends the MIME types a browser game needs, refuses any path
// outside game/, and never lists directories. This is a development
// convenience for playtesting, not a web server for the internet.
import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('./game', import.meta.url)));
const args = process.argv.slice(2);
const portIndex = args.indexOf('--port');
const requested = portIndex === -1 ? 8080 : Number(args[portIndex + 1]);
const port = Number.isInteger(requested) && requested > 0 && requested < 65536 ? requested : 8080;
const verbose = args.includes('--verbose');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.bin': 'application/octet-stream',
  '.wasm': 'application/wasm',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.txt': 'text/plain; charset=utf-8',
};

const server = createServer((req, res) => {
  const url = new URL(req.url || '/', 'http://localhost');
  const rel = normalize(decodeURIComponent(url.pathname)).replace(/^[/\\]+/, '');
  const file = resolve(join(root, rel));
  if (file !== root && !file.startsWith(root + sep)) {
    res.writeHead(403, { 'content-type': 'text/plain' });
    res.end('forbidden\n');
    return;
  }
  let target = file;
  try {
    if (statSync(target).isDirectory()) target = join(target, 'index.html');
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found\n');
    return;
  }
  try {
    const stat = statSync(target);
    res.writeHead(200, {
      'content-type': MIME[extname(target)] || 'application/octet-stream',
      'content-length': stat.size,
      'cache-control': 'no-store',
    });
    createReadStream(target).pipe(res);
    if (verbose) console.error(req.method + ' ' + url.pathname + ' -> 200');
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found\n');
  }
});

server.listen(port, () => {
  console.log('SOLARA BAY at http://localhost:' + port + '/');
});
