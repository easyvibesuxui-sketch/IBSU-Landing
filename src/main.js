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

// ── Sticky story: each wheel flick or swipe moves on to the next key moment. The camera travels at one
// steady cruise speed (so the film always plays at the same pace), easing in and out over ~0.6 s.
// A flick while moving extends the trip to the following moment without stopping in between.
// Leaving past either end scrolls freely; keyboard / scrollbar rests ease to a nearby moment. ?snap=0 turns it off.
const SNAP_REACH = 0.3;
const CRUISE = 0.075; // story lengths per second (the film runs ≈2.4× real time)
const RAMP = 0.6;     // seconds to reach / leave cruise speed
if (lenis && new URLSearchParams(location.search).get('snap') !== '0') {
  const story = document.querySelector('.story');
  const bounds = () => {
    const top = story.offsetTop;
    const span = story.offsetHeight - innerHeight;
    return { top, span, points: SNAP_POINTS.map((p) => top + p * span) };
  };
  let idle = 0;
  let touching = false;
  let lastWheel = 0;
  let wheelArmed = true; // re-armed only after the wheel goes quiet, so trackpad inertia can't skip scenes
  let touchSum = 0;
  let touchStepped = false;

  // Motion: v accelerates toward ±cruise and brakes on the curve that stops exactly on the target
  const glide = { on: false, pos: 0, v: 0, target: 0 };
  const travel = (target) => {
    if (!glide.on) Object.assign(glide, { on: true, pos: lenis.scroll, v: 0 });
    glide.target = target;
    autoScrolling = true;
  };
  gsap.ticker.add((_, deltaMs) => {
    if (!glide.on) return;
    const dt = Math.min(deltaMs, 50) / 1000;
    const { span } = bounds();
    const vMax = CRUISE * span, acc = vMax / RAMP;
    const d = glide.target - glide.pos;
    const dir = Math.sign(d);
    const want = dir * Math.min(vMax, Math.sqrt(2 * acc * Math.abs(d)));
    const step = (Math.sign(want - glide.v) === Math.sign(glide.v) || !glide.v ? acc : acc * 1.6) * dt;
    glide.v = Math.abs(want - glide.v) <= step ? want : glide.v + Math.sign(want - glide.v) * step;
    const next = glide.pos + glide.v * dt;
    const arrived = Math.abs(d) < 0.5 || Math.sign(glide.target - next) !== dir;
    glide.pos = arrived ? glide.target : next;
    lenis.scrollTo(glide.pos, { immediate: true, force: true });
    if (arrived) { glide.on = false; glide.v = 0; autoScrolling = false; }
  });

  // Next key moment in the gesture's direction (counting from where the trip is heading), or null to leave the story
  const nextPoint = (dir) => {
    const { top, span, points } = bounds();
    const y = glide.on && Math.sign(glide.target - glide.pos) === dir ? glide.target : lenis.scroll;
    if (y < top - 2 || y > top + span + 2) return null;
    return dir > 0 ? points.find((t) => t > y + 2) ?? null : [...points].reverse().find((t) => t < y - 2) ?? null;
  };
  const request = (dir) => {
    const target = nextPoint(dir);
    if (target === null) return glide.on; // swallow while still travelling, else let the page scroll on
    travel(target);
    return true;
  };
  lenis.options.virtualScroll = ({ deltaY, event }) => {
    const type = event.type;
    if (type === 'touchstart') { touchSum = 0; touchStepped = false; return !glide.on; }
    if (type === 'touchend') return !glide.on && !touchStepped;
    const dir = Math.sign(deltaY);
    if (!dir) return true;
    if (type === 'wheel') {
      const now = performance.now();
      if (now - lastWheel > 140) wheelArmed = true;
      lastWheel = now;
      if (!wheelArmed) {
        if (!glide.on && nextPoint(dir) === null) return true;
        if (event.cancelable) event.preventDefault();
        return false;
      }
      if (Math.abs(deltaY) < 4 && !glide.on) return true;
      if (!request(dir)) return true;
      wheelArmed = false;
    } else {
      touchSum += deltaY;
      if (!touchStepped && Math.abs(touchSum) > 24) {
        if (!request(dir)) return true;
        touchStepped = true;
      } else if (!touchStepped && !glide.on && nextPoint(dir) === null) return true;
    }
    if (event.cancelable) event.preventDefault();
    return false;
  };

  addEventListener('touchstart', () => { touching = true; }, { passive: true });
  addEventListener('touchend', () => { touching = false; }, { passive: true });
  const trySnap = () => {
    if (autoScrolling || touching || glide.on) return;
    const { top, span, points } = bounds();
    const y = lenis.scroll;
    if (y <= top || y >= top + span) return;
    const target = points.reduce((best, t) => (Math.abs(t - y) < Math.abs(best - y) ? t : best));
    const dist = Math.abs(target - y);
    if (dist < 2 || dist > innerHeight * SNAP_REACH) return;
    travel(target);
  };
  lenis.on('scroll', () => { if (!glide.on) { clearTimeout(idle); idle = setTimeout(trySnap, 160); } });
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
