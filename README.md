# Jimothy Run

The official website and game for **Jimothy**, a short-spine raccoon with a dog on his tail. Ticker: **$JIMORUN** on **Solana**.

> "They said a raccoon with a short spine couldn't outrun anything. Jimothy said: watch me."

## What's inside

A fully static site + game — no build step, no dependencies, no image assets. Clean, light, emoji-free design.

**Landing page (`index.html`)**
- Hero with a procedurally drawn Jimothy (canvas)
- Story, game promo, Tokenomics, How to Buy (Phantom → SOL → Jupiter/Raydium), Roadmap, Community
- Copy-to-clipboard contract address, responsive layout, disclaimer

**The game (`game.html`) — "Jimothy Run 3D"**
An endless side-scrolling runner in **real 3D** (Three.js), starring the Jimothy raccoon.
- **Low-poly 3D world** built entirely from primitives — no external models. Lighting, soft shadows, fog and depth.
- **Endless, procedural** track that blends a **forest** biome and a **city** biome (buildings, hydrants, bins)
- **Jump & double-jump** over obstacles (logs, rocks, bins, hydrants, crates) and **real gaps/chasms** — fall in and the run ends
- **The chasing dog is your health**: a lead meter drains over time and drops when you get hit; **food scraps** push the dog back. It runs on the ground and **physically hops obstacles and chasms** — no clipping through. Lose the lead and it catches you.
- **Enemies** — dogs and people on the track; jump them or **throw a can** (a picked-up power-up) to knock them out
- **Power-ups** from bins: cans (throwables), shield, speed boost, coin magnet
- **Score = distance + collected**, saved to a **local leaderboard** (name entry on a new high score)
- Controls: Space / Up / tap to jump, F / Down / button to throw; touch buttons on mobile

Three.js (r128) is vendored as `three.min.js` so the game runs fully offline with no CDN.

## Files

| File | Purpose |
|------|---------|
| `index.html` | Landing page structure & content |
| `styles.css` | Landing page styling (light theme) |
| `mascot.js` | Smooth cartoon Jimothy for the landing (nav, hero, promo) |
| `script.js` | Copy-contract button & UI helpers |
| `game.html` | The game page |
| `run.css` | Game HUD / overlay styling |
| `run3d.js` | The 3D endless-runner engine + server/net layer |
| `three.min.js` | Vendored Three.js r128 (rendering library) |
| `api/` | Vercel serverless functions (leaderboard, anti-cheat, tournament) |

## Run locally

The site is static — serve it and play (the game auto-detects that the API is absent and falls back to a device-local leaderboard):

```bash
python -m http.server 8000
# then open http://localhost:8000
```

## Deploy: Vercel + Upstash (global leaderboard)

1. Push this repo to GitHub and **import it into Vercel** (framework: "Other", no build step). The static site and the `api/*` functions deploy together — zero npm dependencies.
2. Create a free **Upstash Redis** database and copy its REST credentials.
3. In Vercel → Project → Settings → **Environment Variables**, set:

| Variable | Required | What it is |
|----------|----------|------------|
| `UPSTASH_REDIS_REST_URL` | yes | Upstash REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | yes | Upstash REST token |
| `RUN_SECRET` | yes | long random string — signs run tokens (e.g. `openssl rand -hex 32`) |
| `TOURNAMENT_ID` | no | current tournament key (default `season1`) — bump it per season |
| `TOKEN_MINT` | no | the $JIMORUN SPL mint address; **unset = tournament entry open** (pre-launch) |
| `MIN_TOKEN_BALANCE` | no | minimum holding to enter (default `1`) |
| `RPC_URL` | no | Solana RPC (default public mainnet; use a private RPC in production) |
| `PRIZE_WALLET` | for P2E | public address that collects the 0.05 SOL entries and pays the pot |
| `PRIZE_WALLET_SECRET` | for payouts | base58 secret key of `PRIZE_WALLET` (**dedicated hot wallet only** — it signs the hourly payouts) |
| `ENTRY_FEE_SOL` | no | P2E entry fee per run (default `0.05`) |
| `FEE_RESERVE_SOL` | no | always left in the wallet for tx fees (default `0.02`) |
| `CRON_SECRET` | for payouts | random string; Vercel sends it with the hourly cron so only the cron can trigger payouts |

4. Redeploy. The game detects `/api/lb` and switches to the **global leaderboard** automatically; without the env vars the API answers 503 and the game stays in offline mode.

## Security model (anti-cheat)

The browser can never be fully trusted — so the **server is the authority** and the client is treated as hostile:

- **Signed, single-use run tokens** — a submit is only accepted with a token issued by `/api/run-start` (HMAC with `RUN_SECRET`, 30-min expiry, single use enforced in Redis). Forged or replayed tokens are rejected.
- **Real-time check** — the token's issue time must roughly match the claimed run duration; you can't "finish" a 10-minute run 5 seconds after starting it.
- **Physics plausibility** — distance is capped by the game's true top speed × duration; treat/kill/jump counts are capped by what a real run can produce.
- **Exact score reconciliation** — the server recomputes `floor(dist) + treats*5 + kills*15` and rejects any mismatch.
- **Rate limiting** per IP on every endpoint; names are sanitized server-side.
- No cheat/debug hooks in production (a read-only state hook exists on `localhost` only).

All of this is covered by an offline test suite (17 checks: forged/replayed tokens, impossible speed, formula mismatch, instant submits, bad wallet signatures — all rejected). Honest caveat: no client game can be *literally* 100% tamper-proof (a determined bot could simulate a plausible human run); this design makes score forgery impractical, and tournament payouts should additionally be reviewed manually before sending.

## P2E tournament — hourly SOL pot

- **Entry:** the player types a **username (required)**, connects Phantom and signs a one-time nonce; `/api/t-join` verifies the Ed25519 signature server-side. If `TOKEN_MINT` is set, the wallet must also hold ≥ `MIN_TOKEN_BALANCE` of the project coin (checked on-chain).
- **Paid runs:** each P2E run costs `ENTRY_FEE_SOL` (default **0.05 SOL**), paid straight to `PRIZE_WALLET`. The server verifies the payment **on-chain** (`/api/t-pay`: correct payer, correct recipient, correct amount, recent, and each transaction spendable exactly once) before issuing a paid run token.
- **Hourly pot:** paid runs land on the current hour's board (`/api/lb?t=1`). At minute 1 of every hour, a **Vercel cron** calls `/api/payout`: the top player of the hour that just ended receives the **entire wallet balance minus `FEE_RESERVE_SOL`**, sent automatically on-chain (the transaction is built and signed server-side with zero dependencies). Hours with no paid runs roll the pot over.
- **Live pot on the site:** `/api/pot` feeds the game's tournament panel — current pot, countdown to payout, this hour's leader, and recent winners with their tx signatures.
- **Hot-wallet warning:** `PRIZE_WALLET_SECRET` makes automated payouts possible, which by definition puts a key on the server. Use a **dedicated wallet that only ever holds entry fees**, never the treasury; sweep profits out regularly. Payout attempts are idempotent (one per hour, Redis-guarded) and the cron is authenticated with `CRON_SECRET`.

## To do before mainnet launch

- Drop the real contract address into `#ca` in `index.html`
- Wire up real X / Telegram / Dexscreener links
- Confirm final tokenomics numbers
- Add a real social preview image

---

*$JIMORUN is a community meme coin with no intrinsic value or expectation of financial return. Not financial advice. Always do your own research.*
