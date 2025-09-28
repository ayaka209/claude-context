# 使用Qwen嵌入模型配置指南

Claude Context 已支持Qwen3嵌入模型系列和阿里云DashScope服务。本文档将指导您如何配置和使用Qwen模型作为向量嵌入提供商。

## 支持的Qwen模型

项目目前支持以下Qwen3嵌入模型：

| 模型名称 | 维度 | 上下文长度 | 支持服务 | 描述 |
|---------|------|-----------|---------|------|
| `Qwen/Qwen3-Embedding-8B` | 4096 | 32000 | 通用OpenAI兼容端点 | 8B参数模型，4096维度 |
| `Qwen/Qwen3-Embedding-4B` | 2560 | 32000 | 通用OpenAI兼容端点 | 4B参数模型，2560维度 |
| `Qwen/Qwen3-Embedding-0.6B` | 1024 | 32000 | 通用OpenAI兼容端点 | 0.6B参数模型，1024维度 |
| `text-embedding-v4` | 1024 | 32000 | 阿里云DashScope专用 | **专为阿里云优化，自动处理批处理限制** |

> **重要提示**：`text-embedding-v4` 模型专为阿里云DashScope服务优化，包含自动批处理大小限制（≤10）和响应格式兼容处理。

## 配置方式

### 方式一：通过环境变量配置（推荐）

#### 1. 创建全局配置文件
```bash
# 创建配置目录
mkdir -p ~/.context

# 创建环境变量文件
touch ~/.context/.env
```

#### 2. 编辑配置文件

##### 阿里云DashScope配置（推荐）：
```bash
# 阿里云DashScope专用配置
EMBEDDING_PROVIDER=OpenAI
EMBEDDING_MODEL=text-embedding-v4

# 阿里云API配置
OPENAI_API_KEY=sk-your-dashscope-api-key
OPENAI_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1

# 向量数据库配置
ZILLIZ_ENDPOINT=your-zilliz-endpoint
ZILLIZ_TOKEN=your-zilliz-token

# 注意：EMBEDDING_BATCH_SIZE 会自动限制为10（阿里云限制）
```

##### 通用Qwen模型配置：
```bash
# 嵌入提供商设置
EMBEDDING_PROVIDER=OpenAI
EMBEDDING_MODEL=Qwen/Qwen3-Embedding-8B

# API配置 - 需要兼容OpenAI的API端点
OPENAI_API_KEY=your-api-key-here
OPENAI_BASE_URL=https://your-qwen-api-endpoint

# 向量数据库配置
MILVUS_ADDRESS=your-milvus-endpoint
MILVUS_TOKEN=your-milvus-token

# 可选：嵌入批处理大小（默认100）
EMBEDDING_BATCH_SIZE=50
```

#### 3. 模型选择建议
- **性能优先**：使用 `Qwen/Qwen3-Embedding-8B` (4096维度)
- **平衡选择**：使用 `Qwen/Qwen3-Embedding-4B` (2560维度)
- **资源受限**：使用 `Qwen/Qwen3-Embedding-0.6B` (1024维度)

### 方式二：通过系统环境变量

```bash
# 设置系统环境变量
export EMBEDDING_PROVIDER=OpenAI
export EMBEDDING_MODEL=Qwen/Qwen3-Embedding-8B
export OPENAI_API_KEY=your-api-key-here
export OPENAI_BASE_URL=https://your-qwen-api-endpoint
export MILVUS_ADDRESS=your-milvus-endpoint
export MILVUS_TOKEN=your-milvus-token
```

### 方式三：通过VS Code扩展配置

1. 打开VS Code设置
2. 搜索 `semanticCodeSearch`
3. 配置以下项：
   - **Embedding Provider**: 选择 `OpenAI`
   - **Model**: 输入 `Qwen/Qwen3-Embedding-8B`
   - **API Key**: 输入您的API密钥
   - **Base URL**: 输入Qwen API端点

## API端点要求

Qwen嵌入模型需要兼容OpenAI嵌入API格式的端点。确保您的API端点：

1. **支持OpenAI嵌入API格式**：
   ```
   POST /v1/embeddings
   Content-Type: application/json
   Authorization: Bearer your-api-key

   {
     "model": "Qwen/Qwen3-Embedding-8B",
     "input": ["text to embed"],
     "encoding_format": "float"
   }
   ```

2. **返回标准格式**：
   ```json
   {
     "data": [
       {
         "embedding": [0.1, 0.2, ...],
         "index": 0
       }
     ]
   }
   ```

## 启动MCP服务器

配置完成后，启动MCP服务器：

```bash
# 使用npx直接运行（推荐）
npx @ayaka209/claude-context-mcp@latest

# 或者先安装再运行
npm install -g @ayaka209/claude-context-mcp
claude-context-mcp
```

## 验证配置

启动后，您应该看到类似输出：

```
[MCP] 🚀 Starting Context MCP Server
[MCP] Configuration Summary:
[MCP]   Server: Context MCP Server v1.0.0
[MCP]   Embedding Provider: OpenAI
[MCP]   Embedding Model: Qwen/Qwen3-Embedding-8B
[MCP]   Milvus Address: your-milvus-endpoint
[MCP]   OpenAI API Key: ✅ Configured
[MCP]   OpenAI Base URL: https://your-qwen-api-endpoint
[MCP] 🔧 Initializing server components...
```

## 故障排除

### 1. 阿里云DashScope专用问题

#### 批处理大小错误
```
Error: Value error, batch size is invalid, it should not be larger than 10
```
**解决方案**：使用 `text-embedding-v4` 模型，系统会自动处理此限制。

#### 响应格式错误
```
Error: Unexpected embedding response format: expected embedding field
```
**解决方案**：确保使用 `text-embedding-v4` 模型和正确的DashScope端点URL。

### 2. 模型不支持错误
如果遇到模型不支持的错误，Claude Context会自动检测模型维度：
```
[OpenAIEmbedding] ⚠️ getDimension() called for custom model 'your-model' - returning 1536. Call detectDimension() first for accurate dimension.
```

### 3. API连接问题
- **阿里云**：确保使用 `https://dashscope.aliyuncs.com/compatible-mode/v1`
- **通用端点**：检查 `OPENAI_BASE_URL` 是否正确
- 确认API密钥有效
- 验证端点是否支持OpenAI格式

### 4. 维度不匹配
- **阿里云 text-embedding-v4**：固定1024维度
- **其他模型**：系统会自动检测维度，确保向量数据库配置匹配

## 性能优化建议

1. **批处理大小**：根据API限制调整 `EMBEDDING_BATCH_SIZE`
2. **模型选择**：根据精度要求选择合适的模型大小
3. **网络延迟**：选择地理位置较近的API端点

## 示例配置文件

完整的 `~/.context/.env` 示例：

```bash
# Qwen 嵌入模型配置
EMBEDDING_PROVIDER=OpenAI
EMBEDDING_MODEL=Qwen/Qwen3-Embedding-8B
EMBEDDING_BATCH_SIZE=50

# API配置
OPENAI_API_KEY=sk-xxx-your-qwen-api-key
OPENAI_BASE_URL=https://dashscope.aliyuncs.com/v1

# 向量数据库配置（Zilliz Cloud）
MILVUS_TOKEN=your-zilliz-cloud-api-key

# 可选：本地Milvus配置
# MILVUS_ADDRESS=localhost:19530

# 代码分割配置
SPLITTER_TYPE=ast
CUSTOM_EXTENSIONS=.vue,.svelte
CUSTOM_IGNORE_PATTERNS=node_modules/**,dist/**
```

## 相关链接

- [Qwen官方文档](https://qwen.readthedocs.io/)
- [Claude Context官方文档](../README.md)
- [Zilliz Cloud注册](https://cloud.zilliz.com/signup)