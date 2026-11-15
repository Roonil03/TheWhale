# Design decisions

The Whale is an unofficial specimen collection and a playful image collage tool. Ocean ink, deep-blue surfaces, ice text, cyan and a small acid-yellow accent give the default dark gallery a marine field-guide character. An explicit light-mode option uses ice white, navy and cobalt. The selected mode persists locally and is applied before the first paint, with dark as the default even on a light operating system. Type is limited to two families: DM Sans for headings and text, and DM Mono for small labels, counts and numeric inputs. All icons are Lucide.

## Animation reel review

One style is used: **water ripples**, behind the hero whale. They connect directly to the subject and make a small, quiet focal point without obscuring the content. Three CSS outlines animate only transform and opacity. Reduced-motion preferences stop the animation and leave one static outline.

The other nineteen styles were considered and omitted:

- Ink in water: organic, but visually dense beside small specimen artwork.
- Matrix rain: unrelated to the ocean subject and hard to keep quiet.
- Chrome metal: a material treatment would compete with vendor rendering differences.
- Wireframe terrain: terrain implies a landscape rather than a whale collection.
- Stained glass: strong fragmentation would obscure the emoji silhouettes.
- Birds flocking: moving fauna would draw attention away from the whale.
- Aurora gradient: introduces a colour language the specimen palette does not need.
- Low-poly 3D: an additional rendering style would distract from authentic specimens.
- Origami fold: another strong material metaphor without a content reason.
- Voronoi cells: background geometry would compete with the field-guide grid.
- Kaleidoscope: repetition would obscure the exact vendor differences.
- Spirograph: elaborate line work would compete with the specimens.
- Fireworks: too energetic for close visual comparison.
- Smoke simulation: diffuse motion reduces contrast and adds rendering work.
- Isometric city: an unrelated scene and unnecessary visual complexity.
- Reaction diffusion: continuous simulation has no role in the mixer interaction.
- Slime mold: continuous simulation would add complexity without a product benefit.
- Starfield warp: rapid depth movement conflicts with the quiet gallery.
- Infinite tunnel: perpetual depth motion would dominate the page.

The static whale blueprint is generated with fogleman/ln. It is an illustration, not another animation style. The mixer changes only when the visitor interacts.

## Production choices

React and Vite provide a static build. Vite minifies production CSS and JavaScript; there is no additional minifier or animation runtime. Both fonts are bundled and served locally. Vendor images retain transparency. Originals are never recompressed. Vector sources are used where the documented version publishes them. The gallery grid loads WebP display copies of the four large non-animated rasters (see `docs/ASSETS.md`), and the lab loads the originals. Meaningful images have alternative text, and the blueprint is lazy loaded.

The collection is bundled at build time from `public/whales/manifest.json`, so specimens render without a runtime request. There are no third-party API requests, analytics, accounts or uploads. The lab is a separate chunk that `lab.html` preloads; the home page never loads it. The lab canvas renders and exports at 1200 × 1200. Hashed JS/CSS filenames provide cache invalidation; GitHub Pages sets the actual HTTP caching policy.

The single-page structure uses section links rather than artificial breadcrumbs. Metadata includes a canonical URL, title, description, raster social preview and an Organization publisher within WebSite structured data. Source and licensing details are available in the page and in `ASSETS.md`.
