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
- Large top-down 2D world (3600×2400) with five biomes: forest, flower meadow, snowfield, sandy beach and ponds, joined by dirt paths (ponds kept off the roads)
- Soft cartoon art — round trees, rocks, bushes, flowers, mushrooms, lilies and butterflies; depth-sorted rendering and soft shadows
- **Minimap with legend** (top-left), a follow camera, WASD/arrows on desktop and a touch d-pad on mobile
- **Collectibles everywhere** — JIMO coins, forest berries and rare gems, all scattered randomly
- **Custom skins** — pick Jimothy's look on the start screen (groundwork for the planned editable-skin multiplayer)
- NPCs (Rocky, Pip) with multi-line dialog and a real quest line:
  1. **Waddle & Collect** — gather 12 JIMO coins
  2. **Berry Run** — pick 6 forest berries
  3. **Clean the Meadow** — collect trash bags and recycle them at the bin
  4. **Chase Off the Hounds** — shoo the three dogs (press E next to one)
  5. **Find Momo** — rescue the lost cub and bring them home
- **The dogs are the villains** — the Catcher's hounds patrol and chase; walk up and press E to hiss and scare one off

The world layout and biome idea are adapted from the author's own "pokefight" open-world engine.

### Roadmap in the code
- `player.skin` / `SKINS` — swappable palettes; the start screen writes the choice to `localStorage`
- `others[]` — a slot for remote players (drawn like NPCs) to make online multiplayer straightforward

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
