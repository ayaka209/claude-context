# 自定义维度使用指南

本文档介绍如何在Claude Context中使用支持自定义维度的嵌入模型，特别是text-embedding-v4模型。

## 支持自定义维度的模型

目前支持自定义维度的模型：

| 模型 | 默认维度 | 支持的自定义维度范围 | 技术基础 |
|------|----------|---------------------|----------|
| **text-embedding-v4** | 1024 | 512, 1024, 1536, 2048, 3072+ | MRL (Matryoshka Representation Learning) |

> **注意**: Claude Context中已将text-embedding-v4预配置为2048维度，以提供更好的语义搜索性能。

## 配置方法

### 方法1: 使用预配置的2048维度 (推荐)

直接使用已优化的2048维度配置：

```bash
# ~/.context/.env
EMBEDDING_PROVIDER=OpenAI
EMBEDDING_MODEL=text-embedding-v4
OPENAI_API_KEY=your-api-key
OPENAI_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
```

### 方法2: 程序化配置自定义维度

如果需要其他维度，可以在代码中直接配置：

```typescript
import { OpenAIEmbedding } from '@zilliz/claude-context-core';

// 创建自定义维度的嵌入实例
const embedding = new OpenAIEmbedding({
    model: 'text-embedding-v4',
    apiKey: 'your-api-key',
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    dimensions: 1536  // 自定义维度
});

// 使用示例
const result = await embedding.embed('测试文本');
console.log('向量维度:', result.dimension); // 输出: 1536
```

### 方法3: 扩展配置接口

如果需要在环境变量中支持维度配置，可以扩展配置管理：

```typescript
// 在配置管理器中添加维度支持
interface ExtendedEmbeddingConfig {
    provider: string;
    model: string;
    apiKey: string;
    baseURL?: string;
    dimensions?: number;  // 新增维度配置
}
```

## 维度选择建议

### 性能与精度权衡

| 维度 | 存储需求 | 计算速度 | 搜索精度 | 推荐场景 |
|------|----------|----------|----------|----------|
| 512 | 低 | 最快 | 基础 | 简单相似性匹配 |
| 1024 | 中等 | 快 | 良好 | 一般语义搜索 |
| 1536 | 中等+ | 中等 | 很好 | 精确语义搜索 |
| **2048** | **高** | **中等** | **优秀** | **推荐用于代码搜索** |
| 3072 | 很高 | 慢 | 极佳 | 高精度要求场景 |

### 代码搜索优化

对于代码语义搜索，推荐使用2048维度：

**优势**:
- ✅ 更好的语义理解能力
- ✅ 更准确的代码匹配
- ✅ 支持复杂查询
- ✅ 多语言代码支持

**权衡**:
- ⚠️ 稍高的存储需求
- ⚠️ 略慢的搜索速度

## 测试自定义维度

### 快速测试

```bash
# 测试预配置的2048维度
pnpm test:v4-2048

# 测试其他维度（需要修改脚本）
node scripts/test-custom-embedding.js \
  --api-key "your-key" \
  --model "text-embedding-v4" \
  --url "https://dashscope.aliyuncs.com/compatible-mode/v1" \
  --text "测试自定义维度"
```

### 手动API测试

```bash
# 测试1536维度
curl -X POST "https://dashscope.aliyuncs.com/compatible-mode/v1/embeddings" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -d '{
    "model": "text-embedding-v4",
    "input": ["测试文本"],
    "dimensions": 1536
  }'
```

## Milvus/Zilliz配置

使用自定义维度时，确保向量数据库配置匹配：

### 创建Collection时指定维度

```python
# Milvus集合配置示例
collection_schema = CollectionSchema(
    fields=[
        FieldSchema(name="id", dtype=DataType.INT64, is_primary=True),
        FieldSchema(name="vector", dtype=DataType.FLOAT_VECTOR, dim=2048),  # 匹配嵌入维度
        FieldSchema(name="content", dtype=DataType.VARCHAR, max_length=65535)
    ]
)
```

### 环境变量配置

```bash
# 确保向量数据库支持指定维度
MILVUS_ADDRESS=your-milvus-endpoint
MILVUS_TOKEN=your-token

# 如果使用本地Milvus，确保版本支持高维度向量
```

## 性能优化建议

### 1. 向量数据库优化

```bash
# Milvus索引配置优化
index_params = {
    "metric_type": "COSINE",
    "index_type": "IVF_FLAT",
    "params": {"nlist": 1024}  # 根据数据量调整
}
```

### 2. 批处理优化

```typescript
// 批量处理以提高效率
const texts = ['text1', 'text2', 'text3'];
const embeddings = await embedding.embedBatch(texts);
```

### 3. 缓存策略

```typescript
// 实现嵌入结果缓存
const cache = new Map();
function getCachedEmbedding(text) {
    if (cache.has(text)) {
        return cache.get(text);
    }
    const result = await embedding.embed(text);
    cache.set(text, result);
    return result;
}
```

## 故障排除

### 常见问题

#### 1. 维度不匹配错误
```
Error: Vector dimension mismatch: expected 1536, got 2048
```
**解决方案**: 确保向量数据库集合维度与嵌入模型维度一致。

#### 2. API不支持dimensions参数
```
Error: Unknown parameter 'dimensions'
```
**解决方案**: 确认API端点支持dimensions参数，某些兼容性API可能不支持。

#### 3. 内存使用过高
```
Warning: High memory usage detected
```
**解决方案**: 考虑降低维度或实现分批处理。

### 调试技巧

```typescript
// 启用详细日志
console.log('Config:', {
    model: embedding.config.model,
    dimensions: embedding.config.dimensions,
    actualDimension: embedding.getDimension()
});

// 验证向量质量
const vector = result.vector;
console.log('Vector stats:', {
    length: vector.length,
    min: Math.min(...vector),
    max: Math.max(...vector),
    mean: vector.reduce((a, b) => a + b) / vector.length
});
```

## 最佳实践

### 1. 开发环境
- 使用较低维度(1024)进行快速开发和测试
- 生产环境使用优化维度(2048)

### 2. 生产部署
- 预先测试所选维度的性能
- 监控存储和计算资源使用
- 建立维度变更的迁移策略

### 3. 数据迁移
```bash
# 维度变更时的数据迁移策略
1. 创建新的集合（新维度）
2. 重新生成所有嵌入向量
3. 验证搜索质量
4. 切换到新集合
5. 清理旧数据
```

## 相关文档

- [text-embedding-v4测试指南](test-custom-embedding.md)
- [Qwen模型配置指南](qwen-embedding-setup.md)
- [向量数据库配置文档](../README.md)

## 技术支持

如果遇到自定义维度相关问题：

1. 检查模型是否支持MRL技术
2. 验证API端点兼容性
3. 确认向量数据库配置
4. 运行测试脚本进行诊断

```bash
# 运行完整诊断
pnpm test:v4-2048
pnpm test:embedding:full
```