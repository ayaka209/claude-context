#!/usr/bin/env node

const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Get command line arguments
const args = process.argv.slice(2);

function showHelp() {
    console.log(`
Indexing Process Management Tool
================================

Usage:
  node scripts/stop-indexing.js [options] [project-name]

Options:
  --all                          Stop all indexing processes
  --list                         List all running indexing processes
  --help, -h                     Show this help message

Examples:
  node scripts/stop-indexing.js --list
  node scripts/stop-indexing.js project-name
  node scripts/stop-indexing.js --all

Safety Features:
  - Only stops processes running MCP indexing servers
  - Never kills all Node.js processes
  - Identifies processes by command line arguments
  - Graceful shutdown with SIGTERM before SIGKILL
`);
}

function findIndexingProcesses() {
    return new Promise((resolve) => {
        // Find processes running the MCP server for indexing
        const command = os.platform() === 'win32'
            ? 'powershell "Get-WmiObject Win32_Process | Where-Object { $_.CommandLine -like \'*@ayaka209/claude-context-mcp*\' -or $_.CommandLine -like \'*index-project.js*\' } | Select-Object ProcessId,CommandLine | ConvertTo-Json"'
            : 'ps aux | grep -E "(claude-context-mcp|index-project\\.js)" | grep -v grep';

        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.warn('⚠️  Could not list processes:', error.message);
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
                            // Extract project name from command line
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
                                projectName
                            });
                        }
                    });
                } catch (parseError) {
                    console.warn('⚠️  Could not parse PowerShell output:', parseError.message);
                }
            } else {
                // Parse Unix ps output
                const lines = stdout.split('\n').filter(line => line.trim());

                lines.forEach(line => {
                    const parts = line.trim().split(/\s+/);
                    if (parts.length >= 11) {
                        const pid = parseInt(parts[1]);
                        const command = parts.slice(10).join(' ');

                        // Extract project name from command
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
                            projectName
                        });
                    }
                });
            }

            resolve(processes);
        });
    });
}

function killProcess(pid, projectName) {
    return new Promise((resolve) => {
        console.log(`🛑 Stopping indexing process for project: ${projectName} (PID: ${pid})`);

        // Try graceful shutdown first (SIGTERM)
        const killCommand = os.platform() === 'win32'
            ? `taskkill /PID ${pid}`
            : `kill -TERM ${pid}`;

        exec(killCommand, (error) => {
            if (error) {
                console.warn(`⚠️  Could not stop process ${pid} gracefully, trying force kill...`);

                // Force kill (SIGKILL)
                const forceKillCommand = os.platform() === 'win32'
                    ? `taskkill /F /PID ${pid}`
                    : `kill -KILL ${pid}`;

                exec(forceKillCommand, (forceError) => {
                    if (forceError) {
                        console.error(`❌ Failed to stop process ${pid}:`, forceError.message);
                        resolve(false);
                    } else {
                        console.log(`✅ Forcefully stopped process ${pid}`);
                        resolve(true);
                    }
                });
            } else {
                console.log(`✅ Gracefully stopped process ${pid}`);
                resolve(true);
            }
        });
    });
}

async function listProcesses() {
    console.log('🔍 Searching for running indexing processes...\n');

    const processes = await findIndexingProcesses();

    if (processes.length === 0) {
        console.log('✅ No indexing processes found running');
        return;
    }

    console.log(`📋 Found ${processes.length} indexing process(es):\n`);

    processes.forEach((proc, index) => {
        console.log(`${index + 1}. Project: ${proc.projectName}`);
        console.log(`   PID: ${proc.pid}`);
        console.log(`   Command: ${proc.command.substring(0, 80)}${proc.command.length > 80 ? '...' : ''}`);
        console.log();
    });
}

async function stopSpecificProject(projectName) {
    console.log(`🔍 Looking for indexing processes for project: ${projectName}\n`);

    const processes = await findIndexingProcesses();
    const matchingProcesses = processes.filter(proc =>
        proc.projectName.toLowerCase().includes(projectName.toLowerCase())
    );

    if (matchingProcesses.length === 0) {
        console.log(`❌ No indexing processes found for project: ${projectName}`);
        return;
    }

    console.log(`📋 Found ${matchingProcesses.length} process(es) for project: ${projectName}\n`);

    let stoppedCount = 0;
    for (const proc of matchingProcesses) {
        const success = await killProcess(proc.pid, proc.projectName);
        if (success) stoppedCount++;
    }

    console.log(`\n🎉 Stopped ${stoppedCount}/${matchingProcesses.length} processes`);
}

async function stopAllProcesses() {
    console.log('🔍 Looking for all indexing processes...\n');

    const processes = await findIndexingProcesses();

    if (processes.length === 0) {
        console.log('✅ No indexing processes found running');
        return;
    }

    console.log(`📋 Found ${processes.length} indexing process(es) to stop\n`);

    // Group by project for better output
    const projectGroups = {};
    processes.forEach(proc => {
        if (!projectGroups[proc.projectName]) {
            projectGroups[proc.projectName] = [];
        }
        projectGroups[proc.projectName].push(proc);
    });

    let totalStopped = 0;
    for (const [projectName, projectProcesses] of Object.entries(projectGroups)) {
        console.log(`📂 Stopping processes for project: ${projectName}`);

        for (const proc of projectProcesses) {
            const success = await killProcess(proc.pid, proc.projectName);
            if (success) totalStopped++;
        }
        console.log();
    }

    console.log(`🎉 Stopped ${totalStopped}/${processes.length} processes`);
}

async function main() {
    if (args.includes('--help') || args.includes('-h')) {
        showHelp();
        process.exit(0);
    }

    if (args.includes('--list')) {
        await listProcesses();
    } else if (args.includes('--all')) {
        await stopAllProcesses();
    } else if (args.length > 0) {
        const projectName = args[0];
        await stopSpecificProject(projectName);
    } else {
        console.error('❌ Error: Please specify a project name, --all, or --list');
        console.log('\nUse --help for usage information');
        process.exit(1);
    }
}

// Run main function
main().catch(error => {
    console.error(`❌ Unexpected error: ${error.message}`);
    process.exit(1);
});