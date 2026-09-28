// Builds web media from the Kling sources in assets-src/.
//   assets-src/clips/c1.mp4 … c5.mp4   → public/media/story-1080.mp4, story-720.mp4 (all-intra, scrub-friendly)
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

const clips = list(join(src, 'clips'), '.mp4');
if (clips.length) {
  const listFile = join(src, 'clips', 'concat.txt');
  writeFileSync(listFile, clips.map((c) => `file '${c}'`).join('\n'));
  // Short GOP (keyframe every 8 frames, no B-frames) so currentTime seeks decode at most a few frames.
  for (const [h, crf] of [[1080, 23], [720, 26]]) {
    run([
      '-f', 'concat', '-safe', '0', '-i', listFile, '-an',
      '-vf', `scale=-2:${h},fps=24`,
      '-c:v', 'libx264', '-preset', 'slow', '-crf', String(crf), '-g', '8', '-bf', '0', '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart', join(out, `story-${h}.mp4`),
    ]);
  }
  // VP9 twin for browsers without H.264 (e.g. open-source Chromium builds)
  for (const [h, crf] of [[1080, 36], [720, 38]]) {
    run([
      '-f', 'concat', '-safe', '0', '-i', listFile, '-an',
      '-vf', `scale=-2:${h},fps=24`,
      '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', String(crf), '-g', '8', '-row-mt', '1', '-deadline', 'good', '-cpu-used', '4',
      '-pix_fmt', 'yuv420p', join(out, `story-${h}.webm`),
    ]);
  }
  console.log(`encoded ${clips.length} clips`);
} else {
  console.log('no clips yet — site falls back to keyframe crossfade');
}
