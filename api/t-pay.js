/* POST /api/t-pay { pk, sig } → verify the 0.05 SOL entry payment on-chain,
   then issue a PAID run token (bound to the wallet, single use).
   sig = the transaction signature returned by Phantom's signAndSendTransaction.
   The client polls this endpoint until the transaction is confirmed. */
'use strict';
const crypto = require('crypto');
const { redis, hmac, readBody, send, rateLimit, b58decode, rpc, TID } = require('./_lib.js');

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

    // must be an entrant (wallet connected + username registered via /api/t-join)
    const entered = await redis('SISMEMBER', 't:' + TID() + ':entrants', pk);
    if (entered !== 1) return send(res, 403, { ok: false, error: 'connect your wallet first' });

    // already-used payment? (idempotent guard BEFORE rpc to save calls)
    if (await redis('GET', 'paytx:' + txSig)) return send(res, 400, { ok: false, error: 'payment already used' });

    // on-chain check
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

    // burn the payment → one paid run
    const fresh = await redis('SET', 'paytx:' + txSig, pk, 'NX', 'EX', 172800);
    if (fresh !== 'OK') return send(res, 400, { ok: false, error: 'payment already used' });

    const runId = crypto.randomBytes(12).toString('hex'), ts = Date.now();
    const token = runId + '.' + ts + '.1.' + hmac(runId + '.' + ts + '.1.' + pk);
    send(res, 200, { ok: true, token });
  } catch (e) {
    send(res, e.code === 503 ? 503 : 500, { ok: false, error: e.rpc ? 'rpc error' : (e.code === 503 ? 'not configured' : 'server error') });
  }
};
