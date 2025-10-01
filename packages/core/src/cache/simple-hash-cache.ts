import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

/**
 * Simple file-level hash cache for incremental indexing
 * Stores in <project>/.context/file-hashes.json
 */
export interface FileHashEntry {
    hash: string;           // SHA256 of file content
    lastModified: number;   // Timestamp
    chunkCount: number;     // Number of chunks generated
}

export interface SimpleHashCache {
    projectPath: string;
    collectionName: string;
    lastIndexed: number;
    files: Record<string, FileHashEntry>;  // Key: relative file path
}

export class SimpleHashCacheManager {
    private cacheDir: string;
    private cacheFilePath: string;
    private cache: SimpleHashCache;

    constructor(projectPath: string, collectionName: string) {
        this.cacheDir = path.join(projectPath, '.context');
        this.cacheFilePath = path.join(this.cacheDir, 'file-hashes.json');
        this.ensureCacheDir();
        this.cache = this.loadCache(projectPath, collectionName);
    }

    private ensureCacheDir(): void {
        if (!fs.existsSync(this.cacheDir)) {
            fs.mkdirSync(this.cacheDir, { recursive: true });
        }
    }

    private loadCache(projectPath: string, collectionName: string): SimpleHashCache {
        if (fs.existsSync(this.cacheFilePath)) {
            try {
                const data = fs.readFileSync(this.cacheFilePath, 'utf-8');
                const loaded: SimpleHashCache = JSON.parse(data);

                // Validate cache
                if (loaded.projectPath === projectPath && loaded.collectionName === collectionName) {
                    return loaded;
                }
                console.log('[HashCache] Cache project/collection mismatch, creating new');
            } catch (error) {
                console.warn('[HashCache] Failed to load cache:', error);
            }
        }

        return {
            projectPath,
            collectionName,
            lastIndexed: Date.now(),
            files: {}
        };
    }

    save(): void {
        try {
            this.cache.lastIndexed = Date.now();
            fs.writeFileSync(
                this.cacheFilePath,
                JSON.stringify(this.cache, null, 2),
                'utf-8'
            );
        } catch (error) {
            console.error('[HashCache] Failed to save:', error);
        }
    }

    clear(): void {
        if (fs.existsSync(this.cacheFilePath)) {
            try {
                fs.unlinkSync(this.cacheFilePath);
                console.log('[HashCache] File hash cache cleared');
            } catch (error) {
                console.error('[HashCache] Failed to clear:', error);
            }
        }
    }

    static calculateHash(content: string): string {
        return crypto.createHash('sha256').update(content, 'utf-8').digest('hex');
    }

    hasFileChanged(relativePath: string, currentHash: string): boolean {
        const entry = this.cache.files[relativePath];
        if (!entry) return true;  // New file
        return entry.hash !== currentHash;  // Modified file
    }

    updateFile(relativePath: string, hash: string, chunkCount: number): void {
        this.cache.files[relativePath] = {
            hash,
            lastModified: Date.now(),
            chunkCount
        };
    }

    getDeletedFiles(currentFiles: Set<string>): string[] {
        const cached = Object.keys(this.cache.files);
        return cached.filter(f => !currentFiles.has(f));
    }

    getStats(): { totalFiles: number; totalChunks: number; lastIndexed: Date } {
        const totalFiles = Object.keys(this.cache.files).length;
        const totalChunks = Object.values(this.cache.files)
            .reduce((sum, entry) => sum + entry.chunkCount, 0);

        return {
            totalFiles,
            totalChunks,
            lastIndexed: new Date(this.cache.lastIndexed)
        };
    }
}
