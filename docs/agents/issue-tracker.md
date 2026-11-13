# Issue tracker: Local Markdown

Issues and specs live in `.scratch/`.

## Conventions

- One feature per directory: `.scratch/<feature-slug>/`.
- Specs: `.scratch/<feature-slug>/spec.md`.
- Implementation tickets: `.scratch/<feature-slug>/issues/<NN>-<slug>.md`,
  numbered from 01, with one file per ticket.
- Record triage state in a `Status:` line near the top, using
  `triage-labels.md`.
- Append discussion under `## Comments`.

Publishing means creating the appropriate local file. Fetching a ticket
means reading its referenced file.

## Wayfinding operations

- Map: `.scratch/<effort>/map.md`, containing Notes, Decisions-so-far, and Fog.
- Child tickets: `.scratch/<effort>/issues/NN-<slug>.md`.
- Record ticket type in `Type:`: research, prototype, grilling, or task.
- Record dependencies in `Blocked by: NN, NN`.
- Select open, unblocked, unclaimed tickets in numerical order.
- Before working, set `Status: claimed`.
- On completion, append `## Answer`, set `Status: resolved`, and add a
  summary and ticket link to the map's Decisions-so-far.
- Wayfinding lifecycle states are separate from the triage vocabulary.
