# Whale artwork

All files in `public/whales` depict U+1F433, spouting whale. `manifest.json` lists the source and version for each. The original six specimens come from: Apple, [iamcal/emoji-data](https://github.com/iamcal/emoji-data) (`img-apple-160`); Google, the vector source of [Noto Emoji](https://github.com/googlefonts/noto-emoji) v2.048 (Apache-2.0; notice in `public/whales/licenses/noto-emoji.txt`); WhatsApp and Facebook, the original images on their recorded Emojipedia version pages; Twitter, the vector source of the [jdecked/twemoji](https://github.com/jdecked/twemoji) fork v16.0.1 ([CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); credit Twitter, Inc., jdecked and other contributors; notice in `public/whales/licenses/twemoji.txt`); and OpenMoji, licensed [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/); credit OpenMoji designers and contributors. See the upstream projects for full license texts and attribution terms.

Apple artwork is copyright Apple and the source says it is not licensed for commercial use. Facebook artwork is copyright Facebook and its license is unclear. Their inclusion is for the requested visual comparison, not a grant of reuse rights. Review rights before reusing these assets. Neither this project's Apache-2.0 license nor the collection repository's code license supersedes individual image rights.

WhatsApp's image is the original artwork shown by [Emojipedia for WhatsApp 2.23.2.72](https://emojipedia.org/whatsapp/2.23.2.72/spouting-whale), retrieved 2026-11-13 from its [image CDN](https://em-content.zobj.net/source/whatsapp/352/spouting-whale_1f433.png). WhatsApp artwork rights remain with its owner; reuse rights have not been established. No substitute artwork is labeled as another vendor.

## Resolution

On 2026-11-15 three low-resolution originals were replaced by larger authentic originals of the same design and version. Each record in [COLLECTION-SOURCES.json](COLLECTION-SOURCES.json) gives the new URL, pinned version or commit, SHA-256 of the downloaded bytes, and a `replaces` note with the evidence that the drawing is unchanged.

- Google: the 128 px PNG was byte-identical to Noto Emoji v2.048's `png/128` file, so it was replaced by that tag's `svg/emoji_u1f433.svg`.
- Twitter: the 72 px PNG was byte-identical to jdecked/twemoji v16.0.1's `assets/72x72` file, so it was replaced by that tag's `assets/svg/1f433.svg`.
- Facebook: the 96 px emoji-data image was replaced by the 512 px original that Emojipedia serves, byte-identically, for Facebook 3.0 through 16.0. Downscaled to 96 px it matches the previous file except for resampling. The manifest now cites the Facebook 15.0 page. Facebook 2.2 has a different drawing and was not used.

The other rasters were kept because no larger original of the same version was found. Emojipedia's `source` image for every recorded vendor version is byte-identical to the file kept here, as are the other versions of the same artwork that were checked (Apple iOS 18.4, WhatsApp 2.24 to 2.26, Samsung One UI 7.0 and 8.5, LG G4). Apple's color emoji font tops out at 160 px, and Microsoft's Fluent repository has 3D art only at 256 px. Two later versions of a historical specimen have a larger image of a similar drawing: Google Android 7.0 (512 px, framed differently) and Apple iOS 4.0 (64 px, redrawn). Using either would change the version a specimen documents, so neither was substituted. No image was upscaled, redrawn or taken from another vendor.

Each manifest entry records the original's native `width` and `height`. For SVGs these come from the root `width`/`height` attributes or the `viewBox`. Rasters 64 px or smaller (now only Apple iPhone OS 2.2, 32 px) carry `"rendering": "pixelated"`, so the gallery can enlarge them as crisp pixel art. The splice lab enlarges them the same way.

### Display copies

The originals in `public/whales` are never recompressed, and their SHA-256 hashes stay as recorded. For the gallery grid, `tools/specimen-derivatives.mjs` writes lighter display copies of non-animated rasters that are at least 256 px to `public/whales/display/`, as WebP at quality 90 and at most 512 px. It keeps a copy only when it is at most 70% of the original's size, and records the copy as the specimen's `display` path. The tests check that each copy decodes, keeps the original's aspect ratio, and matches the original to within a mean of three levels per channel; the real copies differ by less than one. The splice lab always draws from the originals. Run `node tools/specimen-derivatives.mjs` after changing a specimen; `--check` reports stale dimensions or copies. The animated Skype APNG has no display copy, because a WebP from canvas would drop its animation.

### Splice lab export

The lab keeps its 600-unit editing space. Shared recipe URLs, transforms and pointer math are unchanged. It renders at a fixed 2× scale, so the canvas backing store and the downloaded PNG are 1200 × 1200 pixels on every device. Each part's masked layer is cached at that resolution, so vector sources are rasterised sharply.

## Expanded collection

The gallery contains twenty renderings. Fourteen additions were retrieved on 2026-11-13 by inspecting public vendor-version pages and official artwork repositories. [COLLECTION-SOURCES.json](COLLECTION-SOURCES.json) records each addition's exact source page, original image URL, version or pinned commit, SHA-256 of the unmodified downloaded bytes, code point and rights status. All additions identify U+1F433 Spouting Whale; U+1F40B Whale is excluded. Versions are snapshots, not a claim that every image is the vendor's latest design.

- Microsoft Fluent 3D and Flat come from Microsoft's official Fluent Emoji repository at the recorded commit. They are MIT licensed, copyright Microsoft Corporation; the complete notice is served at `public/whales/licenses/microsoft-fluent.txt`.
- EmojiTwo, Mozilla FxEmoji and Blobmoji come from pinned upstream repository revisions. Their upstream notices are retained in `public/whales/licenses/`. EmojiTwo credit: Emoji artwork is provided by Emojitwo, originally released as Emojione 2.2 by Ranks.com with contributions from the Emojitwo community (CC BY 4.0). FxEmoji visual design is copyright Mozilla Foundation under CC BY 4.0. Blobmoji is Apache-2.0, with credit to Noto Emoji and Blobmoji contributors.
- Samsung One UI 7.0, JoyPixels 7.0 and Skype Emoticons 1.2 are the originals shown on their recorded Emojipedia version pages. Their proprietary artwork is not relicensed by this project; redistribution permission is unestablished.
- Google Noto 3D is the static PNG from Google's official emoji CDN. Its static-image license remains unestablished; a license for animated Google assets is not assumed to cover this separate file.
- Historical specimens are Apple iPhone OS 2.2 (2008), Google Android 6.0.1 (2015), au by KDDI Type F, HTC Sense 7, and LG G5 (2016). Their original dimensions and bytes are retained. The recorded source pages explicitly identify the spouting whale; carrier mapping alone was not used to invent a glyph. No verified SoftBank image was obtained, and DoCoMo's original mapping was a text fallback, so neither was added.

The build checks decode every specimen, reject active or external SVG content, and compare normalized rendered pixels to catch exact visual duplicates. The original six specimen IDs remain unchanged, preserving existing shared recipes.

The site uses two typefaces, both under the SIL Open Font License 1.1: DM Sans (variable) for text and DM Mono (400 and 500) for labels and data. They are installed from the `@fontsource-variable/dm-sans` and `@fontsource/dm-mono` packages, which ship the license, and are bundled and served locally by Vite. Icons come from `lucide-react` (ISC License).

The original line-art whale and raster social preview are generated using `tools/lineart`. They do not contain vendor emoji artwork. Remixing licensed artwork may create attribution or share-alike obligations; a downloaded collage does not grant additional rights to any source artwork.

Exports combine and modify source images. When sharing a collage, credit the source creators, link to their sources and licenses, and indicate that the artwork was modified. The project license does not replace the artwork licenses.

## Underwater game world

The game adapts the procedural world, renderer, shaders, math, quality selection, and synthesized audio from [Noniv/abyssal-garden](https://github.com/Noniv/abyssal-garden), revision `a596354eff400d458bc2aeb9bdf5e0a9734b2bcf`. Copyright 2026 Maksymilian Dendura. The MIT license is retained at `src/game/vendor/abyssal/LICENSE`. All geometry and sound are generated locally; no third-party models, images, or audio recordings are loaded.
