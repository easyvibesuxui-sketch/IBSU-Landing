// Builds web media from the Kling sources in assets-src/.
//   assets-src/clips/c1…c4 + c5d / c5m  → public/media/story-1080.*, story-m.* (short GOP, scrub-friendly)
//   assets-src/keyframes/k1.png … k6.png → public/media/frames/k*.webp (poster + no-video fallback)
//   assets-src/memories/*.png           → public/media/memories/*.webp
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import ffmpeg from 'ffmpeg-static';

const run = (args) => execFileSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' });
const src = 'assets-src';
const out = 'public/media';
const list = (dir, ext) => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(ext)).sort() : []);

mkdirSync(join(out, 'frames'), { recursive: true });
mkdirSync(join(out, 'memories'), { recursive: true });

for (const f of list(join(src, 'keyframes'), '.png')) {
  run(['-i', join(src, 'keyframes', f), '-vf', 'scale=1920:-2', '-quality', '78', join(out, 'frames', f.replace('.png', '.webp'))]);
}
for (const f of list(join(src, 'memories'), '.png')) {
  run(['-i', join(src, 'memories', f), '-vf', 'scale=480:480:force_original_aspect_ratio=increase,crop=480:480', '-quality', '80', join(out, 'memories', f.replace('.png', '.webp'))]);
}

// Shared story c1…c4, then one ending per device: c5d (laptop) → story-1080, c5m (phone) → story-m.
const shared = list(join(src, 'clips'), '.mp4').filter((c) => /^c[1-4]\.mp4$/.test(c));
const variants = [
  ['story-1080', 'c5d.mp4', 1080, 23, 36],
  ['story-m', 'c5m.mp4', 720, 26, 38],
].filter(([, end]) => existsSync(join(src, 'clips', end)));
for (const [name, end, h, crf264, crfvp9] of variants) {
  // Kling clips come in slightly different sizes (1916×1080, 1928×1072…), so normalise each before joining
  const files = [...shared, end];
  const w = Math.round((h * 16) / 9 / 2) * 2;
  const norm = files.map((_, i) => `[${i}:v]scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},setsar=1,fps=24[v${i}]`).join(';');
  const graph = `${norm};${files.map((_, i) => `[v${i}]`).join('')}concat=n=${files.length}:v=1:a=0[out]`;
  const input = [...files.flatMap((c) => ['-i', join(src, 'clips', c)]), '-filter_complex', graph, '-map', '[out]', '-an'];
  // Short GOP (keyframe every 8 frames, no B-frames) so currentTime seeks decode at most a few frames.
  run([...input, '-c:v', 'libx264', '-preset', 'slow', '-crf', String(crf264), '-g', '8', '-bf', '0', '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart', join(out, `${name}.mp4`)]);
  // VP9 twin for browsers without H.264 (e.g. open-source Chromium builds)
  run([...input, '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', String(crfvp9), '-g', '8', '-row-mt', '1', '-deadline', 'good', '-cpu-used', '4',
    '-pix_fmt', 'yuv420p', join(out, `${name}.webm`)]);
  console.log(`encoded ${name}: ${shared.length} shared clips + ${end}`);
}
if (!variants.length) console.log('no clips yet — site falls back to keyframe crossfade');
