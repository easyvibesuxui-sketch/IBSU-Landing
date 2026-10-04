// Builds web media from the Kling sources in assets-src/.
//   assets-src/clips/c1.mp4 … c5.mp4   → public/media/story-1080.*, story-720.* (short GOP, scrub-friendly)
//   assets-src/keyframes/k1.png … k6.png → public/media/frames/k*.webp (poster + no-video fallback)
//   assets-src/memories/*.png           → public/media/memories/*.webp
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
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

const clips = list(join(src, 'clips'), '.mp4');
if (clips.length) {
  // Kling clips come in slightly different sizes (1916×1080, 1928×1072…), so normalise each before joining
  for (const [h, crf264, crfvp9] of [[1080, 23, 36], [720, 26, 38]]) {
    const w = Math.round((h * 16) / 9 / 2) * 2;
    const norm = clips.map((_, i) => `[${i}:v]scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},setsar=1,fps=24[v${i}]`).join(';');
    const graph = `${norm};${clips.map((_, i) => `[v${i}]`).join('')}concat=n=${clips.length}:v=1:a=0[out]`;
    const input = [...clips.flatMap((c) => ['-i', join(src, 'clips', c)]), '-filter_complex', graph, '-map', '[out]', '-an'];
    // Short GOP (keyframe every 8 frames, no B-frames) so currentTime seeks decode at most a few frames.
    run([...input, '-c:v', 'libx264', '-preset', 'slow', '-crf', String(crf264), '-g', '8', '-bf', '0', '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart', join(out, `story-${h}.mp4`)]);
    // VP9 twin for browsers without H.264 (e.g. open-source Chromium builds)
    run([...input, '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', String(crfvp9), '-g', '8', '-row-mt', '1', '-deadline', 'good', '-cpu-used', '4',
      '-pix_fmt', 'yuv420p', join(out, `story-${h}.webm`)]);
  }
  console.log(`encoded ${clips.length} clips`);
} else {
  console.log('no clips yet — site falls back to keyframe crossfade');
}
