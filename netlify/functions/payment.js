const https = require('https');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const PI_API_KEY = process.env.PI_API_KEY;
  const body = event.body ? JSON.parse(event.body) : {};
  const path = event.path;

  // ── VERIFY USER (validate accessToken via Pi API) ──
  if (path.includes('/verify')) {
    const { accessToken } = body;
    if (!accessToken) return { statusCode: 400, headers, body: JSON.stringify({ error: 'No token' }) };
    try {
      const result = await piGet('/v2/me', accessToken);
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, user: result }) };
    } catch (e) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid token' }) };
    }
  }

  // ── APPROVE PAYMENT ──
  if (path.includes('/approve')) {
    const { paymentId } = body;
    try {
      const result = await piRequest('POST', `/v2/payments/${paymentId}/approve`, PI_API_KEY);
      return { statusCode: 200, headers, body: JSON.stringify(result) };
    } catch (e) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
    }
  }

  // ── COMPLETE PAYMENT ──
  if (path.includes('/complete')) {
    const { paymentId, txid } = body;
    try {
      const result = await piRequest('POST', `/v2/payments/${paymentId}/complete`, PI_API_KEY, { txid });
      return { statusCode: 200, headers, body: JSON.stringify(result) };
    } catch (e) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
    }
  }

  // Config endpoint - returns Firebase key safely
  if (path.includes('/config')) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ fbkey: process.env.FIREBASE_API_KEY || '' })
    };
  }

  return { statusCode: 404, headers, body: JSON.stringify({ error: 'Not found' }) };
};

// Pi API call with API Key
function piRequest(method, path, apiKey, data) {
  return new Promise((resolve, reject) => {
    const postData = data ? JSON.stringify(data) : null;
    const options = {
      hostname: 'api.minepi.com',
      path,
      method,
      headers: { 'Authorization': `Key ${apiKey}`, 'Content-Type': 'application/json' }
    };
    if (postData) options.headers['Content-Length'] = Buffer.byteLength(postData);
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => { try { resolve(JSON.parse(body)); } catch (e) { resolve(body); } });
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

// Pi API call with Bearer token (for user verification)
function piGet(path, accessToken) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.minepi.com',
      path,
      method: 'GET',
      headers: { 'Authorization': `Bearer ${accessToken}` }
    };
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (res.statusCode === 200) resolve(parsed);
          else reject(new Error('Invalid token'));
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}
