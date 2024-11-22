// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	let currentPanel: vscode.WebviewPanel | undefined = undefined;

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "shadertoy-sound" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	const disposable = vscode.commands.registerCommand('shadertoy-sound.preview', async () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		vscode.window.showInformationMessage('Hello World from shadertoy-sound!');

		if (currentPanel === undefined) {
			currentPanel = vscode.window.createWebviewPanel('preview',
				'shadertoy sound preview',
				vscode.ViewColumn.Two,
				{
					enableScripts: true,
					localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'frontend', 'dist')]
				}
			);
			const mainPath = currentPanel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'frontend', 'dist', 'main.js'));
			currentPanel.webview.html = `
<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="utf-8">
    <title>My first three.js app</title>
</head>

<body>
	<h1>Sound Preview</h1>
	<pre id="error"></pre>
	<input type="range" id="volume" min="0" max="2" value="1" step="any" />
	<p>volume: <output id="value"></output></p>
	<button id="play">Play</button>
	<div id="app"></div>
    <script type="module" src="${mainPath}"></script>
</body>
</html>`;
			currentPanel.onDidDispose(
				() => {
					currentPanel = undefined;
				},
				undefined,
				context.subscriptions
			);
		} else {
			currentPanel.reveal(undefined, true);
		}

		const shader = vscode.window.activeTextEditor?.document.getText();
		currentPanel.webview.postMessage({ command: 'setShader', shader: shader });
	});

	context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() { }
