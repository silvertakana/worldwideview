---
name: update-context
description: Update context document
---

# Update Context

1. Purpose
This specification defines the requirements for maintaining persistent, accurate project context across chat instances by synchronizing internal documentation with local context artifacts.

2. Requirements
2.1 Internal Documentation
The agent MUST maintain an internal, continuously updated documentation set describing the project.

This documentation MUST include:

Project goals and vision

Architecture and major components

Active features, experiments, and branches

Constraints, assumptions, and open questions

Key decisions and their rationale

The internal documentation MUST serve as the single source of truth for project context.

2.2 Synchronization With Local Context Artifacts
The agent MUST regularly review the contents of:

C:\dev\worldwideview\.agents\context

When performing any task, the agent SHOULD check this folder for:

Relevant guidance

Conflicts or discrepancies

When referencing any file from this folder, the agent MUST include the file path in its notes or summaries to ensure easy retrieval.

If discrepancies are found, the agent MUST update the internal documentation to reflect the most accurate state.

2.3 Reflecting New Changes
When new information, decisions, or changes occur:

The agent MUST determine whether the change is represented in internal documentation and context artifacts.

If not, the agent MUST update the documentation accordingly.

Documentation SHOULD remain:

Comprehensive

Current

Unambiguous

3. Goal
A new chat instance MUST be able to reconstruct an accurate understanding of the project solely from:

The agent's internal documentation

The contents of C:\dev\worldwideview\.agents\context

This ensures continuity, accuracy, and long‑term coherence across sessions.
