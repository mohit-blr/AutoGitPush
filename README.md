# autogitpush README

# Auto-Push Extension for VS Code

The Auto-Push extension automates the process of pushing your code changes to a Git remote repository or a local repository like Phabricator at regular intervals. It provides an easy-to-use interface for configuring authentication and repository details.

## Features

- Automatically pushes code changes at user-defined intervals.
- Supports both Git and local repositories such as Phabricator.
- Provides a configuration file (`.autopush.json`) for flexible settings.
- Ignores sensitive files like `.autopush.json` from being pushed.

## Installation

To install this VS Code extension manually:

1. Clone the repository.
   ```
   git clone <repository_url>
   ```
2. Download the latest `.vsix` file.
3. Open Visual Studio Code.
4. Navigate to the Extensions view:
   - **Windows/Linux**: `Ctrl+Shift+X`
   - **macOS**: `Cmd+Shift+X`
5. Click on the `...` menu in the top-right corner.
6. Select **Install from VSIX...**.
7. Choose the downloaded `.vsix` file and wait for the installation to complete.
8. Reload or restart Visual Studio Code if prompted.

You're all set! The extension is now ready to use.

## Usage

1. Open your workspace in VS Code.

2. Run the command `Init Auto-Push` from the Command Palette (`Ctrl+Shift+P`).

3. Configure your authentication and repository details in the `.autopush.json` file. Example configuration:

   ```json
   {
     "repoType": "local",
     "authType": "password",    `password` or `token`
     "gitToken": "your_personal_access_token",
     "username": "username",    `phabricator or git username`
     "password": "vcspassword", `phabricator or git password`
     "remoteRepo": "https://github.com/username/repository.git",
     "intervalMinutes": 30,
     "branch": "main"
   }
   ```

4. Save the `.autopush.json` file to start the auto-push process.

## Configuration Options

- `repoType`: `github` or `local`;

- `authType`: Authentication method (`token` or `password`).

- `gitToken`: Personal access token for token-based authentication.

- `username`: Git username (for password-based authentication).

- `password`: Git password (for password-based authentication).

- `remoteRepo`: URL of the remote repository.

- `intervalMinutes`: Time interval (in minutes) for auto-push.

- `branch`: Branch to push changes to.

## Ignoring Files

The extension ensures that `.autopush.json` is ignored in Git:

1. Adds `.autopush.json` to `.gitignore` automatically.
2. Untracks `.autopush.json` if it is already tracked.

## Testing

1. Make changes to your workspace files.
2. Ensure `.autopush.json` is correctly configured and saved.
3. Monitor the auto-push process through VS Code notifications.

## Known Issues

- The extension will not function if the workspace is closed.
- The extension requires an active network connection for remote repositories.

## Troubleshooting

- **File still getting pushed:** Ensure `.autopush.json` is untracked by running:

  ```bash
  git rm --cached .autopush.json
  ```

- **Authentication errors:** Verify your token, username, and password in `.autopush.json`.

## License

This extension is licensed under the MIT License. See `LICENSE` for more details.

## Contribution

Contributions are welcome! Please fork the repository and create a pull request with your changes.

## Contact

For issues or feature requests, please open an issue on the GitHub repository.
