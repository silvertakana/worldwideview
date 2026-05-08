import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const targetPort = 3000;
const listenPort = 3001;
const certPath = path.join(process.cwd(), 'data', 'localhost.crt');
const keyPath = path.join(process.cwd(), 'data', 'localhost.key');

if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
  console.error('[HTTPS Proxy] Certificates not found. Proxy will not start.');
  process.exit(1);
}

const options = {
  key: fs.readFileSync(keyPath),
  cert: fs.readFileSync(certPath)
};

const server = https.createServer(options, (req, res) => {
  const proxyReq = http.request({
    hostname: '127.0.0.1',
    port: targetPort,
    path: req.url,
    method: req.method,
    headers: {
      ...req.headers,
      'x-forwarded-proto': 'https',
      'x-forwarded-port': String(listenPort)
    }
  }, (proxyRes) => {
    res.writeHead(proxyRes.statusCode || 500, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on('error', (e) => {
    console.error(`[HTTPS Proxy] Error proxying request to ${req.url}:`, e.message);
    res.writeHead(502);
    res.end('Bad Gateway');
  });

  req.pipe(proxyReq, { end: true });
});

server.listen(listenPort, '0.0.0.0', () => {
  console.log(`[HTTPS Proxy] Secure bridge listening on https://0.0.0.0:${listenPort} (forwarding to http://127.0.0.1:${targetPort})`);
});
