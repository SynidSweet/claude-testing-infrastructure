# Planning Documentation - AI Agent Guide

*Quick navigation for AI agents working with planning documents and task management*

*Last updated: 2025-07-01 | File Discovery Service Investigation completed - architecture and implementation plan ready*

## 🎯 Purpose

This guide helps AI agents understand how to work with planning documents, track tasks, and contribute to the project roadmap. Follow these patterns to maintain organized development.

## 📋 Planning Document Structure

### Active Documents
- **REFACTORING_PLAN.md** - Active refactoring tasks with priorities
- **ACTIVE_TASKS.md** - Current sprint/immediate work
- **FUTURE_WORK.md** - Long-term improvements and ideas
- **roadmap.md** - Project vision and milestones

### Investigation Reports
- **file-discovery-investigation-report.md** - Phase 1 analysis results (2025-07-01)
- **file-discovery-architecture-design.md** - Phase 2 architecture specification (2025-07-01)
- **file-discovery-implementation-plan.md** - Phase 3 implementation roadmap (2025-07-01)

### Document Hierarchy
```
planning/
├── REFACTORING_PLAN.md                    # Prioritized improvements
├── ACTIVE_TASKS.md                        # Current work
├── FUTURE_WORK.md                         # Backlog items
├── roadmap.md                             # Strategic direction
├── file-discovery-investigation-report.md # Investigation Phase 1 results
├── file-discovery-architecture-design.md  # Investigation Phase 2 architecture  
├── file-discovery-implementation-plan.md  # Investigation Phase 3 implementation
└── archive/                               # Completed plans
```

## 📝 Working with Tasks

### Task Structure
```markdown
## 📋 Task: [Descriptive Title]

**Status**: Pending | In Progress | Completed | Blocked
**Priority**: 🟢 Low | 🟡 Medium | 🟠 High | 🔴 Critical
**Estimate**: X hours / Y sessions
**Started**: YYYY-MM-DD (when status changes to In Progress)

### Problem Summary
Brief description of the issue or improvement needed.

### Success Criteria
- [ ] Specific, measurable outcome 1
- [ ] Specific, measurable outcome 2
- [ ] All tests passing

### Detailed Implementation Steps
**Phase 1: [Phase Name]** (time estimate)
- [ ] Step 1 with specific details
- [ ] Step 2 with specific details

### Estimated Effort
**Total time**: X-Y hours
**Complexity**: Simple | Moderate | Complex | Epic
**AI Agent suitability**: Good | Requires investigation | Not suitable
```

### Task Lifecycle

1. **Creation**
   - Add to appropriate planning document
   - Set clear success criteria
   - Estimate effort realistically
   - Tag AI agent suitability

2. **Selection** (via carry-on command)
   - Prioritize by: User feedback > Critical > High > Medium > Low
   - Consider dependencies
   - Match to session time
   - Check AI agent suitability

3. **Execution**
   - Update status to "In Progress"
   - Add started timestamp
   - Follow implementation steps
   - Update task notes as needed

4. **Completion**
   - **Delete the entire task** from planning document
   - Git preserves history - no need to keep completed tasks
   - Update related documentation
   - Create follow-up tasks if needed

## 🎯 Task Prioritization

### Priority Levels
- **🔴 Critical** - Blocking issues, broken functionality
- **🟠 High** - Important features, significant improvements
- **🟡 Medium** - Nice-to-have features, refactoring
- **🟢 Low** - Minor improvements, documentation

### Sizing Guidelines
- **Simple (< 2 hours)** - Single file changes, documentation
- **Moderate (3-6 hours)** - Multi-file changes, new features
- **Complex (6-8 hours)** - Architectural changes, investigations
- **Epic (20+ hours)** - Major features requiring breakdown

## 📊 Planning Workflows

### Adding New Tasks

1. **Identify appropriate document**
   - Bug fixes → REFACTORING_PLAN.md
   - Features → FUTURE_WORK.md or ACTIVE_TASKS.md
   - Investigations → Mark as "Investigation Phase"

2. **Create structured task**
   - Use standard template above
   - Include all required fields
   - Be specific in success criteria
   - Break down complex tasks

3. **Set realistic estimates**
   - Consider testing time
   - Include documentation updates
   - Add buffer for unknowns
   - Note session boundaries

### Breaking Down Epics

When a task is too large (> 8 hours):

1. **Add breakdown subtask**
   ```markdown
   ### Detailed Steps
   - [ ] Break down [task name] into subtasks
   ```

2. **Execute breakdown**
   - Analyze requirements
   - Create 3-6 hour subtasks
   - Maintain dependencies
   - Update original task

3. **Create new tasks**
   - Add subtasks to planning doc
   - Link to parent epic
   - Set individual priorities
   - Delete breakdown task

### Managing Dependencies

```markdown
### Dependencies
- **Requires**: [TASK-ID] - Brief description
- **Blocks**: [TASK-ID] - Brief description
- **Related**: [TASK-ID] - Brief description
```

## 🔄 Document Maintenance

### REFACTORING_PLAN.md
- **Purpose**: Track code improvements and debt
- **Update when**: Issues found, refactoring needed
- **Clean up**: Delete completed tasks immediately
- **Review**: Check for stale tasks monthly

### ACTIVE_TASKS.md
- **Purpose**: Current sprint/immediate work
- **Update when**: Starting new development phase
- **Clean up**: Move incomplete to backlog
- **Review**: At sprint boundaries

### FUTURE_WORK.md
- **Purpose**: Ideas and long-term improvements
- **Update when**: New ideas arise
- **Clean up**: Promote to active when ready
- **Review**: Quarterly planning

### roadmap.md
- **Purpose**: Strategic vision and milestones
- **Update when**: Major milestones reached
- **Clean up**: Archive completed phases
- **Review**: After major releases

## 🚨 Important Rules

### Task Deletion Policy
- **Always delete completed tasks** - Git preserves history
- **Never add "COMPLETED" sections** - They clutter documents
- **Remove empty sections** - Keep documents clean
- **No placeholder text** - Empty is better than noise

### Documentation Updates
After completing tasks:
1. Update PROJECT_CONTEXT.md if architecture changed
2. Update feature docs if functionality added
3. Update user docs if UI/commands changed
4. Never create docs unless necessary

### Follow-up Tasks
When discovering new work:
1. Create specific, actionable tasks
2. Link to original task context
3. Set appropriate priority
4. Consider investigation needs

## 🔗 Related Documentation

- **Architecture**: [`/docs/architecture/CLAUDE.md`](../architecture/CLAUDE.md) - System design
- **Development**: [`/docs/development/CLAUDE.md`](../development/CLAUDE.md) - Dev workflow
- **Features**: [`/docs/features/CLAUDE.md`](../features/CLAUDE.md) - Components
- **API**: [`/docs/api/CLAUDE.md`](../api/CLAUDE.md) - Interfaces
- **User Guide**: [`/docs/user/CLAUDE.md`](../user/CLAUDE.md) - Usage

## ⚡ Quick Planning Actions

### Need to add a task?
1. Choose correct planning document
2. Use standard task template
3. Set realistic estimates
4. Tag AI suitability

### Ready to work?
1. Run `/carry-on` command
2. Or manually select from REFACTORING_PLAN.md
3. Update status to "In Progress"
4. Delete when complete

### Found technical debt?
1. Add to REFACTORING_PLAN.md
2. Describe problem clearly
3. Suggest solution approach
4. Estimate effort needed

---

**Planning Philosophy**: Keep tasks specific, documents clean, and always delete completed work to maintain focus.