/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

'use strict';

import * as vscode from 'vscode';

const initialConfigurations = {
	version: '0.2.0',
	configurations: [
	{
		name: 'Apex-Debug',
		type: 'apex',
		request: 'launch',
		program: '${workspaceRoot}/${command.AskForProgramName}',
		stopOnEntry: true
	}
]}

export function activate(context: vscode.ExtensionContext) {

	let disposable = vscode.commands.registerCommand('extension.getProgramName', () => {
		return vscode.window.showInputBox({
			placeHolder: "Please enter the name of a text file in the workspace folder",
			value: "debug.log"
		});
	});
	context.subscriptions.push(disposable);

	context.subscriptions.push(vscode.commands.registerCommand('extension.provideInitialConfigurations', () => {
		return JSON.stringify(initialConfigurations);
	}));
}

export function deactivate() {
}
