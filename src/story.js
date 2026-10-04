import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// Story timeline, as fractions of the pinned scroll distance.
const VIDEO_END = 0.78;           // video (or keyframe fallback) plays across 0 → VIDEO_END
const SITE_ON = [0.785, 0.84];    // the firefly's light spreads over the laptop screen like ink, revealing the IBSU site
const SCREEN = [0.84, 0.95];      // camera pushes into the screen, the site settles full-view
const CTA_ON = [0.93, 0.98];      // then the single Apply button arrives
// Where the firefly lands on the screen (fraction of the screen box) and the ink blobs that grow
// from it: [dx, dy, delay, speed] relative to the screen size, for an organic, uneven edge.
const INK_ORIGIN = [0.5, 0.47];
const INK_BLOBS = [[0, 0, 0, 1], [0.12, -0.08, 0.08, 0.9], [-0.14, 0.1, 0.12, 0.85], [0.2, 0.18, 0.22, 0.8], [-0.22, -0.16, 0.26, 0.8], [0.04, 0.3, 0.3, 0.75], [-0.3, 0.32, 0.4, 0.7], [0.34, -0.3, 0.42, 0.7]];
// Laptop screen corners (TL, TR, BR, BL) in the final video frame, as fractions of the 16:9 frame.
// Measured on story-1080's last frame.
// Inset slightly from the measured edge so the soft-edged site stays inside the bezel.
const SCREEN_QUAD = [[0.3754, 0.4096], [0.6398, 0.4096], [0.6398, 0.7015], [0.3754, 0.7015]];
const SHOT_ASPECT = 1902 / 840;   // hero-screenshot.webp (nav bar cropped, its buttons painted out)
const SHOT_BUTTON = [75 / 1902, 700 / 840]; // where the screenshot's own CTA sat — ours takes its place
const FRAME_ASPECT = 16 / 9;
// Where the subject is (x as a fraction of the frame) over video time 0 → 1. On narrow screens
// object-fit: cover crops most of the 16:9 frame, so the visible window follows the two friends.
const FOCUS = [[0, 0.25], [0.2, 0.26], [0.4, 0.32], [0.6, 0.36], [0.75, 0.45], [0.85, 0.5], [1, 0.5]];
const focusAt = (t) => {
  const i = Math.max(1, FOCUS.findIndex(([k]) => k >= t));
  const [t0, x0] = FOCUS[i - 1], [t1, x1] = FOCUS[i];
  return x0 + (x1 - x0) * clamp01((t - t0) / (t1 - t0 || 1));
};
const CHAPTERS = [[0.01, 0.13], [0.15, 0.3], [0.32, 0.5], [0.54, 0.74]];
// Resting points for the "sticky" scroll: top, each chapter at full strength, the lit laptop, the CTA
export const SNAP_POINTS = [0, 0.07, 0.225, 0.41, 0.64, 0.8, 1];
const MEMORIES = [0.17, 0.5];      // core-memory orbs drift past while they grow up
const AGE = [[0.15, 6], [0.6, 18]];

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const lerp = (a, b, t) => a + (b - a) * t;

// Projective transform taking the w×h box onto quad q (TL, TR, BR, BL), as a CSS matrix3d.
function quadMatrix(w, h, q) {
  const src = [[0, 0], [w, 0], [w, h], [0, h]];
  const A = [], B = [];
  src.forEach(([x, y], i) => {
    const [u, v] = q[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); B.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); B.push(v);
  });
  // Gaussian elimination, 8×8
  for (let c = 0; c < 8; c++) {
    let m = c;
    for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[m][c])) m = r;
    [A[c], A[m]] = [A[m], A[c]]; [B[c], B[m]] = [B[m], B[c]];
    for (let r = 0; r < 8; r++) {
      if (r === c) continue;
      const f = A[r][c] / A[c][c];
      for (let k = c; k < 8; k++) A[r][k] -= f * A[c][k];
      B[r] -= f * B[c];
    }
  }
  const [a, b, c, d, e, f, g, hh] = B.map((v, i) => v / A[i][i]);
  return `matrix3d(${a},${d},0,${g},${b},${e},0,${hh},0,0,1,0,${c},${f},0,1)`;
}
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
  const backdrop = story.querySelector('[data-backdrop]');
  const firefly = story.querySelector('[data-firefly]');
  const glow = story.querySelector('[data-glow]');
  const front = story.querySelector('[data-front]');
  const plate = front.querySelector('img');
  const cta = story.querySelector('[data-cta]');
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
    // VP9 is about half the size; fall back to H.264 where WebM/VP9 isn't solid (older Safari)
    const ext = video.canPlayType('video/webm; codecs="vp9"') === 'probably' ? 'webm' : 'mp4';
    video.src = `media/story-${small ? 720 : 1080}.${ext}`;
    video.addEventListener('loadeddata', () => { hasVideo = true; story.classList.add('has-video'); }, { once: true });
    video.addEventListener('error', () => { hasVideo = false; }, { once: true });
    video.load();
    gsap.ticker.add(() => {
      if (!hasVideo) return;
      if (video.seeking) { if (wasReady) render(lastP); return; }
      // Once the screen phase starts, jump straight to the last frame: the overlay and the
      // push-in are measured on it, and a lagging video would leave them floating off the screen.
      shownTime = lastP >= SITE_ON[0] ? targetTime : shownTime + (targetTime - shownTime) * 0.18;
      if (Math.abs(video.currentTime - shownTime) > 1 / 60) video.currentTime = shownTime;
      if (endReady() !== wasReady) render(lastP);
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
  // The screen overlay and zoom only line up with the video's final frame
  const endReady = () => !hasVideo || !video.duration || (!video.seeking && video.currentTime >= video.duration - 0.12);
  let wasReady = true;
  let lastP = 0;
  function render(p) {
    lastP = p;
    const ready = (wasReady = endReady());
    // media
    const vp = range(p, 0, VIDEO_END);
    const W = stage.clientWidth, H = stage.clientHeight;
    const fw = Math.max(W, H * FRAME_ASPECT), fh = fw / FRAME_ASPECT;
    const overflow = fw - W;
    const left = overflow ? clamp01((focusAt(vp) * fw - W / 2) / overflow) : 0.5; // object-position x
    const pos = `${left * 100}% 50%`;
    video.style.objectPosition = pos;
    plate.style.objectPosition = pos;
    frames.forEach((img) => { img.style.objectPosition = pos; });
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

    // laptop screen → IBSU site. Frame→viewport mapping follows object-fit: cover + the pan above.
    const ox = -overflow * left, oy = (H - fh) / 2;
    const quad = SCREEN_QUAD.map(([x, y]) => [ox + x * fw, oy + y * fh]);
    // Push in uniformly until the rectangle inscribed in the screen covers the viewport
    const ix0 = Math.max(quad[0][0], quad[3][0]), ix1 = Math.min(quad[1][0], quad[2][0]);
    const iy0 = Math.max(quad[0][1], quad[1][1]), iy1 = Math.min(quad[2][1], quad[3][1]);
    const s = ready ? range(p, SCREEN[0], SCREEN[1]) : 0;
    const e = gsap.parseEase('power3.inOut')(s);
    const Z = lerp(1, Math.max(W / (ix1 - ix0), H / (iy1 - iy0)), e);
    const cx = (ix0 + ix1) / 2, cy = (iy0 + iy1) / 2;
    const tx = lerp(0, W / 2 - cx * Z, e) + (1 - e) * cx * (1 - Z), ty = lerp(0, H / 2 - cy * Z, e) + (1 - e) * cy * (1 - Z);
    zoom.style.transform = s > 0 ? `translate(${tx}px, ${ty}px) scale(${Z})` : '';
    front.style.transform = zoom.style.transform;
    // Screenshot rides the zoomed screen, then relaxes into an undistorted, fully visible frame
    const onScreen = quad.map(([x, y]) => [tx + x * Z, ty + y * Z]);
    // Anchored left where the headline lives: cover on landscape; on portrait, scale so the
    // headline column (first ~480px of the shot) spans the viewport width.
    const fitW = Math.max(W, Math.min(H * SHOT_ASPECT, W * 1902 / 480)), fitH = fitW / SHOT_ASPECT;
    const fx = 0, fy = (H - fitH) / 2;
    const target = [[fx, fy], [fx + fitW, fy], [fx + fitW, fy + fitH], [fx, fy + fitH]];
    // Stay glued to the laptop screen while the camera pushes in; relax only once the screen
    // already fills the viewport, so the site never floats over the people around it.
    const settle = gsap.parseEase('power2.inOut')(range(s, 0.82, 1));
    const shown = onScreen.map(([x, y], i) => [lerp(x, target[i][0], settle), lerp(y, target[i][1], settle)]);
    const on = ready ? range(p, SITE_ON[0], SITE_ON[1]) : 0;
    screen.classList.toggle('is-live', on > 0);
    screen.style.opacity = on > 0 ? 1 : 0;
    // Ink: soft-edged blobs grow from the firefly's landing point until they cover the screen box.
    // Sized in on-screen pixels and stretched back into the W×H box, so they stay round on the
    // laptop whatever the viewport's aspect ratio.
    const qw = quad[1][0] - quad[0][0], qh = quad[3][1] - quad[0][1];
    const reach = Math.hypot(qw, qh);
    const ink = INK_BLOBS.map(([dx, dy, d, sp]) => {
      const g = gsap.parseEase('power1.in')(clamp01((on - d) / (1 - d)));
      const r = g * sp * reach * 0.62; // the main blob alone reaches the screen's far corners at g = 1
      const soft = 4 + 10 * (1 - g);
      const x = (INK_ORIGIN[0] + dx * g) * W, y = (INK_ORIGIN[1] + dy * g) * H;
      const rx = ((r + soft) * W) / qw, ry = ((r + soft) * H) / qh;
      const edge = (100 * r) / (r + soft || 1);
      return `radial-gradient(${rx}px ${ry}px at ${x}px ${y}px, #000 ${edge}%, transparent 100%)`;
    }).join(',');
    const mask = on >= 1 ? 'none' : ink;
    screen.style.maskImage = mask;
    screen.style.webkitMaskImage = mask;
    firefly.style.opacity = on > 0 && on < 1 ? 1 - on : 0;
    firefly.style.setProperty('--x', `${INK_ORIGIN[0] * 100}%`);
    firefly.style.setProperty('--y', `${INK_ORIGIN[1] * 100}%`);
    if (on > 0) screen.style.transform = glow.style.transform = quadMatrix(W, H, shown);
    // Rounded, feathered edges while the site sits on the laptop screen; sharp once it is full view
    screen.style.setProperty('--feather', `${(1 - settle) * Math.min(W, H) * 0.06}px`);
    glow.classList.toggle('is-live', on > 0 && on < 1);
    front.style.opacity = on > 0 ? 1 - settle : 0;
    backdrop.style.opacity = clamp01(settle * 2.5);
    overlays.forEach((o) => { o.style.opacity = (o.classList.contains('story__grain') ? 0.07 : 1) * (1 - e); });
    const c = range(p, CTA_ON[0], CTA_ON[1]);
    cta.style.opacity = c;
    cta.style.left = `${fx + SHOT_BUTTON[0] * fitW}px`;
    cta.style.top = `${fy + SHOT_BUTTON[1] * fitH}px`;
    cta.style.transform = `translate3d(0, ${(1 - c) * 24}px, 0)`;
    cta.inert = c < 0.5;

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
