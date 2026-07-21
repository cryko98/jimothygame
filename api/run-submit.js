/* POST /api/run-submit → validate a finished run and record it.
   The server is the authority: it checks the signed token, that the token is
   used only once, that the claimed duration matches real elapsed time, that
   distance is physically possible, that pickup counts are plausible, and that
   the score matches the game's exact formula. Anything implausible is dropped. */
'use strict';
const { redis, hmac, timingEqual, readBody, send, sanitizeName, rateLimit, TID, topList } = require('./_lib.js');

const MAX_SPEED = 22;        // units/sec — above the game's real top speed
const MIN_DUR = 5;           // runs shorter than this can't score
const MAX_AGE_MS = 30 * 60 * 1000;
const MAX_SCORE = 100000;

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'POST only' });
  try {
    if (!(await rateLimit(req, 'submit', 20))) return send(res, 429, { ok: false, error: 'slow down' });
    const b = await readBody(req);

    // 1) token: shape + signature + age
    const parts = String(b.token || '').split('.');
    if (parts.length !== 3) return send(res, 400, { ok: false, error: 'bad token' });
    const [runId, tsStr, sig] = parts, ts = Number(tsStr);
    if (!/^[0-9a-f]{24}$/.test(runId) || !Number.isFinite(ts)) return send(res, 400, { ok: false, error: 'bad token' });
    if (!timingEqual(sig, hmac(runId + '.' + ts))) return send(res, 400, { ok: false, error: 'bad signature' });
    const elapsed = (Date.now() - ts) / 1000;
    if (elapsed < 0 || elapsed * 1000 > MAX_AGE_MS) return send(res, 400, { ok: false, error: 'token expired' });

    // 2) numbers: integers in sane ranges
    const num = v => (Number.isFinite(Number(v)) ? Number(v) : NaN);
    const score = num(b.score), dist = num(b.dist), coins = num(b.coins), kills = num(b.kills);
    const thrown = num(b.thrown), jumps = num(b.jumps), dur = num(b.dur);
    for (const v of [score, dist, coins, kills, thrown, jumps, dur]) if (!Number.isFinite(v) || v < 0) return send(res, 400, { ok: false, error: 'bad payload' });
    if (score > MAX_SCORE || dist > MAX_SPEED * 3600) return send(res, 400, { ok: false, error: 'implausible' });

    // 3) physics & economy plausibility
    if (dur < MIN_DUR) return send(res, 400, { ok: false, error: 'run too short' });
    if (dur > elapsed + 5) return send(res, 400, { ok: false, error: 'duration > elapsed' });
    if (elapsed < dur * 0.8) return send(res, 400, { ok: false, error: 'submitted too fast' });
    if (dist > MAX_SPEED * dur) return send(res, 400, { ok: false, error: 'too fast' });
    if (coins > dist / 1.5 + 10) return send(res, 400, { ok: false, error: 'too many treats' });
    if (kills > thrown || thrown > dist / 2 + 10) return send(res, 400, { ok: false, error: 'too many kills' });
    if (jumps > dur * 3 + 10) return send(res, 400, { ok: false, error: 'too many jumps' });
    if (Math.abs(score - (Math.floor(dist) + coins * 5 + kills * 15)) > 2) return send(res, 400, { ok: false, error: 'score mismatch' });

    // 4) single use — a token can never score twice
    const fresh = await redis('SET', 'used:' + runId, '1', 'NX', 'EX', 86400);
    if (fresh !== 'OK') return send(res, 400, { ok: false, error: 'token already used' });

    // 5) record (keep each name's best; GT = only raise)
    const name = sanitizeName(b.name);
    await redis('ZADD', 'lb', 'GT', String(score), name);

    // tournament board: only wallets that entered via /api/t-join
    let tournament = false;
    const wallet = typeof b.wallet === 'string' && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(b.wallet) ? b.wallet : null;
    if (wallet) {
      const entered = await redis('SISMEMBER', 't:' + TID() + ':entrants', wallet);
      if (entered === 1) { await redis('ZADD', 't:' + TID() + ':lb', 'GT', String(score), wallet); tournament = true; }
    }

    send(res, 200, { ok: true, tournament, top: await topList('lb', false) });
  } catch (e) {
    send(res, e.code === 503 ? 503 : 500, { ok: false, error: e.code === 503 ? 'not configured' : 'server error' });
  }
};
