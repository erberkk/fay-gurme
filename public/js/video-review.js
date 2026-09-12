(() => {
  const T = (...args) => window.FayI18n.t(...args);
  const $ = selector => document.querySelector(selector);
  const original = $('#source-video'),
    restored = $('#restored-video');
  const frame = $('#comparison-frame'),
    split = $('#comparison-range'),
    seek = $('#video-seek');
  const play = $('#video-play'),
    status = $('#video-status');
  const preview = new URLSearchParams(location.search).has('preview');
  restored.src = preview ? '/media/venue-ai-preview.mp4?v=bt709' : restored.dataset.src;
  if (preview) {
    $('.video-facts span:last-child').removeAttribute('data-i18n');
    $('.video-facts span:last-child').textContent = T('vr.factsFpsPreview');
    $('.intro .note').removeAttribute('data-i18n');
    $('.intro .note').innerHTML = T('vr.notePreview');
    const download = $('.download-links a');
    download.href = restored.src;
    download.download = 'Fay-Gurme-1080p-onizleme.mp4';
    download.removeAttribute('data-i18n');
    download.textContent = T('vr.downloadPreview');
  } else restored.poster = '/media/venue-ai-1080-poster.webp';
  let ready = false,
    initializing = false,
    dragging = false,
    wantedPlaying = false;
  const clock = seconds => `00:${String(Math.floor(seconds)).padStart(2, '0')}`;
  function update() {
    if (!dragging) seek.value = restored.currentTime;
    $('#video-time').textContent = `${clock(restored.currentTime)} / ${clock(Number(seek.max))}`;
    play.textContent = restored.paused ? T('vr.play') : T('vr.pause');
  }
  function setSplit(value) {
    const amount = Math.max(0, Math.min(100, value));
    split.value = amount;
    frame.style.setProperty('--split', `${amount}%`);
    split.setAttribute('aria-valuetext', T('vr.valuetext', Math.round(amount)));
  }
  function point(event) {
    const rect = frame.getBoundingClientRect();
    setSplit(((event.clientX - rect.left) / rect.width) * 100);
  }
  split.addEventListener('input', () => setSplit(Number(split.value)));
  frame.addEventListener('pointerdown', event => {
    frame.setPointerCapture(event.pointerId);
    point(event);
  });
  frame.addEventListener('pointermove', event => {
    if (frame.hasPointerCapture(event.pointerId)) point(event);
  });
  function pause() {
    original.pause();
    restored.pause();
    if (ready) status.textContent = T('vr.statusPaused');
    update();
  }
  async function start() {
    if (!ready) return;
    if (restored.currentTime >= Number(seek.max) - 0.1) original.currentTime = restored.currentTime = 0;
    original.currentTime = restored.currentTime;
    try {
      await Promise.all([original.play(), restored.play()]);
      status.textContent = T('vr.statusPlaying');
    } catch {
      pause();
      status.textContent = T('vr.statusPlayRetry');
    }
    update();
  }
  play.addEventListener('click', () => (restored.paused ? start() : pause()));
  async function load() {
    if (ready || initializing || original.readyState < 1 || restored.readyState < 1) return;
    initializing = true;
    seek.max = Math.min(original.duration, restored.duration);
    const target = Math.min(5, Number(seek.max) / 2);
    await Promise.all(
      [original, restored].map(
        video =>
          new Promise(resolve => {
            video.addEventListener('seeked', resolve, { once: true });
            video.currentTime = target;
          })
      )
    );
    ready = true;
    play.disabled = seek.disabled = false;
    status.textContent = T('vr.statusReady');
    update();
  }
  [original, restored].forEach(video => {
    video.addEventListener('loadedmetadata', load);
    video.addEventListener('error', () => {
      pause();
      status.textContent = T('vr.statusLoadError');
    });
    video.addEventListener('ended', pause);
  });
  restored.addEventListener('timeupdate', () => {
    if (!restored.paused && Math.abs(original.currentTime - restored.currentTime) > 0.1)
      original.currentTime = restored.currentTime;
    update();
  });
  restored.addEventListener('play', update);
  restored.addEventListener('pause', update);
  seek.addEventListener('input', () => {
    if (!dragging) {
      wantedPlaying = !restored.paused;
      dragging = true;
      pause();
    }
    original.currentTime = restored.currentTime = Number(seek.value);
    update();
  });
  seek.addEventListener('change', () => {
    dragging = false;
    if (wantedPlaying) start();
    update();
  });
  $('#video-zoom').addEventListener('click', event => {
    const active = frame.classList.toggle('zoomed');
    event.currentTarget.setAttribute('aria-pressed', String(active));
    event.currentTarget.removeAttribute('data-i18n');
    event.currentTarget.textContent = active ? T('vr.zoomOff') : T('vr.zoom');
  });
  $('#video-sound').addEventListener('click', event => {
    restored.muted = !restored.muted;
    event.currentTarget.setAttribute('aria-pressed', String(!restored.muted));
    event.currentTarget.removeAttribute('data-i18n');
    event.currentTarget.textContent = restored.muted ? T('vr.soundOn') : T('vr.soundOff');
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pause();
  });
  document.querySelectorAll('[data-action="set-lang"]').forEach(btn => {
    btn.addEventListener('click', () => {
      window.FayI18n.setLang(btn.dataset.lang);
      document
        .querySelectorAll('.lang-option')
        .forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === window.FayI18n.getLang())));
      update();
      if (!ready) status.textContent = T('vr.statusPreparing');
    });
  });
  load();
})();
