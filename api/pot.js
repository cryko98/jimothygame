/* GET /api/pot → live prize-pool data for the site:
   { potSol, feeSol, nextPayoutMs, leader, winners: [{hour, name, wallet, amountSol, sig}] } */
'use strict';
const { redis, send, rateLimit, rpc, TID } = require('./_lib.js');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return send(res, 405, { ok: false, error: 'GET only' });
  try {
    if (!(await rateLimit(req, 'pot', 30))) return send(res, 429, { ok: false, error: 'slow down' });
    const prizeWallet = process.env.PRIZE_WALLET;
    if (!prizeWallet) return send(res, 503, { ok: false, error: 'prize wallet not configured' });

    const bal = await rpc('getBalance', [prizeWallet, { commitment: 'confirmed' }]);
    const reserve = Number(process.env.FEE_RESERVE_SOL || 0.02);
    const potSol = Math.max(0, (bal.value || 0) / 1e9 - reserve);

    // current hour's leader
    const hour = new Date().toISOString().slice(0, 13);
    const top = await redis('ZREVRANGE', 't:' + TID() + ':h:' + hour + ':lb', '0', '0', 'WITHSCORES') || [];
    let leader = null;
    if (top.length) {
      const name = await redis('HGET', 't:' + TID() + ':names', top[0]);
      leader = { name: name || (top[0].slice(0, 4) + '…' + top[0].slice(-4)), score: Math.round(Number(top[1])) };
    }
    const winnersRaw = await redis('LRANGE', 't:' + TID() + ':winners', '0', '4') || [];
    const winners = winnersRaw.map(s => { try { return JSON.parse(s); } catch (e) { return null; } }).filter(Boolean);
    const now = Date.now();
    const nextPayoutMs = 3600000 - (now % 3600000);

    send(res, 200, { ok: true, potSol: Math.round(potSol * 1000) / 1000, feeSol: Number(process.env.ENTRY_FEE_SOL || 0.05), nextPayoutMs, leader, winners });
  } catch (e) {
    send(res, e.code === 503 ? 503 : 500, { ok: false, error: e.rpc ? 'rpc error' : (e.code === 503 ? 'not configured' : 'server error') });
  }
};
