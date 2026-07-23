/* GET /api/pot → live prize-pool + round state for the site:
   { potSol, feeSol, state: 'idle'|'active'|'break',
     roundEndsMs?, breakMs?, leader?, winners: [...] }
   Polling this endpoint also lazily settles any round that just ended. */
'use strict';
const { redis, send, rateLimit, rpc, TID, roundBoard, getRound, breakLeftMs, settleRound } = require('./_lib.js');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return send(res, 405, { ok: false, error: 'GET only' });
  try {
    if (!(await rateLimit(req, 'pot', 40))) return send(res, 429, { ok: false, error: 'slow down' });
    const prizeWallet = process.env.PRIZE_WALLET;
    if (!prizeWallet) return send(res, 503, { ok: false, error: 'prize wallet not configured' });

    await settleRound();   // lazy settlement — any open game page keeps rounds honest

    const bal = await rpc('getBalance', [prizeWallet, { commitment: 'confirmed' }]);
    const reserve = Number(process.env.FEE_RESERVE_SOL || 0.02);
    const potSol = Math.max(0, (bal.value || 0) / 1e9 - reserve);

    const out = { ok: true, potSol: Math.round(potSol * 1000) / 1000, feeSol: Number(process.env.ENTRY_FEE_SOL || 0.05) };
    const round = await getRound();
    const cd = await breakLeftMs();
    if (round && Date.now() <= round.end) {
      out.state = 'active'; out.roundEndsMs = round.end - Date.now();
      const top = (await redis('ZREVRANGE', roundBoard(round.id), '0', '0', 'WITHSCORES')) || [];
      if (top.length) {
        const name = await redis('HGET', 't:' + TID() + ':names', top[0]);
        out.leader = { name: name || (top[0].slice(0, 4) + '…' + top[0].slice(-4)), score: Math.round(Number(top[1])) };
      }
    } else if (cd > 0) { out.state = 'break'; out.breakMs = cd; }
    else out.state = 'idle';

    const winnersRaw = (await redis('LRANGE', 't:' + TID() + ':winners', '0', '4')) || [];
    out.winners = winnersRaw.map(s => { try { return JSON.parse(s); } catch (e) { return null; } }).filter(Boolean);
    send(res, 200, out);
  } catch (e) {
    send(res, e.code === 503 ? 503 : 500, { ok: false, error: e.rpc ? 'rpc error' : (e.code === 503 ? 'not configured' : 'server error') });
  }
};
