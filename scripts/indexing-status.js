#!/usr/bin/env node

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

function showHelp() {
    console.log(`
Indexing Status Checker
=======================

Usage:
  node scripts/indexing-status.js [options]

Options:
  --processes                    Show running indexing processes
  --projects                     Show project indexing status
  --all                         Show both processes and projects (default)
  --help, -h                    Show this help message

Examples:
  node scripts/indexing-status.js
  node scripts/indexing-status.js --processes
  node scripts/indexing-status.js --projects
`);
}

function findRunningProcesses() {
    return new Promise((resolve) => {
        const command = os.platform() === 'win32'
            ? 'powershell "Get-WmiObject Win32_Process | Where-Object { $_.CommandLine -like \'*@ayaka209/claude-context-mcp*\' -or $_.CommandLine -like \'*index-project.js*\' } | Select-Object ProcessId,CommandLine | ConvertTo-Json"'
            : 'ps aux | grep -E "(claude-context-mcp|index-project\\.js)" | grep -v grep';

        exec(command, (error, stdout, stderr) => {
            if (error) {
                resolve([]);
                return;
            }

            const processes = [];

            if (os.platform() === 'win32') {
                // Parse Windows PowerShell JSON output
                try {
                    let processData = JSON.parse(stdout);

                    // Handle single process vs array
                    if (!Array.isArray(processData)) {
                        processData = [processData];
                    }

                    processData.forEach(proc => {
                        if (proc && proc.ProcessId && proc.CommandLine) {
                            let projectName = 'unknown';
                            const projectMatch = proc.CommandLine.match(/index-project\.js["\s]+([^"\s]+)/);
                            if (projectMatch) {
                                projectName = path.basename(projectMatch[1]);
                            } else if (proc.CommandLine.includes('claude-context-mcp')) {
                                projectName = 'mcp-server';
                            }

                            processes.push({
                                pid: parseInt(proc.ProcessId),
                                command: proc.CommandLine,
                                projectName,
                                startTime: new Date().toISOString() // Approximation
                            });
                        }
                    });
                } catch (parseError) {
                    // If JSON parsing fails, no processes found
                }
            } else {
                const lines = stdout.split('\n').filter(line => line.trim());

                lines.forEach(line => {
                    const parts = line.trim().split(/\s+/);
                    if (parts.length >= 11) {
                        const pid = parseInt(parts[1]);
                        const command = parts.slice(10).join(' ');

                        let projectName = 'unknown';
                        const projectMatch = command.match(/index-project\.js\s+([^\s]+)/);
                        if (projectMatch) {
                            projectName = path.basename(projectMatch[1]);
                        } else if (command.includes('claude-context-mcp')) {
                            projectName = 'mcp-server';
                        }

                        processes.push({
                            pid,
                            command,
                            projectName,
                            startTime: new Date().toISOString()
                        });
                    }
                });
            }

            resolve(processes);
        });
    });
}

function getProjectStatus() {
    const snapshotPath = path.join(os.homedir(), '.context', 'mcp-codebase-snapshot.json');

    if (!fs.existsSync(snapshotPath)) {
        return [];
    }

    try {
        const content = fs.readFileSync(snapshotPath, 'utf8');
        const snapshot = JSON.parse(content);

        if (!snapshot.codebases) return [];

        const projects = [];

        if (Array.isArray(snapshot.codebases)) {
            // v1 format
            snapshot.codebases.forEach(codebase => {
                projects.push({
                    name: path.basename(codebase.path || codebase.rootPath || 'unknown'),
                    path: codebase.path || codebase.rootPath,
                    status: codebase.status || 'unknown',
                    progress: codebase.progress || 0,
                    lastUpdated: codebase.lastUpdated || 'unknown'
                });
            });
        } else if (typeof snapshot.codebases === 'object') {
            // v2 format
            Object.entries(snapshot.codebases).forEach(([projectPath, data]) => {
                projects.push({
                    name: path.basename(projectPath),
                    path: projectPath,
                    status: data.status || 'unknown',
                    progress: data.progress || 0,
                    lastUpdated: data.lastUpdated || 'unknown'
                });
            });
        }

        return projects;
    } catch (error) {
        console.warn(`⚠️  Could not read project status: ${error.message}`);
        return [];
    }
}

async function showProcessStatus() {
    console.log('🔄 Running Indexing Processes');
    console.log('==============================\n');

    const processes = await findRunningProcesses();

    if (processes.length === 0) {
        console.log('✅ No indexing processes currently running\n');
        return;
    }

    processes.forEach((proc, index) => {
        console.log(`${index + 1}. Project: ${proc.projectName}`);
        console.log(`   PID: ${proc.pid}`);
        console.log(`   Status: 🟢 Running`);
        console.log(`   Command: ${proc.command.substring(0, 60)}${proc.command.length > 60 ? '...' : ''}`);
        console.log();
    });
}

function showProjectStatus() {
    console.log('📊 Project Indexing Status');
    console.log('===========================\n');

    const projects = getProjectStatus();

    if (projects.length === 0) {
        console.log('📁 No projects found in indexing history\n');
        return;
    }

    projects.forEach((project, index) => {
        const statusIcon = {
            'indexed': '✅',
            'indexing': '🔄',
            'failed': '❌',
            'pending': '⏳'
        }[project.status] || '❓';

        const lastUpdated = project.lastUpdated !== 'unknown'
            ? new Date(project.lastUpdated).toLocaleString()
            : 'Unknown';

        console.log(`${index + 1}. ${project.name}`);
        console.log(`   Status: ${statusIcon} ${project.status} ${project.status === 'indexing' ? `(${project.progress}%)` : ''}`);
        console.log(`   Path: ${project.path}`);
        console.log(`   Last Updated: ${lastUpdated}`);
        console.log();
    });
}

async function main() {
    const args = process.argv.slice(2);

    if (args.includes('--help') || args.includes('-h')) {
        showHelp();
        process.exit(0);
    }

    const showProcesses = args.includes('--processes') || args.includes('--all') || args.length === 0;
    const showProjects = args.includes('--projects') || args.includes('--all') || args.length === 0;

    if (showProcesses) {
        await showProcessStatus();
    }

    if (showProjects) {
        showProjectStatus();
    }

    console.log('💡 Tips:');
    console.log('   - Use "npm run index:stop project-name" to stop specific indexing');
    console.log('   - Use "npm run logs --latest project-name" to view indexing logs');
    console.log('   - Use "npm run check:index" for detailed project status');
}

// Run main function
main().catch(error => {
    console.error(`❌ Unexpected error: ${error.message}`);
    process.exit(1);
});