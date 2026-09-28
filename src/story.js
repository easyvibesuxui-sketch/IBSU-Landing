import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// Story timeline, as fractions of the pinned scroll distance.
const VIDEO_END = 0.78;           // video (or keyframe fallback) plays across 0 → VIDEO_END
const SITE_ON = [0.77, 0.81];     // the IBSU site lights up on the laptop screen
const SCREEN = [0.82, 0.95];      // camera pushes into the screen until the site fills the viewport
// Laptop screen in the final frame, as fractions of the 16:9 source frame (measured on k5).
const SCREEN_RECT = { x: 0.2821, y: 0.4125, w: 0.1682, h: 0.1838 };
// The screen is seen at an angle: its corners inside that box (%), eased to a full rectangle as we push in.
const SCREEN_QUAD = [[0, 3.5], [82.5, 0], [100, 78.7], [11.4, 100]];
const FULL_QUAD = [[0, 0], [100, 0], [100, 100], [0, 100]];
const FRAME_ASPECT = 16 / 9;
const CHAPTERS = [[0.01, 0.12], [0.13, 0.25], [0.28, 0.52], [0.56, 0.74]];
const MEMORIES = [0.22, 0.62];     // core-memory orbs drift past while he grows up
const AGE = [[0.2, 6], [0.6, 17]];

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
  const zoom = story.querySelector('[data-zoom]');
  const overlays = [...story.querySelectorAll('.story__grain, .story__vignette')];
  const stage = story.querySelector('.story__stage');
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

    // laptop screen → live hero: map the screen rect through object-fit: cover
    const W = stage.clientWidth, H = stage.clientHeight;
    const fw = Math.max(W, H * FRAME_ASPECT), fh = fw / FRAME_ASPECT;
    const rx = (W - fw) / 2 + SCREEN_RECT.x * fw, ry = (H - fh) / 2 + SCREEN_RECT.y * fh;
    const rw = SCREEN_RECT.w * fw, rh = SCREEN_RECT.h * fh;
    const on = range(p, SITE_ON[0], SITE_ON[1]);
    const s = range(p, SCREEN[0], SCREEN[1]);
    const e = gsap.parseEase('power3.inOut')(s);
    const zx = 1 + (W / rw - 1) * e, zy = 1 + (H / rh - 1) * e;
    zoom.style.transform = s > 0 ? `translate(${(1 - e) * rx - zx * rx}px, ${(1 - e) * ry - zy * ry}px) scale(${zx}, ${zy})` : '';
    screen.classList.toggle('is-live', on > 0);
    screen.style.opacity = on;
    screen.style.transform = `translate(${rx}px, ${ry}px) scale(${rw / W}, ${rh / H})`;
    overlays.forEach((o) => { o.style.opacity = (o.classList.contains('story__grain') ? 0.07 : 1) * (1 - e); });
    const quad = SCREEN_QUAD.map(([x, y], i) => `${x + (FULL_QUAD[i][0] - x) * e}% ${y + (FULL_QUAD[i][1] - y) * e}%`);
    screen.style.clipPath = `polygon(${quad.join(',')})`;
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
