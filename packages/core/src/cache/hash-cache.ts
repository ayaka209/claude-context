import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

/**
 * Symbol-level hash information
 */
export interface SymbolHash {
    name: string;           // Symbol name (function/class name)
    startLine: number;      // Start line number
    endLine: number;        // End line number
    contentHash: string;    // Hash of symbol content
}

/**
 * File-level hash information
 */
export interface FileHash {
    filePath: string;       // Relative file path
    fileHash: string;       // Hash of entire file content
    lastModified: number;   // Timestamp
    symbols: SymbolHash[];  // Symbol-level hashes
}

/**
 * Project-level hash cache
 */
export interface HashCache {
    projectPath: string;
    collectionName: string;
    lastIndexed: number;
    files: Record<string, FileHash>;  // Key: relative file path
}

/**
 * Hash cache manager
 * Stores hash information in <project>/.context/hash-cache.json
 */
export class HashCacheManager {
    private cacheDir: string;
    private cacheFilePath: string;
    private cache: HashCache | null = null;

    constructor(projectPath: string, collectionName: string) {
        this.cacheDir = path.join(projectPath, '.context');
        this.cacheFilePath = path.join(this.cacheDir, 'hash-cache.json');
        this.ensureCacheDir();
        this.loadCache(projectPath, collectionName);
    }

    /**
     * Ensure .context directory exists
     */
    private ensureCacheDir(): void {
        if (!fs.existsSync(this.cacheDir)) {
            fs.mkdirSync(this.cacheDir, { recursive: true });
        }
    }

    /**
     * Load cache from disk
     */
    private loadCache(projectPath: string, collectionName: string): void {
        if (fs.existsSync(this.cacheFilePath)) {
            try {
                const data = fs.readFileSync(this.cacheFilePath, 'utf-8');
                this.cache = JSON.parse(data);

                // Validate cache belongs to same project and collection
                if (this.cache?.projectPath !== projectPath ||
                    this.cache?.collectionName !== collectionName) {
                    console.warn('[HashCache] Cache mismatch, creating new cache');
                    this.cache = this.createEmptyCache(projectPath, collectionName);
                }
            } catch (error) {
                console.warn('[HashCache] Failed to load cache, creating new:', error);
                this.cache = this.createEmptyCache(projectPath, collectionName);
            }
        } else {
            this.cache = this.createEmptyCache(projectPath, collectionName);
        }
    }

    /**
     * Create empty cache structure
     */
    private createEmptyCache(projectPath: string, collectionName: string): HashCache {
        return {
            projectPath,
            collectionName,
            lastIndexed: Date.now(),
            files: {}
        };
    }

    /**
     * Save cache to disk
     */
    save(): void {
        if (!this.cache) return;

        try {
            this.cache.lastIndexed = Date.now();
            fs.writeFileSync(
                this.cacheFilePath,
                JSON.stringify(this.cache, null, 2),
                'utf-8'
            );
        } catch (error) {
            console.error('[HashCache] Failed to save cache:', error);
        }
    }

    /**
     * Clear all cache data
     */
    clear(): void {
        if (fs.existsSync(this.cacheFilePath)) {
            try {
                fs.unlinkSync(this.cacheFilePath);
                console.log('[HashCache] Cache cleared');
            } catch (error) {
                console.error('[HashCache] Failed to clear cache:', error);
            }
        }
        this.cache = null;
    }

    /**
     * Calculate file hash
     */
    static calculateFileHash(content: string): string {
        return crypto.createHash('sha256').update(content, 'utf-8').digest('hex');
    }

    /**
     * Calculate symbol hash
     */
    static calculateSymbolHash(content: string): string {
        // Remove whitespace variations for more stable hashing
        const normalized = content.trim().replace(/\s+/g, ' ');
        return crypto.createHash('sha256').update(normalized, 'utf-8').digest('hex');
    }

    /**
     * Get file hash from cache
     */
    getFileHash(relativePath: string): FileHash | null {
        if (!this.cache) return null;
        return this.cache.files[relativePath] || null;
    }

    /**
     * Update file hash in cache
     */
    updateFileHash(fileHash: FileHash): void {
        if (!this.cache) return;
        this.cache.files[fileHash.filePath] = fileHash;
    }

    /**
     * Remove file from cache
     */
    removeFile(relativePath: string): void {
        if (!this.cache) return;
        delete this.cache.files[relativePath];
    }

    /**
     * Check if file has changed
     * Returns true if file is new or modified
     */
    hasFileChanged(relativePath: string, currentHash: string): boolean {
        const cached = this.getFileHash(relativePath);
        if (!cached) return true;  // New file
        return cached.fileHash !== currentHash;  // File modified
    }

    /**
     * Get changed symbols in a file
     * Returns list of symbols that are new or modified
     */
    getChangedSymbols(relativePath: string, currentSymbols: SymbolHash[]): SymbolHash[] {
        const cached = this.getFileHash(relativePath);
        if (!cached) return currentSymbols;  // All symbols are new

        const changed: SymbolHash[] = [];
        const cachedSymbolMap = new Map(
            cached.symbols.map(s => [`${s.name}:${s.startLine}:${s.endLine}`, s])
        );

        for (const symbol of currentSymbols) {
            const key = `${symbol.name}:${symbol.startLine}:${symbol.endLine}`;
            const cachedSymbol = cachedSymbolMap.get(key);

            if (!cachedSymbol || cachedSymbol.contentHash !== symbol.contentHash) {
                changed.push(symbol);
            }
        }

        return changed;
    }

    /**
     * Get all cached file paths
     */
    getCachedFilePaths(): string[] {
        if (!this.cache) return [];
        return Object.keys(this.cache.files);
    }

    /**
     * Get deleted files (files in cache but not in current scan)
     */
    getDeletedFiles(currentFiles: string[]): string[] {
        const cached = this.getCachedFilePaths();
        const currentSet = new Set(currentFiles);
        return cached.filter(f => !currentSet.has(f));
    }

    /**
     * Get cache statistics
     */
    getStats(): { totalFiles: number; totalSymbols: number; lastIndexed: Date } {
        if (!this.cache) {
            return { totalFiles: 0, totalSymbols: 0, lastIndexed: new Date(0) };
        }

        const totalFiles = Object.keys(this.cache.files).length;
        const totalSymbols = Object.values(this.cache.files)
            .reduce((sum, file) => sum + file.symbols.length, 0);

        return {
            totalFiles,
            totalSymbols,
            lastIndexed: new Date(this.cache.lastIndexed)
        };
    }
}
