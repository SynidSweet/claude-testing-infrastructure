# Configuration System Implementation Tasks

*Generated from investigation report - 2025-07-01 | Updated 2025-07-01 with Phase 2 completion*

## Phase 1: Core ConfigurationService (4-6 hours) ✅ COMPLETE

### TASK-CONFIG-001: Create ConfigurationService Base ✅
**Priority**: High  
**Estimate**: 2 hours  
**Dependencies**: None  
**Status**: COMPLETE  

**Success Criteria**:
- [x] Create `src/config/ConfigurationService.ts`
- [x] Define interfaces (ConfigurationSource, ConfigurationServiceOptions)
- [x] Implement constructor and basic structure
- [x] Add source management (addSource, getSources)
- [x] Unit tests for basic functionality

### TASK-CONFIG-002: Implement Configuration Loading ✅
**Priority**: High  
**Estimate**: 2 hours  
**Dependencies**: TASK-CONFIG-001  
**Status**: COMPLETE  

**Success Criteria**:
- [x] Implement loadConfiguration() method
- [x] Add project config loading with existing ConfigurationManager
- [x] Add custom config file loading
- [x] Implement merging logic
- [x] Add validation after merge
- [x] Unit tests for loading scenarios

### TASK-CONFIG-003: Add Discovery Algorithms ✅
**Priority**: High  
**Estimate**: 2 hours  
**Dependencies**: TASK-CONFIG-001  
**Status**: COMPLETE  

**Success Criteria**:
- [x] Implement discoverProjectConfig() - walk up directory tree
- [x] Implement discoverUserConfig() - check standard locations
- [x] Add hasProjectConfig() convenience method
- [x] Handle edge cases (permissions, missing files)
- [x] Unit tests for discovery logic

## Phase 2: Command Integration (6-8 hours) ✅ PARTIALLY COMPLETE

### TASK-CONFIG-004: Create Command Helper ✅
**Priority**: High  
**Estimate**: 1 hour  
**Dependencies**: TASK-CONFIG-002  
**Status**: COMPLETE  

**Success Criteria**:
- [x] Create loadCommandConfig() helper function
- [x] Add CLI option mapping logic (implemented in ConfigurationService.mapCliArgsToConfig)
- [x] Handle command-specific overrides
- [x] Export from ConfigurationService
- [x] Unit tests for helper

### TASK-CONFIG-005: Update Watch Command ✅
**Priority**: High  
**Estimate**: 1 hour  
**Dependencies**: TASK-CONFIG-004  
**Status**: COMPLETE  

**Success Criteria**:
- [x] Import ConfigurationService in watch command
- [x] Replace hardcoded values with config
- [x] Map CLI options to config paths
- [x] Test watch command with config file
- [x] Verify backward compatibility

### TASK-CONFIG-009: Update Analyze Command ✅
**Priority**: High  
**Estimate**: 1 hour  
**Dependencies**: TASK-CONFIG-004  
**Status**: COMPLETE  

**Success Criteria**:
- [x] Import ConfigurationService in analyze command
- [x] Add --validate-config option to show configuration sources
- [x] Map CLI options to config (verbose, format, config)
- [x] Test with various configurations
- [x] Verify backward compatibility

### TASK-CONFIG-010: Update Test Command ✅
**Priority**: High  
**Estimate**: 1.5 hours  
**Dependencies**: TASK-CONFIG-004  
**Status**: COMPLETE  

**Success Criteria**:
- [x] Import ConfigurationService in test command
- [x] Replace configuration loading with ConfigurationService
- [x] Map all CLI options (verbose, dryRun, coverage, force, maxRatio, etc.)
- [x] Test with various configurations
- [x] Verify backward compatibility

### TASK-CONFIG-011: Update Run Command ✅
**Priority**: High  
**Estimate**: 1 hour  
**Dependencies**: TASK-CONFIG-004  
**Status**: COMPLETE  

**Success Criteria**:
- [x] Import ConfigurationService in run command
- [x] Use ConfigurationService for configuration loading
- [x] Map CLI options to configuration
- [x] Apply framework and output settings from config
- [x] Test with various configurations

### TASK-CONFIG-006: Update Analyze-Gaps Command ✅
**Priority**: High  
**Estimate**: 1 hour  
**Dependencies**: TASK-CONFIG-004  
**Status**: COMPLETE  

**Success Criteria**:
- [x] Add configuration loading to analyze-gaps
- [x] Use AI model from config
- [x] Use complexity threshold from config
- [x] Test with various configurations
- [x] Update command help text

### TASK-CONFIG-007: Update Incremental Command ✅
**Priority**: High  
**Estimate**: 1 hour  
**Dependencies**: TASK-CONFIG-004  
**Status**: COMPLETE  

**Success Criteria**:
- [x] Add configuration loading to incremental
- [x] Use incremental settings from config
- [x] Map CLI options properly
- [x] Test cost limit and batch size from config
- [x] Verify Git settings applied

### TASK-CONFIG-008: Update Generate-Logical Commands ✅
**Priority**: High  
**Estimate**: 1.5 hours  
**Dependencies**: TASK-CONFIG-004  
**Status**: COMPLETE  

**Success Criteria**:
- [x] Update generate-logical command
- [x] Update generate-logical-batch command
- [x] Use AI settings from config
- [x] Test model selection from config
- [x] Verify timeout and temperature settings

### TASK-CONFIG-009: Update Run Command
**Priority**: Medium  
**Estimate**: 1 hour  
**Dependencies**: TASK-CONFIG-004  

**Success Criteria**:
- [ ] Replace custom config logic with ConfigurationService
- [ ] Ensure project config is loaded
- [ ] Maintain --config flag support
- [ ] Test coverage settings from config
- [ ] Verify no breaking changes

### TASK-CONFIG-010: Update Test Command
**Priority**: Medium  
**Estimate**: 0.5 hours  
**Dependencies**: TASK-CONFIG-004  

**Success Criteria**:
- [ ] Refactor to use ConfigurationService
- [ ] Remove duplicate loading logic
- [ ] Ensure all config values are used
- [ ] Test generation limits applied
- [ ] Verify patterns used correctly

## Phase 3: Advanced Features (2-3 hours)

### TASK-CONFIG-011: Add Environment Variable Support
**Priority**: Medium  
**Estimate**: 1.5 hours  
**Dependencies**: TASK-CONFIG-002  

**Success Criteria**:
- [ ] Define ENV_VAR_MAPPING constant
- [ ] Implement extractEnvConfig() method
- [ ] Add to configuration loading pipeline
- [ ] Handle array values (comma-separated)
- [ ] Test with various env configurations

### TASK-CONFIG-012: Add User Config Support
**Priority**: Low  
**Estimate**: 1.5 hours  
**Dependencies**: TASK-CONFIG-003  

**Success Criteria**:
- [ ] Implement user config discovery
- [ ] Add to loading pipeline with correct priority
- [ ] Create example user config
- [ ] Document user config location
- [ ] Test precedence order

## Phase 4: Testing & Documentation (3-4 hours)

### TASK-CONFIG-013: Integration Tests
**Priority**: High  
**Estimate**: 2 hours  
**Dependencies**: TASK-CONFIG-005 through TASK-CONFIG-010  

**Success Criteria**:
- [ ] Test configuration precedence order
- [ ] Test each command with config file
- [ ] Test CLI override behavior
- [ ] Test missing config scenarios
- [ ] Test validation error handling

### TASK-CONFIG-014: Update Documentation
**Priority**: High  
**Estimate**: 1.5 hours  
**Dependencies**: All implementation tasks  

**Success Criteria**:
- [ ] Update configuration.md with all options
- [ ] Add configuration guide to user docs
- [ ] Update AI_AGENT_GUIDE.md
- [ ] Add examples for each command
- [ ] Document precedence order

### TASK-CONFIG-015: Add Config Debugging
**Priority**: Low  
**Estimate**: 0.5 hours  
**Dependencies**: TASK-CONFIG-002  

**Success Criteria**:
- [ ] Add --show-config flag to commands
- [ ] Add config source tracking
- [ ] Log config loading in verbose mode
- [ ] Add config validation command
- [ ] Document debugging features

## Dependencies Summary

```
Phase 1 (Core Service)
├── TASK-CONFIG-001 (no deps)
├── TASK-CONFIG-002 (depends on 001)
└── TASK-CONFIG-003 (depends on 001)

Phase 2 (Command Integration)  
├── TASK-CONFIG-004 (depends on 002)
├── TASK-CONFIG-005 through 010 (depend on 004)

Phase 3 (Advanced)
├── TASK-CONFIG-011 (depends on 002)
└── TASK-CONFIG-012 (depends on 003)

Phase 4 (Testing)
└── TASK-CONFIG-013-015 (depend on Phase 2 completion)
```

## Risk Mitigation

1. **Start with watch command** - Low risk, currently has no config
2. **Keep backward compatibility** - All changes additive
3. **Feature flag new behavior** - Can disable if issues
4. **Comprehensive tests** - Before touching test/run commands

## Total Estimated Effort

- Phase 1: 6 hours
- Phase 2: 8 hours  
- Phase 3: 3 hours
- Phase 4: 4 hours
- **Total: 21 hours**

## Next Actions

1. Create new refactoring tasks in REFACTORING_PLAN.md for each phase
2. Start with Phase 1 implementation
3. Test thoroughly before moving to Phase 2
4. Get user feedback after Phase 2 completion