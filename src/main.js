import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import '@fontsource-variable/source-serif-4/opsz.css';
import '@fontsource-variable/source-serif-4/opsz-italic.css';
import '@fontsource-variable/hanken-grotesk';
import '@fontsource/spline-sans-mono/400.css';
import '@fontsource/spline-sans-mono/500.css';
import '@fontsource/noto-sans-georgian/georgian-400.css';
import '@fontsource/noto-sans-georgian/georgian-600.css';
import '@fontsource/noto-serif-georgian/georgian-400.css';
import '@fontsource/noto-serif-georgian/georgian-600.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/story.css';
import './styles/sections.css';
import './styles/motion.css';
import './styles/theme-b.css';

import { initI18n, onLangChange } from './i18n.js';
import { renderContent } from './render.js';
import { initStory, SNAP_POINTS } from './story.js';

gsap.registerPlugin(ScrollTrigger);

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
document.documentElement.classList.add('js', reduced ? 'motion-reduced' : 'motion-ok');

renderContent();
initI18n();

// ── Smooth scroll (skipped for reduced motion)
let lenis = null;
if (!reduced) {
  lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 0.9 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
}
let autoScrolling = false; // true while a programmatic scroll runs, so snapping doesn't fight it
const scrollTo = (target, offset = 0) => {
  if (!lenis) return document.querySelector(target)?.scrollIntoView({ behavior: 'auto' });
  autoScrolling = true;
  lenis.scrollTo(target, { offset, duration: 1.6, onComplete: () => { autoScrolling = false; } });
};

// ── Nav state follows the story, then the background under it
const nav = document.querySelector('.nav');
const lightUnderNav = new Set();
initStory({ reduced, onSiteState: (s) => { nav.dataset.phase = s; } });
document.querySelectorAll('.section--paper, .section--gray').forEach((sec) =>
  ScrollTrigger.create({
    trigger: sec,
    start: 'top 40px',
    end: 'bottom 40px',
    onToggle: (self) => {
      self.isActive ? lightUnderNav.add(sec) : lightUnderNav.delete(sec);
      nav.dataset.tone = lightUnderNav.size ? 'light' : 'dark';
    },
  }),
);

// ── Sticky story: when scrolling rests inside the story, ease to the nearest key moment.
// Only nearby points pull (within SNAP_REACH of the viewport), so long passages stay free. ?snap=0 turns it off.
const SNAP_REACH = 0.3;
if (lenis && new URLSearchParams(location.search).get('snap') !== '0') {
  const story = document.querySelector('.story');
  let idle = 0;
  let touching = false;
  // Any user input takes over from an in-flight snap (Lenis cancels it without calling onComplete)
  const userInput = () => { autoScrolling = false; };
  addEventListener('wheel', userInput, { passive: true });
  addEventListener('keydown', userInput);
  addEventListener('touchstart', () => { touching = true; userInput(); }, { passive: true });
  addEventListener('touchend', () => { touching = false; clearTimeout(idle); idle = setTimeout(trySnap, 160); }, { passive: true });
  const trySnap = () => {
    if (autoScrolling || touching) return;
    const top = story.offsetTop;
    const span = story.offsetHeight - innerHeight;
    const y = lenis.scroll;
    if (y <= top || y >= top + span) return;
    const target = SNAP_POINTS.map((p) => top + p * span)
      .reduce((best, t) => (Math.abs(t - y) < Math.abs(best - y) ? t : best));
    const dist = Math.abs(target - y);
    if (dist < 2 || dist > innerHeight * SNAP_REACH) return;
    autoScrolling = true;
    lenis.scrollTo(target, {
      duration: Math.min(1.1, 0.45 + dist / innerHeight),
      easing: (t) => 1 - (1 - t) ** 3,
      onComplete: () => { autoScrolling = false; },
    });
  };
  lenis.on('scroll', () => { clearTimeout(idle); idle = setTimeout(trySnap, 160); });
}

// ── Story shortcuts
document.querySelector('[data-skip-story]').addEventListener('click', (e) => {
  e.preventDefault();
  scrollTo('#hero-end', -innerHeight);
});
document.querySelectorAll('a[href^="#"]:not([data-skip-story])').forEach((a) =>
  a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    if (id.length < 2 || !document.querySelector(id)) return;
    e.preventDefault();
    scrollTo(id, id === '#top' ? 0 : -80);
  }),
);

// ── Reveals: groups flip .is-in once; children stagger via --i in CSS
const revealGroups = ['.section__head', '[data-stats]', '[data-programs]', '[data-steps]', '[data-explore]', '.calc', '[data-faq]', '.finale__inner'];
document.querySelectorAll(revealGroups.join(',')).forEach((el) =>
  ScrollTrigger.create({ trigger: el, start: 'top 82%', once: true, onEnter: () => el.classList.add('is-in') }),
);

if (!reduced) {
  // Parallax images
  document.querySelectorAll('[data-parallax]').forEach((img) => {
    const amt = parseFloat(img.dataset.parallax);
    gsap.fromTo(img, { yPercent: -amt }, {
      yPercent: amt, ease: 'none',
      scrollTrigger: { trigger: img.parentElement, start: 'top bottom', end: 'bottom top', scrub: true },
    });
  });

  // Admission: each step's rule draws in as it passes
  document.querySelectorAll('.steps__fill').forEach((line) =>
    gsap.to(line, { scaleX: 1, ease: 'none', scrollTrigger: { trigger: line.parentElement, start: 'top 85%', end: 'top 45%', scrub: true } }),
  );

  // Stats count up
  document.querySelectorAll('[data-stats] b').forEach((b) => {
    const n = parseInt(b.textContent, 10);
    if (!Number.isFinite(n) || String(n) !== b.textContent.trim()) return;
    const from = n > 100 ? n - 40 : 0;
    const obj = { v: from };
    ScrollTrigger.create({
      trigger: b, start: 'top 85%', once: true,
      onEnter: () => gsap.to(obj, { v: n, duration: 1.6, ease: 'power3.out', onUpdate: () => { b.textContent = Math.round(obj.v); } }),
    });
  });
}

const refresh = () => ScrollTrigger.refresh();
window.addEventListener('ibsu:layout', refresh);
onLangChange(() => requestAnimationFrame(refresh));
document.fonts?.ready.then(refresh);
