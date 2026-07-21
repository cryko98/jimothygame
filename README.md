# 🦝 $JIMOTHY — Short Spine, Big Adventure

The official website for **Jimothy**, a short-spine-syndrome raccoon on the biggest little adventure on **Solana**.

> *"They said a raccoon with a short spine couldn't go on adventures. Jimothy said: watch me."*

## What's inside

A single-page, fully static memecoin site — no build step, no dependencies.

- **Hero** with a procedurally drawn pixel-art Jimothy (canvas, no image assets)
- **Lore** — the legend of the trash panda
- **Trash Dash** — a playable 2D endless-runner mini-game (jump, collect coins, dodge trash cans)
- **Tokenomics**, **How to Buy** (Phantom → SOL → Jupiter/Raydium), **Roadmap**, **Community**
- Copy-to-clipboard contract address, responsive layout, meme disclaimer

## Files

| File | Purpose |
|------|---------|
| `index.html` | Page structure & content |
| `styles.css` | All styling (dark trash-panda theme) |
| `game.js` | Pixel-Jimothy painter + Trash Dash runner |
| `script.js` | Copy-contract button & UI helpers |

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
