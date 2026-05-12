---
trigger: always_on
description: Guidelines for ongoing project maintenance, cleanliness, and self-correction during everyday development tasks.
---

# Continuous Improvement & Maintenance

As an AI agent working within the WorldWideView project, you are expected to practice the **Boy Scout Rule**: always leave the codebase (and its context) cleaner than you found it. 

While executing your primary programming tasks, you MUST actively abide by these maintenance protocols:

## 1. Documentation & Rule Parity
- **Self-Correction**: If you notice that an architectural choice you are implementing contradicts an existing rule in `.agents/rules/`, you must halt and update the rule file to reflect the new paradigm.
- **Dead Context**: If you encounter context, plans, or architectural files referencing deprecated concepts (e.g., legacy microservices, `StaticDataPlugin`), proactively prune or update them.

## 2. Codebase Cleanliness
- **Dead Code**: If you refactor a file and leave behind unused functions, imports, or CSS classes, clean them up immediately. Do not leave "commented out" code unless explicitly requested for future use.
- **Console Logs**: Remove debugging `console.log` statements before finalizing a feature, except for structured error logging or critical startup info.
- **Sandbox Hygiene**: Any throwaway scripts or debugging tools placed in `/local-scripts/` should be deleted once the underlying issue is resolved, unless they provide permanent utility.

## 3. Dependency & Typings Checks
- **Type Safety**: Never use `any` or `@ts-ignore` as a shortcut when refactoring. Always build the proper TypeScript interfaces.
- **Manifest Validation**: Whenever you touch a plugin, ensure its `package.json` `"worldwideview"` manifest block is completely accurate and synced with its capabilities.

## 4. The "See Something, Say Something" Rule
If you spot an unrelated but obvious bug, security vulnerability, or architectural anti-pattern in the file you are editing:
1. Fix it if it's a minor, isolated issue (and document the fix in your summary).
2. For larger issues, explicitly call it out to the user so it can be added to the technical debt backlog.
