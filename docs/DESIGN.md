# Design system

This document is the source of truth for the visual and interaction decisions
behind the site. Tokens here map directly to the CSS custom properties in
[`public/css/styles.css`](../public/css/styles.css). A machine-readable version
of the same system lives in [`design-dna.json`](design-dna.json).

- **Product:** a working digital menu for a Turkish restaurant, reachable from a table QR code.
- **Audience:** guests on phones at the table, and people discovering the venue on desktop.
- **Direction:** cinematic, tactile, editorial and intimate. Real dishes and the real interior
  lead; nothing is invented.

## Visual thesis

Warm ivory, the logo's deep green and muted gold. Monumental FAY letters sit
behind a portrait film while angled food photographs add depth. Scrolling
dissolves the collage into a dark green scene, followed by three rotating food
stories. A moving typographic ribbon leads into the functional menu.

No invented dishes, architecture or claims about the restaurant. Where food
textures have been restored, that is documented (see [Media](#media)).

## Interaction thesis

- GSAP 3.13 and ScrollTrigger, self-hosted in `public/vendor/`.
- A staggered 1.25 s entrance introduces the film and the letters.
- Sticky scenes follow native scrolling and never hijack it: the opening runs for
  180svh and the tasting story for 185svh on screens wider than 600px.
- Scrolling pushes the side photos outward, dissolves the letters, shifts ivory to
  dark green and advances the three food chapters. Chapter buttons stay usable at
  any point.
- Phones get a compact entrance, light photo parallax and swipeable chapters,
  with no long pinned sections.
- Fine pointers get a magnetic menu button and an 82px image inspection marker;
  the system cursor always stays visible.
- `prefers-reduced-motion` falls back to static sections and manual playback.
- Every looping video can be paused, and only videos in view play.

## Tokens

| Group | Values |
| --- | --- |
| Colour | paper `#F7F5EF`, white `#FFFFFF`, surface `#EEEBE3`, green `#004A43` (logo), ink `#203C34`, muted `#59655D`, bronze `#795B35`, border `#DCDDD3`, gold `#CAB57C`, dark `#102E29`, error `#9B3535` |
| Scene colour | scene dark `#122F29`, scene gold `#D0BD8A`, secondary text `#C9D1C8` |
| Fonts | Cormorant Garamond 400/500/600 + 400 italic (display), Manrope 400–700 (body) |
| Type scale | hero `clamp(3.6rem, 6.5vw, 6.5rem)`, section `clamp(2.7rem, 4.5vw, 4.6rem)`, card 1.55rem, body 1rem, supporting 0.875rem, overline 0.65rem / 0.18em tracking |
| Spacing | 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96, 120px; gutter `clamp(20px, 5vw, 80px)`; max width 1440px |
| Radius | 0 / 4 / 12 / 999px — imagery stays rectangular, pills only for filters and round controls |
| Shadow | low `0 8px 24px #102E290A`, floating `0 16px 60px #102E2914`, modal `0 24px 100px #102E2933` |
| Motion | fast 160ms, normal 280ms, slow 600ms; ease `cubic-bezier(.2,.7,.2,1)`; ease-in on exit |
| Breakpoints | 600, 900, 1200px (plus a 360px safety net for the narrowest phones) |
| Layers | header 20, mobile dock 30, native dialogs in the top layer, toast 100 |

Minimum reading sizes: card descriptions 12px, prices 14px, full descriptions
14px, allergen tags 12px, notes 11px. Muted and bronze text pass 4.5:1 contrast on
both light surfaces.

## Components

- **Navigation** — sticky header with experience / menu / visit anchors, a bottom
  action dock on phones, visible active section and keyboard focus. Every
  reservation CTA opens the restaurant's WhatsApp link.
- **Buttons** — 44px minimum targets; solid green primary, bordered and text
  secondary; disabled state uses opacity and no motion.
- **Product cards** — real photograph at a fixed aspect ratio, serif title, price
  and description. The photo or title opens a native `<dialog>`; saving is a
  separate button.
- **Search** — persistent label, clear action, Turkish-aware normalisation
  (`ı`/`i`, diacritics), searches every product, live result count and a helpful
  empty state.
- **Categories** — sticky scrollable sidebar on desktop; a category dialog and
  horizontal quick filters on mobile. Every original category stays reachable.
- **Product dialog** — native focus trap, Escape and focus return; full
  description, exact price, allergen list and an optional category film. Allergen
  safety is never inferred.
- **Saved items** — stored in `localStorage` with a defensive fallback when
  storage is unavailable.
- **Language** — Turkish and English, remembered per device. UI strings live in
  `public/i18n/dict.js`; menu translations are stored next to the source text in
  `public/data/menu.json`.

## Content integrity

Names, descriptions, prices, labels and allergens are kept exactly as published
by the restaurant in `public/data/menu.json`. Restored image paths are mapped at
render time, so the original image paths remain intact in the data. Category
capitalisation is presentational only. Editorial headlines are new copy; opening
hours, addresses, reviews, staff names and availability are never invented.

## Media

- **Hero film** — the original 720 × 1280 source was restored locally with
  Real-ESRGAN x4plus to 1080 × 1920 (744 frames, 30 fps, BT.709). Each frame is
  blended 75/25 restored/source to limit over-smoothing; audio is bit-identical to
  the source. Reproduce with `scripts/media/upscale_video.py`, verify with
  `scripts/media/verify_video.py`.
- **Featured photos** — 12 hand-guided restorations
  (IDs 2589, 2590, 2599, 2506, 2622, 2625, 2600–2604, 2606); 2604 also gets a
  neutral white-balance correction.
- **Product photos** — the remaining 185 photos use local Real-ESRGAN x4plus with a
  72/28 restored/source blend, capped at a 1400px long edge, WebP quality 88.
  Product 3727 has no source photo and uses the text fallback.
- **Review tools** — `/media-review.html` and `/video-review.html` compare
  originals and restorations side by side.

Neural restoration reinterprets fine texture; it does not recover detail that was
never captured. Originals are always kept alongside the restored files.
