/**
 * Simple Express proxy server to forward requests to Shazam's API.
 * This is needed because Shazam's API does not allow direct browser requests (CORS).
 *
 * Usage: node server.cjs
 * Then start the Vite dev server: npm run dev
 */

const express = require('express');
const cors = require('cors');
const https = require('https');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Proxy all requests under /api/shazam to Shazam's API
app.use('/api/shazam', (req, res) => {
	console.log(`Proxying request: ${req.method} ${req.originalUrl}`);
	// Build the path to forward to Shazam (preserve query string)
	const original = req.originalUrl || req.url;
	const shazamPath = original.startsWith('/api/shazam')
		? original.slice('/api/shazam'.length)
		: original;
	const targetUrl = `https://amp.shazam.com${shazamPath}`;

	const options = {
		method: req.method,
		headers: {
			'Content-Type': 'application/json',
			'Content-Language': 'en_US',
			'User-Agent':
				'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36',
		},
	};

	const body = req.method === 'POST' ? JSON.stringify(req.body) : undefined;

	if (body) {
		options.headers['Content-Length'] = Buffer.byteLength(body);
	}

	const proxyReq = https.request(targetUrl, options, (proxyRes) => {
		res.status(proxyRes.statusCode);

		// Forward content-type header
		if (proxyRes.headers['content-type']) {
			res.setHeader('Content-Type', proxyRes.headers['content-type']);
		}

		proxyRes.pipe(res);
	});

	proxyReq.on('error', (err) => {
		console.error('Proxy error:', err.message);
		res.status(502).json({ error: 'Proxy error: ' + err.message });
	});

	if (body) {
		proxyReq.write(body);
	}

	proxyReq.end();
});

app.get('/health', (_req, res) => {
	res.json({ status: 'ok' });
});

app.listen(PORT, () => {
	console.log(`SongRec proxy server running at http://localhost:${PORT}`);
	console.log(`Proxying Shazam API requests...`);
});
