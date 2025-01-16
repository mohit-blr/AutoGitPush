// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { simpleGit } = require('simple-git');
require('events').EventEmitter.defaultMaxListeners = 20; // or any value greater than 10


let pushInterval;
const CONFIG_FILE_NAME = '.autopush.json';

// Function to add .autopush.json to .gitignore if not already present
function addToGitIgnore(workspacePath) {
    const gitIgnorePath = path.join(workspacePath, '.gitignore');
    
    if (fs.existsSync(gitIgnorePath)) {
        const gitIgnoreContent = fs.readFileSync(gitIgnorePath, 'utf-8');
        // Check if .autopush.json is already in .gitignore
        if (!gitIgnoreContent.includes('.autopush.json')) {
            fs.appendFileSync(gitIgnorePath, '\n.autopush.json\n');
            vscode.window.showInformationMessage('.autopush.json has been added to .gitignore');
        }
    } else {
        // If .gitignore doesn't exist, create it and add .autopush.json
        const content = '.autopush.json\n';
        fs.writeFileSync(gitIgnorePath, content);
        vscode.window.showInformationMessage('.gitignore created and .autopush.json added');
    }
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
			"repoType": "local",    // Options: "github" or "local"
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

    addToGitIgnore(workspaceFolder.uri.fsPath);  // Add .autopush.json to .gitignore

    fs.watchFile(configPath, async (curr, prev) => {
        if (curr.mtime !== prev.mtime) {
            await startAutoPush(configPath, workspaceFolder.uri.fsPath);
        }
    });

    vscode.window.showInformationMessage('Please configure your Git credentials in the config file');
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

        if (pushInterval) {
            clearInterval(pushInterval);
        }

        const git = simpleGit(workspacePath);

        // Handle repository-specific functionality
        if (config.repoType === 'github') {
            await handleGitRepository(git, config);
        } else if (config.repoType === 'local') {
            await handleLocalRepository(git, config);
        }

        // Schedule auto-push
        pushInterval = setInterval(async () => {
            try {
                const status = await git.status();
                // console.log(status)
                if (status.modified.length > 0 || status.not_added.length > 0) {
                    await git.add('.');
                    await git.commit(`Auto-push: ${new Date().toISOString()}`);
                    await git.push('origin', config.branch);
                    vscode.window.showInformationMessage('Successfully pushed changes to repository');
                }
            } catch (error) {
                vscode.window.showErrorMessage(`Auto-push failed: ${error.message}`);
            }
        }, config.intervalMinutes * 60 * 1000);

        vscode.window.showInformationMessage(`Auto-push activated! Will push every ${config.intervalMinutes} minutes`);

    } catch (error) {
        vscode.window.showErrorMessage(`Failed to start auto-push: ${error.message}`);
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
        clearInterval(pushInterval); // Stop auto-push interval
        pushInterval = null;
        vscode.window.showInformationMessage('Auto-push extension deactivated.');
    }
}

module.exports = {
    activate: (context) => {
        let disposable = vscode.commands.registerCommand('extension.initAutoPush', initAutoPush);
        context.subscriptions.push(disposable);
    },
    deactivate
};