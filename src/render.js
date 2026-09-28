import { t, onLangChange } from './i18n.js';
import { SCHOOLS, PROGRAMS, GRANTS, INSTALMENT_MONTHS } from './content/programs.js';

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
  ['74%', '10%'], ['6%', '14%'], ['84%', '36%'],
  ['14%', '40%'], ['64%', '28%'], ['26%', '6%'],
];

export function renderContent() {
  fill('[data-chapters]', each('story.chapters', (c, i, k) =>
    h('div', { class: `chapter${i % 2 ? '' : ' chapter--right'}`, 'data-chapter': i }, [
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

  renderPrograms();
  renderCalculator();
  renderExplore();

  fill('[data-steps]', each('admission.steps', (s, i, k) =>
    h('li', { class: 'reveal', style: `--i:${i}` }, [
      h('i', { class: 'steps__fill', 'aria-hidden': 'true' }),
      h('h3', { i18n: `${k}.title` }), h('p', { i18n: `${k}.body` }),
    ])));

  fill('[data-faq]', each('faq.items', (f, i, k) =>
    h('details', { class: 'reveal', style: `--i:${i}` }, [
      h('summary', {}, [h('span', { i18n: `${k}.q` }), h('i', { 'aria-hidden': 'true' })]),
      h('p', { class: 'faq__a', i18n: `${k}.a` }),
    ])));

  document.querySelector('[data-year]').textContent = new Date().getFullYear();
}

const gel = (n) => Math.round(n).toLocaleString('en-US').replace(/,/g, '\u202f');

function renderPrograms() {
  const filters = document.querySelector('[data-filters]');
  const tab = (id, key) => h('button', { type: 'button', 'aria-pressed': String(id === 'all'), 'data-school': id, i18n: key });
  filters.replaceChildren(tab('all', 'programs.all'), ...SCHOOLS.map((id) => tab(id, `schools.${id}`)));

  fill('[data-programs]', PROGRAMS.map((p, i) =>
    h('li', { class: 'program reveal', 'data-school': p.school, style: `--i:${i % 6}` }, [
      h('p', { class: 'program__school eyebrow', i18n: `schools.${p.school}` }),
      h('h3', { i18n: `programs.names.${p.id}` }),
      h('div', { class: 'program__meta' }, [
        h('p', { class: 'program__fee' }, [h('b', {}, [`${gel(p.fee)} ₾`]), ' ', h('span', { i18n: 'programs.perYear' })]),
        h('p', { class: 'program__langs' }, p.langs.map((l) => h('span', { class: `tag tag--${l}`, i18n: `langs.${l}` }))),
      ]),
    ])));

  filters.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-school]');
    if (!btn) return;
    const id = btn.dataset.school;
    filters.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
    document.querySelectorAll('.program').forEach((card) => { card.hidden = id !== 'all' && card.dataset.school !== id; });
    window.dispatchEvent(new Event('ibsu:layout'));
  });
}

function renderCalculator() {
  const select = document.querySelector('[data-calc-program]');
  select.replaceChildren(...SCHOOLS.map((school) =>
    h('optgroup', { 'data-i18n-attr': `label:schools.${school}` }, PROGRAMS.filter((p) => p.school === school).map((p) =>
      h('option', { value: p.id, i18n: `programs.names.${p.id}` })))));

  document.querySelector('[data-calc-grants]').replaceChildren(...GRANTS.map((g) =>
    h('label', { class: 'grant', 'data-grant': g.id }, [
      h('input', { type: 'checkbox', value: g.id }),
      h('span', { class: 'grant__pct' }, [`${g.pct}%`]),
      h('span', { class: 'grant__text' }, [h('b', { i18n: `tuition.list.${g.id}.title` }), h('small', { i18n: `tuition.list.${g.id}.body` })]),
    ])));

  const form = document.querySelector('[data-calc]');
  const out = {
    full: form.querySelector('[data-calc-full]'), grant: form.querySelector('[data-calc-grant]'),
    pay: form.querySelector('[data-calc-pay]'), monthly: form.querySelector('[data-calc-monthly]'),
  };
  let shownPay = 0;
  const update = () => {
    const program = PROGRAMS.find((p) => p.id === select.value) ?? PROGRAMS[0];
    form.querySelectorAll('.grant').forEach((row) => {
      const g = GRANTS.find((x) => x.id === row.dataset.grant);
      const box = row.querySelector('input');
      const allowed = !g.creativeOnly || program.creative;
      box.disabled = !allowed;
      if (!allowed) box.checked = false;
      row.classList.toggle('is-disabled', !allowed);
    });
    const pct = Math.max(0, ...GRANTS.filter((g) => form.querySelector(`input[value="${g.id}"]`).checked).map((g) => g.pct));
    const pay = program.fee * (1 - pct / 100);
    form.querySelectorAll('.grant').forEach((row) => {
      const g = GRANTS.find((x) => x.id === row.dataset.grant);
      row.classList.toggle('is-applied', pct > 0 && g.pct === pct && row.querySelector('input').checked);
    });
    out.full.textContent = `${gel(program.fee)} ₾`;
    out.grant.textContent = pct ? `−${pct}%` : t('tuition.none');
    out.monthly.textContent = t('tuition.monthly').replace('{x}', gel(pay / INSTALMENT_MONTHS));
    // count toward the new figure so the saving is felt, not just read
    const from = shownPay;
    const start = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - start) / 600);
      shownPay = from + (pay - from) * (1 - (1 - k) ** 3);
      out.pay.textContent = gel(shownPay);
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  form.addEventListener('change', update);
  onLangChange(update);
  select.value = 'cs';
  update();
}

const EXPLORE_LINKS = {
  open: 'https://docs.google.com/forms/d/1gIFliUAAOBOoD4FF2G9rTPWaigSRr1kvcXZ9Y00iFBU/viewform',
  career: 'https://ibsu.edu.ge/entrant/guide/',
  profession: 'https://ibsu.edu.ge/entrant/choose-profession/',
};

function renderExplore() {
  fill('[data-explore]', each('explore.cards', (c, i, k) =>
    h('li', { class: 'explore__card reveal', style: `--i:${i}` }, [
      h('span', { class: 'explore__n eyebrow' }, [`0${i + 1}`]),
      h('h3', { i18n: `${k}.title` }),
      h('p', { i18n: `${k}.body` }),
      h('a', { class: 'btn btn--yellow', href: EXPLORE_LINKS[c.k], target: '_blank', rel: 'noopener', i18n: `${k}.cta` }),
    ])));
  const items = (cls) => each('explore.trainingList', (_, i, k) => h('li', { class: cls, i18n: k }));
  fill('[data-trainings]', items(''));
  // doubled track so the marquee loops seamlessly
  fill('[data-marquee]', [h('ul', {}, items('pill')), h('ul', { 'aria-hidden': 'true' }, items('pill'))]);
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
