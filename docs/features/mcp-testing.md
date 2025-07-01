# MCP Server Testing Support

*Last updated: 2025-07-01 | Created by: /document command | Initial implementation*

## Overview

The MCP (Model Context Protocol) testing feature provides specialized testing patterns for MCP server implementations. This feature automatically detects MCP servers and generates comprehensive tests for protocol compliance, tool integration, message handling, transport layers, and chaos scenarios.

## Architecture Components

### 1. MCP Detection (`src/analyzers/ProjectAnalyzer.ts`)

Enhanced project analyzer that detects MCP servers by:

- **Package dependencies**: `@modelcontextprotocol/sdk`, `fastmcp`, `mcp-framework`
- **Configuration files**: `mcp.json`, `.mcp/config.json`
- **Framework detection**: FastMCP vs official SDK vs custom implementations
- **Transport identification**: STDIO and HTTP+SSE

### 2. MCP Types (`src/types/mcp-types.ts`)

Specialized type definitions:

```typescript
interface MCPProjectAnalysis extends ProjectAnalysis {
  projectType: 'mcp-server';
  mcpCapabilities: {
    tools: MCPTool[];
    resources: MCPResource[];
    prompts: MCPPrompt[];
    transports: ('stdio' | 'http-sse')[];
    framework: 'fastmcp' | 'official-sdk' | 'custom';
  };
}
```

### 3. MCP Test Templates

Five specialized templates for comprehensive MCP testing:

#### MCPProtocolComplianceTemplate
- JSON-RPC 2.0 message format validation
- Request/response correlation testing
- Error handling per MCP specification
- Capability negotiation and handshake testing

#### MCPToolIntegrationTemplate
- Tool discovery (`listTools`) testing
- Tool parameter validation
- Tool execution and result validation
- Tool chaining and context preservation

#### MCPMessageHandlingTemplate
- Message ordering and sequencing
- Concurrent request handling
- Connection lifecycle management
- Session state persistence
- Timeout and cancellation handling

#### MCPTransportTemplate
- STDIO transport testing (pipe communication)
- HTTP+SSE transport testing (REST + Server-Sent Events)
- Transport-specific error scenarios
- Performance and latency testing

#### MCPChaosTemplate
- LLM input simulation with unpredictable patterns
- Malformed parameter handling
- Edge case numeric and string values
- Boundary testing (deep nesting, circular references)
- Protocol abuse testing

## Generated Test Structure

When MCP server is detected, generates:

```
.claude-testing/
├── mcp-protocol-compliance.test.js
├── mcp-tool-integration.test.js
├── mcp-message-handling.test.js
├── mcp-transport-stdio.test.js
├── mcp-transport-http-sse.test.js
└── mcp-chaos-testing.test.js
```

## Usage

### Basic MCP Server Testing
```bash
# Analyze MCP server
node dist/cli/index.js analyze /path/to/mcp-server

# Generate MCP tests
node dist/cli/index.js test /path/to/mcp-server

# Run generated tests
cd /path/to/mcp-server/.claude-testing
npm test
```

### Framework-Specific Testing

#### FastMCP Servers
```bash
node dist/cli/index.js test /path/to/fastmcp-server
# Automatically detects FastMCP and uses framework-specific patterns
```

#### Official SDK Servers
```bash
node dist/cli/index.js test /path/to/official-sdk-server
# Detects @modelcontextprotocol/sdk usage
```

## Integration Points

### ProjectAnalyzer Integration
- Extended `detectFrameworks()` to include MCP detection
- Added `analyzeMCPCapabilities()` for capability extraction
- Enhanced framework list with 'mcp-server' and 'fastmcp'

### StructuralTestGenerator Integration
- Modified `postGenerate()` to generate MCP-specific tests
- Added `generateMCPTests()` method for MCP test creation
- Integrated with existing dry-run and progress reporting

### Type System Integration
- Added to `src/types/index.ts` exports
- Created type guards for MCP project detection
- Extended `ProjectAnalysis` interface

## Test Coverage Areas

### Protocol Compliance (JSON-RPC 2.0)
- Message format validation
- Required field presence
- Error code standards (-32700 to -32603)
- Request ID correlation

### Tool Integration
- Tool discovery and listing
- Input schema validation
- Tool execution flow
- Result format compliance

### Async Message Handling
- Concurrent request processing
- Notification handling (no response)
- Message ordering guarantees
- State isolation between connections

### Transport Validation
- STDIO: Message boundaries, binary data, stream management
- HTTP+SSE: Connection establishment, event streaming, reconnection

### Chaos Testing
- Invalid parameter types and values
- Missing required fields
- Unexpected additional properties
- Extreme values and edge cases
- Rapid-fire requests
- Mixed valid/invalid requests

## Configuration

MCP testing respects standard `.claude-testing.config.json`:

```json
{
  "testFramework": "jest",
  "features": {
    "mcpTesting": {
      "enableChaosTests": true,
      "transportTests": ["stdio", "http-sse"],
      "protocolVersion": "2024-11-05"
    }
  }
}
```

## Performance Considerations

- MCP test generation adds 5 additional test files
- Chaos tests can be CPU-intensive (100+ test cases)
- Transport tests may require actual server processes
- Consider using `--only-structural` for faster iteration

## Future Enhancements

- Chrome DevTools Protocol integration patterns
- WebSocket transport support
- Advanced session management testing
- Performance benchmarking templates
- Custom tool schema validation

## Related Documentation

- **Test Generator**: [`./test-generator.md`](./test-generator.md) - Core generation system
- **Project Analyzer**: [`./project-analyzer.md`](./project-analyzer.md) - Detection system
- **Template Engines**: [`./template-engines.md`](./template-engines.md) - Template patterns
- **AI Integration**: [`./ai-integration.md`](./ai-integration.md) - Logical test enhancement

---

**MCP Testing Philosophy**: Comprehensive validation of protocol compliance while stress-testing with real-world LLM behavior patterns.