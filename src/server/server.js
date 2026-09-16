import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../config.js';
import * as api from './api.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, '..', '..', 'public');
const DEFAULT_PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4173;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8'
};

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('Corps de requete JSON invalide'));
      }
    });
    req.on('error', reject);
  });
}

async function serveStatic(res, pathname) {
  const safePath = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.normalize(path.join(PUBLIC_DIR, safePath));

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Interdit');
    return;
  }

  try {
    const data = await readFile(filePath);
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Page introuvable');
  }
}

/**
 * Serveur HTTP minimal (node:http, sans framework) exposant l'API JSON
 * consommee par l'interface statique servie depuis /public.
 */
export function createServer({ config = loadConfig() } = {}) {
  return http.createServer(async (req, res) => {
    let url;
    try {
      url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    } catch {
      res.writeHead(400);
      res.end('URL invalide');
      return;
    }
    const { pathname } = url;

    try {
      if (pathname === '/api/config' && req.method === 'GET') {
        return sendJson(res, 200, api.getUiConfig(config));
      }

      if (pathname === '/api/prospects' && req.method === 'GET') {
        return sendJson(res, 200, api.listProspects());
      }

      if (pathname === '/api/prospects' && req.method === 'POST') {
        const body = await readBody(req);
        return sendJson(res, 201, api.addProspect(body));
      }

      if (pathname === '/api/analyze' && req.method === 'POST') {
        const body = await readBody(req);
        return sendJson(res, 200, api.addAndAnalyze(body, config));
      }

      if (pathname === '/api/analyze-text' && req.method === 'POST') {
        const body = await readBody(req);
        return sendJson(res, 200, api.analyzeRawText(body, config));
      }

      if (pathname === '/api/analyze-v2' && req.method === 'POST') {
        const body = await readBody(req);
        return sendJson(res, 200, api.analyzeProspectV2(body, config));
      }

      if (pathname === '/api/prospecting/run' && req.method === 'POST') {
        const body = await readBody(req);
        return sendJson(res, 200, api.runProspectingWorkflow(body, config));
      }

      if (pathname === '/api/briefing' && req.method === 'GET') {
        return sendJson(res, 200, { briefing: api.getBriefingText(config) });
      }

      if (pathname === '/api/top' && req.method === 'GET') {
        const n = parseInt(url.searchParams.get('n') || '10', 10);
        return sendJson(res, 200, api.topProspectsList(Number.isFinite(n) ? n : 10));
      }

      const prospectMatch = pathname.match(/^\/api\/prospects\/([^/]+)$/);
      if (prospectMatch && req.method === 'GET') {
        const prospect = api.getProspect(decodeURIComponent(prospectMatch[1]));
        if (!prospect) return sendJson(res, 404, { error: 'Prospect introuvable' });
        return sendJson(res, 200, prospect);
      }

      const analyzeMatch = pathname.match(/^\/api\/prospects\/([^/]+)\/analyze$/);
      if (analyzeMatch && req.method === 'POST') {
        const body = await readBody(req);
        const result = api.analyzeExisting(decodeURIComponent(analyzeMatch[1]), config, body.event);
        if (!result) return sendJson(res, 404, { error: 'Prospect introuvable' });
        return sendJson(res, 200, result);
      }

      if (pathname.startsWith('/api/')) {
        return sendJson(res, 404, { error: 'Route API inconnue' });
      }

      return await serveStatic(res, pathname);
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  });
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const server = createServer();
  server.listen(DEFAULT_PORT, () => {
    console.log(`Interface de prospection disponible sur http://localhost:${DEFAULT_PORT}`);
  });
}
