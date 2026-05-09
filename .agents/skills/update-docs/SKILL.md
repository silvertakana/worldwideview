---
name: update-docs
description: Use when generating or updating LLM-optimized documentation with concrete file references across project overview, architecture, build, testing, development, deployment, and file catalog docs.
---

# Update Documentation

You will generate LLM-optimized documentation with concrete file references and flexible formatting.

## Your Task

Create documentation that allows humans and LLMs to:
- **Understand project purpose** - what the project does and why
- **Get architecture overview** - how the system is organized
- **Build on all platforms** - build instructions with file references
- **Add features/subsystems** - following established patterns with examples
- **Debug applications** - troubleshoot issues with specific file locations
- **Test and add tests** - run existing tests and create new ones
- **Deploy and distribute** - package and deploy the software

## Required Documentation Structure

Each document MUST include:
1. **Timestamp Header** - Hidden comment with last update timestamp
2. **Brief Overview** (2-3 paragraphs max) 
3. **Key Files & Examples** - Concrete file references for each major topic
4. **Common Workflows** - Practical guidance with file locations
5. **Reference Information** - Quick lookup tables with file paths

## Timestamp Format

Each generated file MUST start with:
```
<!-- Generated: YYYY-MM-DD HH:MM:SS UTC -->
```

## Process

You will:
1. **Analyze the codebase systematically** across 7 key areas (merging development+patterns)
2. **Create or update docs** in `docs/*.md` with concrete file references
3. **Synthesize final documentation** into a minimal, LLM-friendly README.md
4. **Eliminate all duplication** across files

## Analysis Methodology

For each area, agents should:
1. **Examine key files**: Look for build configs, test files, deployment scripts, main source files
2. **Extract file references**: Note specific files, line numbers, and examples
3. **Identify patterns**: Find repeated structures, naming conventions, common workflows
4. **Make content LLM-friendly**: Token-efficient, reference-heavy, practical examples

## Specific File Requirements

Issue the following Task calls in parallel:

**Project Overview** (`docs/project-overview.md`):
STRUCTURE:
- Overview: What the project is, core purpose, key value proposition (2-3 paragraphs)
- Key Files: Main entry points and core configuration files
- Technology Stack: Core technologies with specific file examples
- Platform Support: Requirements with platform-specific file locations

**Architecture** (`docs/architecture.md`):
STRUCTURE:
- Overview: High-level system organization (2-3 paragraphs)
- Component Map: Major components with their source file locations
- Key Files: Core headers and implementations with brief descriptions
- Data Flow: How information flows with specific function/file references

**Build System** (`docs/build-system.md`):
STRUCTURE:
- Overview: Build system with file references to main build configuration
- Build Workflows: Common tasks with specific commands and config files
- Platform Setup: Platform-specific requirements with file paths
- Reference: Build targets, presets, and troubleshooting with file locations

**Testing** (`docs/testing.md`):
STRUCTURE:
- Overview: Testing approach with test file locations
- Test Types: Different test categories with specific file examples
- Running Tests: Commands with file paths and expected outputs
- Reference: Test file organization and build system test targets

**Development** (`docs/development.md`):
STRUCTURE:
- Overview: Development environment, code style, patterns (merge with old patterns.md if exists)
- Code Style: Conventions with specific file examples (show actual code from codebase)
- Common Patterns: Implementation patterns with file references and examples from the codebase
- Workflows: Development tasks with concrete file locations and examples
- Reference: File organization, naming conventions, common issues with specific files

**Deployment** (`docs/deployment.md`):
STRUCTURE:
- Overview: Packaging and distribution with script references
- Package Types: Different packages with build targets and output locations
- Platform Deployment: Platform-specific packaging with file paths
- Reference: Deployment scripts, output locations, server configurations

**Files Catalog** (`docs/files.md`):
STRUCTURE:
- Overview: Comprehensive file catalog with descriptions and relationships (2-3 paragraphs)
- Core Source Files: Main application logic with purpose descriptions
- Platform Implementation: Platform-specific code with interface mappings
- Build System: Build configuration and helper modules
- Configuration: Assets, scripts, configs - Supporting files and their roles
- Reference: File organization patterns, naming conventions, dependency relationships

## Critical Requirements

### LLM-OPTIMIZED FORMAT
- **Token efficient**: Avoid redundant explanations, focus on essential information
- **Concrete file references**: Always include specific file paths, line numbers when helpful
- **Flexible formatting**: Use subsections, code blocks, examples instead of rigid step-by-step
- **Pattern examples**: Show actual code from the codebase, not generic examples

### NO DUPLICATION  
- Each piece of information appears in EXACTLY ONE file
- Build information only in build-system.md
- Code style and patterns only in development.md
- Deployment information only in deployment.md
- Cross-references using: "See [docs/filename.md](docs/filename.md)"

### FILE REFERENCE FORMAT
Always include specific file references:
```
**Core System** - Core implementation in src/core.h (lines 15-45), platform backends in src/platform/

**Build Configuration** - Main build file (lines 67-89), configuration files

**Module Management** - Interface in src/module.h, implementation in src/module.c (key_function at line 134)
```

### PRACTICAL EXAMPLES
Use actual code from the codebase:
```c
// From src/example.h:23-27
typedef struct {
    bool active;
    void *data;
    int count;
} ExampleState;
```

## Final Steps

After all tasks complete:

1. **Read all `docs/*.md` files** and create README.md with:
   - Project description (2-3 sentences max)
   - Key entry points and core configuration files
   - Quick build commands
   - Documentation links with brief descriptions of what LLMs will find useful
   - Keep it under 50 lines total

2. **Duplication check**: Scan all files and remove any duplicated information

3. **File reference check**: Ensure all file paths are accurate and helpful

## Agent Instructions

Each agent must:
1. **Read existing file** if it exists to understand current content
2. **Analyze relevant codebase files** systematically
3. **Extract specific file references** throughout analysis
4. **Create LLM-friendly content**: Token-efficient, concrete file paths, flexible formatting
5. **Include practical workflows** with specific file references
6. **Create reference sections** with file locations and line numbers
7. **Update timestamp** at the top with current UTC time
8. **Read generated file** and revise for accuracy and completeness

**Success criteria**: Each file should be a practical reference that helps LLMs quickly understand the codebase and find the right files for specific tasks.
