/* GET /api/lb        → { ok, top: [{name, score}] }   (global board)
   GET /api/lb?t=1    → tournament board (wallets shortened for display) */
'use strict';
const { send, topList, TID } = require('./_lib.js');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return send(res, 405, { ok: false, error: 'GET only' });
  try {
    const url = new URL(req.url, 'http://x');
    const tourney = url.searchParams.get('t') === '1';
    const top = await topList(tourney ? 't:' + TID() + ':lb' : 'lb', tourney);
    send(res, 200, { ok: true, tournament: tourney ? TID() : undefined, top });
  } catch (e) {
    send(res, e.code === 503 ? 503 : 500, { ok: false, error: e.code === 503 ? 'not configured' : 'server error' });
  }
};
