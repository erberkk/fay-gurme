// Menu application: renders public/data/menu.json and handles search, sorting,
// categories, product dialogs, saved items, sharing and the hero film.
// The scroll-driven opening lives in experience.js.

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
// Inline SVG icon set (24px grid, stroked).
const paths = {
  'arrow-up-right': '<path d="M6 18 18 6M6 6h12v12"/>',
  'arrow-down': '<path d="M12 4v16m-6-6 6 6 6-6"/>',
  'arrow-up': '<path d="M12 20V4m-6 6 6-6 6 6"/>',
  'arrow-right': '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  'arrow-left': '<path d="M20 12H4m6-6-6 6 6 6"/>',
  'chevron-down': '<path d="m6 9 6 6 6-6"/>',
  search: '<circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/>',
  heart:
    '<path d="M20.8 4.6a5.6 5.6 0 0 0-7.9 0l-.9.9-.9-.9a5.6 5.6 0 0 0-7.9 7.9L12 21l8.8-8.5a5.6 5.6 0 0 0 0-7.9Z"/>',
  phone:
    '<path d="m7 3 3 5-2.5 2.5a15 15 0 0 0 6 6L16 14l5 3v3a1 1 0 0 1-1 1C10.6 21 3 13.4 3 4a1 1 0 0 1 1-1Z"/>',
  pin: '<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 14 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  menu: '<path d="M4 8h16M8 16h12"/>',
  x: '<path d="m6 6 12 12M6 18 18 6"/>',
  sliders:
    '<path d="M4 7h9m4 0h3M4 17h3m4 0h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  utensils: '<path d="M5 3v5a3 3 0 0 0 6 0V3M8 3v18m11 0V3c-4 3-5 9 0 9"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.1"/>',
  play: '<path d="m9 5 11 7-11 7Z"/>',
  pause: '<path d="M9 5v14M15 5v14"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  share: '<path d="M12 15V3m-4 4 4-4 4 4M6 12H4v9h16v-9h-2"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  leaf: '<path d="M20 4c-9-1-16 3-15 9a6 6 0 0 0 7 6c6-1 8-8 8-15ZM4 21 15 10"/>',
  sprout: '<path d="M12 21v-9m0 2c-5 0-8-2.5-8-7 5 0 8 2.5 8 7Zm0-3c0-4.5 2.7-7 8-7 0 4.5-2.7 7-8 7Z"/>',
  'wheat-off':
    '<path d="M12 21V8m0 5c-3 0-5-2-5-5 3 0 5 2 5 5Zm0 3c3 0 5-2 5-5m-5-1c3 0 5-2 5-5M4 4l16 16"/>',
  nut: '<path d="M15.5 4.5c3 1.4 5 4.3 4.5 7.7-.7 4.8-5 8.3-9.6 7.8-4.1-.5-7-4.2-6.3-8.2.4-2.3 1.8-4.2 3.7-5.3 2.6-1.5 5.1-3.2 7.7-2Z"/><path d="M8 7c1.5 1 2.5 2.5 3 4.5M16 16c-1.5-1-2.5-2.5-3-4.5"/>',
  chili:
    '<path d="M19 5c-1.5 1.5-2.7 1.8-4.4 1.4C11 5.6 7.3 7.6 6 11.1c-1.1 3-.2 6.2 2.1 8 4.1-.5 7.6-2.9 9.6-6.5 1.2-2.2.8-4.3-1.1-5.7M18 4l2 2"/>',
};
const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.info}</svg>`;
function hydrateIcons(root = document) {
  $$('svg[data-icon]', root).forEach(el => {
    el.setAttribute('viewBox', '0 0 24 24');
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = paths[el.dataset.icon] || paths.info;
  });
}
hydrateIcons();

// i18n shorthands, backed by public/i18n/i18n.js.
const T = (...args) => window.FayI18n.t(...args);
const lang = () => window.FayI18n.getLang();
const locale = () => (lang() === 'en' ? 'en-US' : 'tr-TR');
const L = p => window.FayI18n.localizedProduct(p);
const LC = c => window.FayI18n.localizedCategory(c);

// Formatting helpers.
const escapeHTML = value =>
  String(value ?? '').replace(
    /[&<>"']/g,
    char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]
  );
const normalize = value =>
  String(value).toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i');
const titleCase = value =>
  value
    .toLocaleLowerCase(locale())
    .replace(/(^|\s)(\p{L})/gu, (_, space, char) => space + char.toLocaleUpperCase(locale()));
const descriptionText = value => String(value).replace(/([,;])(?=\S)/g, '$1 ');
const priceHTML = product =>
  product.price === null
    ? `<span class="price">${T('product.priceUnknown')}</span>`
    : `<span class="price">${new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format(product.price)}<small>₺</small></span>`;
// State.
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const savedKey = 'fay-gurme:selected:v1';
let saved;
try {
  const parsed = JSON.parse(localStorage.getItem(savedKey) || '[]');
  saved = new Set(Array.isArray(parsed) ? parsed.filter(id => typeof id === 'string') : []);
} catch {
  saved = new Set();
}
let data,
  productsById,
  categoriesById,
  openProductId = null;
const state = { category: '333', query: '', sort: 'default', limit: 24 };
const groupIds = [
  ['featured', 'all'],
  ['323', '324', '325', '327'],
  ['333', '332', '331', '334', '326', '328', '329', '330'],
  ['320', '322', '321', '335'],
  ['336'],
  ['337', '338', '339', '340', '341'],
  ['342'],
];
const categoryCopyIds = ['333', '324', '336', '326', '342', '320', '321', '322'];
const allergenCodes = [
  'gluten',
  'milk',
  'egg',
  'nuts',
  'peanut',
  'soy',
  'fish',
  'crustacean',
  'sesame',
  'celery',
  'mustard',
  'sulfite',
  'lupin',
  'mollusc',
];
const menuLabelMeta = {
  '🌿': ['label.plant', 'sprout'],
  '🥬': ['label.vegetable', 'leaf'],
  '🆓🌾': ['label.glutenfree', 'wheat-off'],
  '🥜': ['label.nuts', 'nut'],
  '🌶️': ['label.spicy', 'chili'],
};
function menuLabel(label) {
  const [key, iconName] = menuLabelMeta[label] || ['product.allergenLabel', 'info'];
  return `<span class="source-label">${icon(iconName)}<span>${T(key)}</span></span>`;
}
function allergenLabel(code) {
  return T('allergen.' + code) === 'allergen.' + code ? code : T('allergen.' + code);
}
let toastTimeout;

function categoryName(id) {
  return id === 'all'
    ? T('category.all')
    : id === 'featured'
      ? T('category.featured')
      : id === 'saved'
        ? T('category.saved')
        : titleCase(LC(categoriesById.get(id))?.name || T('menu.sidebar.heading'));
}
function categoryCount(id) {
  return id === 'all'
    ? data.products.length
    : id === 'featured'
      ? data.featured.length
      : id === 'saved'
        ? saved.size
        : categoriesById.get(id)?.productIds.length || 0;
}
function categoryCopy(id) {
  return categoryCopyIds.includes(id) ? T('category.copy.' + id) : undefined;
}
function toast(message) {
  clearTimeout(toastTimeout);
  $('#toast').textContent = message;
  $('#toast').classList.add('visible');
  toastTimeout = setTimeout(() => $('#toast').classList.remove('visible'), 2600);
}
function persistSaved() {
  try {
    localStorage.setItem(savedKey, JSON.stringify([...saved]));
  } catch {
    /* Saving remains available in memory when storage is disabled. */
  }
}
function syncSaved() {
  $$('.saved-count').forEach(el => (el.textContent = saved.size));
  $$('[data-action="saved"]').forEach(el => {
    if (el.tagName === 'BUTTON') el.setAttribute('aria-pressed', String(state.category === 'saved'));
  });
  $$('[data-save]').forEach(el => {
    const active = saved.has(el.dataset.save),
      product = productsById?.get(el.dataset.save);
    el.setAttribute('aria-pressed', String(active));
    if (el.classList.contains('favorite-button'))
      el.setAttribute(
        'aria-label',
        `${L(product)?.name || '—'}: ${active ? T('product.favorite.remove') : T('product.favorite.add')}`
      );
    else
      el.innerHTML = `${icon(active ? 'check' : 'heart')} ${active ? T('product.saved.buttonActive') : T('product.saved.buttonInactive')}`;
  });
}
function toggleSaved(id) {
  if (!productsById.has(id)) return;
  const restoreFocus = state.category === 'saved' && $('#product-grid').contains(document.activeElement);
  const wasSaved = saved.has(id);
  if (wasSaved) saved.delete(id);
  else saved.add(id);
  persistSaved();
  syncSaved();
  if (state.category === 'saved') {
    renderResults();
    if (restoreFocus)
      $('#product-grid [data-save], #product-grid .empty-state button')?.focus({ preventScroll: true });
  }
  toast(wasSaved ? T('product.favorite.removedToast') : T('product.favorite.addedToast'));
}
// Rendering.
function favoriteButton(rawProduct) {
  const p = L(rawProduct);
  return `<button class="favorite-button" data-save="${rawProduct.id}" aria-pressed="${saved.has(rawProduct.id)}" aria-label="${escapeHTML(p.name)}: ${saved.has(rawProduct.id) ? T('product.favorite.remove') : T('product.favorite.add')}">${icon('heart')}</button>`;
}
function productImage(rawProduct, className = 'product-image') {
  const p = L(rawProduct);
  return `<button class="${className}" data-product="${rawProduct.id}" aria-label="${T('product.detailAria', escapeHTML(p.name))}">${p.image ? `<img src="${p.image}" alt="${escapeHTML(p.name)}" loading="lazy" decoding="async" width="600" height="600">` : `<span class="image-fallback">${T('product.fallback')}</span>`}${className === 'product-image' ? `<span class="detail-hint" aria-hidden="true">${icon('plus')}</span>` : ''}</button>`;
}
function productCard(rawProduct) {
  const p = L(rawProduct);
  const kind =
    rawProduct.categoryId === '320'
      ? T('product.kind.vegetarian')
      : rawProduct.categoryId === '321'
        ? T('product.kind.vegan')
        : rawProduct.categoryId === '322'
          ? T('product.kind.glutenfree')
          : rawProduct.categoryId === '333'
            ? T('product.kind.local')
            : '';
  return `<article class="product-card" data-id="${rawProduct.id}">${productImage(rawProduct)}${favoriteButton(rawProduct)}<div class="product-card-body"><h4><button class="product-title" data-product="${rawProduct.id}">${escapeHTML(p.name)}</button></h4><p class="product-description">${escapeHTML(descriptionText(p.description))}</p><div class="product-card-bottom">${priceHTML(p)}<span class="product-kind">${kind}</span></div></div></article>`;
}
function renderFeatured() {
  $('#featured-track').innerHTML = data.featured
    .map((id, i) => {
      const raw = productsById.get(id);
      if (!raw) return '';
      const p = L(raw);
      return `<article class="featured-card"><button class="featured-image-button" data-product="${raw.id}" aria-label="${T('product.detailAria', escapeHTML(p.name))}"><img src="${p.image}" alt="${escapeHTML(p.name)}" loading="lazy" decoding="async" width="600" height="480"><span class="featured-badge">${escapeHTML(T('featured.badge', String(i + 1).padStart(2, '0')))}</span></button>${favoriteButton(raw)}<div class="featured-info"><h3><button data-product="${raw.id}">${escapeHTML(p.name)}</button></h3>${priceHTML(p)}</div><p class="featured-category">${escapeHTML(categoryName(raw.categoryId))}</p></article>`;
    })
    .join('');
  updateCarousel();
}
function categoryButton(id) {
  return `<button class="category-button" data-category="${id}" aria-pressed="${state.category === id}"><span>${escapeHTML(categoryName(id))}</span><span class="category-number">${String(categoryCount(id)).padStart(2, '0')}</span></button>`;
}
function renderCategories() {
  const groupLabels = T('category.groups');
  const markup = groupIds
    .map(
      (ids, i) =>
        `<p class="category-group-title">${escapeHTML(groupLabels[i])}</p>${ids.map(categoryButton).join('')}`
    )
    .join('');
  $('#category-list').innerHTML = markup;
  $('#dialog-category-list').innerHTML = markup;
  $('#quick-categories').innerHTML = ['333', '324', '332', '326', '336', '340', 'all']
    .map(
      id =>
        `<button class="quick-category" data-category="${id}" aria-pressed="${state.category === id}">${id === '333' ? escapeHTML(T('category.chefSelection')) : escapeHTML(categoryName(id))}</button>`
    )
    .join('');
  const count = $('#category-count');
  if (count) count.textContent = T('menu.sidebar.categoryCount', data.categories.length);
  syncTasteLinks();
}
function syncTasteLinks() {
  $$('.taste-product-link[data-product]').forEach(btn => {
    const raw = productsById?.get(btn.dataset.product);
    if (!raw) return;
    const span = $('.taste-product-name', btn);
    if (span) span.textContent = L(raw).name;
  });
}
function syncCategoryButtons() {
  $$('[data-category]').forEach(el =>
    el.setAttribute('aria-pressed', String(el.dataset.category === state.category))
  );
  syncSaved();
}
// Filtering, sorting and navigation.
function filteredProducts() {
  let list =
    state.category === 'saved'
      ? data.products.filter(p => saved.has(p.id))
      : state.category === 'featured'
        ? data.featured.map(id => productsById.get(id))
        : state.category === 'all'
          ? data.products
          : [...data.products.filter(p => p.categoryId === state.category)];
  const terms = normalize(state.query.trim()).split(/\s+/).filter(Boolean);
  if (terms.length)
    list = list.filter(raw => {
      const p = L(raw);
      return terms.every(term =>
        normalize(
          `${p.name} ${p.description} ${LC(categoriesById.get(raw.categoryId))?.name || ''}`
        ).includes(term)
      );
    });
  if (state.sort === 'price-asc')
    list = [...list].sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
  else if (state.sort === 'price-desc')
    list = [...list].sort((a, b) => (b.price ?? -Infinity) - (a.price ?? -Infinity));
  else if (state.sort === 'name') list = [...list].sort((a, b) => L(a).name.localeCompare(L(b).name, lang()));
  return list;
}
function renderResults({ animate = false } = {}) {
  const products = filteredProducts(),
    searching = Boolean(state.query.trim()),
    copy = categoryCopy(state.category);
  $('#category-title').textContent = searching ? T('search.titleActive') : categoryName(state.category);
  $('#category-eyebrow').textContent = searching
    ? state.category === 'saved'
      ? T('search.eyebrow.saved')
      : T('search.eyebrow.all')
    : state.category === 'saved'
      ? T('search.eyebrow.savedIdle')
      : copy?.[0] || T('category.eyebrow.default');
  $('#result-count').textContent = T(
    'search.resultCount',
    products.length,
    searching ? state.query.trim() : ''
  );
  $('#category-note').innerHTML = !searching && copy ? `<span>${escapeHTML(copy[1])}</span>` : '';
  const grid = $('#product-grid');
  if (products.length) {
    grid.innerHTML = products.slice(0, state.limit).map(productCard).join('');
  } else {
    const savedEmpty = state.category === 'saved' && !searching;
    grid.innerHTML = `<div class="empty-state">${icon(savedEmpty ? 'heart' : 'search')}<h4>${savedEmpty ? T('empty.savedTitle') : T('empty.searchTitle')}</h4><p>${savedEmpty ? T('empty.savedBody') : T('empty.searchBody')}</p><button class="button button-primary" data-action="reset">${savedEmpty ? T('empty.exploreMenu') : T('empty.clearSearch')} ${icon('arrow-right')}</button></div>`;
  }
  $('#menu-pagination').innerHTML =
    products.length > state.limit
      ? `<div class="load-more-wrap"><p>${T('pagination.showing', Math.min(state.limit, products.length), products.length)}</p><button class="button button-secondary" data-action="load-more">${T('pagination.loadMore')} ${icon('plus')}</button></div>`
      : '';
  if (animate && !reducedMotion.matches) {
    grid.classList.remove('is-changing');
    requestAnimationFrame(() => grid.classList.add('is-changing'));
  }
  syncCategoryButtons();
  document.dispatchEvent(new Event('fay:menu-rendered'));
}
function updateURL() {
  const url = new URL(location.href);
  if (state.category !== '333') url.searchParams.set('kategori', state.category);
  else url.searchParams.delete('kategori');
  if (state.query) url.searchParams.set('q', state.query);
  else url.searchParams.delete('q');
  history.replaceState(null, '', url);
}
function goToResults({ instant = false } = {}) {
  const target = window.innerWidth <= 900 ? $('.mobile-category-bar') : $('.menu-toolbar');
  const offset =
    parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) + 16;
  window.scrollTo({
    top: target.getBoundingClientRect().top + window.scrollY - offset,
    behavior: instant || reducedMotion.matches ? 'instant' : 'smooth',
  });
}
async function enterMenu() {
  if (document.readyState !== 'complete')
    await new Promise(resolve => window.addEventListener('load', resolve, { once: true }));
  await document.fonts.ready;
  requestAnimationFrame(() => {
    window.ScrollTrigger?.refresh();
    requestAnimationFrame(() => goToResults({ instant: true }));
  });
}
function chooseCategory(id, { scroll = true } = {}) {
  if (!categoriesById.has(id) && !['all', 'featured', 'saved'].includes(id)) return;
  state.category = id;
  state.query = '';
  state.limit = 24;
  $('#menu-search').value = '';
  updateURL();
  renderResults({ animate: true });
  closeDialog($('#categories-dialog'));
  if (scroll) goToResults();
}
// Dialogs and sharing.
function openDialog(dialog) {
  dialog.getAnimations().forEach(a => a.cancel());
  if (!dialog.open) dialog.showModal();
}
function closeDialog(dialog) {
  if (!dialog.open) return;
  if (dialog.id === 'product-dialog') {
    openProductId = null;
    const url = new URL(location.href);
    url.searchParams.delete('urun');
    history.replaceState(null, '', url);
  }
  $$('video', dialog).forEach(video => video.pause());
  if (reducedMotion.matches) {
    dialog.close();
    return;
  }
  const animation = dialog.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: 'ease-in' });
  animation.finished
    .then(() => {
      dialog.close();
      animation.cancel();
    })
    .catch(() => {});
}
function openProduct(id) {
  const raw = productsById.get(id);
  if (!raw) return;
  const p = L(raw);
  openProductId = id;
  const category = categoriesById.get(raw.categoryId);
  $('#product-detail').innerHTML =
    `<div class="detail-layout"><div class="detail-photo">${p.image ? `<img src="${p.image}" alt="${escapeHTML(p.name)}" width="600" height="700">` : `<span class="image-fallback">${T('product.fallback')}</span>`}</div><div class="detail-body"><p class="eyebrow">${escapeHTML(categoryName(raw.categoryId))}</p><h2 id="detail-name">${escapeHTML(p.name)}</h2><div class="detail-price">${priceHTML(p)}</div><p class="detail-description">${escapeHTML(descriptionText(p.description || T('product.descriptionFallback')))}</p><div class="allergens"><span>${T('product.allergenLabel')}</span>${raw.allergens.length ? `<div class="allergen-tags">${raw.allergens.map(a => `<span class="allergen-tag">${escapeHTML(allergenLabel(a))}</span>`).join('')}</div>` : `<p class="allergen-note">${T('product.allergenNote.none')}</p>`}<p class="allergen-note">${raw.allergens.length ? T('product.allergenNote.prefix') : ''}${T('product.allergenNote.common')}</p></div><div class="detail-actions"><button class="button button-primary" data-save="${raw.id}" aria-pressed="${saved.has(raw.id)}">${icon(saved.has(raw.id) ? 'check' : 'heart')} ${saved.has(raw.id) ? T('product.saved.buttonActive') : T('product.saved.buttonInactive')}</button><button class="button button-secondary" data-share="${raw.id}" aria-label="${T('product.shareAria', escapeHTML(p.name))}">${icon('share')}</button></div>${category?.video ? `<details class="detail-category-video"><summary>${T('product.detailVideoSummary')}</summary><video controls playsinline preload="none" poster="${category.image}" data-src="${category.video}" aria-label="${T('product.detailVideoAria', escapeHTML(categoryName(raw.categoryId)))}"></video></details>` : ''}</div></div>`;
  if (raw.labels.length) {
    const labels = document.createElement('div');
    labels.className = 'source-labels';
    labels.innerHTML = `<span>${T('product.labelsHeading')}</span>${raw.labels.map(menuLabel).join('')}`;
    $('.detail-actions').before(labels);
  }
  const details = $('.detail-category-video');
  if (details)
    details.addEventListener('toggle', () => {
      const video = $('video', details);
      if (details.open && !video.src) video.src = video.dataset.src;
      if (!details.open) video.pause();
    });
  const url = new URL(location.href);
  url.searchParams.set('urun', id);
  history.replaceState(null, '', url);
  openDialog($('#product-dialog'));
  syncSaved();
}
async function shareProduct(id) {
  const raw = productsById.get(id);
  if (!raw) return;
  const p = L(raw);
  const url = new URL(location.href);
  url.searchParams.set('urun', id);
  try {
    if (navigator.share) {
      await navigator.share({ title: T('product.shareTitle', p.name), url: url.href });
      return;
    }
    await navigator.clipboard.writeText(url.href);
    toast(T('product.shareCopiedToast'));
  } catch (error) {
    if (error.name === 'AbortError') return;
    const existing = $('#share-link');
    if (existing) {
      existing.focus();
      existing.select();
      return;
    }
    const wrapper = document.createElement('label');
    wrapper.className = 'share-manual';
    wrapper.textContent = T('product.share.manualLabel');
    const input = document.createElement('input');
    input.id = 'share-link';
    input.readOnly = true;
    input.value = url.href;
    input.style.cssText = 'width:100%;margin-top:8px;padding:12px;font-size:12px;';
    wrapper.append(input);
    $('.detail-body').append(wrapper);
    input.focus();
    input.select();
  }
}
function updateCarousel() {
  const track = $('#featured-track');
  $('[data-action="featured-prev"]').disabled = track.scrollLeft < 4;
  $('[data-action="featured-next"]').disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
}

// Event wiring. Clicks are delegated from the document.
document.addEventListener('click', event => {
  const langButton = event.target.closest('[data-action="set-lang"]');
  if (langButton) {
    setLanguage(langButton.dataset.lang);
    return;
  }
  const save = event.target.closest('[data-save]');
  if (save && data) {
    toggleSaved(save.dataset.save);
    return;
  }
  const product = event.target.closest('[data-product]');
  if (product && data) {
    openProduct(product.dataset.product);
    return;
  }
  const category = event.target.closest('[data-category]');
  if (category && data) {
    chooseCategory(category.dataset.category);
    return;
  }
  const share = event.target.closest('[data-share]');
  if (share && data) {
    shareProduct(share.dataset.share);
    return;
  }
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (!action) return;
  if (action === 'close-product') closeDialog($('#product-dialog'));
  else if (action === 'close-categories') closeDialog($('#categories-dialog'));
  else if (action === 'categories' && data) openDialog($('#categories-dialog'));
  else if (action === 'search') {
    goToResults();
    $('#menu-search').focus({ preventScroll: true });
  } else if (action === 'saved' && data) chooseCategory(state.category === 'saved' ? '333' : 'saved');
  else if (action === 'reset' && data) {
    chooseCategory(state.query ? 'all' : '333', { scroll: false });
    $('#menu-search').focus({ preventScroll: true });
  } else if (action === 'load-more' && data) {
    const previous = state.limit;
    state.limit += 24;
    renderResults();
    const next = $$('.product-card')[previous];
    $('button', next)?.focus({ preventScroll: true });
  } else if (action === 'featured-prev' || action === 'featured-next') {
    const track = $('#featured-track');
    track.scrollBy({
      left: (action === 'featured-next' ? 1 : -1) * (track.clientWidth + 24),
      behavior: reducedMotion.matches ? 'instant' : 'smooth',
    });
  } else if (action === 'toggle-hero') toggleHero();
});
$('#menu-search').addEventListener('input', event => {
  if (!data) return;
  state.query = event.target.value;
  state.limit = 24;
  if (state.category !== 'saved') state.category = 'all';
  updateURL();
  renderResults();
});
$('#sort-select').addEventListener('change', event => {
  if (!data) return;
  state.sort = event.target.value;
  renderResults({ animate: true });
});
$('#featured-track').addEventListener('scroll', updateCarousel, { passive: true });
window.addEventListener('resize', updateCarousel, { passive: true });
document.addEventListener('keydown', event => {
  if (event.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(event.target.tagName) && !$('dialog[open]')) {
    event.preventDefault();
    goToResults();
    $('#menu-search').focus({ preventScroll: true });
  }
});
$$('dialog').forEach(dialog => {
  dialog.addEventListener('cancel', event => {
    event.preventDefault();
    closeDialog(dialog);
  });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    )
      closeDialog(dialog);
  });
  dialog.addEventListener('close', () => {
    $$('video', dialog).forEach(video => {
      video.pause();
      video.removeAttribute('src');
      video.load();
    });
    if (dialog.id === 'product-dialog') {
      openProductId = null;
      const url = new URL(location.href);
      url.searchParams.delete('urun');
      history.replaceState(null, '', url);
    }
  });
});
window.addEventListener('storage', event => {
  if (event.key !== savedKey || !data) return;
  try {
    const parsed = JSON.parse(event.newValue || '[]');
    if (!Array.isArray(parsed)) return;
    saved = new Set(parsed.filter(id => productsById.has(id)));
    syncSaved();
    if (state.category === 'saved') renderResults();
  } catch {
    /* Ignore invalid external storage. */
  }
});

function setLanguage(next) {
  if (!data) return;
  window.FayI18n.setLang(next);
  $$('.lang-option').forEach(btn =>
    btn.setAttribute('aria-pressed', String(btn.dataset.lang === window.FayI18n.getLang()))
  );
  renderCategories();
  renderFeatured();
  renderResults();
  syncSaved();
  heroButtonState();
  if (openProductId) openProduct(openProductId);
}
$$('.lang-option').forEach(btn => btn.setAttribute('aria-pressed', String(btn.dataset.lang === lang())));

// Hero film: plays only while visible; autoplay is skipped for reduced motion and Save-Data.
const heroVideo = $('#hero-video');
let heroVisible = false,
  heroUserPaused = false,
  heroUserAllowed = false;
function heroButtonState() {
  const playing = !heroVideo.paused;
  $('[data-action="toggle-hero"]').innerHTML = icon(playing ? 'pause' : 'play');
  $('[data-action="toggle-hero"]').setAttribute(
    'aria-label',
    T(playing ? 'hero.video.pause.aria' : 'hero.video.play.aria')
  );
}
function autoVideoAllowed() {
  return heroUserAllowed || (!reducedMotion.matches && !navigator.connection?.saveData);
}
async function playHero() {
  if (!heroVideo.src) heroVideo.src = heroVideo.dataset.src;
  try {
    await heroVideo.play();
  } catch {
    /* The poster and explicit play control remain available. */
  }
  heroButtonState();
}
function syncHero() {
  if (heroVisible && !document.hidden && !heroUserPaused && autoVideoAllowed()) playHero();
  else heroVideo.pause();
}
function toggleHero() {
  if (heroVideo.paused) {
    heroUserPaused = false;
    heroUserAllowed = true;
    playHero();
  } else {
    heroUserPaused = true;
    heroVideo.pause();
  }
  heroButtonState();
}
heroVideo.addEventListener('play', heroButtonState);
heroVideo.addEventListener('pause', heroButtonState);
heroVideo.addEventListener('error', () => {
  heroVideo.pause();
  heroButtonState();
});
new IntersectionObserver(
  entries => {
    heroVisible = entries[0].isIntersecting;
    syncHero();
  },
  { threshold: 0.1 }
).observe(heroVideo);
document.addEventListener('visibilitychange', () => {
  syncHero();
  if (document.hidden) $$('dialog video').forEach(v => v.pause());
});
reducedMotion.addEventListener('change', () => {
  heroUserAllowed = false;
  syncHero();
});

const sectionObserver = new IntersectionObserver(
  entries => {
    const visible = entries
      .filter(entry => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (!visible) return;
    $$('.desktop-nav .nav-link').forEach(link => {
      const active = link.getAttribute('href') === `#${visible.target.id}`;
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  },
  { rootMargin: '-15% 0px -45% 0px', threshold: 0 }
);
['menu', 'deneyim', 'mekan'].forEach(id => sectionObserver.observe(document.getElementById(id)));

async function initialize() {
  try {
    const response = await fetch('/data/menu.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    data = await response.json();
    data.products = data.products.map(p =>
      p.image ? { ...p, sourceImage: p.image, image: `/media/enhanced-${p.id}.webp` } : p
    );
    productsById = new Map(data.products.map(p => [p.id, p]));
    categoriesById = new Map(data.categories.map(c => [c.id, c]));
    saved = new Set([...saved].filter(id => productsById.has(id)));
    const params = new URLSearchParams(location.search),
      category = params.get('kategori');
    if (categoriesById.has(category) || ['all', 'featured', 'saved'].includes(category))
      state.category = category;
    if (params.get('q')) {
      state.query = params.get('q');
      if (state.category !== 'saved') state.category = 'all';
      $('#menu-search').value = state.query;
    }
    renderCategories();
    renderFeatured();
    renderResults();
    syncSaved();
    heroButtonState();
    $('#year').textContent = new Date().getFullYear();
    if (productsById.has(params.get('urun'))) openProduct(params.get('urun'));
    else if (category || state.query || /^\/menu\/?$/.test(location.pathname)) enterMenu();
  } catch (error) {
    console.error('Menü yüklenemedi:', error);
    const message = `<div class="empty-state">${icon('info')}<h4>${T('menu.errorTitle')}</h4><p>${T('menu.errorBody')}</p><a class="button button-primary" href="${escapeHTML(location.pathname)}">${T('menu.errorRetry')} ${icon('arrow-right')}</a><a class="text-link" href="tel:+905342608522">+90 534 260 85 22</a></div>`;
    $('#product-grid').innerHTML = message;
    $('#featured-track').innerHTML = `<p class="loading-placeholder">${T('menu.errorLoadFailed')}</p>`;
  }
}
initialize();
