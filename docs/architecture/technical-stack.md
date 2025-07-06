# Technical Stack

*Last updated: 2025-07-05 | Comprehensive technology stack and dependencies*

## 🔧 Core Technologies

### Runtime Environment
- **Node.js 18+**: Primary runtime environment with modern ES2022 features
- **TypeScript 5.x**: Full type safety with strict configuration and exactOptionalPropertyTypes
- **ES Modules**: Modern module system with CommonJS compatibility layer

### Language Support
- **JavaScript**: ES6+ with full async/await, destructuring, and modern features
- **TypeScript**: Full TypeScript support with strict type checking
- **Python**: 3.8+ support for pytest-based test generation (expanding)

## 🏗️ Framework Dependencies

### CLI and Command Processing
- **Commander.js 12.x**: Production-grade CLI framework with subcommands
- **chalk 5.x**: Terminal string styling for enhanced user experience
- **ora 8.x**: Elegant terminal spinners for long-running operations

### File System and Path Processing
- **fast-glob 3.x**: High-performance glob pattern matching
- **chokidar 3.x**: Cross-platform file system watching
- **fs-extra**: Enhanced file system operations with promisified API

### AST and Code Analysis
- **@babel/parser 7.x**: JavaScript/TypeScript AST parsing
- **@babel/traverse 7.x**: AST traversal for code analysis
- **@babel/types 7.x**: AST node type definitions and utilities

### Testing Infrastructure
- **Jest 29.x**: Primary testing framework with coverage reporting
- **@testing-library/jest-dom**: Enhanced Jest matchers for DOM testing
- **pytest**: Python testing framework (for target project test execution)

## 🔌 AI and External Integrations

### AI Processing
- **Claude CLI**: Anthropic's Claude Code CLI for AI-powered test generation
- **Token Estimation**: Custom token counting and cost calculation
- **Batch Processing**: Intelligent task batching with state persistence

### Version Control
- **Git**: Required for incremental testing and change detection
- **Simple-git 3.x**: Programmatic Git operations for change analysis

### Process Management
- **Cross-platform Process Monitoring**: ps (Unix), wmic (Windows)
- **Child Process Management**: Enhanced Node.js spawn with timeout controls
- **Resource Monitoring**: CPU, memory tracking across platforms

## 🛠️ Development Dependencies

### Build and Compilation
- **TypeScript Compiler**: tsc with strict type checking
- **ts-node**: Development-time TypeScript execution
- **rimraf**: Cross-platform file/directory removal

### Code Quality
- **ESLint 9.x**: JavaScript/TypeScript linting with comprehensive rules
- **Prettier 3.x**: Code formatting with consistent style
- **Husky 9.x**: Git hooks for automated quality checks

### Testing and Validation
- **Jest**: Unit and integration testing framework
- **@types/jest**: TypeScript definitions for Jest
- **Supertest**: HTTP assertion library for API testing (when applicable)

## 📊 Configuration and Validation

### Schema Validation
- **Zod 3.x**: Runtime type validation and schema definition
- **JSON Schema**: Configuration file validation
- **Custom Validators**: Framework-specific validation logic

### Configuration Management
- **Multi-source Configuration**: CLI args, env vars, config files
- **Template System**: Pre-built configurations for common frameworks
- **Environment Variable Mapping**: `CLAUDE_TESTING_*` prefix support

## 🎯 Target Project Support

### JavaScript/TypeScript Frameworks
- **React 18+**: Components, hooks, JSX/TSX support
- **Vue 3+**: Composition API, template analysis
- **Angular**: Component architecture, dependency injection
- **Next.js**: Full-stack React framework with SSR/SSG
- **Express**: Node.js web framework
- **Node.js**: Runtime and module detection

### Python Frameworks
- **FastAPI**: Modern async web framework
- **Flask**: Lightweight web framework
- **Django**: Full-featured web framework
- **pytest**: Testing framework integration

### Testing Frameworks (Target Projects)
- **Jest**: Full integration with module mocking
- **Vitest**: Vite-native testing framework
- **pytest**: Python testing with fixtures and parametrization
- **Mocha/Chai**: Traditional Node.js testing (basic support)

### Module Systems
- **ES Modules**: Modern import/export syntax
- **CommonJS**: require/module.exports for Node.js
- **Mixed Projects**: Automatic detection and appropriate handling
- **TypeScript Modules**: .ts/.tsx import resolution

## 🔄 External Service Integrations

### Required Services
- **Anthropic Claude API**: Via Claude CLI for AI generation
- **File System**: Cross-platform file operations
- **Git Repository**: For change detection and incremental updates

### Optional Services
- **GitHub Actions**: CI/CD integration templates
- **GitLab CI**: Continuous integration support
- **Coverage Services**: Codecov, Coveralls integration
- **IDE Extensions**: VS Code debugging and integration

## 📈 Performance and Scalability

### Caching Strategy
- **Memory Caching**: TTL-based caching with configurable limits
- **File System Caching**: Intelligent cache invalidation
- **Pattern Caching**: Compiled glob patterns for performance

### Concurrency Management
- **Process Limits**: Global Claude process limits (max 5)
- **Batch Processing**: Configurable batch sizes (default: 5)
- **Sequential Processing**: Default mode to prevent resource exhaustion
- **Optional Concurrency**: `--allow-concurrent` flag for parallel processing

### Resource Optimization
- **File Chunking**: Large files split for AI processing (4k+ tokens)
- **Streaming Operations**: Memory-efficient file processing
- **Lazy Loading**: On-demand module loading for CLI commands
- **Connection Pooling**: Efficient resource management

## 🔒 Security and Reliability

### Error Handling
- **Circuit Breaker Pattern**: Prevents cascading failures
- **Intelligent Retry**: Exponential backoff with jitter
- **Graceful Degradation**: Fallback modes when AI unavailable
- **Timeout Management**: Adaptive timeouts based on task complexity

### Process Safety
- **Process Isolation**: Subprocess sandboxing
- **Resource Limits**: Memory and CPU monitoring
- **Zombie Process Detection**: Automatic cleanup
- **Signal Handling**: Proper SIGTERM/SIGKILL handling

### Data Protection
- **No Credential Storage**: Uses existing Claude CLI authentication
- **Temporary File Cleanup**: Automatic cleanup of intermediate files
- **Error Sanitization**: Sensitive information removal from logs

## 🌐 Cross-Platform Compatibility

### Operating Systems
- **Linux**: Ubuntu 20.04+ with full feature support
- **macOS**: macOS 12+ with native process monitoring
- **Windows**: Windows 10+ with WSL and PowerShell support

### Architecture Support
- **x64**: Primary architecture with full support
- **ARM64**: Apple Silicon and ARM servers
- **Multi-arch**: Automatic architecture detection

### Environment Compatibility
- **Docker**: Container support with volume mounting
- **CI/CD**: GitHub Actions, GitLab CI, Jenkins
- **Development**: Local development with hot reloading

## See Also
- 📖 **Architecture Overview**: [`/docs/architecture/overview.md`](./overview.md)
- 📖 **Adapter Pattern**: [`/docs/architecture/adapter-pattern.md`](./adapter-pattern.md)
- 📖 **Dependencies**: [`/docs/architecture/dependencies.md`](./dependencies.md)