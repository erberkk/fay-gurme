// Shared TR/EN engine: language state, DOM translation, product/category localization.
(() => {
  const STORAGE_KEY = 'fay-gurme:lang:v1';
  const SUPPORTED = ['tr', 'en'];
  const listeners = new Set();

  function readStoredLang() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return SUPPORTED.includes(stored) ? stored : null;
    } catch {
      return null;
    }
  }

  let lang = readStoredLang() || 'tr';

  function t(key, ...args) {
    const entry = window.FAY_I18N_DICT[lang]?.[key] ?? window.FAY_I18N_DICT.tr[key];
    if (entry === undefined) return key;
    return typeof entry === 'function' ? entry(...args) : entry;
  }

  function getLang() {
    return lang;
  }

  function setLang(next) {
    if (!SUPPORTED.includes(next) || next === lang) return;
    lang = next;
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* Language still switches for this visit when storage is disabled. */
    }
    document.documentElement.lang = lang;
    applyStatic(document);
    listeners.forEach(fn => fn(lang));
  }

  function onChange(fn) {
    listeners.add(fn);
  }

  function applyStatic(root = document) {
    root.querySelectorAll('[data-i18n]').forEach(el => {
      el.textContent = t(el.dataset.i18n);
    });
    root.querySelectorAll('[data-i18n-html]').forEach(el => {
      el.innerHTML = t(el.dataset.i18nHtml);
    });
    root.querySelectorAll('[data-i18n-attrs]').forEach(el => {
      let map;
      try {
        map = JSON.parse(el.dataset.i18nAttrs);
      } catch {
        return;
      }
      Object.entries(map).forEach(([attr, key]) => el.setAttribute(attr, t(key)));
    });
    const title = document.querySelector('title[data-i18n]');
    if (title) document.title = t(title.dataset.i18n);
    const description = document.querySelector('meta[name="description"][data-i18n-attrs]');
    if (description) description.setAttribute('content', t('meta.description'));
  }

  function localizedProduct(p) {
    if (!p) return p;
    if (lang === 'en' && p.name_en)
      return { ...p, name: p.name_en, description: p.description_en || p.description };
    return p;
  }

  function localizedCategory(c) {
    if (!c) return c;
    if (lang === 'en' && c.name_en) return { ...c, name: c.name_en };
    return c;
  }

  document.documentElement.lang = lang;
  document.addEventListener('DOMContentLoaded', () => applyStatic(document));

  window.FayI18n = {
    t,
    getLang,
    setLang,
    onChange,
    applyStatic,
    localizedProduct,
    localizedCategory,
    SUPPORTED,
  };
})();
