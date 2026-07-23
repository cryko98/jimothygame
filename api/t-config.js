/* GET /api/t-config → { prizeWallet, feeSol, blockhash }
   Client-side config for the P2E entry payment (fresh blockhash included so
   the browser never needs direct RPC access). */
'use strict';
const { send, rateLimit, rpc } = require('./_lib.js');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return send(res, 405, { ok: false, error: 'GET only' });
  try {
    if (!(await rateLimit(req, 'cfg', 30))) return send(res, 429, { ok: false, error: 'slow down' });
    const prizeWallet = process.env.PRIZE_WALLET;
    if (!prizeWallet) return send(res, 503, { ok: false, error: 'prize wallet not configured' });
    const bh = await rpc('getLatestBlockhash', [{ commitment: 'finalized' }]);
    send(res, 200, { ok: true, prizeWallet, feeSol: Number(process.env.ENTRY_FEE_SOL || 0.05), blockhash: bh.value.blockhash });
  } catch (e) {
    send(res, e.code === 503 ? 503 : 500, { ok: false, error: e.rpc ? 'rpc error' : (e.code === 503 ? 'not configured' : 'server error') });
  }
};
