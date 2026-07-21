/* Smooth cartoon Jimothy for the landing page — canvas, no image assets.
   Replaces the old pixel mascot. Renders a little game-style diorama in the
   hero and a small raccoon head in the nav. */
(function () {
  'use strict';

  const PAL = { body: '#7f848c', body2: '#9aa0a8', belly: '#dcd9d2', mask: '#20202a', eyering: '#f0ede6', leg: '#26262b', ear: '#6c7178', ring: '#25252c', nose: '#14141a' };

  function ellipse(ctx, x, y, rx, ry) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); }
  function rrect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.fill(); }

  // Chunky front-facing Jimothy, anchored at feet (0,0). `s` scales it.
  function jimothy(ctx, s, walk) {
    ctx.save(); ctx.scale(s, s);
    const bob = Math.sin(walk) * 1.2, sw = Math.sin(walk) * 2.2;

    // ringed tail curling to the left-back
    ctx.save(); ctx.translate(-30, -26); ctx.rotate(-0.35);
    for (let i = 0; i < 6; i++) { ctx.fillStyle = i % 2 ? PAL.ring : PAL.body; ellipse(ctx, -i * 8, -i * 3.4, 11 - i * 0.7, 9 - i * 0.5); }
    ctx.fillStyle = PAL.ring; ellipse(ctx, -48, -20, 6, 5); ctx.restore();

    // legs
    ctx.fillStyle = PAL.leg;
    rrect(ctx, -20, -14 - sw, 11, 16, 4); rrect(ctx, 9, -14 + sw, 11, 16, 4);
    rrect(ctx, -11, -12 + sw, 11, 15, 4); rrect(ctx, 2, -12 - sw, 11, 15, 4);

    ctx.translate(0, bob);
    // body
    const g = ctx.createRadialGradient(-6, -40, 6, 0, -34, 40); g.addColorStop(0, PAL.body2); g.addColorStop(1, PAL.body);
    ctx.fillStyle = g; ellipse(ctx, 0, -34, 33, 28);
    ctx.strokeStyle = 'rgba(0,0,0,.14)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = PAL.belly; ellipse(ctx, 0, -20, 18, 14);

    // ears
    ctx.fillStyle = PAL.ear; ellipse(ctx, -17, -48, 9, 10); ellipse(ctx, 17, -48, 9, 10);
    ctx.fillStyle = PAL.mask; ellipse(ctx, -17, -50, 4.6, 5.5); ellipse(ctx, 17, -50, 4.6, 5.5);
    // head
    ctx.fillStyle = PAL.body2; ellipse(ctx, 0, -32, 23, 20);
    ctx.fillStyle = PAL.belly; ellipse(ctx, 0, -24, 14, 12);
    // mask
    ctx.fillStyle = PAL.mask;
    ctx.beginPath(); ctx.ellipse(-10, -35, 10, 9, 0.25, 0, Math.PI * 2); ctx.ellipse(10, -35, 10, 9, -0.25, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, -38, 6, 4.5, 0, 0, Math.PI * 2); ctx.fill();
    // eyes
    ctx.fillStyle = PAL.eyering; ellipse(ctx, -10, -35, 5.6, 5.2); ellipse(ctx, 10, -35, 5.6, 5.2);
    ctx.fillStyle = '#111'; ellipse(ctx, -9, -35, 3, 3.3); ellipse(ctx, 11, -35, 3, 3.3);
    ctx.fillStyle = 'rgba(255,255,255,.9)'; ellipse(ctx, -10, -36.4, 1.1, 1.1); ellipse(ctx, 10, -36.4, 1.1, 1.1);
    // nose + mouth
    ctx.fillStyle = PAL.nose; ellipse(ctx, 0, -23, 4, 3);
    ctx.strokeStyle = PAL.nose; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, -20.5); ctx.quadraticCurveTo(-4, -17, -6.5, -18.5); ctx.moveTo(0, -20.5); ctx.quadraticCurveTo(4, -17, 6.5, -18.5); ctx.stroke();
    ctx.restore();
  }

  // ---- Hero diorama ----
  function heroScene(cv) {
    const ctx = cv.getContext('2d'); const W = cv.width, H = cv.height;
    let t = 0, visible = true, last = 0;
    if ('IntersectionObserver' in window) { new IntersectionObserver(es => { visible = es[0].isIntersecting; }, { threshold: 0.05 }).observe(cv); }
    function loop(now) { requestAnimationFrame(loop); if (!visible) return; if (now - last < 40) return; last = now; paint(); }
    function paint() {
      ctx.clearRect(0, 0, W, H);
      // sky
      const sky = ctx.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#cdeafe'); sky.addColorStop(1, '#eaf7ef');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
      // sun
      ctx.fillStyle = '#ffe08a'; ellipse(ctx, W - 54, 60, 30, 30);
      // rolling hills
      ctx.fillStyle = '#bfe6c4'; ctx.beginPath(); ctx.moveTo(0, H * 0.62); ctx.quadraticCurveTo(W * 0.3, H * 0.5, W * 0.6, H * 0.62); ctx.quadraticCurveTo(W * 0.85, H * 0.72, W, H * 0.6); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.fill();
      // ground
      ctx.fillStyle = '#8cc24a'; ctx.beginPath(); ctx.moveTo(0, H * 0.72); ctx.quadraticCurveTo(W * 0.5, H * 0.66, W, H * 0.74); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.fill();
      ctx.fillStyle = '#7bb33e'; for (let i = 0; i < 26; i++) { const x = (i * 53 + 20) % W, y = H * 0.78 + (i % 4) * 14; ellipse(ctx, x, y, 2, 6); }
      // bushes
      const bush = (x, y, r) => { ctx.fillStyle = '#3f9142'; ctx.beginPath(); ctx.arc(x - r * .5, y, r * .6, 0, 6.283); ctx.arc(x + r * .5, y, r * .6, 0, 6.283); ctx.arc(x, y - r * .3, r * .7, 0, 6.283); ctx.fill(); ctx.fillStyle = '#4cae4f'; ellipse(ctx, x - r * .2, y - r * .2, r * .32, r * .32); };
      bush(58, H * 0.82, 30); bush(W - 70, H * 0.86, 34);
      // floating coin
      const cy = H * 0.4 + Math.sin(t / 40) * 8;
      ctx.save(); ctx.translate(W * 0.24, cy); const sx = Math.abs(Math.cos(t / 46)); ctx.scale(sx * .7 + .3, 1);
      ctx.fillStyle = '#ffd23f'; ellipse(ctx, 0, 0, 15, 15); ctx.strokeStyle = '#e0a92b'; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.ellipse(0, 0, 15, 15, 0, 0, 6.283); ctx.stroke();
      ctx.fillStyle = '#7a5a12'; ctx.font = '700 18px Fredoka, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('J', 0, 1); ctx.restore();
      // butterfly
      const bx = W * 0.74 + Math.cos(t / 30) * 26, by = H * 0.34 + Math.sin(t / 22) * 18, flap = Math.abs(Math.sin(t / 6));
      ctx.fillStyle = '#f472b6'; ctx.globalAlpha = .9; ellipse(ctx, bx - 4, by, 4 * flap + 1.5, 5); ellipse(ctx, bx + 4, by, 4 * flap + 1.5, 5); ctx.globalAlpha = 1;
      // shadow + Jimothy
      ctx.fillStyle = 'rgba(20,40,20,.16)'; ellipse(ctx, W * 0.52, H * 0.82, 62, 16);
      ctx.save(); ctx.translate(W * 0.52, H * 0.82); jimothy(ctx, 1.5, t / 22); ctx.restore();
      t++;
    }
    paint(); requestAnimationFrame(loop);
  }

  // ---- Small nav head ----
  function brand(cv) {
    const ctx = cv.getContext('2d'), W = cv.width, H = cv.height;
    ctx.clearRect(0, 0, W, H); ctx.save(); ctx.translate(W / 2, H * 0.86); jimothy(ctx, 0.58, 0); ctx.restore();
  }

  window.addEventListener('DOMContentLoaded', () => {
    const hs = document.getElementById('heroScene'); if (hs) heroScene(hs);
    const pm = document.getElementById('playScene'); if (pm) heroScene(pm);
    const bm = document.getElementById('brandMark'); if (bm) brand(bm);
  });
})();
