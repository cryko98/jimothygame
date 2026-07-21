/* Shared helpers for the Vercel serverless API (zero-dependency).
   Storage: Upstash Redis via REST. Auth: HMAC run tokens + Ed25519 wallet sigs. */
'use strict';
const crypto = require('crypto');

const UP_URL = process.env.UPSTASH_REDIS_REST_URL;
const UP_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

// Single Redis command over Upstash REST: redis('ZADD','lb','GT','10','name')
async function redis(...cmd) {
  if (!UP_URL || !UP_TOKEN) { const e = new Error('storage not configured'); e.code = 503; throw e; }
  const r = await fetch(UP_URL, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + UP_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  const d = await r.json();
  if (d.error) throw new Error('redis: ' + d.error);
  return d.result;
}

function hmac(s) {
  const secret = process.env.RUN_SECRET;
  if (!secret) { const e = new Error('RUN_SECRET not configured'); e.code = 503; throw e; }
  return crypto.createHmac('sha256', secret).update(s).digest('hex');
}
function timingEqual(a, b) {
  const ba = Buffer.from(String(a)), bb = Buffer.from(String(b));
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

function readBody(req) {
  return new Promise(resolve => {
    let b = '';
    req.on('data', c => { b += c; if (b.length > 10000) { req.destroy(); resolve({}); } });
    req.on('end', () => { try { resolve(JSON.parse(b || '{}')); } catch (e) { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}
function ip(req) { return ((req.headers['x-forwarded-for'] || '').split(',')[0].trim()) || req.socket.remoteAddress || '?'; }
function send(res, code, obj) { res.statusCode = code; res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify(obj)); }
function sanitizeName(n) { return (String(n || '').replace(/[^\w \-.]/g, '').trim().slice(0, 12)) || 'Jimothy'; }

// per-IP sliding-minute rate limit
async function rateLimit(req, bucket, max) {
  const key = 'rl:' + bucket + ':' + ip(req) + ':' + Math.floor(Date.now() / 60000);
  const n = await redis('INCR', key);
  if (n === 1) await redis('EXPIRE', key, 70);
  return n <= max;
}

// ---- base58 (Solana addresses) -------------------------------------------
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function b58decode(s) {
  if (!/^[1-9A-HJ-NP-Za-km-z]+$/.test(s)) throw new Error('bad base58');
  let n = 0n;
  for (const c of s) n = n * 58n + BigInt(B58.indexOf(c));
  const bytes = [];
  while (n > 0n) { bytes.push(Number(n & 255n)); n >>= 8n; }
  for (const c of s) { if (c === '1') bytes.push(0); else break; }
  return Buffer.from(bytes.reverse());
}

// ---- Ed25519 signature check (raw 32-byte Solana pubkey) -----------------
function verifyEd25519(messageStr, sigBuf, pubRaw32) {
  if (pubRaw32.length !== 32 || sigBuf.length !== 64) return false;
  const spki = Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), pubRaw32]);
  const key = crypto.createPublicKey({ key: spki, format: 'der', type: 'spki' });
  return crypto.verify(null, Buffer.from(messageStr, 'utf8'), key, sigBuf);
}

const TID = () => (process.env.TOURNAMENT_ID || 'season1').replace(/[^\w-]/g, '');

async function topList(key, shorten) {
  const flat = (await redis('ZREVRANGE', key, '0', '9', 'WITHSCORES')) || [];
  const out = [];
  for (let i = 0; i < flat.length; i += 2) {
    let name = String(flat[i]);
    if (shorten && name.length > 14) name = name.slice(0, 4) + '…' + name.slice(-4);
    out.push({ name, score: Math.round(Number(flat[i + 1])) });
  }
  return out;
}

module.exports = { redis, hmac, timingEqual, readBody, ip, send, sanitizeName, rateLimit, b58decode, verifyEd25519, TID, topList };
