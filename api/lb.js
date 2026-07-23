/* GET /api/lb        → { ok, top: [{name, score}] }   (global board)
   GET /api/lb?t=1    → current hour's P2E tournament standings, with the
                        usernames registered at wallet connect */
'use strict';
const { redis, send, topList, TID } = require('./_lib.js');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return send(res, 405, { ok: false, error: 'GET only' });
  try {
    const url = new URL(req.url, 'http://x');
    if (url.searchParams.get('t') === '1') {
      const hour = new Date().toISOString().slice(0, 13);
      const flat = (await redis('ZREVRANGE', 't:' + TID() + ':h:' + hour + ':lb', '0', '9', 'WITHSCORES')) || [];
      const top = [];
      if (flat.length) {
        const wallets = []; for (let i = 0; i < flat.length; i += 2) wallets.push(flat[i]);
        const names = (await redis('HMGET', 't:' + TID() + ':names', ...wallets)) || [];
        for (let i = 0; i < wallets.length; i++) {
          const w = wallets[i];
          top.push({ name: names[i] || (w.slice(0, 4) + '…' + w.slice(-4)), score: Math.round(Number(flat[i * 2 + 1])) });
        }
      }
      return send(res, 200, { ok: true, tournament: TID(), hour, top });
    }
    send(res, 200, { ok: true, top: await topList('lb', false) });
  } catch (e) {
    send(res, e.code === 503 ? 503 : 500, { ok: false, error: e.code === 503 ? 'not configured' : 'server error' });
  }
};
