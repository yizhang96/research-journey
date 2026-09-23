# Public genealogy data schema

`src/data/genealogy.json` is the sole content source used by the public interface. It is intentionally independent of the private analytical archive.

## Top-level fields

| Field | Type | Purpose |
| --- | --- | --- |
| `meta` | object | Public title, description, date range, and update date |
| `threads` | array | Ordered research currents and their display colors |
| `nodes` | array | Public intellectual events |
| `edges` | array | Directed developmental relationships |

## Thread

```json
{
  "id": "empathy",
  "label": "Empathy & social value",
  "shortLabel": "Empathy",
  "color": "#66d7ff",
  "order": 0
}
```

Thread IDs are stable keys. Colors must be valid CSS colors with sufficient contrast on the light map background.

## Node

Required fields:

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | Stable, unique identifier |
| `title` | string | Concise public label |
| `thread` | string | Must match a thread ID |
| `date` | `YYYY-MM-DD` | First public appearance on the timeline |
| `kind` | enum | `question`, `attempt`, `reframing`, `pivot`, `setback`, `revival`, `integration`, `publication`, or `event` |
| `status` | string | Current lifecycle state, such as `active`, `persistent`, `dormant`, `completed`, or `published` |
| `summary` | string | Standalone public description without source evidence |

Optional fields:

| Field | Type | Notes |
| --- | --- | --- |
| `endDate` | `YYYY-MM-DD` | End of the event’s active interval, if meaningful |
| `question` | string | Public-facing guiding question |
| `significance` | string | Why the event changed later work |
| `url` | URL string | Paper or project link; shown only when present |
| `landmark` | boolean | Marks a publication or major output for categorical visual emphasis |
| `afterlifeSummary` | string | Public account of what inherited from a redirected or dormant idea |

## Edge

```json
{
  "source": "E10",
  "target": "E11",
  "relation": "constrained",
  "label": "was bounded by",
  "date": "2024-11-12"
}
```

`source` and `target` must reference public node IDs. The direction represents intellectual development, not causal proof. `relation` is a stable machine-readable value; `label` is the concise public phrase shown in the detail panel.

The optional `overview` boolean marks a curated backbone relation that can remain visible in the default overview. Trace modes may reveal any edge, regardless of this flag.

## Fields that must never appear

The validator rejects source-evidence fields such as `evidence`, `evidence_dates`, `opening_snippet`, `milestone_tags_auto`, line ranges, confidence coding, and meeting word counts. Do not add names, quotations, private discussions, unpublished numerical results, or source-derived snippets under alternate field names.
