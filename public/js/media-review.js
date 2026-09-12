(() => {
  const T = (...args) => window.FayI18n.t(...args);
  const select = document.querySelector('#photo-choice');
  const frame = document.querySelector('#comparison-frame');
  const range = document.querySelector('#comparison-range');
  const source = document.querySelector('#source-photo');
  const restored = document.querySelector('#restored-photo');
  let photos = [],
    namesEn = {};
  function photoName(p) {
    return window.FayI18n.getLang() === 'en' && namesEn[p.id] ? namesEn[p.id] : p.name;
  }
  function setSplit(value) {
    const split = Math.max(0, Math.min(100, value));
    range.value = split;
    frame.style.setProperty('--split', `${split}%`);
    range.setAttribute('aria-valuetext', T('mr.valuetext', Math.round(split)));
  }
  range.addEventListener('input', () => setSplit(Number(range.value)));
  function point(event) {
    const rect = frame.getBoundingClientRect();
    setSplit(((event.clientX - rect.left) / rect.width) * 100);
  }
  frame.addEventListener('pointerdown', event => {
    frame.setPointerCapture(event.pointerId);
    point(event);
  });
  frame.addEventListener('pointermove', event => {
    if (frame.hasPointerCapture(event.pointerId)) point(event);
  });
  function refreshOptions() {
    select.replaceChildren(
      ...photos.map(p => {
        const option = document.createElement('option');
        option.value = p.id;
        option.textContent = photoName(p);
        return option;
      })
    );
  }
  function choose() {
    const p = photos.find(photo => photo.id === select.value);
    if (!p) return;
    const name = photoName(p);
    source.src = p.original;
    restored.src = p.restored;
    source.alt = T('mr.altSource', name);
    restored.alt = T('mr.altRestored', name);
    document.querySelector('#photo-metadata').textContent = T(
      'mr.metadata',
      p.originalSize.join(' × '),
      p.restoredSize.join(' × ')
    );
    document.querySelector('#image-note').textContent =
      p.id === '2604' ? T('mr.imageNote2604') : T('mr.imageNoteDefault');
    setSplit(50);
  }
  select.addEventListener('change', choose);
  document.querySelectorAll('[data-action="set-lang"]').forEach(btn => {
    btn.addEventListener('click', () => {
      window.FayI18n.setLang(btn.dataset.lang);
      document
        .querySelectorAll('.lang-option')
        .forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === window.FayI18n.getLang())));
      if (photos.length) {
        refreshOptions();
        select.value = photos.find(p => p.id === select.value)?.id || photos[0].id;
        choose();
      }
    });
  });
  Promise.all([
    fetch('/data/media-restorations.json').then(r => {
      if (!r.ok) throw new Error();
      return r.json();
    }),
    fetch('/data/menu.json')
      .then(r => (r.ok ? r.json() : { products: [] }))
      .catch(() => ({ products: [] })),
  ])
    .then(([data, menu]) => {
      photos = data.photos;
      (menu.products || []).forEach(p => {
        if (p.name_en) namesEn[p.id] = p.name_en;
      });
      refreshOptions();
      choose();
    })
    .catch(() => {
      select.disabled = true;
      document.querySelector('#photo-metadata').textContent = T('mr.loadError');
    });
})();
