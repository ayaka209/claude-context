# 向量模型测试指南

本文档介绍如何使用提供的脚本和命令来测试向量模型的可用性。

## 可用的测试方法

### 1. 快速环境检查 (推荐)

```bash
# 快速检查环境配置和网络连接
pnpm test:embedding:quick

# 或直接运行
bash scripts/test-embedding.sh
```

**功能：**
- ✅ 检查必要工具 (Node.js, pnpm, curl)
- ✅ 验证环境变量配置
- ✅ 测试API端点网络连接
- ✅ 检查Milvus/Zilliz连接
- ⚡ 快速执行，无需构建

### 2. 完整模型测试

```bash
# 完整测试，包括实际API调用
pnpm test:embedding:full

# 或直接运行
bash scripts/test-embedding.sh --full-test
```

**功能：**
- ✅ 包含快速检查的所有功能
- ✅ 构建核心包
- ✅ 实际调用嵌入API
- ✅ 测试向量维度检测
- ✅ 测量API延迟
- ✅ 生成详细测试报告

### 3. Node.js详细测试

```bash
# 纯Node.js测试脚本
pnpm test:embedding

# 或直接运行
node scripts/test-embedding.js
```

**功能：**
- ✅ 支持所有嵌入提供商
- ✅ 批量测试多个模型
- ✅ 详细错误诊断
- ✅ JSON格式报告
- ✅ 性能指标收集

### 4. 生成配置模板

```bash
# 生成环境变量配置模板
pnpm test:embedding:template

# 或直接运行
bash scripts/test-embedding.sh --template
```

**生成文件：** `~/.context/.env.example`

## 支持的嵌入提供商

| 提供商 | 必需环境变量 | 可选环境变量 | 测试状态 |
|-------|-------------|-------------|---------|
| **OpenAI** | `OPENAI_API_KEY` | `OPENAI_BASE_URL` | ✅ 完全支持 |
| **Qwen** | `OPENAI_API_KEY`<br/>`OPENAI_BASE_URL` | - | ✅ 完全支持 |
| **Azure OpenAI** | `AZURE_OPENAI_API_KEY`<br/>`AZURE_OPENAI_ENDPOINT` | `AZURE_OPENAI_API_VERSION`<br/>`AZURE_OPENAI_DEPLOYMENT_NAME` | ✅ 完全支持 |
| **VoyageAI** | `VOYAGEAI_API_KEY` | - | ✅ 完全支持 |
| **Gemini** | `GEMINI_API_KEY` | `GEMINI_BASE_URL` | ✅ 完全支持 |
| **Ollama** | - | `OLLAMA_HOST`<br/>`OLLAMA_MODEL` | ✅ 完全支持 |

## 测试输出示例

### 快速检查输出
```bash
$ pnpm test:embedding:quick

🚀 向量模型可用性测试
========================

🔍 检查先决条件...
✅ node 已安装
✅ pnpm 已安装
✅ curl 已安装

📋 加载环境文件: /home/user/.context/.env

🤖 检查OpenAI配置...
✅ OpenAI API Key: ✓ [长度: 51]
ℹ️  使用自定义端点: https://dashscope.aliyuncs.com/v1
✅ OpenAI配置完整
✅ 自定义OpenAI端点 连接成功

🗄️  检查Milvus配置...
✅ Milvus Token (Zilliz Cloud): ✓ [长度: 44]
✅ 至少有一个嵌入提供商已配置
```

### 完整测试输出
```json
{
  "timestamp": "2025-01-XX",
  "summary": {
    "totalProviders": 6,
    "configuredProviders": 2,
    "successfulConnections": 2
  },
  "connectionTest": [
    {
      "provider": "OpenAI",
      "success": true,
      "dimensions": {
        "Qwen/Qwen3-Embedding-8B": 4096
      },
      "latency": 1247
    }
  ],
  "recommendations": [
    {
      "type": "success",
      "message": "可用的提供商: OpenAI, Ollama"
    }
  ]
}
```

## 常见问题排除

### 1. 环境变量未找到
```bash
⚠️  OpenAI API Key: ✗ [未设置]
```
**解决方案：**
- 运行 `pnpm test:embedding:template` 生成配置模板
- 编辑 `~/.context/.env` 文件添加缺失的环境变量

### 2. 网络连接失败
```bash
❌ OpenAI官方API 连接失败
```
**解决方案：**
- 检查网络连接
- 确认API端点URL正确
- 验证防火墙设置

### 3. API调用失败
```bash
❌ 测试失败: Failed to generate OpenAI embedding: API key invalid
```
**解决方案：**
- 验证API密钥有效性
- 检查API额度是否充足
- 确认模型名称正确

### 4. Milvus连接问题
```bash
⚠️  Milvus服务端口不可达
```
**解决方案：**
- 确认Milvus服务正在运行
- 检查端口配置 (默认19530)
- 验证Zilliz Cloud令牌

## 最佳实践

### 开发环境设置
1. **生成配置模板**：`pnpm test:embedding:template`
2. **编辑配置文件**：`~/.context/.env`
3. **快速验证**：`pnpm test:embedding:quick`
4. **完整测试**：`pnpm test:embedding:full`

### 生产环境验证
1. **设置环境变量**：在系统级别设置
2. **运行完整测试**：`pnpm test:embedding`
3. **保存报告**：用于故障排除

### CI/CD集成
```yaml
# 示例GitHub Actions
- name: Test Embedding Models
  run: |
    pnpm test:embedding:quick
  env:
    OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
    MILVUS_TOKEN: ${{ secrets.MILVUS_TOKEN }}
```

## 相关文档

- [Qwen嵌入模型配置指南](qwen-embedding-setup.md)
- [项目主要文档](../README.md)
- [环境变量配置文档](getting-started/environment-variables.md)

## 命令参考

```bash
# 测试命令
pnpm test:embedding:quick       # 快速环境检查
pnpm test:embedding:full        # 完整功能测试
pnpm test:embedding             # Node.js详细测试
pnpm test:embedding:template    # 生成配置模板

# 脚本参数
bash scripts/test-embedding.sh --help          # 显示帮助
bash scripts/test-embedding.sh --check-only    # 仅检查配置
node scripts/test-embedding.js --help          # Node.js脚本帮助
```