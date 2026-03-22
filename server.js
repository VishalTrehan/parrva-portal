const express = require('express');
const jose = require('node-jose');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ─── PUBLIC KEYS ─────────────────────────────────────────────────────────────

const PARRVA_PEM = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAtCTj4Oo+RbfXCWXuLLMI
MSZVwy6nG4a0T3y5ALW2w7nDCk/SWmd1HMvj6R92Pk8ta1P3HNgmGvWikUMiAOgP
NBe35mT0SUv7mFTcSQeTKnhto7tbr2R+hnwA/7o2Fn1iEqcqNdz4fSSULGaloVv/
amwPVwKH1z0RQgaLjtvBTKwKxP6LUOJnUo0G9BuH0eNHfmG4En9sYZgs4sAyKK1a
6oz+qDYatp2Bv/JRf0Kjnxi7GtiiKhCUWgW5jDIY42Q5D1Gsld8xeUeYYS6A1D/w
u0WqJp1oJ9pEV5D+oRdQotYKQqoTllBaJ4NmsigfNr5a9/3UvDY5F7s7MnYhuMSk
DQIDAQAB
-----END PUBLIC KEY-----`;

const PDC_PEM = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAojQVs6yFZR/Gs46x6wqc
8m1aeaSX3hXHvRDGKeEsJ7/Umb5GmPkUdlximFEPTyhCYSfR4WwtO4B3VaUStX35
JbUoeRwFFuz+z4ZR1Dr1CyKrnLthhcyG7WFxZ1nITXVI32ZTBZFskpcQ/JGO0y/d
9KbuVoLRU2r6IIoK3sfh4FhOkpmnyZA+jbuAU0ayUsjjHvbBcGja0Q3MOLlasxav
lmPWLrUkVV7Gp79p4edONXw81yG6b+WeJhjUqs8M3hxmFJpPA4GfOYze8q0kA++i
eEZIe30L4Te8GwkDYcNk1SBDScVHEcr+pwGoJB4DoCBODvSSzKn4G42z7ZKdmi1p
pQIDAQAB
-----END PUBLIC KEY-----`;

// ─── JWE ENCRYPT HELPER ───────────────────────────────────────────────────────

async function encryptJWE(plaintext, pemKey) {
  const keystore = jose.JWK.createKeyStore();
  const key = await keystore.add(pemKey, 'pem');
  const buf = Buffer.from(plaintext, 'utf8');
  const encrypted = await jose.JWE.createEncrypt(
    { format: 'compact', fields: { alg: 'RSA-OAEP-256', enc: 'A256GCM', cty: 'application/json' } },
    key
  ).update(buf).final();
  return encrypted;
}

// ─── PDC ENDPOINT RESOLVER ────────────────────────────────────────────────────

function getPdcEndpoint(apiType, enrollmentId) {
  const prefix = (enrollmentId || '').toUpperCase().startsWith('RA') ? 'rainput' : 'iainput';
  const base = `https://pdc.nseasl.com/advice/${prefix}`;
  const routes = {
    intraday:    `${base}/intraday`,
    singlestock: `${base}/singlestock`,
    derivative:  `${base}/derivative`,
    strategy:    `${base}/strategy`,
    algoinput:   'https://pdc.nseasl.com/advice/algoinput',
  };
  return routes[apiType] || `${base}/${apiType}`;
}

// ─── API ROUTES ───────────────────────────────────────────────────────────────

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'PARRVA Portal running' });
});

// Step 1: Authenticate — encrypt credentials with PARRVA key
app.post('/api/authenticate', async (req, res) => {
  try {
    const { userId, password, role } = req.body;
    if (!userId || !password) {
      return res.status(400).json({ error: 'userId and password are required' });
    }

    const payload = JSON.stringify({ userId, password, role: role || 'TM' });
    const jwe = await encryptJWE(payload, PARRVA_PEM);

    const response = await fetch('https://www.careparrva.com/api/parrva/pdc/auth/authenticate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: jwe }),
    });

    const data = await response.json();

    if (response.ok && data.jwe) {
      return res.json({ jwe: data.jwe });
    } else {
      return res.status(response.status).json({
        error: `Auth failed (HTTP ${response.status})`,
        detail: data
      });
    }
  } catch (err) {
    console.error('Auth error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Step 2: Submit trade — encrypt payload with PDC key
app.post('/api/submit/:apiType', async (req, res) => {
  try {
    const { apiType } = req.params;
    const { token, enrollmentId, payload } = req.body;

    if (!token)   return res.status(400).json({ error: 'Bearer token is required' });
    if (!payload) return res.status(400).json({ error: 'payload is required' });

    const payloadStr = JSON.stringify(payload);
    const encrypted  = await encryptJWE(payloadStr, PDC_PEM);
    const endpoint   = getPdcEndpoint(apiType, enrollmentId);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'accept': '*/*',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ data: encrypted }),
    });

    let respData;
    const text = await response.text();
    try { respData = JSON.parse(text); } catch { respData = { raw: text }; }

    res.json({ status_code: response.status, endpoint, response: respData });
  } catch (err) {
    console.error('Submit error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Serve frontend for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── START ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n✅ PARRVA Portal running on port ${PORT}\n`);
});
