/* GET /api/lb        → { ok, top: [{name, score}] }   (global board)
   GET /api/lb?t=1    → the CURRENT round's P2E standings, with the usernames
                        registered at wallet connect (empty when no round) */
'use strict';
const { redis, send, topList, TID, getRound, roundBoard } = require('./_lib.js');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return send(res, 405, { ok: false, error: 'GET only' });
  try {
    const url = new URL(req.url, 'http://x');
    if (url.searchParams.get('t') === '1') {
      const round = await getRound();
      const flat = round ? ((await redis('ZREVRANGE', roundBoard(round.id), '0', '9', 'WITHSCORES')) || []) : [];
      const top = [];
      if (flat.length) {
        const wallets = []; for (let i = 0; i < flat.length; i += 2) wallets.push(flat[i]);
        const names = (await redis('HMGET', 't:' + TID() + ':names', ...wallets)) || [];
        for (let i = 0; i < wallets.length; i++) {
          const w = wallets[i];
          top.push({ name: names[i] || (w.slice(0, 4) + '…' + w.slice(-4)), score: Math.round(Number(flat[i * 2 + 1])) });
        }
      }
      return send(res, 200, { ok: true, tournament: TID(), round: round ? round.id : null, top });
    }
    send(res, 200, { ok: true, top: await topList('lb', false) });
  } catch (e) {
    send(res, e.code === 503 ? 503 : 500, { ok: false, error: e.code === 503 ? 'not configured' : 'server error' });
  }
};
