# Quality checks

The site is verified with a set of Playwright scripts in [`scripts/qa/`](../scripts/qa).
They run against the local dev server (`npm run dev`) and write their raw reports
and screenshots to the git-ignored `source/` folder.

| Script | npm script | What it covers |
| --- | --- | --- |
| `audit.cjs` | `qa:audit` | Overflow and broken images at 375 / 768 / 1024 / 1440px, Turkish search, price sort, pagination, empty state, product dialog, saved items, deep links, mobile category drawer |
| `behavior.cjs` | `qa:behavior` | Hero video play/pause, pausing out of view, reduced-motion switch, direct `/menu` entry, 320px overflow, CLS and LCP |
| `experience-audit.cjs` | `qa:experience` | Scroll-driven opening, the three tasting chapters, reservation links, mobile swipe, overflow at 320–1440px |
| `accessibility.cjs` | `qa:a11y` | axe-core WCAG 2.1 A/AA on the page, product dialog and category dialog, desktop and mobile |
| `video-review-audit.cjs` | `qa:video-review` | Synchronised playback, seeking, zoom, sound and byte-range streaming on the video comparison page |

The accessibility check expects `axe.min.js` (from the `axe-core` package) at
`source/axe.min.js`. Playwright is not a project dependency; `browser.cjs` picks up
an existing installation, or you can point to one with `PLAYWRIGHT_PATH` and to a
Chromium binary with `FAY_BROWSER_PATH`.

## Latest results

- No horizontal overflow at 320, 375, 390, 768, 1024 and 1440px.
- All 23 categories and 198 products reachable; search, sorting, pagination,
  empty state, saved items and product deep links pass.
- Scroll changes the opening scene and advances the three stories; chapter
  buttons and product hand-off work. Phones use manual chapters.
- Reduced motion disables animation and video autoplay.
- Dialogs trap focus, close on Escape, return focus to the opener and clean up the URL.
- Video play/pause, out-of-view pausing and HTTP byte-range requests pass.
- **No axe-core A/AA violations** on the page and both dialogs, on desktop and mobile.
- Local desktop Chromium: LCP ≈ 0.70 s, CLS ≈ 0.099. These are local lab numbers,
  not field data or mobile network scores.

## Media verification

- All 744 frames of the restored hero video pass a coarse luminance/alignment
  check (`scripts/media/audit_video_frames.py`).
- Resolution, frame count, frame rate, start time, colour metadata and duration
  match the source, and the audio packets are bit-identical
  (`scripts/media/verify_video.py`).
- These checks catch processing failures; they are not a perceptual quality score.

## Known limits

- The menu is a snapshot of the restaurant's public menu. Prices and stock are not
  synced with any back office.
- Not yet tested on physical iOS/Android devices or in Safari.
