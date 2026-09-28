# IBSU — Applicants landing

This is a storytelling landing page for applicants to International Black Sea University. Scrolling drives a video: a child reads in the dark, grows up while core memories drift past, then opens the IBSU site on a laptop. The laptop screen then becomes the live hero with the **Start** button, followed by programmes, admission, tuition, dates and FAQ. The page is in English and Georgian.

```bash
npm install
npm run dev       # local dev
npm run encode    # rebuild web media from assets-src/ (Kling sources)
npm run build     # static site in dist/
```

## Stack
- Vite with vanilla JS
- GSAP ScrollTrigger and Lenis
- Self-hosted fonts via @fontsource

| Path | What it holds |
|---|---|
| `src/content/{en,ka}.json` | All copy. The DOM is built once and language switches rewrite every `data-i18n` node. |
| `src/story.js` | Scroll-scrubbed story: the video (or a keyframe crossfade), chapters, memory orbs, and the screen-to-hero transition. |
| `src/render.js` | Builds the section lists from the content files. |
| `src/main.js` | Smooth scrolling, reveals and parallax. |

The story timeline is set by the constants at the top of `src/story.js`.

## Media
The Kling sources go in `assets-src/`, and `npm run encode` writes `public/media/`:
- `assets-src/clips/c1.mp4` … `c5.mp4` become `story-1080.mp4` and `story-720.mp4`. They are encoded all-intra, so scrubbing seeks instantly.
- `assets-src/keyframes/k1.png` … `k6.png` become `frames/k*.webp`. These are used as the fallback before the video loads and for reduced motion.
- `assets-src/memories/{kindergarten,school,sport,parents,grandparents,friends}.png` become the memory orbs.

## Content still to verify against ibsu.edu.ge/entrant
Everything marked **TBC** in `src/content/*.json` still needs checking:
- tuition
- discounts and scholarships
- key dates
- school names and their programme mapping
- the international admission text
- the address
