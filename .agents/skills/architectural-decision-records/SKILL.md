---
name: architectural-decision-records
description: Use when making significant architectural decisions, adding new patterns, or altering core workflows. This skill ensures that all major technical choices are documented via ADRs.
---

# Architectural Decision Records (ADRs)

## When to use this skill
Trigger this skill whenever you are about to introduce a new architectural pattern, make a load-bearing contract change, or bypass an established standard for a necessary reason.

## Guidelines
1. **Never make a major architectural change without an ADR**.
2. Store ADRs in `docs/architecture/decisions/` (create this directory if it doesn't exist).
3. An ADR must follow this exact structure:
   - **Title**: Short, descriptive noun phrase.
   - **Context**: What is the problem we are solving? What forces are at play? (Be objective).
   - **Decision**: What is the specific change or pattern we are adopting?
   - **Consequences**: What becomes easier because of this change? What becomes harder? (There are always trade-offs).

## Actionable Steps
When tasked with a major architecture change, pause and explicitly state: *"This requires an Architectural Decision Record."* Draft the ADR and ask the user to approve the reasoning *before* writing the implementation code.
