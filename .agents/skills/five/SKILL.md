---
name: five
description: Use the "Five Whys" root cause analysis technique to deeply understand problems.
---

# Five Whys Analysis

Use the "Five Whys" root cause analysis technique to deeply understand problems.

## Process:

### 1. Define the Problem
Clearly state the issue or symptom

### 2. Ask "Why?" Five Times
- Why did this problem occur? → Answer 1
- Why did Answer 1 happen? → Answer 2  
- Why did Answer 2 happen? → Answer 3
- Why did Answer 3 happen? → Answer 4
- Why did Answer 4 happen? → Answer 5 (Root Cause)

### 3. Validate Root Cause
- Verify the logical chain
- Check if addressing root cause prevents recurrence
- Consider multiple root causes if applicable

### 4. Develop Solutions
- Address the root cause, not just symptoms
- Create preventive measures
- Consider systemic improvements

## Example:
**Problem**: Application crashes when processing large files

1. **Why?** → The application runs out of memory
2. **Why?** → It loads entire file into memory at once
3. **Why?** → The file parser wasn't designed for streaming
4. **Why?** → Initial requirements only specified small files
5. **Why?** → Requirements gathering didn't consider future growth

**Root Cause**: Incomplete requirements gathering process
**Solution**: Implement streaming parser and improve requirements process

## Best Practices:
- Focus on process, not people
- Look for systemic issues
- Document the analysis
- Involve relevant stakeholders
- Test solutions address root cause
