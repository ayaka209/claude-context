import OpenAI from 'openai';
import { Embedding, EmbeddingVector } from './base-embedding';

export interface OpenAIEmbeddingConfig {
    model: string;
    apiKey: string;
    baseURL?: string; // OpenAI supports custom baseURL
    dimensions?: number; // Custom dimensions for models that support it (e.g., text-embedding-v4)
}

export class OpenAIEmbedding extends Embedding {
    private client: OpenAI;
    private config: OpenAIEmbeddingConfig;
    private dimension: number = 1536; // Default dimension for text-embedding-3-small
    protected maxTokens: number = 8192; // Maximum tokens for OpenAI embedding models

    constructor(config: OpenAIEmbeddingConfig) {
        super();
        this.config = config;
        this.client = new OpenAI({
            apiKey: config.apiKey,
            baseURL: config.baseURL,
        });

        // Set dimension and context length based on model
        this.updateModelSettings(config.model || 'text-embedding-3-small');
    }

    private updateModelSettings(model: string): void {
        const supportedModels = OpenAIEmbedding.getSupportedModels();
        const modelInfo = supportedModels[model];

        if (modelInfo) {
            // Use custom dimensions if specified, otherwise use model default
            this.dimension = this.config.dimensions || modelInfo.dimension;
            this.maxTokens = modelInfo.contextLength;
        } else {
            // Use custom dimensions if specified, otherwise use default
            this.dimension = this.config.dimensions || 1536;
            this.maxTokens = 8192;
        }
    }

    async detectDimension(testText: string = "test"): Promise<number> {
        const model = this.config.model || 'text-embedding-3-small';
        const knownModels = OpenAIEmbedding.getSupportedModels();

        // If custom dimensions specified, use that
        if (this.config.dimensions) {
            return this.config.dimensions;
        }

        // Use known dimension for standard models
        if (knownModels[model]) {
            return knownModels[model].dimension;
        }

        // For custom models, make API call to detect dimension
        try {
            const processedText = this.preprocessText(testText);
            const embedRequest: any = {
                model: model,
                input: processedText,
                encoding_format: 'float',
            };

            // Add dimensions parameter if specified (for models that support it like text-embedding-v4)
            if (this.config.dimensions) {
                embedRequest.dimensions = this.config.dimensions;
            }

            const response = await this.client.embeddings.create(embedRequest);

            // Handle different response formats (OpenAI vs Alibaba Cloud/DashScope)
            const firstItem = response.data[0];
            const isAlibaba = this.config.baseURL?.includes('dashscope.aliyuncs.com');

            if (isAlibaba && (firstItem as any).vector) {
                // Alibaba Cloud/DashScope format: { data: [{ vector: [...] }] }
                return (firstItem as any).vector.length;
            } else if (firstItem.embedding) {
                // Standard OpenAI format: { data: [{ embedding: [...] }] }
                return firstItem.embedding.length;
            } else {
                throw new Error(`Unexpected embedding response format: expected ${isAlibaba ? 'vector' : 'embedding'} field`);
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';

            // Re-throw authentication errors
            if (errorMessage.includes('API key') || errorMessage.includes('unauthorized') || errorMessage.includes('authentication')) {
                throw new Error(`Failed to detect dimension for model ${model}: ${errorMessage}`);
            }

            // For other errors, throw exception instead of using fallback
            throw new Error(`Failed to detect dimension for model ${model}: ${errorMessage}`);
        }
    }

    async embed(text: string): Promise<EmbeddingVector> {
        const processedText = this.preprocessText(text);
        const model = this.config.model || 'text-embedding-3-small';

        const knownModels = OpenAIEmbedding.getSupportedModels();
        if (knownModels[model] && this.dimension !== knownModels[model].dimension) {
            this.dimension = knownModels[model].dimension;
        } else if (!knownModels[model]) {
            this.dimension = await this.detectDimension();
        }

        try {
            const embedRequest: any = {
                model: model,
                input: processedText,
                encoding_format: 'float',
            };

            // Add dimensions parameter if specified (for models that support it like text-embedding-v4)
            if (this.config.dimensions) {
                embedRequest.dimensions = this.config.dimensions;
            }

            const response = await this.client.embeddings.create(embedRequest);

            // Handle different response formats (OpenAI vs Alibaba Cloud/DashScope)
            let embeddingVector: number[];
            const firstItem = response.data[0];
            const isAlibaba = this.config.baseURL?.includes('dashscope.aliyuncs.com');

            if (isAlibaba && (firstItem as any).vector) {
                // Alibaba Cloud/DashScope format: { data: [{ vector: [...] }] }
                embeddingVector = (firstItem as any).vector;
            } else if (firstItem.embedding) {
                // Standard OpenAI format: { data: [{ embedding: [...] }] }
                embeddingVector = firstItem.embedding;
            } else {
                throw new Error(`Unexpected embedding response format: expected ${isAlibaba ? 'vector' : 'embedding'} field`);
            }

            // Update dimension from actual response
            this.dimension = embeddingVector.length;

            return {
                vector: embeddingVector,
                dimension: this.dimension
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            throw new Error(`Failed to generate OpenAI embedding: ${errorMessage}`);
        }
    }

    async embedBatch(texts: string[]): Promise<EmbeddingVector[]> {
        // Check for Alibaba Cloud/DashScope limitations
        const isAlibaba = this.config.baseURL?.includes('dashscope.aliyuncs.com');
        const maxBatchSize = isAlibaba ? 10 : texts.length; // Alibaba Cloud has a batch size limit of 10

        if (texts.length > maxBatchSize) {
            // Split into smaller batches for providers with limitations
            const results: EmbeddingVector[] = [];
            for (let i = 0; i < texts.length; i += maxBatchSize) {
                const batch = texts.slice(i, i + maxBatchSize);
                const batchResults = await this.embedBatch(batch);
                results.push(...batchResults);
            }
            return results;
        }

        const processedTexts = this.preprocessTexts(texts);
        const model = this.config.model || 'text-embedding-3-small';

        const knownModels = OpenAIEmbedding.getSupportedModels();
        if (knownModels[model] && this.dimension !== knownModels[model].dimension) {
            this.dimension = knownModels[model].dimension;
        } else if (!knownModels[model]) {
            this.dimension = await this.detectDimension();
        }

        try {
            const embedRequest: any = {
                model: model,
                input: processedTexts,
                encoding_format: 'float',
            };

            // Add dimensions parameter if specified (for models that support it like text-embedding-v4)
            if (this.config.dimensions) {
                embedRequest.dimensions = this.config.dimensions;
            }

            const response = await this.client.embeddings.create(embedRequest);

            // Handle different response formats (OpenAI vs Alibaba Cloud/DashScope)
            const firstItem = response.data[0];
            const isAlibaba = this.config.baseURL?.includes('dashscope.aliyuncs.com');
            let embeddingVector: number[];

            if (isAlibaba && (firstItem as any).vector) {
                // Alibaba Cloud/DashScope format: { data: [{ vector: [...] }] }
                embeddingVector = (firstItem as any).vector;
                this.dimension = embeddingVector.length;

                return response.data.map((item) => ({
                    vector: (item as any).vector,
                    dimension: this.dimension
                }));
            } else if (firstItem.embedding) {
                // Standard OpenAI format: { data: [{ embedding: [...] }] }
                embeddingVector = firstItem.embedding;
                this.dimension = embeddingVector.length;

                return response.data.map((item) => ({
                    vector: item.embedding,
                    dimension: this.dimension
                }));
            } else {
                throw new Error(`Unexpected embedding response format: expected ${isAlibaba ? 'vector' : 'embedding'} field`);
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            throw new Error(`Failed to generate OpenAI batch embeddings: ${errorMessage}`);
        }
    }

    getDimension(): number {
        // For custom models, we need to detect the dimension first
        const model = this.config.model || 'text-embedding-3-small';
        const knownModels = OpenAIEmbedding.getSupportedModels();

        // If it's a known model, return its known dimension
        if (knownModels[model]) {
            return knownModels[model].dimension;
        }

        // For custom models, return the current dimension
        // Note: This may be incorrect until detectDimension() is called
        console.warn(`[OpenAIEmbedding] getDimension() called for custom model '${model}' - returning ${this.dimension}. Call detectDimension() first for accurate dimension.`);
        return this.dimension;
    }

    getProvider(): string {
        return 'OpenAI';
    }

    /**
     * Set model type
     * @param model Model name
     */
    async setModel(model: string): Promise<void> {
        this.config.model = model;
        const knownModels = OpenAIEmbedding.getSupportedModels();
        if (knownModels[model]) {
            this.dimension = knownModels[model].dimension;
            this.maxTokens = knownModels[model].contextLength;
        } else {
            this.dimension = await this.detectDimension();
            // Use default maxTokens for unknown models
            this.maxTokens = 8192;
        }
    }

    /**
     * Get client instance (for advanced usage)
     */
    getClient(): OpenAI {
        return this.client;
    }

    /**
     * Get list of supported models
     */
    static getSupportedModels(): Record<string, { dimension: number; contextLength: number; description: string }> {
        return {
            'text-embedding-3-small': {
                dimension: 1536,
                contextLength: 8192,
                description: 'High performance and cost-effective embedding model (recommended)'
            },
            'text-embedding-3-large': {
                dimension: 3072,
                contextLength: 8192,
                description: 'Highest performance embedding model with larger dimensions'
            },
            'text-embedding-ada-002': {
                dimension: 1536,
                contextLength: 8192,
                description: 'Legacy model (use text-embedding-3-small instead)'
            },
            'Qwen/Qwen3-Embedding-8B': {
                dimension: 4096,
                contextLength: 32000,
                description: 'Qwen3 8B embedding model with 4096 dimensions (32k context)'
            },
            'Qwen/Qwen3-Embedding-4B': {
                dimension: 2560,
                contextLength: 32000,
                description: 'Qwen3 4B embedding model with 2560 dimensions (32k context)'
            },
            'Qwen/Qwen3-Embedding-0.6B': {
                dimension: 1024,
                contextLength: 32000,
                description: 'Qwen3 0.6B embedding model with 1024 dimensions (32k context)'
            },
            'text-embedding-v4': {
                dimension: 1024,
                contextLength: 32000,
                description: 'Qwen text-embedding-v4 model (Alibaba Cloud/DashScope) - 1024 dimensions, requires dashscope.aliyuncs.com baseURL'
            }
        };
    }
} 