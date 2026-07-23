/* POST /api/t-pay { pk, sig } → verify the 0.05 SOL entry payment on-chain,
   then issue a PAID run token bound to the wallet AND the current round.
   Round lifecycle: the FIRST confirmed payment opens a 1-hour round; after it
   settles there is a 5-minute break, then the next first payment opens the
   next round. During the break (or in a round's final seconds) the payment is
   NOT consumed — the client can retry the same transaction after the break. */
'use strict';
const crypto = require('crypto');
const { redis, hmac, readBody, send, rateLimit, b58decode, rpc, TID, ROUND_MS, roundKey, getRound, breakLeftMs, settleRound } = require('./_lib.js');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'POST only' });
  try {
    if (!(await rateLimit(req, 'pay', 40))) return send(res, 429, { ok: false, error: 'slow down' });
    const b = await readBody(req);
    const pk = String(b.pk || ''), txSig = String(b.sig || '');
    let raw; try { raw = b58decode(pk); } catch (e) { raw = null; }
    if (!raw || raw.length !== 32) return send(res, 400, { ok: false, error: 'bad wallet address' });
    if (!/^[1-9A-HJ-NP-Za-km-z]{80,90}$/.test(txSig)) return send(res, 400, { ok: false, error: 'bad tx signature' });
    const prizeWallet = process.env.PRIZE_WALLET;
    if (!prizeWallet) return send(res, 503, { ok: false, error: 'prize wallet not configured' });

    const entered = await redis('SISMEMBER', 't:' + TID() + ':entrants', pk);
    if (entered !== 1) return send(res, 403, { ok: false, error: 'connect your wallet first' });

    // settle any expired round, then gate on the break / round-ending window —
    // BEFORE consuming the payment, so a paid tx stays valid for a retry.
    await settleRound();
    const cd = await breakLeftMs();
    if (cd > 0) return send(res, 200, { ok: false, error: 'break between rounds — try again in ' + Math.ceil(cd / 1000) + 's (your payment stays valid)', retryMs: cd });
    let round = await getRound();
    if (round && Date.now() > round.end - 30000) return send(res, 200, { ok: false, error: 'round is ending — wait for the break, then try again (your payment stays valid)', retryMs: Math.max(1000, round.end - Date.now() + 1000) });

    if (await redis('GET', 'paytx:' + txSig)) return send(res, 400, { ok: false, error: 'payment already used' });

    // on-chain verification
    const tx = await rpc('getTransaction', [txSig, { encoding: 'jsonParsed', commitment: 'confirmed', maxSupportedTransactionVersion: 0 }]);
    if (!tx) return send(res, 200, { ok: false, error: 'not confirmed yet' });
    if (tx.meta && tx.meta.err) return send(res, 400, { ok: false, error: 'transaction failed on-chain' });
    if (!tx.blockTime || Math.abs(Date.now() / 1000 - tx.blockTime) > 900) return send(res, 400, { ok: false, error: 'payment too old' });
    const keys = ((tx.transaction || {}).message || {}).accountKeys || [];
    const keyStr = k => (typeof k === 'string' ? k : k.pubkey);
    const payerOk = keys.length && keyStr(keys[0]) === pk;
    const prizeIdx = keys.findIndex(k => keyStr(k) === prizeWallet);
    if (!payerOk || prizeIdx < 0) return send(res, 400, { ok: false, error: 'wrong payer or recipient' });
    const need = Math.round(Number(process.env.ENTRY_FEE_SOL || 0.05) * 1e9);
    const delta = (tx.meta.postBalances[prizeIdx] || 0) - (tx.meta.preBalances[prizeIdx] || 0);
    if (delta < need) return send(res, 400, { ok: false, error: 'payment amount too low' });

    // burn the payment → exactly one paid run
    const fresh = await redis('SET', 'paytx:' + txSig, pk, 'NX', 'EX', 172800);
    if (fresh !== 'OK') return send(res, 400, { ok: false, error: 'payment already used' });

    // the FIRST confirmed payment opens the round (atomic create)
    if (!round) {
      const cand = { id: Date.now().toString(36) + crypto.randomBytes(2).toString('hex'), start: Date.now(), end: Date.now() + ROUND_MS };
      const made = await redis('SET', roundKey(), JSON.stringify(cand), 'NX');
      round = made === 'OK' ? cand : await getRound();
      if (!round) { await redis('DEL', 'paytx:' + txSig); return send(res, 500, { ok: false, error: 'round open failed — payment refunded for retry' }); }
    }

    const runId = crypto.randomBytes(12).toString('hex'), ts = Date.now();
    const rid = 'R' + round.id;
    const token = runId + '.' + ts + '.' + rid + '.' + hmac(runId + '.' + ts + '.' + rid + '.' + pk);
    send(res, 200, { ok: true, token, roundEndsMs: round.end - Date.now() });
  } catch (e) {
    send(res, e.code === 503 ? 503 : 500, { ok: false, error: e.rpc ? 'rpc error' : (e.code === 503 ? 'not configured' : 'server error') });
  }
};
