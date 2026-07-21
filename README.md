# Jimothy's Adventures

The official website and game for **Jimothy**, a short-spine raccoon with a dog on his tail. Ticker: **$JIMO** on **Solana**.

> "They said a raccoon with a short spine couldn't outrun anything. Jimothy said: watch me."

## What's inside

A fully static site + game — no build step, no dependencies, no image assets. Clean, light, emoji-free design.

**Landing page (`index.html`)**
- Hero with a procedurally drawn Jimothy (canvas)
- Story, game promo, Tokenomics, How to Buy (Phantom → SOL → Jupiter/Raydium), Roadmap, Community
- Copy-to-clipboard contract address, responsive layout, disclaimer

**The game (`game.html`) — "Jimothy Run"**
An endless side-scrolling runner starring the Jimothy raccoon.
- **Endless, procedural** track that blends a **forest** biome and a **city** biome with parallax backgrounds
- **Jump & double-jump** over obstacles (logs, rocks, bins, hydrants, crates) and **gaps/chasms** — falling in ends the run
- **The chasing dog is your health**: a lead meter drains over time and drops when you get hit; **food scraps** push the dog back. Lose the lead and it catches you.
- **Enemies** — dogs and people on the track; jump them or **throw a can** (a picked-up power-up) to knock them out
- **Power-ups** from bins: cans (throwables), shield, speed boost, coin magnet
- **Score = distance + collected**, saved to a **local leaderboard** (with a name entry on a new high score)
- Controls: Space / Up / tap to jump, F / Down / button to throw; touch buttons on mobile

### Roadmap in the code
- Scores persist in `localStorage` (`jimothy_run_lb`); a **global online leaderboard** needs a small backend server — that's the main next step.

## Files

| File | Purpose |
|------|---------|
| `index.html` | Landing page structure & content |
| `styles.css` | Landing page styling (light theme) |
| `mascot.js` | Smooth cartoon Jimothy for the landing (nav, hero, promo) |
| `script.js` | Copy-contract button & UI helpers |
| `game.html` | The game page |
| `run.css` | Game HUD / overlay styling |
| `run.js` | The endless-runner engine |

## Run locally

Fully static — open `index.html`, or serve it:

```bash
python -m http.server 8000
# then open http://localhost:8000
```

## To do before mainnet launch

- Drop the real contract address into `#ca` in `index.html`
- Wire up real X / Telegram / Dexscreener links
- Confirm final tokenomics numbers
- Add a real social preview image

---

*$JIMO is a community meme coin with no intrinsic value or expectation of financial return. Not financial advice. Always do your own research.*
