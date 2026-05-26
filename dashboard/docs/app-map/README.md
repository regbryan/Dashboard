# App Map Template

Interactive clickable component map. Required Phase 1 deliverable in `/app-review`.

## What this is

A ComfyUI-style node graph viewer (LiteGraph engine) where every node is a
component of your app and clicking it opens a plain-English side panel
explaining what it does, who owns it, and what breaks when it's down.

## Setup in a new project

```bash
# From the root of the target project:
mkdir -p docs/app-map/components
cp ~/.claude/templates/app-map/index.html docs/app-map/index.html
cp ~/.claude/templates/app-map/components/_example.md docs/app-map/components/
```

Open `docs/app-map/index.html` in a browser. Edit the `docs = { ... }` object
inline to define your components.

## Data model

Each component is keyed by an `id` and has:

```js
{
  id: {
    title:   "Display name",
    role:    "One-line role description",
    owner:   "Team / person",
    color:   "#hex",            // accent color for outline + status dot
    inputs:  ["pin-name", ...], // semantic pin names, drawn on left
    outputs: ["pin-name", ...], // semantic pin names, drawn on right
    summary: "Plain-English paragraph explaining the component.",
    breaks:  [
      "Failure mode 1 → user-visible symptom",
      "Failure mode 2 → user-visible symptom"
    ]
  }
}
```

Connections are made by pin name via the `wire()` helper:

```js
wire(N.api, "query", N.db, "query");
```

## Wire to error tracking

Tag every error tracker event (Sentry, Datadog, Rollbar) with the matching
component id:

```ts
Sentry.setContext("app-map", { component: "auth" });
```

Then when an alert fires, the dashboard link can be `docs/app-map/?focus=auth`
and the viewer opens with that node selected — clicking the broken part
becomes literal.

## Acceptance test

A non-engineering stakeholder (PM, client, ops) opens the file, clicks a node,
and can explain in their own words what that component does. If they can't,
the `summary` copy isn't plain-English enough — rewrite it.
