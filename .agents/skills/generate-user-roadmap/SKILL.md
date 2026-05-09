---
name: generate-user-roadmap
description: Generate an updated user-facing roadmap
---

# Generate User-Facing Roadmap Workflow

Use this workflow to translate the project's technical `ROADMAP.md` into a clear, user-facing summary of future features.

1. **Read the Technical Roadmap**
   - Read the contents of `ROADMAP.md` to discover new planned stages and unchecked items.

2. **Filter for End-Users**
   - Extract only the features that impact the daily usage of the globe for an end-user.
   - Ignore backend infrastructure, publisher workflows, and CI/CD tasks unless they directly translate to a user-facing capability.

3. **Format and Structure**
   - Group the extracted features into three sections, in this exact order:
     1. `### Major Features`
     2. `### Minor Features`
     3. `### Recently Implemented` (Keep this at the very bottom of the document).

4. **Apply Target Tone and Formatting**
   - **No Fluff:** Remove marketing buzzwords, corporate language, and overly technical descriptions.
   - **Plugin Formatting:** Format plugins as `[Short Name] Plugin`. Keep the name 2-3 words. If the name isn't clear enough, use `[Short Name] Plugin for [short description]`.
   - **Example Good:** `* Conflict Zones Plugin` or `* GPS Jamming Plugin`
   - **One-Liners:** Keep each feature strictly to a single, concise line. Do NOT use a `Title: Description` format.
   - **Tag New Items:** Prefix completely new features with a `[NEW]` tag (e.g. `* [NEW] AI Copilot`).
   - **Strikethrough Implemented:** Any features that have been completed must be moved to the `### Recently Implemented` section at the bottom and formatted with markdown strikethrough (e.g. `* ~~Conflict Zones Plugin~~`).

5. **Update Context**
   - After generating the new list, update `c:\dev\worldwideview\.agents\context\07-user-facing-roadmap.md` using the `/update-context` skill to ensure persistent knowledge remains accurate.
