# Jimothy's Adventures

The official website and game for **Jimothy**, a short-spine raccoon on the biggest little adventure on **Solana**. Ticker: **$JIMO**.

> "They said a raccoon with a short spine couldn't go on adventures. Jimothy said: watch me."

## What's inside

A fully static site + game — no build step, no dependencies, no image assets. Clean, light, emoji-free design.

**Landing page (`index.html`)**
- Hero with a procedurally drawn Jimothy (canvas)
- Story, playable-game promo, Tokenomics, How to Buy (Phantom → SOL → Jupiter/Raydium), Roadmap, Community
- Copy-to-clipboard contract address, responsive layout, disclaimer

**The game (`game.html`) — "Jimothy's Adventures"**
- Top-down 2D adventure across a biome world: grass plains, forests, flower meadows, a snowy patch, sandy beaches, ponds and dirt paths
- Blocky, grainy terrain with feathered biome edges; cubic trees, rocks, bushes, flowers, mushrooms, lilies and ambient butterflies; depth-sorted rendering and soft shadows
- Camera follows the player; WASD/arrows on desktop, on-screen d-pad on mobile
- NPCs (Rocky, Pip) with multi-line dialog and a quest system:
  1. **Waddle & Collect** — gather 8 JIMO coins
  2. **Clean the Meadow** — pick up trash bags and recycle them at the bin
  3. **Find Momo** — rescue the lost cub and bring them back
- A patrolling dog that chases and spooks Jimothy

The world generation and terrain/decoration rendering are adapted from the author's own "pokefight" open-world engine.

## Files

| File | Purpose |
|------|---------|
| `index.html` | Landing page structure & content |
| `styles.css` | Landing page styling (light theme) |
| `game.js` | Pixel-Jimothy mascot painter (nav, hero, promo) |
| `script.js` | Copy-contract button & UI helpers |
| `game.html` | Full-screen game page |
| `game.css` | Game UI styling (HUD, dialog, overlays, mobile controls) |
| `game-adventure.js` | The top-down adventure engine (world + gameplay) |

## Run locally

Fully static — open `index.html`, or serve it:

```bash
python -m http.server 8000
# then open http://localhost:8000
```

## Upgrading to painted sprite art

The game draws Jimothy as clean vector art by default. To swap in painted sprite
PNGs, drop them in `/assets` and set them at the top of `game-adventure.js`:

```js
SPRITES.player = loadImg('assets/jimothy.png');
```

If a sprite image is present it is used automatically instead of the vector drawing.

## To do before mainnet launch

- Drop the real contract address into `#ca` in `index.html`
- Wire up real X / Telegram / Dexscreener links
- Confirm final tokenomics numbers
- Add a real social preview image

---

*$JIMO is a community meme coin with no intrinsic value or expectation of financial return. Not financial advice. Always do your own research.*
