---
name: recall-context
description: >
  Invoke when the user asks to "check history", "recall context", "what did we work on",
  "load prior context", "what's the background on X", "remind me where we left off", or any
  similar request to surface prior session work. Also invoke proactively at the start of a
  session continuation when the user references past work that isn't fully described in the
  current conversation. Uses observation history, context-mode index, and memory files to
  reconstruct relevant prior state.
---

# Recall Context

Reconstruct what happened in prior sessions so you can continue intelligently.

Use all three layers in order — each covers different ground.

---

## Layer 1: Session timeline (already in context)

The `<system-reminder>` injected at conversation start contains a pre-rendered timeline of
recent observations. Scan it now for entries relevant to the current topic and note their IDs.
This is free — no tool call needed.

---

## Layer 2: Observation store (semantic history)

Fetch detailed records for anything relevant. Use the IDs spotted in Layer 1, plus a semantic
search to catch things the timeline summary might have omitted.

**Semantic search** (cast wide first):
```
mcp__mcp-search__observation_search(query: "<topic>", limit: 10)
```

**Fetch by ID** (for specific timeline entries):
```
mcp__mcp-search__get_observations(ids: [ID1, ID2, ...])
```

Run both if you have IDs. Use 2-3 different query phrasings if the topic is broad.

---

## Layer 3: Context-mode index (indexed session content)

Search the context-mode knowledge base for anything that was indexed during prior sessions
(code excerpts, command output, research, etc.):

```
mcp__plugin_context-mode_context-mode__ctx_search(
  queries: ["<angle 1>", "<angle 2>", "<angle 3>"]
)
```

Use 3-5 queries covering different aspects of the topic. For example, if the topic is
"StreamProxy fix", try queries like "streamProxy HTTP SSRF", "safeFetch protocol", and
"camera proxy endpoint".

---

## Layer 4: Persistent memory files

Read `C:\Users\silve\.claude\projects\C--dev-wwv\memory\MEMORY.md` for the index, then read
any files whose one-line description is relevant to the topic. Memory files capture user
preferences, project decisions, and recurring feedback that spans sessions.

---

## Synthesize and report

After gathering, present a focused summary:

| Section | Content |
|---|---|
| **Prior work** | What sessions touched this area and what was done |
| **Current state** | What's complete, what's in progress, what's pending |
| **Key decisions** | Architectural choices, root causes identified, patterns established |
| **Known blockers** | Any flags, gotchas, or unresolved issues noted |

Keep it tight. The goal is a mental model to continue from, not an exhaustive replay.
If nothing relevant is found across all three layers, say so explicitly so the user knows
the search was complete.
