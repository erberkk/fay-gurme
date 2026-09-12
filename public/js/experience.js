/* Scroll-driven opening and tasting story. Scrolling stays native; GSAP only animates visuals. */
(() => {
  const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
  const tabs = [...document.querySelectorAll('[data-taste]')];
  const copies = [...document.querySelectorAll('[data-taste-copy]')];
  const photos = [...document.querySelectorAll('[data-taste-image]')];
  const counter = document.querySelector('#taste-current');
  const gallery = document.querySelector('.taste-gallery');
  const engine = window.gsap;
  let current = 0;
  let storyScroll;
  let introPlayed = false;

  function showTaste(index, animate = true) {
    if (current === index) return;
    current = index;
    tabs.forEach((tab, i) => {
      tab.classList.toggle('is-active', i === index);
      tab.setAttribute('aria-pressed', String(i === index));
    });
    [...copies, ...photos].forEach(el => {
      const active = Number(el.dataset.tasteCopy ?? el.dataset.tasteImage) === index;
      engine?.killTweensOf(el);
      el.hidden = !active;
      el.classList.toggle('is-active', active);
      el.style.removeProperty('opacity');
      el.style.removeProperty('transform');
    });
    counter.textContent = String(index + 1).padStart(2, '0');
    if (engine && animate && !motionPreference.matches) {
      engine.fromTo(
        copies[index],
        { opacity: 0, y: 18 },
        { opacity: 1, y: 0, duration: 0.55, ease: 'power3.out', clearProps: 'transform,opacity' }
      );
      engine.fromTo(
        photos[index],
        { opacity: 0, y: 36, rotation: -6, scale: 0.94 },
        {
          opacity: 1,
          y: 0,
          rotation: 3,
          scale: 1,
          duration: 0.8,
          ease: 'power3.out',
          clearProps: 'transform,opacity',
        }
      );
      engine.fromTo(
        counter,
        { opacity: 0.2, y: 8 },
        { opacity: 1, y: 0, duration: 0.4, clearProps: 'transform,opacity' }
      );
    }
  }
  tabs.forEach(tab =>
    tab.addEventListener('click', () => {
      const index = Number(tab.dataset.taste);
      showTaste(index);
      if (storyScroll && storyScroll.isActive) {
        const progress = [0.08, 0.47, 0.88][index];
        window.scrollTo({
          top: storyScroll.start + (storyScroll.end - storyScroll.start) * progress,
          behavior: 'instant',
        });
      }
    })
  );

  let swipe;
  const resetSwipe = () => {
    gallery.classList.remove('is-swiping');
    gallery.style.setProperty('--swipe-x', '0px');
    swipe = null;
  };
  gallery.addEventListener('pointerdown', event => {
    if (event.pointerType === 'mouse' || innerWidth > 600) return;
    swipe = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      dx: 0,
      started: performance.now(),
      horizontal: false,
    };
    gallery.classList.add('is-swiping');
    gallery.setPointerCapture(event.pointerId);
  });
  gallery.addEventListener('pointermove', event => {
    if (!swipe || event.pointerId !== swipe.id) return;
    const dx = event.clientX - swipe.x;
    const dy = event.clientY - swipe.y;
    if (!swipe.horizontal && Math.abs(dx) > 8) swipe.horizontal = Math.abs(dx) > Math.abs(dy) * 1.15;
    if (!swipe.horizontal) return;
    event.preventDefault();
    const atEdge = (current === 0 && dx > 0) || (current === photos.length - 1 && dx < 0);
    swipe.dx = dx;
    gallery.style.setProperty('--swipe-x', `${dx * (atEdge ? 0.24 : 0.72)}px`);
  });
  const finishSwipe = event => {
    if (!swipe || event.pointerId !== swipe.id) return;
    const { dx, started, horizontal } = swipe;
    const elapsed = Math.max(1, performance.now() - started);
    const target = current + (dx < 0 ? 1 : -1);
    const change =
      horizontal &&
      target >= 0 &&
      target < photos.length &&
      (Math.abs(dx) > Math.min(64, gallery.clientWidth * 0.16) || Math.abs(dx) / elapsed > 0.45);
    resetSwipe();
    if (change) showTaste(target);
  };
  gallery.addEventListener('pointerup', finishSwipe);
  gallery.addEventListener('pointercancel', resetSwipe);

  if (!engine || !window.ScrollTrigger) return;
  const { gsap, ScrollTrigger } = window;
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });
  document.documentElement.classList.add('has-experience');
  const media = gsap.matchMedia();

  media.add(
    {
      motion: '(prefers-reduced-motion: no-preference)',
      desktop: '(min-width: 601px)',
      pointer: '(hover: hover) and (pointer: fine)',
    },
    context => {
      if (!context.conditions.motion) return;
      const cleanups = [];
      const header = () =>
        parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-height'));
      const params = new URLSearchParams(location.search);
      const deepEntry =
        location.pathname.startsWith('/menu') ||
        location.hash ||
        ['urun', 'kategori', 'q'].some(key => params.has(key));
      if (!introPlayed && !deepEntry && window.scrollY < 30) {
        introPlayed = true;
        const entrance = gsap.timeline({ defaults: { ease: 'power3.out' } });
        entrance
          .from('.monument-word > span', { yPercent: 105, opacity: 0, duration: 1.15, stagger: 0.09 }, 0)
          .from('.monument-word > em', { opacity: 0, x: -20, duration: 0.8 }, 0.5)
          .from(
            '.cinema-reveal',
            { clipPath: 'inset(100% 0% 0% 0%)', duration: 1.25, clearProps: 'clipPath' },
            0.15
          )
          .from(
            '.photo-drift',
            { y: 70, opacity: 0, scale: 0.9, duration: 1, stagger: 0.16, clearProps: 'all' },
            0.35
          )
          .from(
            '.line-mask > *',
            { yPercent: 110, duration: 0.85, stagger: 0.12, clearProps: 'transform' },
            0.65
          )
          .from(
            '.opening-copy p, .opening-bottom',
            { opacity: 0, y: 12, duration: 0.7, clearProps: 'transform,opacity' },
            1
          )
          .from(
            '.discovery-orbit',
            { scale: 0.75, opacity: 0, duration: 0.9, clearProps: 'transform,opacity' },
            0.8
          );
      }

      if (context.conditions.desktop) {
        gsap
          .timeline({
            scrollTrigger: {
              trigger: '.opening-scene',
              start: () => `top ${header()}`,
              end: 'bottom bottom',
              scrub: 0.65,
              invalidateOnRefresh: true,
            },
          })
          .to('.scene-progress > span', { scaleX: 1, duration: 1, ease: 'none' }, 0)
          .to('.monument-word', { y: -125, opacity: 0, duration: 0.5, ease: 'none' }, 0)
          .to(
            '.photo-left',
            { xPercent: -45, yPercent: -30, rotation: -18, opacity: 0, duration: 0.55, ease: 'none' },
            0.02
          )
          .to(
            '.photo-right',
            { xPercent: 45, yPercent: -20, rotation: 17, opacity: 0, duration: 0.55, ease: 'none' },
            0.02
          )
          .to('.cinema-frame', { scale: 1.06, y: -24, duration: 1, ease: 'none' }, 0)
          .to('.opening-copy', { y: -24, opacity: 0, duration: 0.3, ease: 'none' }, 0.1)
          .to('.scene-sticky', { backgroundColor: '#122f29', duration: 0.5, ease: 'none' }, 0.3)
          .to('.opening-meta, .opening-bottom, .cinema-side-label', { color: '#c9d1c8', duration: 0.3 }, 0.55)
          .to('.discovery-orbit', { backgroundColor: '#f3f0e7', color: '#122f29', duration: 0.3 }, 0.55)
          .to('.orbit-ring', { stroke: '#d0bd8a', rotation: 110, duration: 0.5, ease: 'none' }, 0.5)
          .fromTo('.scene-end-copy', { y: 30, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.25 }, 0.73);

        let previousStep = -1;
        storyScroll = ScrollTrigger.create({
          trigger: '.tasting-section',
          start: () => `top ${header()}`,
          end: 'bottom bottom',
          invalidateOnRefresh: true,
          onUpdate(self) {
            const index = self.progress < 0.34 ? 0 : self.progress < 0.7 ? 1 : 2;
            if (index !== previousStep) {
              previousStep = index;
              showTaste(index);
            }
          },
        });
        gsap.from('.taste-frame-line', {
          rotation: -13,
          scale: 0.94,
          scrollTrigger: { trigger: '.tasting-section', start: 'top bottom', end: 'top top', scrub: 1 },
        });
      } else {
        gsap.to('.photo-left .photo-drift', {
          y: -35,
          ease: 'none',
          scrollTrigger: { trigger: '.opening-scene', start: 'top top', end: 'bottom top', scrub: 0.7 },
        });
        gsap.to('.photo-right .photo-drift', {
          y: 30,
          ease: 'none',
          scrollTrigger: { trigger: '.opening-scene', start: 'top top', end: 'bottom top', scrub: 0.7 },
        });
      }

      gsap.to('.editorial-ribbon > div', {
        xPercent: -12,
        ease: 'none',
        scrollTrigger: { trigger: '.editorial-ribbon', start: 'top bottom', end: 'bottom top', scrub: 1 },
      });
      document
        .querySelectorAll('.tasting-heading, .section-heading, .menu-intro, .venue-copy')
        .forEach(el => {
          gsap.from(el.children, {
            y: 32,
            opacity: 0,
            duration: 0.85,
            stagger: 0.1,
            ease: 'power3.out',
            scrollTrigger: { trigger: el, start: 'top 94%', once: true },
            clearProps: 'transform,opacity',
          });
        });
      gsap.from('.venue-picture img', {
        clipPath: 'inset(16% 0% 16% 0%)',
        scale: 1.04,
        duration: 1.2,
        ease: 'power3.out',
        scrollTrigger: { trigger: '.venue-picture', start: 'top 85%', once: true },
        clearProps: 'transform,clipPath',
      });

      if (context.conditions.pointer) {
        document.querySelectorAll('.magnetic').forEach(el => {
          const move = event => {
            const rect = el.getBoundingClientRect();
            gsap.to(el, {
              x: (event.clientX - rect.left - rect.width / 2) * 0.16,
              y: (event.clientY - rect.top - rect.height / 2) * 0.16,
              duration: 0.45,
              overwrite: 'auto',
            });
          };
          const leave = () => gsap.to(el, { x: 0, y: 0, duration: 0.7, ease: 'elastic.out(1,.5)' });
          el.addEventListener('pointermove', move);
          el.addEventListener('pointerleave', leave);
          cleanups.push(() => {
            el.removeEventListener('pointermove', move);
            el.removeEventListener('pointerleave', leave);
            gsap.set(el, { clearProps: 'transform' });
          });
        });
        const track = document.querySelector('#featured-track');
        const cursor = document.createElement('span');
        cursor.className = 'image-follow-cursor';
        cursor.textContent = 'İNCELE';
        cursor.setAttribute('aria-hidden', 'true');
        const move = event => {
          const target = event.target.closest('.featured-image-button');
          if (!target) {
            cursor.style.opacity = '0';
            return;
          }
          if (cursor.parentNode !== target) target.append(cursor);
          const rect = target.getBoundingClientRect();
          gsap.to(cursor, {
            left: event.clientX - rect.left,
            top: event.clientY - rect.top,
            opacity: 1,
            duration: 0.2,
            overwrite: true,
          });
        };
        const leave = () => {
          cursor.style.opacity = '0';
        };
        track.addEventListener('pointermove', move);
        track.addEventListener('pointerleave', leave);
        cleanups.push(() => {
          track.removeEventListener('pointermove', move);
          track.removeEventListener('pointerleave', leave);
          cursor.remove();
        });
      }
      return () => {
        storyScroll = null;
        cleanups.forEach(cleanup => cleanup());
      };
    }
  );

  let refreshFrame;
  function refresh() {
    cancelAnimationFrame(refreshFrame);
    refreshFrame = requestAnimationFrame(() => ScrollTrigger.refresh(true));
  }
  document.addEventListener('fay:menu-rendered', refresh);
  document.fonts.ready.then(refresh);
  window.addEventListener('load', refresh, { once: true });
  motionPreference.addEventListener('change', () => {
    gsap.killTweensOf([...copies, ...photos, counter]);
    [...copies, ...photos, counter].forEach(el => {
      el.style.removeProperty('transform');
      el.style.removeProperty('opacity');
    });
    refresh();
  });
})();
