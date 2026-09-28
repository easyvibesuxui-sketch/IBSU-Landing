import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// Story timeline, as fractions of the pinned scroll distance.
const VIDEO_END = 0.86;           // video (or keyframe fallback) plays across 0 → VIDEO_END
const SCREEN = [0.8, 0.93];       // laptop screen grows into the live hero
const CHAPTERS = [[0.015, 0.15], [0.18, 0.31], [0.36, 0.56], [0.6, 0.76]];
const MEMORIES = [0.3, 0.68];     // core-memory orbs drift past while he grows up
const AGE = [[0.2, 6], [0.64, 17]];

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const range = (p, a, b) => clamp01((p - a) / (b - a));
// 0 → 1 → 0 envelope with soft edges, for things that appear and leave
const envelope = (p, a, b, edge = 0.25) => {
  const x = range(p, a, b);
  return Math.min(1, x / edge, (1 - x) / edge);
};

export function initStory({ reduced, onSiteState }) {
  const story = document.querySelector('.story');
  const video = story.querySelector('.story__video');
  const frames = [...story.querySelectorAll('.story__frames img')];
  const chapters = [...story.querySelectorAll('.chapter')];
  const orbs = [...story.querySelectorAll('.orb')];
  const screen = story.querySelector('[data-screen]');
  const age = story.querySelector('[data-age]');
  const bar = story.querySelector('[data-progress]');
  const hint = story.querySelector('[data-hint]');
  const hud = story.querySelector('.story__hud');

  // Hide keyframes that failed to load instead of showing a broken-image glyph
  frames.forEach((img) => {
    const hide = () => { img.style.visibility = 'hidden'; };
    if (img.complete && !img.naturalWidth) hide();
    else img.addEventListener('error', hide, { once: true });
  });

  // ── Video: all-intra encode makes currentTime seeks cheap; lerp for smoothness
  let hasVideo = false;
  let targetTime = 0;
  let shownTime = 0;
  if (!reduced) {
    const small = matchMedia('(max-width: 760px)').matches;
    video.src = small ? '/media/story-720.mp4' : '/media/story-1080.mp4';
    video.addEventListener('loadeddata', () => { hasVideo = true; story.classList.add('has-video'); }, { once: true });
    video.addEventListener('error', () => { hasVideo = false; }, { once: true });
    video.load();
    gsap.ticker.add(() => {
      if (!hasVideo || video.seeking) return;
      shownTime += (targetTime - shownTime) * 0.18;
      if (Math.abs(video.currentTime - shownTime) > 1 / 60) video.currentTime = shownTime;
    });
  }

  // Orbs get independent drift so they read as parallax depth layers
  const orbDrift = orbs.map((_, i) => ({
    y: 70 + (i % 3) * 45,
    x: (i % 2 ? -1 : 1) * (12 + i * 5),
    s: 0.85 + (i % 3) * 0.12,
  }));
  const orbWindow = (i) => {
    const span = MEMORIES[1] - MEMORIES[0];
    const a = MEMORIES[0] + (span * i) / (orbs.length + 1);
    return [a, a + span * 0.42];
  };

  let siteState = null;
  function render(p) {
    // media
    const vp = range(p, 0, VIDEO_END);
    if (hasVideo && video.duration) targetTime = vp * (video.duration - 0.05);
    if (!hasVideo) {
      const f = vp * (frames.length - 1);
      frames.forEach((img, i) => {
        const o = clamp01(1 - Math.abs(f - i));
        img.style.opacity = o;
        img.style.transform = reduced ? '' : `scale(${1.06 - 0.06 * clamp01((f - i + 1) / 2)})`;
      });
    }

    // chapters
    chapters.forEach((el, i) => {
      const [a, b] = CHAPTERS[i];
      const e = envelope(p, a, b);
      el.style.opacity = e;
      el.style.transform = reduced ? '' : `translate3d(0, ${(1 - e) * (p < (a + b) / 2 ? 28 : -28)}px, 0)`;
      el.style.filter = reduced ? '' : `blur(${(1 - e) * 8}px)`;
    });

    // memory orbs
    orbs.forEach((el, i) => {
      const [a, b] = orbWindow(i);
      const x = range(p, a, b);
      const e = envelope(p, a, b, 0.3);
      const d = orbDrift[i];
      el.style.opacity = e;
      if (!reduced) {
        el.style.transform = `translate3d(${d.x * x}px, ${d.y * (0.5 - x) * 2}px, 0) scale(${d.s * (0.8 + 0.2 * e)})`;
      }
    });

    // HUD
    const a = range(p, AGE[0][0], AGE[1][0]);
    age.textContent = String(Math.round(AGE[0][1] + a * (AGE[1][1] - AGE[0][1]))).padStart(2, '0');
    bar.style.transform = `scaleX(${range(p, 0, SCREEN[0])})`;
    hint.style.opacity = 1 - range(p, 0, 0.03);
    hud.style.opacity = 1 - range(p, SCREEN[0] - 0.04, SCREEN[0]);

    // laptop screen → live hero
    const s = range(p, SCREEN[0], SCREEN[1]);
    const eased = gsap.parseEase('power2.inOut')(s);
    screen.classList.toggle('is-live', s > 0);
    screen.style.opacity = clamp01(s / 0.35);
    screen.style.transform = `scale(${0.36 + 0.64 * eased})`;
    screen.style.borderRadius = `${18 * (1 - eased)}px`;
    screen.inert = s < 0.98;

    const next = s >= 0.98 ? 'site' : 'story';
    if (next !== siteState) { siteState = next; onSiteState(next); }
  }

  const st = ScrollTrigger.create({
    trigger: story,
    start: 'top top',
    end: 'bottom bottom',
    onUpdate: (self) => render(self.progress),
  });
  render(0);
  return st;
}
