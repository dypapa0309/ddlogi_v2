const crypto = require('crypto');

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function signJwt({ clientEmail, privateKey, scope }) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: clientEmail,
    scope,
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };
  const encodedHeader = base64url(JSON.stringify(header));
  const encodedClaim = base64url(JSON.stringify(claim));
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(`${encodedHeader}.${encodedClaim}`);
  signer.end();
  const signature = signer.sign(privateKey, 'base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `${encodedHeader}.${encodedClaim}.${signature}`;
}

async function getAccessToken() {
  const clientEmail = process.env.GA_CLIENT_EMAIL;
  const privateKey = (process.env.GA_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  if (!clientEmail || !privateKey) {
    const err = new Error('Missing GA_CLIENT_EMAIL or GA_PRIVATE_KEY');
    err.code = 'GA_ENV_MISSING';
    throw err;
  }

  const jwt = signJwt({
    clientEmail,
    privateKey,
    scope: 'https://www.googleapis.com/auth/analytics.readonly',
  });

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  const tokenJson = await tokenRes.json();
  if (!tokenRes.ok || !tokenJson.access_token) {
    throw new Error(tokenJson.error_description || tokenJson.error || 'Failed to get Google access token');
  }
  return tokenJson.access_token;
}

function metricValueByName(rows = [], headers = [], name) {
  const idx = headers.findIndex((h) => h.name === name);
  if (idx < 0) return 0;
  const firstRow = rows[0];
  const raw = firstRow?.metricValues?.[idx]?.value;
  return Number(raw || 0);
}

function toKstLabel(date = new Date()) {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date).replace('. ', '-').replace('. ', '-').replace('.', '').trim();
}

exports.handler = async function handler(event) {
  if (event && event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: JSON.stringify({ ok: true }),
    };
  }

  if (event && event.httpMethod && !['GET', 'OPTIONS'].includes(event.httpMethod)) {
    return {
      statusCode: 405,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: JSON.stringify({ ok: false, error: 'Method not allowed' }),
    };
  }

  try {
    const propertyId = process.env.GA4_PROPERTY_ID;
    if (!propertyId) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Cache-Control': 'no-store' },
        body: JSON.stringify({ ok: true, disabled: true, reason: 'Missing GA4_PROPERTY_ID', activeUsers: 0, screenPageViews: 0, eventCount: 0, minuteWindowLabel: '최근 30분', fetchedAtKst: '-' }),
      };
    }

    const token = await getAccessToken();
    const apiRes = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runRealtimeReport`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        metrics: [
          { name: 'activeUsers' },
          { name: 'screenPageViews' },
          { name: 'eventCount' },
        ],
      }),
    });

    const json = await apiRes.json();
    if (!apiRes.ok) {
      return {
        statusCode: apiRes.status,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' },
        body: JSON.stringify({ ok: false, error: json.error?.message || 'GA realtime request failed' }),
      };
    }

    const rows = json.rows || [];
    const headers = json.metricHeaders || [];
    const body = {
      ok: true,
      activeUsers: metricValueByName(rows, headers, 'activeUsers'),
      screenPageViews: metricValueByName(rows, headers, 'screenPageViews'),
      eventCount: metricValueByName(rows, headers, 'eventCount'),
      minuteWindowLabel: '최근 30분',
      fetchedAtKst: toKstLabel(new Date()),
    };

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type',
        'Cache-Control': 'public, max-age=30, s-maxage=30',
      },
      body: JSON.stringify(body),
    };
  } catch (e) {
    if (e?.code === 'GA_ENV_MISSING') {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Cache-Control': 'no-store' },
        body: JSON.stringify({ ok: true, disabled: true, reason: String(e?.message || e), activeUsers: 0, screenPageViews: 0, eventCount: 0, minuteWindowLabel: '최근 30분', fetchedAtKst: '-' }),
      };
    }
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' },
      body: JSON.stringify({ ok: false, error: String(e?.message || e) }),
    };
  }
}
