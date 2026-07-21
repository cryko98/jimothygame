/* POST /api/run-start → { token }
   Issues a signed, single-use run token. A leaderboard submit is only accepted
   with a valid token, so scores can't be forged without actually starting a
   run — and the token's timestamp lets the server verify the run's duration. */
'use strict';
const crypto = require('crypto');
const { send, hmac, rateLimit } = require('./_lib.js');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'POST only' });
  try {
    if (!(await rateLimit(req, 'start', 30))) return send(res, 429, { ok: false, error: 'slow down' });
    const runId = crypto.randomBytes(12).toString('hex');
    const ts = Date.now();
    const token = runId + '.' + ts + '.' + hmac(runId + '.' + ts);
    send(res, 200, { ok: true, token });
  } catch (e) {
    send(res, e.code === 503 ? 503 : 500, { ok: false, error: e.code === 503 ? 'not configured' : 'server error' });
  }
};
