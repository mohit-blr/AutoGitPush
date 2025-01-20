// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { simpleGit } = require('simple-git');
require('events').EventEmitter.defaultMaxListeners = 20;

let pushInterval;
let fileWatcher;  // Add this to track the file watcher
const CONFIG_FILE_NAME = '.autopush.json';

async function checkAndInitializeWorkspace() {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return;

    const configPath = path.join(workspaceFolder.uri.fsPath, CONFIG_FILE_NAME);
    
    if (fs.existsSync(configPath)) {
        // Create a file watcher for the config file
        setupFileWatcher(configPath, workspaceFolder.uri.fsPath);
        // Start auto-push
        await startAutoPush(configPath, workspaceFolder.uri.fsPath);
        vscode.window.showInformationMessage('Auto-push initialized from existing configuration');
    }
}

function setupFileWatcher(configPath, workspacePath) {
    // Dispose of existing watcher if any
    if (fileWatcher) {
        fileWatcher.dispose();
    }

    // Create new file watcher using VS Code API
    fileWatcher = vscode.workspace.createFileSystemWatcher(configPath);
    
    fileWatcher.onDidChange(async () => {
        console.log('Config file changed');
        vscode.window.showInformationMessage('Auto-push config changed, restarting...');
        await startAutoPush(configPath, workspacePath);
    });

    fileWatcher.onDidDelete(() => {
        if (pushInterval) {
            clearInterval(pushInterval);
            pushInterval = null;
        }
        vscode.window.showInformationMessage('Auto-push config deleted, stopping auto-push');
    });
}

async function initAutoPush() {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        vscode.window.showErrorMessage('Please open a workspace first');
        return;
    }
    
    if (!fs.existsSync(path.join(workspaceFolder.uri.fsPath, '.git'))) {
        vscode.window.showErrorMessage('The workspace is not a Git repository. Please initialize Git first.');
        return;
    }
    
    const configPath = path.join(workspaceFolder.uri.fsPath, CONFIG_FILE_NAME);
    
    if (!fs.existsSync(configPath)) {
        const config = {
            "repoType": "local",
            "authType": "password",
            "gitToken": "",
            "username": "username",
            "password": "vcspassword",
            "remoteRepo": "http://your.local.repo/path/to/repository.git",
            "intervalMinutes": 60,
            "branch": "master"
        };
        
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    }

    const doc = await vscode.workspace.openTextDocument(configPath);
    await vscode.window.showTextDocument(doc);

    addToGitIgnore(workspaceFolder.uri.fsPath);

    // Set up file watcher
    setupFileWatcher(configPath, workspaceFolder.uri.fsPath);

    vscode.window.showInformationMessage('Please configure your Git credentials in the config file');
}

// Rest of your existing functions remain the same...
function addToGitIgnore(workspacePath) {
    // Your existing addToGitIgnore function
    const gitIgnorePath = path.join(workspacePath, '.gitignore');
    
    if (fs.existsSync(gitIgnorePath)) {
        const gitIgnoreContent = fs.readFileSync(gitIgnorePath, 'utf-8');
        if (!gitIgnoreContent.includes('.autopush.json')) {
            fs.appendFileSync(gitIgnorePath, '\n.autopush.json\n');
            vscode.window.showInformationMessage('.autopush.json has been added to .gitignore');
        }
    } else {
        const content = '.autopush.json\n';
        fs.writeFileSync(gitIgnorePath, content);
        vscode.window.showInformationMessage('.gitignore created and .autopush.json added');
    }
}

async function startAutoPush(configPath, workspacePath) {
    try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        
        // Validate repository type
        if (!['github', 'local'].includes(config.repoType)) {
            vscode.window.showErrorMessage('Invalid repoType in configuration. Use "github" or "local".');
            return;
        }

        // Validate remote repository URL
        if (!config.remoteRepo) {
            vscode.window.showErrorMessage('Please set your remote repository URL in the config file');
            return;
        }

        // Check for credentials
        if (config.authType === 'token' && !config.gitToken) {
            vscode.window.showErrorMessage('Please set your Git token in the config file');
            return;
        }

        if (config.authType === 'password' && (!config.username || !config.password)) {
            vscode.window.showErrorMessage('Please set both username and password in the config file');
            return;
        }

        // Always clear existing interval before setting up a new one
        if (pushInterval) {
            clearInterval(pushInterval);
            pushInterval = null;
        }

        const git = simpleGit(workspacePath);

        // Handle repository-specific functionality
        if (config.repoType === 'github') {
            await handleGitRepository(git, config);
        } else if (config.repoType === 'local') {
            await handleLocalRepository(git, config);
        }

        // Validate interval minutes
        const intervalMinutes = parseInt(config.intervalMinutes);
        if (isNaN(intervalMinutes) || intervalMinutes <= 0) {
            vscode.window.showErrorMessage('Invalid interval value. Please set a positive number of minutes.');
            return;
        }

        // Set up new interval
        pushInterval = setInterval(async () => {
            try {
                const status = await git.status();
                if (status.modified.length > 0 || status.not_added.length > 0) {
                    await git.add('.');
                    await git.commit(`Auto-push: ${new Date().toISOString()}`);
                    await git.push('origin', config.branch);
                    vscode.window.showInformationMessage('Successfully pushed changes to repository');
                }
            } catch (error) {
                vscode.window.showErrorMessage(`Auto-push failed: ${error.message}`);
            }
        }, intervalMinutes * 60 * 1000);

        vscode.window.showInformationMessage(`Auto-push reinitialized! Will push every ${intervalMinutes} minutes`);

    } catch (error) {
        vscode.window.showErrorMessage(`Failed to start auto-push: ${error.message}`);
        // Clear interval on error
        if (pushInterval) {
            clearInterval(pushInterval);
            pushInterval = null;
        }
    }
}

async function handleGitRepository(git, config) {
    try {
        // Remove existing remote if it exists
        await git.removeRemote('origin').catch(() => {}); // Ignore errors

        // Construct authenticated URL for Git
        const authenticatedUrl = config.authType === 'token'
            ? config.remoteRepo.replace('https://', `https://${config.gitToken}@`)
            : config.remoteRepo.replace(
                'https://',
                `https://${encodeURIComponent(config.username)}:${encodeURIComponent(config.password)}@`
            );

        await git.addRemote('origin', authenticatedUrl);

        // Verify connection
        await git.listRemote(['--heads']);
    } catch (error) {
        vscode.window.showErrorMessage('Failed to configure Git repository: ' + error.message);
    }
}

async function handleLocalRepository(git, config) {
    try {
        // For local repositories, simply use the HTTP URL with authentication
        const authenticatedUrl = config.remoteRepo.replace(
            'http://',
            `http://${encodeURIComponent(config.username)}:${encodeURIComponent(config.password)}@`
        );

        await git.removeRemote('origin').catch(() => {}); // Ignore errors
        await git.addRemote('origin', authenticatedUrl);

        // Verify connection
        await git.listRemote(['--heads']);
    } catch (error) {
        vscode.window.showErrorMessage('Failed to configure local repository: ' + error.message);
    }
}

function deactivate() {
    if (pushInterval) {
        clearInterval(pushInterval);
        pushInterval = null;
    }
    if (fileWatcher) {
        fileWatcher.dispose();
    }
    vscode.window.showInformationMessage('Auto-push extension deactivated.');
}

module.exports = {
    activate: async (context) => {
        let disposable = vscode.commands.registerCommand('extension.initAutoPush', initAutoPush);
        context.subscriptions.push(disposable);

        // Add to subscriptions so it gets cleaned up on deactivation
        if (fileWatcher) {
            context.subscriptions.push(fileWatcher);
        }

        context.subscriptions.push(
            vscode.workspace.onDidChangeWorkspaceFolders(async () => {
                await checkAndInitializeWorkspace();
            })
        );

        await checkAndInitializeWorkspace();
    },
    deactivate
};