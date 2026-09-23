# Privacy audit and publishing boundary

Audit date: 2026-09-23

## Source material found locally

- A raw RTFD meeting-notes archive with embedded screenshots
- A supplemental Markdown meeting-notes archive with an embedded image and exported database tables
- A meeting-level index containing source-derived opening snippets and line references
- Hand-coded node and edge tables with evidence dates and interpretive rationales
- An analysis report containing private contextual discussion
- Legacy static and interactive outputs that embed some of those fields

These materials remain useful for private scholarship, but they are not deployment inputs.

## Public curation decisions

- Removed all meeting-level snippets, evidence dates, line references, quotations, confidence fields, and evidence rationales.
- Excluded collaborator/advisor names and private career-planning material.
- Rephrased nodes that summarized unpublished result patterns so they describe the intellectual turn without revealing numerical or directional findings.
- Retained only standalone descriptions of questions, designs, conceptual changes, setbacks, integrations, and publications.
- Made publication/project URLs optional. No link is rendered unless the public dataset supplies one.
- Added a public social-preview card at `public/og.png` and configured its production Open Graph and Twitter metadata.

## Enforcement

- `.gitignore` excludes the raw archive, internal editorial audit, and complete source-derived analytical workflow from version control.
- `.vercelignore` independently prevents those local-only sources and artifacts from being uploaded during CLI deployments.
- `scripts/build.mjs` copies only the page shell, application source, curated public data, schema, and explicitly public assets.
- `scripts/validate-public-data.mjs` rejects known source-only fields and broken graph references before every build.
- `npm run build` never executes the private curation helper and can run from a clean public checkout.

## Maintainer rule

Treat the repository root and `deliverables/` as a working environment, not as a deployable directory. Publish only `dist/`. Review all regenerated public data before committing it.
