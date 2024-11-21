// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "shadertoy-sound" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	const disposable = vscode.commands.registerCommand('shadertoy-sound.helloWorld', async () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		vscode.window.showInformationMessage('Hello World from shadertoy-sound!');

		const panel = vscode.window.createWebviewPanel('preview',
			'preview',
			vscode.ViewColumn.One,
			{
				enableScripts: true,
				localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'frontend', 'dist')]
			}
		);

		const mainPath = panel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'frontend', 'dist', 'main.js'));
		const shader = vscode.window.activeTextEditor?.document.getText();

		panel.webview.html = `
<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="utf-8">
    <title>My first three.js app</title>
    <style>
        body {
            margin: 0;
        }
    </style>
</head>

<body>
	<script id="fragmentShader" type="x-shader/x-fragment">
		${shader}	
    </script>
	<h1>HELLO</h1>
    <script type="module" src="${mainPath}"></script>
</body>

</html>
		`
	});

	context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() { }
