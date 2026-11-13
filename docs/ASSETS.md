# Whale artwork

All files in `public/whales` depict U+1F433, spouting whale. `manifest.json` lists the source and version for each. The four PNG files were retrieved from [iamcal/emoji-data](https://github.com/iamcal/emoji-data), which documents the original sets and version information. The SVG is from [OpenMoji](https://github.com/hfg-gmuend/openmoji), licensed [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/); credit OpenMoji designers and contributors. Twitter/Twemoji artwork is [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); credit Twitter, Inc. and other contributors. Google Noto Emoji is Apache-2.0. See the upstream projects for full license texts and attribution terms.

Apple artwork is copyright Apple and the source says it is not licensed for commercial use. Facebook artwork is copyright Facebook and its license is unclear. Their inclusion is for the requested visual comparison, not a grant of reuse rights. Review rights before reusing these assets. Neither this project's Apache-2.0 license nor the collection repository's code license supersedes individual image rights.

WhatsApp's image is the original artwork shown by [Emojipedia for WhatsApp 2.23.2.72](https://emojipedia.org/whatsapp/2.23.2.72/spouting-whale), retrieved 2026-11-13 from its [image CDN](https://em-content.zobj.net/source/whatsapp/352/spouting-whale_1f433.png). WhatsApp artwork rights remain with its owner; reuse rights have not been established. No substitute artwork is labeled as another vendor.

## Expanded collection

The gallery contains twenty renderings. Fourteen additions were retrieved on 2026-11-13 by inspecting public vendor-version pages and official artwork repositories. [COLLECTION-SOURCES.json](COLLECTION-SOURCES.json) records each addition's exact source page, original image URL, version or pinned commit, SHA-256 of the unmodified downloaded bytes, code point and rights status. All additions identify U+1F433 Spouting Whale; U+1F40B Whale is excluded. Versions are snapshots, not a claim that every image is the vendor's latest design.

- Microsoft Fluent 3D and Flat come from Microsoft's official Fluent Emoji repository at the recorded commit. They are MIT licensed, copyright Microsoft Corporation; the complete notice is served at `public/whales/licenses/microsoft-fluent.txt`.
- EmojiTwo, Mozilla FxEmoji and Blobmoji come from pinned upstream repository revisions. Their upstream notices are retained in `public/whales/licenses/`. EmojiTwo credit: Emoji artwork is provided by Emojitwo, originally released as Emojione 2.2 by Ranks.com with contributions from the Emojitwo community (CC BY 4.0). FxEmoji visual design is copyright Mozilla Foundation under CC BY 4.0. Blobmoji is Apache-2.0, with credit to Noto Emoji and Blobmoji contributors.
- Samsung One UI 7.0, JoyPixels 7.0 and Skype Emoticons 1.2 are the originals shown on their recorded Emojipedia version pages. Their proprietary artwork is not relicensed by this project; redistribution permission is unestablished.
- Google Noto 3D is the static PNG from Google's official emoji CDN. Its static-image license remains unestablished; a license for animated Google assets is not assumed to cover this separate file.
- Historical specimens are Apple iPhone OS 2.2 (2008), Google Android 6.0.1 (2015), au by KDDI Type F, HTC Sense 7, and LG G5 (2016). Their original dimensions and bytes are retained. The recorded source pages explicitly identify the spouting whale; carrier mapping alone was not used to invent a glyph. No verified SoftBank image was obtained, and DoCoMo's original mapping was a text fallback, so neither was added.

The build checks decode every specimen, reject active or external SVG content, and compare normalized rendered pixels to catch exact visual duplicates. The original six specimen IDs remain unchanged, preserving existing shared recipes.

The primary font is Space Grotesk, copyright 2020 The Space Grotesk Project Authors, under the SIL Open Font License 1.1. Its unmodified Latin variable WOFF2 was retrieved from the official Google Fonts stylesheet on 2026-11-13 and is served locally. The full license is in `public/fonts/OFL-Space-Grotesk.txt`. Mono labels use the system monospace font.

The original line-art whale and raster social preview are generated using `tools/lineart`. They do not contain vendor emoji artwork. Remixing licensed artwork may create attribution or share-alike obligations; a downloaded collage does not grant additional rights to any source artwork.

Exports combine and modify source images. When sharing a collage, credit the source creators, link to their sources and licenses, and indicate that the artwork was modified. The project license does not replace the artwork licenses.
