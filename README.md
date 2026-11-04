# Invisible Histories

An interactive map of seven New York City landmarks designated by the Landmarks Preservation Commission.
Static HTML/CSS/vanilla JS + Mapbox GL JS — no build step. Deployed with GitHub Pages.

- `index.html` – app shell (start page, map, landmark pages, info page)
- `js/app.js` – routing (`#map`, `#map/<id>`, `#<id>`, `#info`), map, transitions, carousels, captions
- `js/config.js` – public Mapbox token + style (restrict the token to this site's URL in your Mapbox account)
- `data/landmarks.json` – source of truth: coordinates, LPC designation data, photo captions/credits
- `pages/*.html` + `css/figma.css` – landmark/info pages rendered from the Figma "Midterm" file
- `img/` – optimized images (WebP/SVG)

Landmark IDs: `aakawaxung`, `croton`, `street-plan`, `dry-dock`, `opera-house`, `friends`, `bowery-mission`.
