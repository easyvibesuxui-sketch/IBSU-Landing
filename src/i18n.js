import en from './content/en.json';
import ka from './content/ka.json';

const dicts = { en, ka };
const STORE = 'ibsu-lang';
const listeners = new Set();
let current = 'en';

export const t = (key, lang = current) =>
  key.split('.').reduce((node, part) => (node == null ? node : node[part]), dicts[lang]);

export const lang = () => current;
export const onLangChange = (fn) => listeners.add(fn);

function initialLang() {
  const q = new URLSearchParams(location.search).get('lang');
  if (q && dicts[q]) return q;
  try {
    const saved = localStorage.getItem(STORE);
    if (saved && dicts[saved]) return saved;
  } catch {}
  return 'en';
}

export function apply(next) {
  current = next;
  document.documentElement.lang = next;
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const value = t(el.dataset.i18n);
    if (typeof value === 'string') el.textContent = value;
  });
  document.querySelectorAll('[data-i18n-attr]').forEach((el) => {
    el.dataset.i18nAttr.split(';').forEach((pair) => {
      const [attr, key] = pair.split(':');
      const value = t(key);
      if (typeof value === 'string') el.setAttribute(attr, value);
    });
  });
  try { localStorage.setItem(STORE, next); } catch {}
  listeners.forEach((fn) => fn(next));
}

export function initI18n() {
  document.querySelectorAll('[data-lang-toggle]').forEach((btn) =>
    btn.addEventListener('click', () => apply(current === 'en' ? 'ka' : 'en')),
  );
  apply(initialLang());
}
