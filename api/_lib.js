/* Shared helpers for the Vercel serverless API (zero-dependency).
   Storage: Upstash Redis via REST. Auth: HMAC run tokens + Ed25519 wallet sigs. */
'use strict';
const crypto = require('crypto');

// Accept both naming schemes: manual Upstash setup (UPSTASH_*) and the
// Vercel Marketplace / KV integration (KV_REST_API_*).
const UP_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const UP_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

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

function b58encode(buf) {
  let n = 0n; for (const b of buf) n = (n << 8n) + BigInt(b);
  let s = ''; while (n > 0n) { s = B58[Number(n % 58n)] + s; n /= 58n; }
  for (const b of buf) { if (b === 0) s = '1' + s; else break; }
  return s || '1';
}

// ---- Solana RPC + native SOL transfer (zero-dependency) ------------------
async function rpc(method, params) {
  const url = process.env.RPC_URL || 'https://api.mainnet-beta.solana.com';
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
  const d = await r.json();
  if (d.error) { const e = new Error('rpc ' + method + ': ' + d.error.message); e.rpc = true; throw e; }
  return d.result;
}

// Sign with a raw 32-byte Ed25519 seed via node crypto (PKCS8 DER wrap)
function ed25519KeyFromSeed(seed32) {
  const pkcs8 = Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), seed32]);
  return crypto.createPrivateKey({ key: pkcs8, format: 'der', type: 'pkcs8' });
}
function pubFromSeed(seed32) {
  const pub = crypto.createPublicKey(ed25519KeyFromSeed(seed32));
  return pub.export({ format: 'der', type: 'spki' }).subarray(-32);
}

/* Build + sign a legacy Solana transaction with ONE SystemProgram.transfer.
   Wire layout (all counts are single-byte compact-u16 — our values are tiny):
   [sigCount=1][64-byte sig] · message = [header 3B][acct count=3][from][to]
   [system program][recentBlockhash][ix count=1][programIdx=2][acctIdx 0,1]
   [data len=12][u32 LE 2 (Transfer)][u64 LE lamports]                       */
function buildTransferTx(seed32, fromRaw, toRaw, lamports, blockhashRaw) {
  const SYSTEM = Buffer.alloc(32);   // 111...1 program id = 32 zero bytes
  const data = Buffer.alloc(12);
  data.writeUInt32LE(2, 0); data.writeBigUInt64LE(BigInt(lamports), 4);
  const msg = Buffer.concat([
    Buffer.from([1, 0, 1]),                       // 1 sig, 0 ro-signed, 1 ro-unsigned
    Buffer.from([3]), fromRaw, toRaw, SYSTEM,     // account keys
    blockhashRaw,
    Buffer.from([1]),                             // one instruction
    Buffer.from([2]),                             // program id index
    Buffer.from([2, 0, 1]),                       // 2 account indices: from, to
    Buffer.from([12]), data,
  ]);
  const sig = crypto.sign(null, msg, ed25519KeyFromSeed(seed32));
  return { wire: Buffer.concat([Buffer.from([1]), sig, msg]), sig };
}

// Accepts a base58 64-byte secret (Phantom export) or a 32-byte seed
function parseSecret(b58sec) {
  const raw = b58decode(String(b58sec).trim());
  if (raw.length === 64) return raw.subarray(0, 32);
  if (raw.length === 32) return raw;
  throw new Error('bad secret key length ' + raw.length);
}

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

module.exports = { redis, hmac, timingEqual, readBody, ip, send, sanitizeName, rateLimit, b58decode, b58encode, verifyEd25519, TID, topList, rpc, buildTransferTx, parseSecret, pubFromSeed };
