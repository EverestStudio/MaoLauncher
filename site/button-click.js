(() => {
  'use strict';

  const clickable = 'button, .btn, .btn-primary, .btn-outline, .btn-submit, .nav-cta, .link-card, .filter-btn, .rules-nav-btn, .theme-toggle, .burger, .lightbox-close';
  const clickSound = new Audio('button-click.mp3?v=2');
  clickSound.preload = 'auto';
  clickSound.volume = 0.45;
  let lastPlayed = 0;

  function playClickSound() {
    const now = Date.now();
    if (now - lastPlayed < 50) return;
    lastPlayed = now;
    if (clickSound.readyState > 0) clickSound.currentTime = 0;
    clickSound.play().catch(() => {});
  }

  document.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    const target = event.target.closest(clickable);
    if (target && !target.disabled) playClickSound();
  }, { capture: true, passive: true });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    if (!(event.target instanceof HTMLElement)) return;
    if (event.target.matches(clickable) && !event.target.disabled) playClickSound();
  });
})();
