/* Copy-contract button + tiny niceties */
(function () {
  const btn = document.getElementById('copyBtn');
  const ca = document.getElementById('ca');
  if (btn && ca) {
    btn.addEventListener('click', async () => {
      const text = ca.textContent.trim();
      try {
        await navigator.clipboard.writeText(text);
        const old = btn.textContent;
        btn.textContent = 'Copied!';
        setTimeout(() => (btn.textContent = old), 1400);
      } catch {
        btn.textContent = 'Copy failed';
        setTimeout(() => (btn.textContent = 'Copy'), 1400);
      }
    });
  }
})();
