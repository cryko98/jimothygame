# 🦝 $JIMOTHY — Short Spine, Big Adventure

The official website for **Jimothy**, a short-spine-syndrome raccoon on the biggest little adventure on **Solana**.

> *"They said a raccoon with a short spine couldn't go on adventures. Jimothy said: watch me."*

## What's inside

A fully static memecoin site + game — no build step, no dependencies, no image assets.

**Landing page (`index.html`)**
- **Hero** with a procedurally drawn Jimothy (canvas)
- **Lore** — the legend of the trash panda
- A promo that launches the full game on its own page
- **Tokenomics**, **How to Buy** (Phantom → SOL → Jupiter/Raydium), **Roadmap**, **Community**
- Copy-to-clipboard contract address, responsive layout, meme disclaimer

**The game (`game.html`) — "Jimothy's Big Adventure"**
- Top-down 2D adventure: open world with grass, paths, ponds, trees, houses
- Camera follows the player; WASD/arrows on desktop, on-screen d-pad on mobile
- NPCs (Rocky, Pip) with a multi-line dialog + quest system:
  1. **Waddle & Collect** — gather 8 $JIMO coins
  2. **Clean the Alley** — pick up 3 trash bags, recycle them at the bin
  3. **Find Momo** — rescue the lost cub and bring them back
- A patrolling **dog** that chases and spooks Jimothy
- Cartoon vector raccoon art, depth-sorted rendering

## Files

| File | Purpose |
|------|---------|
| `index.html` | Landing page structure & content |
| `styles.css` | Landing page styling (dark trash-panda theme) |
| `game.js` | Pixel-Jimothy mascot painter (hero + promo) |
| `script.js` | Copy-contract button & UI helpers |
| `game.html` | Full-screen game page |
| `game.css` | Game UI styling (HUD, dialog, overlays, mobile controls) |
| `game-adventure.js` | The top-down adventure engine |

## Upgrading to painted sprite art

The game draws Jimothy as clean vector art by default. To swap in real painted
sprite PNGs, drop them in `/assets` and set them at the top of `game-adventure.js`:

```js
SPRITES.player = loadImg('assets/jimothy.png');
```

If a sprite image is present it's used automatically instead of the vector drawing.

## Run locally

It's fully static — just open `index.html`, or serve it:

```bash
python -m http.server 8000
# then open http://localhost:8000
```

## To do before mainnet launch

- [ ] Drop the real contract address into `#ca` in `index.html`
- [ ] Wire up real X / Telegram / Dexscreener links (`.social-row`)
- [ ] Confirm final tokenomics numbers in the Tokenomics section
- [ ] Add real Open Graph / social preview image

---

*$JIMOTHY is a community meme coin with no intrinsic value or expectation of financial return. Not financial advice. DYOR.*
