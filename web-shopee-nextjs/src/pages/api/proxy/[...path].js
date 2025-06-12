import { createProxyMiddleware } from 'http-proxy-middleware';

export const config = {
  api: {
    bodyParser: false,
    externalResolver: true,
  },
};

// CORS handler
function handleCors(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return true;
  }
  return false;
}

const proxy = createProxyMiddleware({
  target: 'http://localhost:3000',
  changeOrigin: true,
  pathRewrite: {
    '^/api/proxy': '/api',
  },
  onProxyReq: (proxyReq, req, res) => {
    // Forward all headers
    Object.keys(req.headers).forEach((key) => {
      proxyReq.setHeader(key, req.headers[key]);
    });
  },
  onError: (err, req, res) => {
    res.status(500).json({ error: 'Proxy error', details: err.message });
  },
  // Support multipart/form-data uploads
  selfHandleResponse: false,
});

export default function handler(req, res) {
  if (handleCors(req, res)) return;
  proxy(req, res, (err) => {
    if (err) {
      res.status(500).json({ error: 'Proxy error' });
    }
  });
}