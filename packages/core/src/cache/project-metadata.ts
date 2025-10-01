import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

/**
 * Project-level metadata stored in project directory
 * This file should be committed to git for team sharing
 */
export interface ProjectMetadata {
    version: string;                    // Metadata format version
    projectPath: string;                // Absolute path (for validation)
    collectionName: string;             // Vector database collection name
    gitRepoIdentifier?: string;         // Git repository identifier (if available)
    isHybrid: boolean;                  // Whether using hybrid search
    embeddingModel: string;             // Embedding model used
    embeddingDimension: number;         // Embedding vector dimension
    createdAt: number;                  // First index timestamp
    lastIndexed: number;                // Last successful index timestamp
    indexedFileCount: number;           // Number of files indexed
    totalChunks: number;                // Total number of chunks
}

/**
 * Manages project-level metadata in .context/project.json
 * This file contains team-shareable information about the indexed project
 */
export class ProjectMetadataManager {
    private metadataDir: string;
    private metadataFilePath: string;
    private metadata: ProjectMetadata | null = null;

    constructor(projectPath: string) {
        this.metadataDir = path.join(projectPath, '.context');
        this.metadataFilePath = path.join(this.metadataDir, 'project.json');
        this.ensureMetadataDir();
        this.loadMetadata(projectPath);
    }

    /**
     * Ensure .context directory exists
     */
    private ensureMetadataDir(): void {
        if (!fs.existsSync(this.metadataDir)) {
            fs.mkdirSync(this.metadataDir, { recursive: true });
        }
    }

    /**
     * Load metadata from disk
     */
    private loadMetadata(projectPath: string): void {
        if (fs.existsSync(this.metadataFilePath)) {
            try {
                const data = fs.readFileSync(this.metadataFilePath, 'utf-8');
                const loaded: ProjectMetadata = JSON.parse(data);

                // Validate metadata version
                if (loaded.version !== '1.0') {
                    console.warn('[ProjectMetadata] Metadata version mismatch, will be upgraded on save');
                }

                // Validate project path (allow some flexibility for moved projects)
                const normalizedCurrent = path.resolve(projectPath);
                const normalizedStored = path.resolve(loaded.projectPath);
                if (normalizedCurrent !== normalizedStored) {
                    console.log('[ProjectMetadata] Project path changed, updating metadata');
                    loaded.projectPath = normalizedCurrent;
                }

                this.metadata = loaded;
            } catch (error) {
                console.warn('[ProjectMetadata] Failed to load metadata, will create new:', error);
                this.metadata = null;
            }
        }
    }

    /**
     * Save metadata to disk
     */
    save(): void {
        if (!this.metadata) {
            console.warn('[ProjectMetadata] No metadata to save');
            return;
        }

        try {
            this.metadata.version = '1.0';
            this.metadata.lastIndexed = Date.now();

            fs.writeFileSync(
                this.metadataFilePath,
                JSON.stringify(this.metadata, null, 2),
                'utf-8'
            );
            console.log('[ProjectMetadata] 💾 Metadata saved');
        } catch (error) {
            console.error('[ProjectMetadata] Failed to save metadata:', error);
        }
    }

    /**
     * Clear metadata file
     */
    clear(): void {
        if (fs.existsSync(this.metadataFilePath)) {
            try {
                fs.unlinkSync(this.metadataFilePath);
                console.log('[ProjectMetadata] ✅ Metadata cleared');
            } catch (error) {
                console.error('[ProjectMetadata] Failed to clear metadata:', error);
            }
        }
        this.metadata = null;
    }

    /**
     * Check if metadata exists
     */
    exists(): boolean {
        return this.metadata !== null;
    }

    /**
     * Get collection name from metadata (if exists)
     */
    getCollectionName(): string | null {
        return this.metadata?.collectionName || null;
    }

    /**
     * Get metadata
     */
    getMetadata(): ProjectMetadata | null {
        return this.metadata;
    }

    /**
     * Initialize or update metadata
     */
    initializeOrUpdate(params: {
        projectPath: string;
        collectionName: string;
        gitRepoIdentifier?: string;
        isHybrid: boolean;
        embeddingModel: string;
        embeddingDimension: number;
        indexedFileCount: number;
        totalChunks: number;
    }): void {
        const now = Date.now();

        if (this.metadata) {
            // Update existing metadata
            this.metadata.projectPath = params.projectPath;
            this.metadata.collectionName = params.collectionName;
            this.metadata.gitRepoIdentifier = params.gitRepoIdentifier;
            this.metadata.isHybrid = params.isHybrid;
            this.metadata.embeddingModel = params.embeddingModel;
            this.metadata.embeddingDimension = params.embeddingDimension;
            this.metadata.lastIndexed = now;
            this.metadata.indexedFileCount = params.indexedFileCount;
            this.metadata.totalChunks = params.totalChunks;
        } else {
            // Create new metadata
            this.metadata = {
                version: '1.0',
                projectPath: params.projectPath,
                collectionName: params.collectionName,
                gitRepoIdentifier: params.gitRepoIdentifier,
                isHybrid: params.isHybrid,
                embeddingModel: params.embeddingModel,
                embeddingDimension: params.embeddingDimension,
                createdAt: now,
                lastIndexed: now,
                indexedFileCount: params.indexedFileCount,
                totalChunks: params.totalChunks
            };
        }
    }

    /**
     * Generate collection name (static method for initial creation)
     */
    static generateCollectionName(
        projectPath: string,
        isHybrid: boolean,
        gitRepoIdentifier?: string | null
    ): string {
        const prefix = isHybrid ? 'hybrid_code_chunks' : 'code_chunks';

        if (gitRepoIdentifier) {
            // Git-based naming
            const cleanIdentifier = gitRepoIdentifier
                .replace(/[^a-zA-Z0-9]/g, '_')
                .toLowerCase()
                .substring(0, 32);
            const hash = crypto.createHash('md5').update(gitRepoIdentifier).digest('hex');
            return `${prefix}_git_${cleanIdentifier}_${hash.substring(0, 8)}`;
        }

        // Path-based naming
        const normalizedPath = path.resolve(projectPath);
        const hash = crypto.createHash('md5').update(normalizedPath).digest('hex');
        return `${prefix}_${hash.substring(0, 8)}`;
    }

    /**
     * Validate metadata against current configuration
     */
    validateAgainstConfig(
        isHybrid: boolean,
        embeddingModel: string,
        embeddingDimension: number
    ): { valid: boolean; warnings: string[] } {
        if (!this.metadata) {
            return { valid: true, warnings: [] };
        }

        const warnings: string[] = [];

        if (this.metadata.isHybrid !== isHybrid) {
            warnings.push(
                `Search mode mismatch: metadata has ${this.metadata.isHybrid ? 'hybrid' : 'regular'}, ` +
                `current config is ${isHybrid ? 'hybrid' : 'regular'}`
            );
        }

        if (this.metadata.embeddingModel !== embeddingModel) {
            warnings.push(
                `Embedding model mismatch: metadata has '${this.metadata.embeddingModel}', ` +
                `current config is '${embeddingModel}'`
            );
        }

        if (this.metadata.embeddingDimension !== embeddingDimension) {
            warnings.push(
                `Embedding dimension mismatch: metadata has ${this.metadata.embeddingDimension}D, ` +
                `current config is ${embeddingDimension}D`
            );
        }

        return {
            valid: warnings.length === 0,
            warnings
        };
    }
}
