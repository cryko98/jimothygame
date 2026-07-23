/* GET /api/payout — hourly Vercel cron. Pays the ENTIRE pot (minus a fee
   reserve) to the #1 player of the hour that just ended, on-chain, then
   records the win. Protected by CRON_SECRET (Vercel sends it automatically
   as "Authorization: Bearer <CRON_SECRET>" when the env var is set).

   Safety rails:
   - single-shot per hour (Redis SETNX guard — double cron fires can't double-pay)
   - always leaves FEE_RESERVE_SOL in the wallet for future tx fees
   - skips silently when the hour had no paid runs or the pot is dust
   - PRIZE_WALLET_SECRET stays server-side only; use a dedicated hot wallet
     that only ever holds entry fees. */
'use strict';
const { redis, send, rpc, b58decode, b58encode, buildTransferTx, parseSecret, pubFromSeed, TID } = require('./_lib.js');

module.exports = async (req, res) => {
  try {
    const secret = process.env.CRON_SECRET;
    if (!secret || (req.headers.authorization || '') !== 'Bearer ' + secret) return send(res, 401, { ok: false, error: 'unauthorized' });
    const walletSecret = process.env.PRIZE_WALLET_SECRET, prizeWallet = process.env.PRIZE_WALLET;
    if (!walletSecret || !prizeWallet) return send(res, 503, { ok: false, error: 'payout wallet not configured' });

    // the hour that just ended (UTC)
    const hour = new Date(Date.now() - 3600000).toISOString().slice(0, 13);
    const guard = await redis('SET', 'paid:' + TID() + ':' + hour, '1', 'NX', 'EX', 7 * 86400);
    if (guard !== 'OK') return send(res, 200, { ok: true, skipped: 'already processed', hour });

    const top = await redis('ZREVRANGE', 't:' + TID() + ':h:' + hour + ':lb', '0', '0', 'WITHSCORES') || [];
    if (!top.length) return send(res, 200, { ok: true, skipped: 'no paid runs this hour', hour });
    const winner = top[0], score = Math.round(Number(top[1]));

    const seed = parseSecret(walletSecret);
    if (b58encode(pubFromSeed(seed)) !== prizeWallet) return send(res, 500, { ok: false, error: 'PRIZE_WALLET_SECRET does not match PRIZE_WALLET' });

    const bal = await rpc('getBalance', [prizeWallet, { commitment: 'confirmed' }]);
    const reserve = Math.round(Number(process.env.FEE_RESERVE_SOL || 0.02) * 1e9);
    const lamports = (bal.value || 0) - reserve;
    if (lamports < 1e6) return send(res, 200, { ok: true, skipped: 'pot below minimum', hour, potSol: (bal.value || 0) / 1e9 });

    const bh = await rpc('getLatestBlockhash', [{ commitment: 'finalized' }]);
    const { wire } = buildTransferTx(seed, pubFromSeed(seed), b58decode(winner), lamports, b58decode(bh.value.blockhash));
    const txSig = await rpc('sendTransaction', [wire.toString('base64'), { encoding: 'base64', maxRetries: 5 }]);

    const name = (await redis('HGET', 't:' + TID() + ':names', winner)) || null;
    const rec = { hour, wallet: winner, name, score, amountSol: Math.round(lamports / 1e6) / 1e3, sig: txSig, at: Date.now() };
    await redis('LPUSH', 't:' + TID() + ':winners', JSON.stringify(rec));
    await redis('LTRIM', 't:' + TID() + ':winners', '0', '19');
    send(res, 200, { ok: true, paid: rec });
  } catch (e) {
    send(res, e.code === 503 ? 503 : 500, { ok: false, error: e.rpc ? 'rpc error: ' + e.message : (e.code === 503 ? 'not configured' : 'server error: ' + e.message) });
  }
};
