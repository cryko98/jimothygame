/* GET /api/payout — cron-triggered BACKUP settlement.
   Primary settlement is lazy (any /api/pot poll, payment or submit settles an
   expired round), so gameplay traffic keeps rounds honest even on Vercel's
   Hobby plan where crons run only daily. This endpoint just runs the same
   idempotent settleRound(); CRON_SECRET-protected. */
'use strict';
const { send, settleRound } = require('./_lib.js');

module.exports = async (req, res) => {
  try {
    const secret = process.env.CRON_SECRET;
    if (!secret || (req.headers.authorization || '') !== 'Bearer ' + secret) return send(res, 401, { ok: false, error: 'unauthorized' });
    const r = await settleRound();
    send(res, 200, Object.assign({ ok: true }, r));
  } catch (e) {
    send(res, e.code === 503 ? 503 : 500, { ok: false, error: e.rpc ? 'rpc error: ' + e.message : (e.code === 503 ? 'not configured' : 'server error: ' + e.message) });
  }
};
