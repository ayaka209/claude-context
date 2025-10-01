# Interactive Vector Database Query Tool

The interactive query tool provides a user-friendly command-line interface for directly querying and exploring your vector database. This is an advanced debugging and analysis tool designed for developers who need fine-grained control over database operations.

## Overview

The interactive mode offers:

- 🎨 **Colorized Output** - Easy-to-read terminal output with color coding
- 💬 **Interactive Session** - Real-time command processing with persistent connection
- 🔍 **Multiple Operations** - List collections, query data, perform hybrid searches
- ⚡ **Quick Commands** - Simple, intuitive command syntax with aliases
- 📊 **Live Configuration** - Adjust settings on the fly during your session

## Getting Started

### Prerequisites

Before using the interactive query tool, ensure you have:

1. **Environment Configuration** - A `.env` file with vector database credentials
2. **Indexed Codebase** - At least one project indexed in your vector database
3. **API Keys** - Required embedding API key for hybrid search operations

### Required Environment Variables

```bash
# Vector Database (required)
ZILLIZ_ENDPOINT=your-zilliz-endpoint
ZILLIZ_TOKEN=your-zilliz-token
# Or for local Milvus
MILVUS_ENDPOINT=your-milvus-endpoint
MILVUS_TOKEN=your-milvus-token

# Embedding Provider (required for hybrid search)
OPENAI_API_KEY=your-api-key
OPENAI_BASE_URL=https://api.openai.com/v1  # Optional
EMBEDDING_MODEL=text-embedding-3-small      # Optional
EMBEDDING_DIMENSIONS=1536                   # Optional
```

## Starting Interactive Mode

### Using npm/pnpm

```bash
# From the project root
pnpm manual-query:interactive

# Or using npm
npm run manual-query:interactive
```

### Direct Execution

```bash
# If installed globally
claude-context-mcp manual-query:interactive

# Or run directly
node scripts/manual-query-interactive.js
```

## Interface Overview

When you start the interactive tool, you'll see a welcome screen:

```
═══════════════════════════════════════════════════════════════
🔧 Claude Context - Interactive Vector Database Query Tool
═══════════════════════════════════════════════════════════════

Welcome to the interactive query interface! Type help for available commands.
Type exit or quit to leave the session.

claude-context>
```

The colorized prompt `claude-context>` indicates the tool is ready for your commands.

## Available Commands

### Basic Operations

#### `list` or `collections`
List all collections in the vector database.

```
claude-context> list
📋 Listing collections...

✅ Found 4 collections:
  1. hybrid_code_chunks_git_github_com_myrepo_abc123
  2. hybrid_code_chunks_f12bdcb4
  3. hybrid_code_chunks_106e676d
  4. hybrid_code_chunks_6bc5cb3e
```

#### `info <collection>`
Check if a specific collection exists and is accessible.

```
claude-context> info hybrid_code_chunks_abc123
ℹ️  Checking collection: hybrid_code_chunks_abc123
✅ Collection 'hybrid_code_chunks_abc123' exists and is accessible
```

### Query Operations

#### `query <collection> [filter]`
Query a collection with optional filter expression.

**Examples:**

```
# Query without filter (first 10 results)
claude-context> query hybrid_code_chunks_abc123

# Query with path filter
claude-context> query hybrid_code_chunks_abc123 relativePath like "src/%"

# Query specific file extension
claude-context> query hybrid_code_chunks_abc123 fileExtension == ".ts"

# Complex filter
claude-context> query hybrid_code_chunks_abc123 relativePath like "src/%" && fileExtension == ".ts"
```

**Output:**
```
🔍 Querying collection: hybrid_code_chunks_abc123
🎯 Filter: relativePath like "src/%"
📊 Limit: 10

✅ Found 5 results:

--- Result 1 ---
ID: chunk_6db3fd995a5a96f2
Path: src/context.ts
Lines: 100-150
Content: export class Context {
    private embedding: Embedding;
    private vectorDatabase: VectorDatabase;
    ...
```

#### `search <collection> <query>` or `find <collection> <query>`
Perform hybrid search (dense + sparse vectors) using natural language.

**Examples:**

```
# Search for specific functionality
claude-context> search hybrid_code_chunks_abc123 function definition

# Search for error handling code
claude-context> find hybrid_code_chunks_abc123 error handling

# Search for authentication logic
claude-context> search hybrid_code_chunks_abc123 user authentication
```

**Output:**
```
🔎 Performing hybrid search on: hybrid_code_chunks_abc123
🎯 Query: "function definition"
📊 Limit: 10
✅ Generated 2048D query vector

✅ Found 3 hybrid search results:

--- Result 1 (Score: 0.8542) ---
ID: chunk_288741ba128f0e0a
Path: src/utils/helper.ts
Lines: 45-78
Content: // Helper function to process user input
function processInput(data: string): Result {
    const cleaned = sanitize(data);
    ...
```

### Utility Commands

#### `limit <number>`
Set the maximum number of results to return (1-100).

```
claude-context> limit 20
✅ Result limit set to 20

claude-context> limit
Current limit: 20
```

#### `status`
Show current settings and configuration.

```
claude-context> status

Current Settings:
────────────────
  Result Limit: 10
  Embedding Model: text-embedding-v4
  Vector DB: in03-177c258eb8d04b8...
```

#### `clear` or `cls`
Clear the terminal screen.

```
claude-context> clear
```

#### `help` or `h`
Display the help menu with all available commands.

```
claude-context> help

Available Commands:
─────────────────

Basic Operations:
  list                          - List all collections
  info <collection>             - Check if collection exists
  collections                   - Alias for 'list'

Query Operations:
  query <collection> [filter]   - Query collection with optional filter
  search <collection> <query>   - Hybrid search in collection
  find <collection> <query>     - Alias for 'search'
...
```

#### `exit` or `quit` or `q`
Exit the interactive session.

```
claude-context> exit
👋 Goodbye!
```

## Filter Expressions

When using the `query` command, you can specify Milvus filter expressions to narrow down results.

### Filter Syntax

| Expression | Description | Example |
|------------|-------------|---------|
| `==` | Equals | `fileExtension == ".ts"` |
| `!=` | Not equals | `fileExtension != ".md"` |
| `like` | Pattern matching | `relativePath like "src/%"` |
| `&&` | Logical AND | `fileExtension == ".ts" && relativePath like "src/%"` |
| `\|\|` | Logical OR | `fileExtension == ".ts" \|\| fileExtension == ".js"` |
| `in` | In array | `fileExtension in [".ts", ".tsx"]` |

### Common Filter Examples

```bash
# TypeScript files only
query <collection> fileExtension == ".ts"

# Files in src directory
query <collection> relativePath like "src/%"

# Files NOT in tests
query <collection> relativePath not like "%test%"

# TypeScript files in src
query <collection> fileExtension == ".ts" && relativePath like "src/%"

# Multiple file types
query <collection> fileExtension in [".ts", ".tsx", ".js"]

# Specific line range
query <collection> startLine >= 100 && endLine <= 200
```

## Real-World Use Cases

### 1. Debugging Index Issues

**Scenario:** Verify that specific files were indexed correctly.

```
claude-context> list
claude-context> query hybrid_code_chunks_abc123 relativePath like "%authentication%"
```

### 2. Analyzing Code Distribution

**Scenario:** Check how many chunks are in different directories.

```
claude-context> limit 100
claude-context> query hybrid_code_chunks_abc123 relativePath like "src/%"
claude-context> query hybrid_code_chunks_abc123 relativePath like "tests/%"
```

### 3. Testing Search Quality

**Scenario:** Compare hybrid search results with different queries.

```
claude-context> search hybrid_code_chunks_abc123 authentication function
claude-context> search hybrid_code_chunks_abc123 user login
claude-context> search hybrid_code_chunks_abc123 verify credentials
```

### 4. Finding Specific Code Patterns

**Scenario:** Locate all error handling code in services.

```
claude-context> search hybrid_code_chunks_abc123 error handling
claude-context> query hybrid_code_chunks_abc123 relativePath like "services/%" && content like "%try%"
```

### 5. Collection Management

**Scenario:** Identify and clean up old collections.

```
claude-context> list
claude-context> info hybrid_code_chunks_old123
# If exists but outdated, use clear_index tool in MCP
```

## Tips and Best Practices

### 🎯 Efficient Querying

1. **Start with `list`** - Always begin by listing collections to find the correct collection name
2. **Use filters wisely** - Narrow down results with specific filters before running searches
3. **Adjust limit** - Set appropriate limits based on your needs (smaller for exploration, larger for analysis)
4. **Test queries** - Use the interactive mode to test and refine your search queries

### 🔍 Search Optimization

1. **Specific terms** - Use specific technical terms for better search results
2. **Natural language** - Hybrid search works best with natural language descriptions
3. **Iterate** - Try different query phrasings to find the best results
4. **Compare results** - Run similar queries to understand semantic search behavior

### 💡 Session Management

1. **Keep sessions short** - Start fresh sessions for different tasks
2. **Use status** - Regularly check your current settings with `status`
3. **Save findings** - Copy important results before exiting
4. **Exit cleanly** - Always use `exit` or `quit` for clean shutdown

### ⚠️ Common Pitfalls

1. **Case sensitivity** - Collection names are case-sensitive
2. **Filter syntax** - Use correct Milvus filter expression syntax
3. **API quotas** - Hybrid search consumes embedding API calls
4. **Large limits** - Very large limits may impact performance

## Troubleshooting

### Connection Issues

**Problem:** Unable to connect to vector database

**Solution:**
```bash
# Verify environment variables
cat .env | grep ZILLIZ

# Test connection with simple list command
claude-context> list
```

### Empty Results

**Problem:** Query returns no results

**Solution:**
```bash
# Verify collection exists
claude-context> list
claude-context> info <collection-name>

# Try without filter first
claude-context> query <collection-name>

# Check filter syntax
claude-context> query <collection-name> relativePath like "src/%"
```

### Hybrid Search Errors

**Problem:** Hybrid search fails with API error

**Solution:**
```bash
# Verify API key is set
echo $OPENAI_API_KEY

# Check embedding model configuration
claude-context> status

# Try with different query
claude-context> search <collection-name> simple test query
```

### Slow Performance

**Problem:** Queries take too long

**Solution:**
```bash
# Reduce result limit
claude-context> limit 5

# Use more specific filters
claude-context> query <collection> relativePath like "src/specific/path%"

# Check database endpoint performance
# Consider using local Milvus for faster queries
```

## Advanced Features

### Batch Analysis

While the interactive mode doesn't support batch operations directly, you can use it to build and test queries for automation:

```bash
# Test your query interactively
claude-context> search hybrid_code_chunks_abc123 authentication

# Once satisfied, use the CLI version for automation
pnpm manual-query -- --operation hybrid_search \
  --collection "hybrid_code_chunks_abc123" \
  --query "authentication" \
  --limit 20
```

### Collection Name Patterns

Understanding collection naming helps you work more efficiently:

```
Pattern: hybrid_code_chunks_{identifier}

Examples:
- hybrid_code_chunks_git_github_com_owner_repo_hash
- hybrid_code_chunks_{md5_hash_of_path}
- code_chunks_{hash} (older non-hybrid collections)
```

### Keyboard Shortcuts

- `Ctrl+C` - Interrupt current operation (prompts for exit confirmation)
- `Ctrl+L` - Clear screen (same as `clear` command)
- `Up/Down arrows` - Navigate command history
- `Tab` - Auto-completion (in supported terminals)

## Integration with Other Tools

### Using with MCP Tools

The interactive query tool complements MCP tools:

1. **Use MCP for indexing** - `index_codebase` tool
2. **Use interactive for debugging** - Verify index quality
3. **Use MCP for searching** - `search_code` tool in AI workflows
4. **Use interactive for analysis** - Deep dive into specific results

### Scripting with CLI Version

For automation, use the non-interactive CLI:

```bash
# Save results to file
pnpm manual-query -- --operation list > collections.txt

# Automated testing
pnpm manual-query -- --operation query \
  --collection "hybrid_code_chunks_abc123" \
  --filter "relativePath like 'src/%'" \
  --limit 100
```

## Examples Gallery

### Example 1: Complete Analysis Workflow

```
claude-context> list
claude-context> limit 5
claude-context> query hybrid_code_chunks_abc123 fileExtension == ".ts"
claude-context> limit 10
claude-context> search hybrid_code_chunks_abc123 database connection
claude-context> search hybrid_code_chunks_abc123 error handling
claude-context> status
claude-context> exit
```

### Example 2: Debugging Session

```
claude-context> list
claude-context> info hybrid_code_chunks_new123
claude-context> query hybrid_code_chunks_new123
claude-context> query hybrid_code_chunks_new123 relativePath like "src/bug/%"
claude-context> search hybrid_code_chunks_new123 null pointer exception
claude-context> exit
```

### Example 3: Performance Testing

```
claude-context> status
claude-context> limit 1
claude-context> search hybrid_code_chunks_abc123 test query
claude-context> limit 10
claude-context> search hybrid_code_chunks_abc123 test query
claude-context> limit 50
claude-context> search hybrid_code_chunks_abc123 test query
claude-context> exit
```

## Summary

The interactive query tool is a powerful addition to Claude Context's toolkit, providing:

- ✅ Direct database access for debugging and analysis
- ✅ User-friendly interface with color-coded output
- ✅ Flexible query capabilities with filters and hybrid search
- ✅ Real-time configuration adjustments
- ✅ Perfect for development and troubleshooting

For production workflows, consider using the standard MCP tools. For debugging, exploration, and learning, the interactive mode is invaluable.

## Related Documentation

- [Manual Query CLI Tool](./manual-query-cli.md)
- [MCP Tools Reference](../mcp/tools-reference.md)
- [Environment Variables Guide](../getting-started/environment-variables.md)
- [Vector Database Configuration](../configuration/vector-database.md)

---

**Need Help?**
- Report issues: [GitHub Issues](https://github.com/ayaka209/claude-context/issues)
- Main documentation: [README](../../README.md)
- Official repository: [zilliztech/claude-context](https://github.com/zilliztech/claude-context)
