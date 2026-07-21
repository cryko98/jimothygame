/* POST /api/t-join { pk, sig } → verify the wallet signature + token holding,
   then register the wallet as a tournament entrant.
   - sig: base64 Ed25519 signature of the nonce issued by /api/t-nonce
   - token gate: if TOKEN_MINT is set, the wallet must hold ≥ MIN_TOKEN_BALANCE
     of that SPL token (checked on-chain via RPC). If TOKEN_MINT is not set yet
     (pre-launch), entry is open. */
'use strict';
const { redis, readBody, send, rateLimit, b58decode, verifyEd25519, TID } = require('./_lib.js');

async function tokenBalance(pk) {
  const mint = process.env.TOKEN_MINT;
  if (!mint) return null;   // pre-launch: no gate yet
  const rpc = process.env.RPC_URL || 'https://api.mainnet-beta.solana.com';
  const r = await fetch(rpc, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getTokenAccountsByOwner', params: [pk, { mint }, { encoding: 'jsonParsed' }] }),
  });
  const d = await r.json();
  if (d.error) throw new Error('rpc: ' + d.error.message);
  let sum = 0;
  for (const acc of (d.result && d.result.value) || []) {
    const amt = acc.account && acc.account.data && acc.account.data.parsed && acc.account.data.parsed.info && acc.account.data.parsed.info.tokenAmount;
    if (amt) sum += Number(amt.uiAmount || 0);
  }
  return sum;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'POST only' });
  try {
    if (!(await rateLimit(req, 'join', 10))) return send(res, 429, { ok: false, error: 'slow down' });
    const b = await readBody(req);
    const pk = String(b.pk || '');
    let raw; try { raw = b58decode(pk); } catch (e) { raw = null; }
    if (!raw || raw.length !== 32) return send(res, 400, { ok: false, error: 'bad wallet address' });

    // 1) the wallet must sign the exact nonce we issued
    const nonce = await redis('GET', 'nonce:' + pk);
    if (!nonce) return send(res, 400, { ok: false, error: 'nonce expired — try again' });
    let sig; try { sig = Buffer.from(String(b.sig || ''), 'base64'); } catch (e) { sig = Buffer.alloc(0); }
    if (!verifyEd25519(nonce, sig, raw)) return send(res, 400, { ok: false, error: 'signature check failed' });
    await redis('DEL', 'nonce:' + pk);

    // 2) token gate (on-chain balance)
    const balance = await tokenBalance(pk);
    const minBal = Number(process.env.MIN_TOKEN_BALANCE || 1);
    if (balance !== null && balance < minBal) return send(res, 403, { ok: false, error: 'you need at least ' + minBal + ' of the project coin to enter' });

    // 3) register
    await redis('SADD', 't:' + TID() + ':entrants', pk);
    send(res, 200, { ok: true, tournament: TID(), balance });
  } catch (e) {
    send(res, e.code === 503 ? 503 : 500, { ok: false, error: e.code === 503 ? 'not configured' : 'server error' });
  }
};
