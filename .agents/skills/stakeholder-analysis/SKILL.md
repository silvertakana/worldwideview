---
name: stakeholder-analysis
description: Use when designing systems, creating features, or making architectural decisions to ensure all WorldWideView stakeholders' needs and constraints are properly considered.
---

# Stakeholder Analysis & Considerations

## Overview
Every architectural change, new feature, and design decision in WorldWideView affects multiple stakeholders. Before finalizing a design or starting an implementation, you MUST evaluate the impact against this list of stakeholders to ensure their specific needs, preferences, and constraints are respected.

## System Responsibilities & The Stakeholder Relationship
The design of the architecture directly relates to how the stakeholders are needed and what they need. System responsibilities are detailed in this file because the strict decoupling of the architecture guarantees a level playing field across all stakeholder roles:

* **Data Engine**: Must operate as an independent server that complements the plugin. The data from the Data Engine is streamed directly into the plugins and used to display on the map. It can be created by anyone and hosted on their own infrastructure, remaining entirely unrelated to the Platform—acting much like a developer's proprietary API that feeds their plugins. It should not receive any preferential treatment, and should not even be explicitly acknowledged by the platform.
* **The Platform**: Maintained strictly by the **Internal Developers** and the **Owner**. It must remain completely agnostic to which plugins are installed and must never give any plugins preferential treatment.
* **Plugins**: Must be purely "plug-and-play". The plugins themselves contain the path and instructions on how to connect to their respective Data Engine and process the streamed data. The platform must be able to support any type of plugin developed by anyone—the original creator, the owner, an internal developer, or an external developer. It does not matter who created the plugin or whether or not they actually have access to the platform's internal codebase.

Because of these architectural rules, an *External Developer* has the exact same integration power and constraints as an *Internal Developer*.

## Stakeholders

### 1. Internal Developer
* **Role**: Core team maintainers who manage the central engine, data engine, and core plugin codebase.
* **Access**: Push access straight to `main`.
* **Focus**: Large architectural changes, bug fixes across the entire stack (frontend, backend, data engine).
* **Needs/Preferences**: Requires clean abstractions, maintainable code, and the ability to rapidly iterate on complex core systems without breaking downstream consumers.

### 2. External Developer (Contributor)
* **Role**: Community or third-party developers contributing to the ecosystem.
* **Access**: Pull Request (PR) access only. Never pushes directly to `main`.
* **Focus**: Bug fixes and introducing small new features or plugins.
* **Needs/Preferences**: Requires clear documentation, strict templates, and strong CI/CD guardrails. The system must prevent them from accidentally breaking the core engine during PR integration.

### 3. Plugin Developer (Simple)
* **Role**: Users who want to quickly visualize static datasets or basic feeds with minimal effort.
* **Focus**: Moving from an idea to a working plugin development instantly.
* **Needs/Preferences**: Demands an absolutely frictionless, straightforward process. They want simple CLI tools (scaffolds), easy ways to host/upload data, and zero structural complexity. The barrier to entry must be as low as possible.

### 4. Plugin Developer (Advanced)
* **Role**: Power users or organizations building complex integrations.
* **Focus**: Managing their own backend servers/data pipelines, and piping real-time data directly into WWV.
* **Needs/Preferences**: Requires high extensibility and deep access. They need the ability to manipulate the WWV frontend directly, inject custom layers, interact with the raw CesiumJS instance, and hook into the React state to build highly customized experiences.

### 5. The User
Users are fragmented into sub-personas based on their engagement level and goals. Designs must cater to these overlapping but distinct segments:

#### Engagement Types:
* **Casual Users (Demo)**: Just trying out the public demo. They expect an immediate visual "wow factor", zero setup, and intuitive navigation.
* **Cloud Subscribers**: Paying customers with their own hosted WWV instance. They expect stability, secure management, and the ability to install and orchestrate their own custom ecosystem of plugins.

#### Operational Goals:
* **OSINT Researchers**: Need deep filtering, real-time alerting, historical timelines, high data accuracy, and spatial intelligence tools.
* **Data Analysts**: Require data density, aggregation, performance with massive datasets, and relational insights.
* **Journalists**: Prioritize narrative building, visual clarity for audiences, verifiable sourcing, and ease of capturing aesthetics (screenshots/video).

### 6. Data Provider
* **Role**: The source or distributor of the raw intelligence data.
* **Types**: Third-party APIs (e.g., OpenSky), official partner organizations, or copyright holders.
* **Needs/Preferences**: 
    * Strict adherence to API rate limits, backoffs, and fair use.
    * Guaranteed data security and proper visual attribution on the globe.
    * Compliance with their Terms of Service (ToS) and usage tracking.

### 7. The Owner
* **Role**: The product owner / business leader of WorldWideView.
* **Needs/Preferences**: Cares deeply about a holistic balance. Every decision must weigh:
    * System stability, scalability, and minimizing long-term maintenance costs.
    * Rapid feature delivery and flexibility (moving fast).
    * Ecosystem growth, monetization, and attracting more plugin developers and users.
    * Maintaining a premium "wow factor" and elite visual aesthetic across all components.

### 8. Locally Hosted Developer/User
* **Role**: A user or hobbyist developer running their own independent instance of WWV locally (bypassing the official managed cloud instances).
* **Focus**: Maintaining full control, data privacy, and self-sovereignty over their intelligence environment while still accessing the community plugin registry.
* **Needs/Preferences**: 
    * Needs an extremely straightforward, lightweight setup process (e.g., pre-compiled, Dockerized releases rather than building raw source code).
    * Requires the infrastructure to seamlessly support direct CORS/WebSocket connections to external plugin servers without proxying through WWV official servers.
    * Wants the instance stripped of unnecessary development cruft (like hot-reloading tooling), but formatted in a way where they can still easily inspect the application logic if they wish to modify it.

## How to Use This Skill
When tasked with system design, architectural planning, or complex feature implementation:
1. Review this list and identify which stakeholders will be affected by your proposed changes.
2. Explicitly detail how your design mitigates friction for the Simple Plugin Developer, protects the External Developer from breaking the platform, and satisfies the Owner's multi-faceted priorities.
3. Validate that your approach doesn't compromise the Advanced Plugin Developer's need for deep control or the Data Provider's strict ToS requirements.
