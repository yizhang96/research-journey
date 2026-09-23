# The Life of Research Ideas

An interactive map of how research questions became studies, encountered setbacks, changed direction, and led to published work between 2020 and 2026.

[View the live project](https://life-of-research-ideas.vercel.app)

![The Life of Research Ideas](public/og.png)

The map preserves chronology from left to right. Colored paths show how research areas developed, while pivots, setbacks, revivals, and publications receive distinct visual treatment. Selecting an event reveals what led to it or what came next.

## Run locally

The site uses browser-native JavaScript and SVG and has no runtime dependencies.

```bash
npm run dev
```

Then open `http://127.0.0.1:4173/`.

Before publishing a change:

```bash
npm run lint
npm run build
```

The static site is generated in `dist/`.

## Project structure

```text
index.html                 Page shell and social metadata
src/main.js                Visualization and interaction logic
src/styles.css             Layout and visual system
src/data/genealogy.json    Curated public dataset
src/data/schema.json       Public data contract
scripts/                   Validation, development, and build tools
docs/                      Public schema and privacy documentation
public/                    Public static assets
```

The interface is data-driven. New research areas, events, relationships, and publication links can be added in `src/data/genealogy.json` without rewriting the visualization. See the [public data schema](docs/public-data-schema.md).

## Privacy

This repository contains only curated public content. Raw notes, meeting exports, quotations, source snippets, collaborator or advisor names, private discussions, and unpublished numerical findings are excluded from Git and from the deployed bundle. The build validates this boundary before producing `dist/`; see [the privacy documentation](docs/privacy.md).

## Deployment

The project is deployed as a static site on Vercel. [`vercel.json`](vercel.json) runs the build and publishes only `dist/`. [`.vercelignore`](.vercelignore) provides an additional upload boundary for local source material.

## License

Code is available under the [MIT License](LICENSE). Curated research content remains © 2026 Yi Zhang.
