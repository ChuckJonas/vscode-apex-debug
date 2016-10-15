'use strict';

import * as vscode from 'vscode';

const initialConfigurations =
	[{
		name: 'Apex-Debug',
		type: 'apex',
		request: 'launch',
		logFile: '${command.AskForLogName}',
		workspaceRoot: '${workspaceRoot}',
		stopOnEntry: true
	}];

export function activate(context: vscode.ExtensionContext) {

	let disposable = vscode.commands.registerCommand('extension.apex.getLogName', () => {
		return vscode.workspace.findFiles('**/debug/logs/*.log', '').then(
		(result: vscode.Uri[]) => {
			let items = new Array<string>()
			for(let i = 0; i < result.length; i++){
				let f = result[i];
				items.push(f.path);
			}

			return vscode.window.showQuickPick(items, {
						placeHolder: "Please select a log file"
			});
		},
		(reason: any) => {
			// output error
			vscode.window.showErrorMessage(reason);
		});
	});

	context.subscriptions.push(disposable);

	context.subscriptions.push(vscode.commands.registerCommand('extension.apex.provideInitialConfigurations', () => {
		return JSON.stringify(initialConfigurations);
	}));

}

export function deactivate() {
}
