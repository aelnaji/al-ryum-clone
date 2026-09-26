/* @astra — 0817 cinematic controller. Disconnect: restore backed-up entry HTML.
 * Original footage + perspective planes (2.5D), not reconstructed geometry.
 */
(() => {
  'use strict';
  const mq = matchMedia('(prefers-reduced-motion: reduce)');
  let choice = null;
  try { choice = sessionStorage.getItem('ar-cinematic-motion'); } catch {}
  const motion = window.alRyumMotion = {
    enabled: choice === null ? !mq.matches : choice === 'on'
  };
  const clamp = v => Math.max(0, Math.min(1, v));
  let active = null;
  const button = document.createElement('button');
  button.type = 'button'; button.id = 'ar-motion-toggle';
  function label() {
    button.textContent = motion.enabled ? 'Cinematic motion: ON' : 'Enable cinematic motion';
    button.setAttribute('aria-pressed', String(motion.enabled));
  }
  function changed() {
    label(); active?.layout();
    window.dispatchEvent(new Event('alryum-motion-change'));
  }
  button.onclick = () => {
    motion.enabled = !motion.enabled;
    choice = motion.enabled ? 'on' : 'off';
    try { sessionStorage.setItem('ar-cinematic-motion', choice); } catch {}
    changed();
  };
  mq.addEventListener('change', () => {
    if (choice === null) { motion.enabled = !mq.matches; changed(); }
  });
  label();
  const style = document.createElement('style');
  style.textContent = `
    #ar-motion-toggle{position:fixed;bottom:16px;right:16px;z-index:10001;border:1px solid #7dd6aa80;border-radius:24px;background:#122023ed;color:#fff;padding:11px 16px;font:12px system-ui;cursor:pointer}
    #ar-motion-toggle:focus-visible{outline:3px solid #7dd6aa;outline-offset:3px}
    .ar-hero-region{position:relative;isolation:isolate;overflow:clip;background:#122023}
    .ar-hero-region>section{position:sticky!important;top:0;height:100svh!important;min-height:0;perspective:1200px;isolation:isolate}
    .ar-hero-region #hero-scrub-canvas{display:block!important;transform-origin:50% 50%;will-change:transform}
    .ar-hero-region #hero-scrub-fallback{display:none!important}
    .ar-hero-region .ar-integrated-mist{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;mix-blend-mode:screen;pointer-events:none;z-index:1}
    .ar-pf-stage{perspective:1200px}
    .ar-pf-plane{backface-visibility:hidden;transform-style:preserve-3d}
  `;
  document.head.append(style);
  const images = new Array(142); let next = 0; let loaded = 0;
  let started = false;
  function preload() {
    if (started) return; started = true;
    for (let n = 0; n < 6; n++) worker();
  }
  function worker() {
    const i = next++; if (i >= images.length) return;
    const img = new Image(); img.decoding = 'async';
    img.onload = () => { images[i] = img; loaded++; active?.update(); worker(); };
    img.onerror = () => { active?.update(); worker(); };
    img.src = '/assets/hero-0817-astra/frame_' + String(i + 1).padStart(4, '0') + '.webp';
  }
  function mount(canvas) {
    const hero = canvas.closest('section'); if (!hero) return;
    const region = document.createElement('div'); region.className = 'ar-hero-region';
    hero.before(region); region.append(hero);
    const background = canvas.parentElement;
    const mist = document.createElement('video');
    mist.className = 'ar-integrated-mist'; mist.muted = true; mist.playsInline = true;
    mist.preload = 'auto'; mist.loop = true; mist.src = '/assets/hero-mist.mp4';
    mist.setAttribute('aria-hidden', 'true'); background.append(mist);
    const fallback = hero.querySelector('#hero-scrub-fallback'); fallback?.pause();
    const ctx = canvas.getContext('2d');
    const loader = hero.querySelector('#hero-scrub-loader');
    const copy = hero.querySelector(':scope > .relative');
    let frame = -1, width = 0, height = 0, raf = 0;
    const state = { progress: 0, frame: 0, loaded: 0, source: '0817.mp4' };
    function update() {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0; if (!region.isConnected) return;
        const rect = region.getBoundingClientRect();
        const vh = innerHeight;
        const raw = clamp(-rect.top / Math.max(1, region.offsetHeight - vh));
        const p = motion.enabled ? raw : 0;
        state.progress = p; state.loaded = loaded;
        const target = Math.round(clamp(p / 0.86) * (images.length - 1));
        let best = -1;
        for (let i = 0; i < images.length; i++) if (images[i] && (best < 0 || Math.abs(i-target) < Math.abs(best-target))) best = i;
        const w = Math.round(hero.clientWidth * Math.min(devicePixelRatio, 1.5));
        const h = Math.round(hero.clientHeight * Math.min(devicePixelRatio, 1.5));
        if (w !== width || h !== height) { canvas.width = width = w; canvas.height = height = h; frame = -1; }
        if (ctx && best >= 0 && best !== frame) {
          const img = images[best], scale = Math.max(w/img.width, h/img.height);
          ctx.drawImage(img, (w-img.width*scale)/2, (h-img.height*scale)/2, img.width*scale, img.height*scale);
          frame = best; state.frame = best + 1;
        }
        if (loader) {
          loader.style.display = best < 0 ? 'flex' : 'none';
          const text = loader.querySelector('span');
          if (text && best < 0) text.textContent = next >= 148 ? 'Hero media unavailable — reload to retry' : 'Loading original hero…';
        }
        const exit = clamp((p-0.86)/0.14);
        canvas.style.transform = motion.enabled ? `translate3d(0,${-exit*5}%,${p*45}px) rotateX(${exit*3}deg) scale(${1.03+p*0.06})` : 'none';
        mist.style.opacity = motion.enabled ? String(0.62 * (1-clamp(p/0.32))) : '0.12';
        mist.style.transform = `translate3d(0,${-p*18}%,${p*90}px) scale(${1+p*0.15})`;
        if (copy) { copy.style.opacity = String(1-exit*0.8); copy.style.transform = motion.enabled ? `translate3d(0,${-exit*65}px,${p*25}px)` : 'none'; }
        if (motion.enabled && rect.bottom > 0 && rect.top < vh && p < 0.32) mist.play().catch(() => {}); else mist.pause();
      });
    }
    function layout() {
      region.style.height = motion.enabled ? `${innerHeight * 2}px` : `${innerHeight}px`;
      update(); window.lenis?.resize(); window.ScrollTrigger?.refresh();
    }
    const scrollButton = hero.querySelector('button[aria-label="Scroll down"]');
    const skip = e => { e.preventDefault(); e.stopImmediatePropagation(); window.scrollTo({top:scrollY+region.getBoundingClientRect().top+region.offsetHeight,behavior:motion.enabled?'smooth':'instant'}); };
    scrollButton?.addEventListener('click', skip, true);
    window.addEventListener('scroll', update, {passive:true}); window.addEventListener('resize', layout);
    active = { canvas, update, layout, state, destroy() {
      cancelAnimationFrame(raf); mist.pause(); mist.removeAttribute('src'); mist.load();
      window.removeEventListener('scroll', update); window.removeEventListener('resize', layout);
      scrollButton?.removeEventListener('click', skip, true);
    }};
    window.__alRyumHeroFilm = active; layout(); preload();
  }
  function discover() {
    if (!document.body) return;
    if (!button.isConnected) document.body.append(button);
    if (active && !active.canvas.isConnected) { active.destroy(); active = null; }
    const canvas = document.getElementById('hero-scrub-canvas');
    if (canvas && !active) mount(canvas);
  }
  const observer = new MutationObserver(discover);
  observer.observe(document.documentElement, {childList:true,subtree:true});
  discover();
})();
