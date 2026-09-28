import { t, onLangChange } from './i18n.js';

// Structure is identical across languages, so DOM is built once from EN and
// every text node carries a data-i18n key that the language switch rewrites.
const h = (tag, attrs = {}, children = []) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'i18n') el.dataset.i18n = v;
    else if (k === 'style') el.style.cssText = v;
    else el.setAttribute(k, v);
  }
  [].concat(children).forEach((c) => el.append(c));
  return el;
};
const each = (key, fn) => t(key, 'en').map((item, i) => fn(item, i, `${key}.${i}`));
const fill = (sel, nodes) => document.querySelector(sel)?.replaceChildren(...nodes);

// Memory orb placement (% of stage). Kept clear of the walking figure's lane.
const ORB_POS = [
  ['62%', '14%'], ['80%', '38%'], ['54%', '46%'],
  ['74%', '8%'], ['86%', '58%'], ['60%', '24%'],
];

export function renderContent() {
  fill('[data-chapters]', each('story.chapters', (c, i, k) =>
    h('div', { class: `chapter${i % 2 ? ' chapter--right' : ''}`, 'data-chapter': i }, [
      h('p', { class: 'chapter__n eyebrow' }, [h('b', { i18n: `${k}.n` }), h('span', { i18n: `${k}.kicker` })]),
      h('p', { class: 'chapter__line', i18n: `${k}.line` }),
    ])));

  fill('[data-memories]', each('story.memories', (m, i, k) =>
    h('figure', { class: 'orb', 'data-orb': i, style: `--x:${ORB_POS[i][0]};--y:${ORB_POS[i][1]}` }, [
      h('div', { class: 'orb__ball' }, [
        Object.assign(h('img', { src: `/media/memories/${m.k}.webp`, alt: '', loading: 'lazy', decoding: 'async' }), {
          onerror() { this.remove(); },
        }),
      ]),
      h('figcaption', { i18n: `${k}.label` }),
    ])));

  fill('[data-stats]', each('why.stats', (s, i, k) =>
    h('li', { class: 'reveal', style: `--i:${i}` }, [h('b', { i18n: `${k}.value` }), h('span', { i18n: `${k}.label` })])));

  const filters = document.querySelector('[data-filters]');
  const tab = (id, key) => h('button', { type: 'button', role: 'tab', 'aria-selected': String(id === 'all'), 'data-school': id, i18n: key });
  filters.replaceChildren(tab('all', 'programs.all'), ...each('programs.schools', (s, i, k) => tab(s.id, `${k}.name`)));

  const schoolKey = Object.fromEntries(t('programs.schools', 'en').map((s, i) => [s.id, `programs.schools.${i}.name`]));
  fill('[data-programs]', each('programs.items', (p, i, k) =>
    h('li', { class: 'program reveal', 'data-school': p.school, style: `--i:${i % 6}` }, [
      h('p', { class: 'program__school eyebrow', i18n: schoolKey[p.school] }),
      h('div', {}, [h('h3', { i18n: `${k}.name` }), h('p', { class: 'program__degree', i18n: 'programs.degree', style: 'margin-top:10px' })]),
    ])));

  filters.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-school]');
    if (!btn) return;
    const id = btn.dataset.school;
    filters.querySelectorAll('button').forEach((b) => b.setAttribute('aria-selected', String(b === btn)));
    document.querySelectorAll('.program').forEach((card) => { card.hidden = id !== 'all' && card.dataset.school !== id; });
    window.dispatchEvent(new Event('ibsu:layout'));
  });

  fill('[data-steps]', each('admission.steps', (s, i, k) =>
    h('li', { class: 'reveal', style: `--i:${i}` }, [
      h('i', { class: 'steps__fill', 'aria-hidden': 'true' }),
      h('h3', { i18n: `${k}.title` }), h('p', { i18n: `${k}.body` }),
    ])));

  fill('[data-fees]', each('tuition.cards', (c, i, k) =>
    h('li', { class: 'fee reveal', style: `--i:${i}` }, [
      h('p', { class: 'fee__title', i18n: `${k}.title` }),
      h('p', { class: 'fee__value', i18n: `${k}.value` }),
      h('p', { class: 'fee__note', i18n: `${k}.note` }),
    ])));

  fill('[data-dates]', [
    h('i', { class: 'timeline__line', 'aria-hidden': 'true' }),
    ...each('dates.items', (d, i, k) =>
      h('li', { class: 'reveal', style: `--i:${i}` }, [h('time', { i18n: `${k}.date` }), h('h3', { i18n: `${k}.title` })])),
  ]);

  fill('[data-faq]', each('faq.items', (f, i, k) =>
    h('details', { class: 'reveal', style: `--i:${i}` }, [
      h('summary', {}, [h('span', { i18n: `${k}.q` }), h('i', { 'aria-hidden': 'true' })]),
      h('p', { class: 'faq__a', i18n: `${k}.a` }),
    ])));

  document.querySelector('[data-year]').textContent = new Date().getFullYear();
}

// Word-split headings so each word can rise on reveal. Re-run after every language change.
function splitHeadings() {
  document.querySelectorAll('[data-split]').forEach((el) => {
    const words = el.textContent.trim().split(/\s+/);
    el.setAttribute('aria-label', el.textContent.trim());
    el.replaceChildren(...words.flatMap((w, i) => {
      const inner = h('span', { style: `--i:${i}` }, [w]);
      const wrap = h('span', { class: 'w', 'aria-hidden': 'true' }, [inner]);
      return i < words.length - 1 ? [wrap, ' '] : [wrap];
    }));
  });
}
onLangChange(splitHeadings);
