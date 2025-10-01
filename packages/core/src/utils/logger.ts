/**
 * 索引日志系统
 * 将日志写入Claude Context配置目录，避免污染目标项目
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface LogEntry {
    timestamp: string;
    level: 'info' | 'warn' | 'error' | 'debug';
    project: string;
    message: string;
    data?: any;
}

export class IndexLogger {
    private logDir: string;
    private logFile: string;
    private projectName: string;

    constructor(projectPath: string) {
        // Use Claude Context config directory for logs
        this.logDir = path.join(os.homedir(), '.context', 'logs');
        this.projectName = path.basename(projectPath);

        // Create timestamped log file name
        const timestamp = new Date().toISOString().replace(/[:]/g, '-').split('.')[0];
        this.logFile = path.join(this.logDir, `index-${this.projectName}-${timestamp}.log`);

        // Ensure log directory exists
        this.ensureLogDirectory();

        // Initialize log file
        this.log('info', `Starting project indexing: ${projectPath}`);
    }

    private ensureLogDirectory(): void {
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
    }

    private writeLog(entry: LogEntry): void {
        const logLine = JSON.stringify(entry) + '\n';

        try {
            fs.appendFileSync(this.logFile, logLine);
        } catch (error) {
            // If writing fails, at least output to console
            console.error(`[Logger] Failed to write log: ${(error as Error).message}`);
            console.log(`[${entry.level.toUpperCase()}] ${entry.message}`);
        }
    }

    public log(level: LogEntry['level'], message: string, data?: any): void {
        const entry: LogEntry = {
            timestamp: new Date().toISOString(),
            level,
            project: this.projectName,
            message,
            data
        };

        this.writeLog(entry);

        // Also output to console (with colors)
        const levelColors = {
            info: '\x1b[36m',    // cyan
            warn: '\x1b[33m',    // yellow
            error: '\x1b[31m',   // red
            debug: '\x1b[90m'    // gray
        };

        const resetColor = '\x1b[0m';
        const color = levelColors[level] || '';

        console.log(`${color}[${level.toUpperCase()}]${resetColor} ${message}`);

        if (data && level !== 'debug') {
            console.log('  ', JSON.stringify(data, null, 2));
        }
    }

    public info(message: string, data?: any): void {
        this.log('info', message, data);
    }

    public warn(message: string, data?: any): void {
        this.log('warn', message, data);
    }

    public error(message: string, data?: any): void {
        this.log('error', message, data);
    }

    public debug(message: string, data?: any): void {
        this.log('debug', message, data);
    }

    public getLogFile(): string {
        return this.logFile;
    }

    public static getLogDirectory(): string {
        return path.join(os.homedir(), '.context', 'logs');
    }

    /**
     * Get the latest log file for a project
     */
    public static getLatestLogFile(projectPath: string): string | null {
        const logDir = IndexLogger.getLogDirectory();
        const projectName = path.basename(projectPath);

        if (!fs.existsSync(logDir)) {
            return null;
        }

        try {
            const files = fs.readdirSync(logDir)
                .filter(file => file.startsWith(`index-${projectName}-`) && file.endsWith('.log'))
                .map(file => ({
                    name: file,
                    path: path.join(logDir, file),
                    mtime: fs.statSync(path.join(logDir, file)).mtime
                }))
                .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

            return files.length > 0 ? files[0].path : null;
        } catch (error) {
            return null;
        }
    }

    /**
     * Clean old log files (keep recent 7 days)
     */
    public static cleanOldLogs(): void {
        const logDir = IndexLogger.getLogDirectory();

        if (!fs.existsSync(logDir)) {
            return;
        }

        const cutoffTime = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 days ago

        try {
            const files = fs.readdirSync(logDir)
                .filter(file => file.startsWith('index-') && file.endsWith('.log'));

            let deletedCount = 0;
            for (const file of files) {
                const filePath = path.join(logDir, file);
                const stats = fs.statSync(filePath);

                if (stats.mtime.getTime() < cutoffTime) {
                    fs.unlinkSync(filePath);
                    deletedCount++;
                }
            }

            if (deletedCount > 0) {
                console.log(`[Logger] Cleaned ${deletedCount} old log files`);
            }
        } catch (error) {
            console.warn(`Error cleaning log files: ${(error as Error).message}`);
        }
    }
}