# Manual Query CLI Tool

The manual query CLI tool provides direct command-line access to your vector database for automation, scripting, and one-off queries.

## Overview

Unlike the [interactive mode](./manual-query-interactive.md), the CLI version is designed for:

- 🤖 **Automation** - Script-friendly single-command operations
- 📊 **Batch Processing** - Process multiple queries in sequence
- 🔄 **CI/CD Integration** - Integrate database queries into pipelines
- 📝 **Logging** - Capture output for analysis and reporting

## Quick Start

### Basic Usage

```bash
# Using pnpm (recommended)
pnpm manual-query -- --operation <operation> [options]

# Using npm
npm run manual-query -- --operation <operation> [options]

# Direct execution
node scripts/manual-query.js --operation <operation> [options]
```

### Show Help

```bash
pnpm manual-query -- --help
```

## Operations

### 1. List Collections

List all vector database collections.

```bash
pnpm manual-query -- --operation list_collections
```

**Output:**
```
Found 4 collections:
  1. hybrid_code_chunks_git_github_com_myrepo_abc123
  2. hybrid_code_chunks_f12bdcb4
  3. hybrid_code_chunks_106e676d
  4. hybrid_code_chunks_6bc5cb3e
```

### 2. Collection Info

Check if a collection exists.

```bash
pnpm manual-query -- \
  --operation collection_info \
  --collection "hybrid_code_chunks_abc123"
```

**Output:**
```
✅ Collection 'hybrid_code_chunks_abc123' exists and is accessible
```

### 3. Direct Query

Query with optional filter expression.

```bash
# Basic query
pnpm manual-query -- \
  --operation query \
  --collection "hybrid_code_chunks_abc123" \
  --limit 10

# With filter
pnpm manual-query -- \
  --operation query \
  --collection "hybrid_code_chunks_abc123" \
  --filter "relativePath like 'src/%'" \
  --limit 20
```

**Output:**
```
Found 5 results:

--- Result 1 ---
ID: chunk_6db3fd995a5a96f2
Path: src/context.ts
Lines: 100-150
Content: export class Context { ... }
```

### 4. Hybrid Search

Perform semantic search with dense + sparse vectors.

```bash
pnpm manual-query -- \
  --operation hybrid_search \
  --collection "hybrid_code_chunks_abc123" \
  --query "function definition" \
  --limit 10
```

**Output:**
```
Found 3 hybrid search results:

--- Result 1 (Score: 0.8542) ---
ID: chunk_288741ba128f0e0a
Path: src/utils/helper.ts
Lines: 45-78
Content: function processInput(data: string): Result { ... }
```

## Options

| Option | Description | Required | Default |
|--------|-------------|----------|---------|
| `--operation` | Operation type | Yes | `list_collections` |
| `--collection` | Collection name | For query/search/info | - |
| `--query` | Natural language query | For hybrid_search | - |
| `--filter` | Milvus filter expression | No | - |
| `--limit` | Max results (1-100) | No | `10` |
| `--help` | Show help message | No | - |

## Examples

### Automation Scripts

**Example 1: Daily Collection Report**

```bash
#!/bin/bash
# daily-report.sh

echo "=== Vector Database Report $(date) ===" > report.txt
echo "" >> report.txt

echo "Collections:" >> report.txt
pnpm manual-query -- --operation list_collections >> report.txt

echo "" >> report.txt
echo "Sample data from main collection:" >> report.txt
pnpm manual-query -- \
  --operation query \
  --collection "hybrid_code_chunks_abc123" \
  --limit 5 >> report.txt
```

**Example 2: Verify Index Quality**

```bash
#!/bin/bash
# verify-index.sh

COLLECTION="hybrid_code_chunks_abc123"

# Check collection exists
if pnpm manual-query -- --operation collection_info --collection "$COLLECTION" | grep -q "exists"; then
    echo "✓ Collection exists"

    # Count TypeScript files
    TS_COUNT=$(pnpm manual-query -- \
      --operation query \
      --collection "$COLLECTION" \
      --filter "fileExtension == '.ts'" \
      --limit 100 | grep -c "Result")

    echo "✓ Found $TS_COUNT TypeScript chunks"
else
    echo "✗ Collection not found"
    exit 1
fi
```

**Example 3: Search Quality Testing**

```bash
#!/bin/bash
# test-search.sh

COLLECTION="hybrid_code_chunks_abc123"
QUERIES=("authentication" "database connection" "error handling")

for query in "${QUERIES[@]}"; do
    echo "Testing query: $query"
    pnpm manual-query -- \
      --operation hybrid_search \
      --collection "$COLLECTION" \
      --query "$query" \
      --limit 3
    echo "---"
done
```

### CI/CD Integration

**GitHub Actions Example:**

```yaml
name: Verify Vector Database

on:
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM
  workflow_dispatch:

jobs:
  verify:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install pnpm
        run: npm install -g pnpm

      - name: Install dependencies
        run: pnpm install

      - name: Check collections
        env:
          ZILLIZ_ENDPOINT: ${{ secrets.ZILLIZ_ENDPOINT }}
          ZILLIZ_TOKEN: ${{ secrets.ZILLIZ_TOKEN }}
        run: |
          pnpm manual-query -- --operation list_collections

      - name: Verify main collection
        env:
          ZILLIZ_ENDPOINT: ${{ secrets.ZILLIZ_ENDPOINT }}
          ZILLIZ_TOKEN: ${{ secrets.ZILLIZ_TOKEN }}
        run: |
          pnpm manual-query -- \
            --operation collection_info \
            --collection "hybrid_code_chunks_main"
```

### Data Export

**Export collection data:**

```bash
# Export to JSON
pnpm manual-query -- \
  --operation query \
  --collection "hybrid_code_chunks_abc123" \
  --limit 100 > data-export.json

# Export TypeScript files only
pnpm manual-query -- \
  --operation query \
  --collection "hybrid_code_chunks_abc123" \
  --filter "fileExtension == '.ts'" \
  --limit 1000 > typescript-chunks.json
```

### Performance Testing

**Measure query performance:**

```bash
#!/bin/bash
# benchmark.sh

COLLECTION="hybrid_code_chunks_abc123"

echo "Benchmarking queries..."

time pnpm manual-query -- \
  --operation query \
  --collection "$COLLECTION" \
  --limit 10

time pnpm manual-query -- \
  --operation hybrid_search \
  --collection "$COLLECTION" \
  --query "test query" \
  --limit 10
```

## Environment Variables

The CLI tool reads from `.env` file in the project root:

```bash
# Vector Database (required)
ZILLIZ_ENDPOINT=your-endpoint
ZILLIZ_TOKEN=your-token

# Embedding Provider (required for hybrid_search)
OPENAI_API_KEY=your-api-key
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_DIMENSIONS=1536
OPENAI_BASE_URL=https://api.openai.com/v1
```

## Error Handling

### Exit Codes

- `0` - Success
- `1` - Error occurred

### Common Errors

**Missing collection:**
```bash
$ pnpm manual-query -- --operation query --collection "nonexistent"
❌ Error: Collection 'nonexistent' does not exist
```

**Missing required parameter:**
```bash
$ pnpm manual-query -- --operation hybrid_search --collection "abc123"
❌ Error: --query is required for hybrid_search operation
```

**Invalid filter:**
```bash
$ pnpm manual-query -- --operation query --collection "abc123" --filter "invalid syntax"
❌ Error: Invalid filter expression
```

## Output Formats

### Standard Output

By default, output is human-readable:

```
Found 3 results:

--- Result 1 ---
ID: chunk_abc123
Path: src/file.ts
Lines: 10-20
Content: ...
```

### Redirecting Output

Redirect to file for later processing:

```bash
# Save to file
pnpm manual-query -- --operation list_collections > collections.txt

# Pipe to grep
pnpm manual-query -- --operation list_collections | grep "abc123"

# Save errors separately
pnpm manual-query -- --operation query --collection "abc123" 2> errors.log
```

## Best Practices

### 🎯 Script Design

1. **Check exit codes** - Always verify command success
2. **Use environment variables** - Keep credentials secure
3. **Limit results** - Don't query unlimited data
4. **Handle errors** - Implement proper error handling

### 🔒 Security

1. **Never commit credentials** - Use environment variables
2. **Restrict access** - Limit who can run queries
3. **Audit logs** - Keep track of manual queries
4. **Use read-only tokens** - When possible

### ⚡ Performance

1. **Use filters** - Narrow down queries with filters
2. **Set appropriate limits** - Don't fetch more than needed
3. **Cache results** - Store frequently accessed data
4. **Batch operations** - Combine multiple queries when possible

## Comparison: CLI vs Interactive Mode

| Feature | CLI | Interactive |
|---------|-----|-------------|
| **Use Case** | Automation | Exploration |
| **Session** | Single command | Persistent |
| **Output** | Script-friendly | Human-readable |
| **Colors** | No | Yes |
| **Speed** | Fast startup | Session reuse |
| **History** | No | Yes |
| **Best For** | CI/CD, scripts | Debugging, learning |

**When to use CLI:**
- Automated workflows
- CI/CD pipelines
- Batch processing
- Scheduled tasks

**When to use Interactive:**
- Manual exploration
- Debugging issues
- Learning the database
- Iterative queries

## Related Documentation

- [Interactive Query Mode](./manual-query-interactive.md) - Interactive interface
- [MCP Tools Reference](../mcp/tools-reference.md) - MCP integration
- [Environment Variables](../getting-started/environment-variables.md) - Configuration guide
- [Filter Expressions](../advanced/milvus-filters.md) - Query syntax reference

---

**Need Help?**
- Show help: `pnpm manual-query -- --help`
- Report issues: [GitHub Issues](https://github.com/ayaka209/claude-context/issues)
- Official repository: [zilliztech/claude-context](https://github.com/zilliztech/claude-context)
