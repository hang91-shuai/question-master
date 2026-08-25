/**
 * question-sync 云函数（HTTP 云函数 / Web 函数）
 *
 * 作用：作为服务端代理，转发前端对 CloudBase PostgREST 数据库 API 的请求，
 *       从而绕开浏览器跨域(CORS)限制（服务端请求不受 CORS 约束）。
 *
 * 部署：tcb fn deploy question-sync --httpFn --path /api
 * HTTP 云函数为标准 Web 服务，需监听 9000 端口。
 *
 * 前端调用约定（POST JSON）：
 *   {
 *     "path": "/question_banks",              // PostgREST 相对路径
 *     "method": "GET|POST|DELETE|PATCH",
 *     "query": "select=id",                   // 可选
 *     "body": {...} 或 [...],                  // 可选
 *     "prefer": "return=minimal"              // 可选
 *   }
 */

const http = require('http');
const https = require('https');

const API_BASE = process.env.CLOUDBASE_REST_URL;
const ANON_KEY = process.env.CLOUDBASE_ANON_KEY;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
  'Access-Control-Max-Age': '86400',
};

function send(res, statusCode, data) {
  const body = typeof data === 'string' ? data : JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    ...CORS,
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function httpsRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    if (body !== undefined && body !== null) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function handleRequest(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS);
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    return send(res, 405, { error: '仅支持 POST 请求' });
  }

  let payload;
  try {
    const raw = await readBody(req);
    payload = JSON.parse(raw || '{}');
  } catch (e) {
    return send(res, 400, { error: '请求体不是合法 JSON: ' + e.message });
  }

  const path = payload.path || '';
  const method = (payload.method || 'GET').toUpperCase();
  const query = payload.query || '';
  const body = payload.body;
  const prefer = payload.prefer || '';

  if (!path) {
    return send(res, 400, { error: '缺少 path 参数' });
  }
  if (!API_BASE || !ANON_KEY) {
    return send(res, 500, { error: '云函数缺少数据库配置' });
  }

  try {
    const baseUrl = new URL(API_BASE);
    const targetPath = `${baseUrl.pathname.replace(/\/$/, '')}${path}`;
    const target = `${baseUrl.origin}${targetPath}${query ? '?' + query : ''}`;
    const parsed = new URL(target);

    const headers = {
      Authorization: `Bearer ${ANON_KEY}`,
      apikey: ANON_KEY,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (prefer) headers.Prefer = prefer;

    const result = await httpsRequest(
      {
        hostname: parsed.hostname,
        port: parsed.port || 443,
        path: parsed.pathname + parsed.search,
        method,
        headers,
      },
      body
    );

    let respBody;
    try {
      respBody = result.body ? JSON.parse(result.body) : {};
    } catch {
      respBody = result.body;
    }

    send(res, result.status, respBody);
  } catch (err) {
    send(res, 502, { error: '云函数转发失败: ' + err.message });
  }
}

const server = http.createServer(handleRequest);
server.listen(9000, '0.0.0.0', () => {
  console.log('question-sync HTTP server listening on port 9000');
});
