# Scripts

Everything the site needs at runtime lives in `public/`. The scripts here are
the tooling used to build, verify and produce that content. Run them from the
repository root.

## Build

| Script | Purpose |
| --- | --- |
| `build.mjs` | Validates that every referenced image and video exists, then copies `public/` to `dist/` and generates the `/menu`, `/paylasim` and `/kesfet` entry pages. `npm run build` |
| `check-i18n.mjs` | Fails if a Turkish UI string has no English counterpart, if any menu item is missing a translation, or if Turkish text in the HTML is not wired to an i18n key. Part of `npm run check` |

## Data — `data/`

| Script | Purpose |
| --- | --- |
| `extract.py` | Parses an archived copy of the public menu page into `public/data/menu.json` and downloads its media with source provenance |
| `prepare_assets.py` | Self-hosts the Google Fonts and exports the menu to CSV |
| `menu-translations.mjs` | English names and descriptions for every category and product |
| `apply-menu-translations.mjs` | Merges those translations into `menu.json` and fails on any gap |

## Media restoration — `media/`

These need FFmpeg on the `PATH`, the Python packages in
[`requirements.txt`](requirements.txt) and the portable
[Real-ESRGAN NCNN/Vulkan](https://github.com/xinntao/Real-ESRGAN) release in
`source/video-upscale/tools/`. No cloud service or API key is involved.

| Script | Purpose |
| --- | --- |
| `upscale_video.py` | Restores the 720p hero film to 1080p frame by frame and re-muxes the original audio |
| `verify_video.py` | Asserts resolution, frame count, timing, colour metadata and bit-identical audio against the source |
| `audit_video_frames.py` | Coarse per-frame luminance and alignment check for the restored film |
| `restore_product_photos.py` | Restores every product photo that does not have a hand-curated version |
| `save-restored.ps1` | Imports hand-curated restorations: `./scripts/media/save-restored.ps1 -SourceDir <folder>` |

## Browser QA — `qa/`

Playwright checks that run against `npm run dev`. See
[`docs/QUALITY.md`](../docs/QUALITY.md) for what each one covers.

| Script | Purpose |
| --- | --- |
| `browser.cjs` | Shared helper that locates an existing Playwright/Chromium install |
| `audit.cjs`, `behavior.cjs`, `experience-audit.cjs`, `accessibility.cjs`, `video-review-audit.cjs` | Functional, motion, accessibility and video review checks |
| `capture.cjs` | Desktop and mobile screenshots |
| `inspect-original.cjs` | Records how the restaurant's original menu page loads its video |
