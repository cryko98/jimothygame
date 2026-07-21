/* GET /api/t-nonce?pk=<wallet> → { nonce }
   One-time message the wallet must sign to prove ownership (expires in 5 min). */
'use strict';
const crypto = require('crypto');
const { redis, send, rateLimit, b58decode, TID } = require('./_lib.js');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return send(res, 405, { ok: false, error: 'GET only' });
  try {
    if (!(await rateLimit(req, 'nonce', 15))) return send(res, 429, { ok: false, error: 'slow down' });
    const pk = new URL(req.url, 'http://x').searchParams.get('pk') || '';
    let raw; try { raw = b58decode(pk); } catch (e) { raw = null; }
    if (!raw || raw.length !== 32) return send(res, 400, { ok: false, error: 'bad wallet address' });
    const nonce = 'Jimothy Run tournament (' + TID() + ')\nWallet: ' + pk + '\nNonce: ' + crypto.randomBytes(16).toString('hex');
    await redis('SET', 'nonce:' + pk, nonce, 'EX', 300);
    send(res, 200, { ok: true, nonce });
  } catch (e) {
    send(res, e.code === 503 ? 503 : 500, { ok: false, error: e.code === 503 ? 'not configured' : 'server error' });
  }
};
