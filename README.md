# Jimothy's Adventures

The official website and game for **Jimothy**, a short-spine raccoon with a dog on his tail. Ticker: **$JIMO** on **Solana**.

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
| `TOKEN_MINT` | no | the $JIMO SPL mint address; **unset = tournament entry open** (pre-launch) |
| `MIN_TOKEN_BALANCE` | no | minimum holding to enter (default `1`) |
| `RPC_URL` | no | Solana RPC (default public mainnet; use a private RPC in production) |

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

## P2E tournament

- Players click **Connect wallet** (Phantom) on the start screen, sign a one-time nonce, and `/api/t-join` verifies the Ed25519 signature server-side.
- If `TOKEN_MINT` is set, the wallet must hold ≥ `MIN_TOKEN_BALANCE` of the project coin (checked on-chain via RPC) to enter.
- Entered wallets' runs land on a separate tournament board (`/api/lb?t=1`), scored with the same anti-cheat pipeline.
- **Payouts:** export the tournament top (`ZREVRANGE t:<id>:lb 0 N WITHSCORES` in Upstash), review it, then send $JIMO from the treasury wallet to the winners. Never store the treasury private key in this repo, in Vercel env vars, or anywhere client-reachable — sign payouts locally or with a multisig (e.g. Squads).

## To do before mainnet launch

- Drop the real contract address into `#ca` in `index.html`
- Wire up real X / Telegram / Dexscreener links
- Confirm final tokenomics numbers
- Add a real social preview image

---

*$JIMO is a community meme coin with no intrinsic value or expectation of financial return. Not financial advice. Always do your own research.*
