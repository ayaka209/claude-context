# 自定义向量模型测试指南

本文档介绍如何使用提供的脚本测试任意API密钥、模型名称和URL的向量模型可用性。

## 快速开始

### Node.js版本 (推荐，功能完整)

```bash
# 基础用法
pnpm test:custom -- \
  --api-key "your-api-key" \
  --model "your-model-name" \
  --url "https://your-api-endpoint.com/v1"

# 或直接运行脚本
node scripts/test-custom-embedding.js \
  --api-key "your-api-key" \
  --model "your-model-name" \
  --url "https://your-api-endpoint.com/v1"
```

### Shell版本 (快速测试)

```bash
# 基础用法
pnpm test:custom:shell -- \
  --api-key "your-api-key" \
  --model "your-model-name" \
  --url "https://your-api-endpoint.com/v1"

# 或直接运行脚本
bash scripts/test-custom-embedding.sh \
  --api-key "your-api-key" \
  --model "your-model-name" \
  --url "https://your-api-endpoint.com/v1"
```

## 参数说明

### 必需参数

| 参数 | 说明 | 示例 |
|------|------|------|
| `--api-key, -k` | API密钥 | `sk-xxx` |
| `--model, -m` | 模型名称 | `Qwen/Qwen3-Embedding-8B` |
| `--url, -u` | API端点URL | `https://dashscope.aliyuncs.com/v1` |

### 可选参数

| 参数 | 说明 | 默认值 | 示例 |
|------|------|--------|------|
| `--type, -t` | API类型 | `openai` | `openai`, `azure` |
| `--api-version` | Azure API版本 | `2024-02-01` | `2024-02-01` |
| `--text` | 测试文本 | `Hello, this is a test...` | 自定义测试文本 |
| `--basic-only` | 仅基础测试 | false | 跳过扩展测试 |
| `--output, -o` | 报告输出文件 | - | `report.json` |

## 使用示例

### 1. 测试Qwen模型

```bash
# Node.js版本
pnpm test:custom -- \
  --api-key "sk-your-qwen-api-key" \
  --model "Qwen/Qwen3-Embedding-8B" \
  --url "https://dashscope.aliyuncs.com/v1"

# Shell版本
pnpm test:custom:shell -- \
  --api-key "sk-your-qwen-api-key" \
  --model "Qwen/Qwen3-Embedding-8B" \
  --url "https://dashscope.aliyuncs.com/v1"
```

### 2. 测试Azure OpenAI

```bash
# Node.js版本
pnpm test:custom -- \
  --api-key "your-azure-api-key" \
  --model "text-embedding-3-small" \
  --url "https://your-resource.openai.azure.com" \
  --type azure

# Shell版本
pnpm test:custom:shell -- \
  --api-key "your-azure-api-key" \
  --model "text-embedding-3-small" \
  --url "https://your-resource.openai.azure.com" \
  --type azure
```

### 3. 测试本地部署的模型

```bash
# Node.js版本
pnpm test:custom -- \
  --api-key "local-api-key" \
  --model "local-embedding-model" \
  --url "http://localhost:8000/v1" \
  --output "local-test-report.json"

# Shell版本
pnpm test:custom:shell -- \
  --api-key "local-api-key" \
  --model "local-embedding-model" \
  --url "http://localhost:8000/v1" \
  --basic-only
```

### 4. 测试自定义文本

```bash
# 使用中文测试文本
pnpm test:custom -- \
  --api-key "your-api-key" \
  --model "your-model" \
  --url "https://your-endpoint.com/v1" \
  --text "这是一个中文测试文本，用于验证多语言支持。"
```

## 输出示例

### 成功输出 (Node.js版本)

```
🚀 自定义向量模型可用性测试
==================================

📋 测试配置:
   API类型: openai
   模型名称: Qwen/Qwen3-Embedding-8B
   API端点: https://dashscope.aliyuncs.com/v1
   API密钥: sk-xxxx...

🔧 第一步: 基础API测试
🧪 测试OpenAI兼容API...
   模型: Qwen/Qwen3-Embedding-8B
   端点: https://dashscope.aliyuncs.com/v1
   测试文本: Hello, this is a test text for embedding....
   ✅ API调用成功
   📏 向量维度: 4096
   ⏱️  响应延迟: 1247ms
   🔢 向量示例: [0.1234, -0.5678, 0.9012, -0.3456, 0.7890...]
   📊 Token使用: {"prompt_tokens": 8, "total_tokens": 8}

🎯 测试摘要:
   整体状态: ✅ 成功
   向量维度: 4096
   响应延迟: 1247ms

💡 建议:
   ✅ 基础API调用成功
   ✅ 向量维度充足，适合语义搜索
   ⚠️ API响应稍慢，建议优化网络

🎉 测试完成！模型可用于Claude Context。

📝 Claude Context配置示例:
EMBEDDING_PROVIDER=OpenAI
EMBEDDING_MODEL=Qwen/Qwen3-Embedding-8B
OPENAI_API_KEY=sk-your-qwen-api-key
OPENAI_BASE_URL=https://dashscope.aliyuncs.com/v1
```

### 成功输出 (Shell版本)

```
🚀 自定义向量模型可用性测试
==================================

ℹ️  测试配置:
ℹ️    API类型: openai
ℹ️    模型名称: Qwen/Qwen3-Embedding-8B
ℹ️    API端点: https://dashscope.aliyuncs.com/v1
ℹ️    API密钥: sk-xxxx...
ℹ️    测试文本: Hello, this is a test text for embedding....

ℹ️  第一步: 连接测试
ℹ️  测试连接: API端点
ℹ️  URL: https://dashscope.aliyuncs.com/v1
✅ API端点 连接成功

ℹ️  第二步: API功能测试
ℹ️  测试OpenAI兼容API...
ℹ️  模型: Qwen/Qwen3-Embedding-8B
ℹ️  端点: https://dashscope.aliyuncs.com/v1
✅ API调用成功
ℹ️  响应延迟: 1247ms
✅ 向量维度: 4096

ℹ️  测试摘要:
✅ ✅ 向量模型可用

✅ 测试成功！以下是Claude Context配置建议:

# 在 ~/.context/.env 中添加以下配置:
EMBEDDING_PROVIDER=OpenAI
EMBEDDING_MODEL=Qwen/Qwen3-Embedding-8B
OPENAI_API_KEY=sk-your-qwen-api-key
OPENAI_BASE_URL=https://dashscope.aliyuncs.com/v1
```

### 失败输出示例

```
❌ API调用失败 (HTTP 401)
❌ 响应: {"error": {"message": "Invalid API key", "type": "invalid_request_error"}}

❌ ❌ 向量模型不可用

ℹ️  故障排除建议:
- 检查API密钥是否正确
- 验证模型名称是否存在
- 确认API端点URL格式正确
- 检查网络连接和防火墙设置
```

## API兼容性要求

### OpenAI兼容接口

你的API端点需要支持以下格式：

**请求格式：**
```http
POST /embeddings
Content-Type: application/json
Authorization: Bearer your-api-key

{
  "model": "your-model-name",
  "input": ["text to embed"],
  "encoding_format": "float"
}
```

**响应格式：**
```json
{
  "data": [
    {
      "embedding": [0.1, 0.2, 0.3, ...],
      "index": 0
    }
  ],
  "model": "your-model-name",
  "usage": {
    "prompt_tokens": 8,
    "total_tokens": 8
  }
}
```

### Azure OpenAI接口

Azure OpenAI使用不同的URL格式和认证方式：

**URL格式：**
```
https://your-resource.openai.azure.com/openai/deployments/deployment-name/embeddings?api-version=2024-02-01
```

**认证头：**
```http
api-key: your-azure-api-key
```

## 故障排除

### 常见错误及解决方案

#### 1. 连接错误
```
❌ API端点 连接失败
```
**解决方案：**
- 检查URL格式是否正确
- 验证网络连接
- 确认防火墙设置

#### 2. 认证错误
```
❌ API调用失败 (HTTP 401)
```
**解决方案：**
- 验证API密钥正确性
- 检查API密钥权限
- 确认API类型选择正确

#### 3. 模型不存在
```
❌ API调用失败 (HTTP 404)
```
**解决方案：**
- 验证模型名称拼写
- 确认模型在该API提供商中可用
- 检查模型访问权限

#### 4. 响应格式错误
```
❌ 响应格式无效：缺少data数组
```
**解决方案：**
- 确认API兼容OpenAI格式
- 检查API版本设置
- 验证请求参数格式

## 高级功能

### 批量测试多个配置

创建配置文件 `test-configs.json`：

```json
[
  {
    "name": "Qwen-8B",
    "apiKey": "sk-xxx",
    "model": "Qwen/Qwen3-Embedding-8B",
    "url": "https://dashscope.aliyuncs.com/v1"
  },
  {
    "name": "Local-Model",
    "apiKey": "local-key",
    "model": "local-embedding",
    "url": "http://localhost:8000/v1"
  }
]
```

然后编写批量测试脚本：

```bash
#!/bin/bash
for config in $(jq -c '.[]' test-configs.json); do
    name=$(echo $config | jq -r '.name')
    echo "Testing $name..."

    pnpm test:custom:shell -- \
      --api-key "$(echo $config | jq -r '.apiKey')" \
      --model "$(echo $config | jq -r '.model')" \
      --url "$(echo $config | jq -r '.url')" \
      --output "${name}-report.json"
done
```

### 性能基准测试

```bash
# 测试多次调用的平均延迟
for i in {1..5}; do
    echo "Test run $i..."
    pnpm test:custom -- \
      --api-key "your-key" \
      --model "your-model" \
      --url "your-url" \
      --basic-only
done
```

## 相关文档

- [预配置模型测试指南](testing-embedding-models.md)
- [Qwen模型配置指南](qwen-embedding-setup.md)
- [Claude Context主要文档](../README.md)

## 命令参考

```bash
# Node.js版本 (功能完整)
pnpm test:custom -- --help                                    # 显示帮助
node scripts/test-custom-embedding.js --help                  # 显示完整帮助

# Shell版本 (快速测试)
pnpm test:custom:shell -- --help                             # 显示帮助
bash scripts/test-custom-embedding.sh --help                 # 显示完整帮助

# 常用测试模式
pnpm test:custom -- -k KEY -m MODEL -u URL                   # 基础测试
pnpm test:custom -- -k KEY -m MODEL -u URL --basic-only      # 仅基础测试
pnpm test:custom -- -k KEY -m MODEL -u URL -o report.json    # 保存报告
```