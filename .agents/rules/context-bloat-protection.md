---
description: Mandatory tool selection guardrails to prevent context bloat from raw log files, unknown-size output, and direct reads of large files.
paths:
  - "*.txt"
  - "*.log"
  - "*.out"
  - "*.dump"
---

# Context Bloat Protection

## BANNED Operations

These patterns are strictly prohibited. Zero exceptions.

| Instead of... | You MUST use... |
|---|---|
| `read` on any `.txt`, `.log`, `.out`, or `.dump` file | `ctx_execute_file` with a summary script — raw bytes stay in sandbox |
| `bash` piping log output (e.g. `docker logs`, `tail`, `cat`) | `ctx_execute` with a size-gate and summary |
| `bash` with unknown output size (curl, build, test, npx, gh CLI) | `ctx_execute` wrapped with `if (out.length > 2000) { summarize }` |
| `webfetch` for web research | `searxng_search` -> `ctx_fetch_and_index` -> `ctx_search` chain |
| `grep` + `read` to understand architecture | `graphify query` first, then `cymbal search`, then `grep` |
| `Get-ChildItem -Recurse` for file search | `es.exe` (Everything Search) |

## Why

Every byte entering conversation context costs reasoning capacity. A 100-line log file read via `read` burns ~17KB of context. Processing it through `ctx_execute_file` and printing a 3-line summary burns <1KB. Over the course of a session, these differences compound into retaining vs losing the ability to complete complex tasks.

## Decision Tree

Before ANY tool call, ask:

```
Is the target a log/out/txt/dump file?
  YES -> ctx_execute_file with summary script. STOP.
  NO  -> Is the output size unknown or potentially >200 lines?
          YES -> ctx_execute with size gate. STOP.
          NO  -> Is it a code file under 500 lines?
                  YES -> read is fine.
                  NO  -> read with offset/limit, or ctx_execute_file.
```

## Enforcement

This rule is loaded automatically when you access any `.txt` or `.log` file. If you see this rule, you were about to violate context bloat protection. Route through `ctx_execute_file` instead.
