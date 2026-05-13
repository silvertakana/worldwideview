---
name: typescript-docs
description: Use when writing new TypeScript code or refactoring existing code to ensure strict TSDoc/JSDoc hygiene is applied to all methods and interfaces.
---

# Strict TypeScript Documentation

## When to use this skill
Trigger this skill automatically whenever you are creating a new function, class, or interface, OR when you are modifying an existing undocumented function. This is the "Nutrition Label" rule.

## Guidelines
1. **JSDoc/TSDoc format is mandatory**. Always use `/** ... */` above the definition.
2. The block MUST include a short, plain-English description of *what* the function does and *why* it exists.
3. MUST explicitly list all parameters using `@param name - Description`.
4. MUST explicitly define the return value using `@returns Description`.
5. If the function intentionally throws an error, use `@throws {ErrorType} Description`.

## Example
```ts
/**
 * Resolves the appropriate WebSocket engine URL for a given plugin.
 * Prioritizes the local engine during development before falling back to cloud.
 * 
 * @param pluginId - The unique string identifier of the plugin.
 * @returns The fully qualified WebSocket URL for the stream.
 * @throws {Error} If the plugin ID is undefined or missing.
 */
export function resolveEngineUrl(pluginId: string): string { ... }
```

## Actionable Steps
Never consider a PR or code edit "done" unless the new or modified functions have these strict labels attached. If you spot an undocumented function nearby while working, clean it up!
