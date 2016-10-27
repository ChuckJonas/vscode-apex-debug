'use strict';

import * as vscode from 'vscode';
import {statSync} from 'fs';

const initialConfigurations =
	[{
		name: 'Apex-Debug',
		type: 'apex',
		request: 'launch',
		logFile: '${command.AskForLogName}',
		workspaceRoot: '${workspaceRoot}',
		stopOnEntry: true,
		traceLog: false
	}];

export function activate(context: vscode.ExtensionContext) {

	let disposable = vscode.commands.registerCommand('extension.apex.getLogName', () => {
		return vscode.workspace.findFiles('**/debug/logs/*.log', '').then(
		(result: vscode.Uri[]) => {
			let files = new Array<string>()
			for(let i = 0; i < result.length; i++){
				let f = result[i];
				files.push(f.path);
			}
			files.sort(function(a, b) {
               return statSync(b).mtime.getTime() -
                      statSync(a).mtime.getTime();
            });

			return vscode.window.showQuickPick(files, {
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
