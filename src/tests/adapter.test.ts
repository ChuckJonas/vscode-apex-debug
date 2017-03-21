/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/// <reference path="../../node_modules/@types/mocha/index.d.ts" />

import assert = require('assert');
import * as Path from 'path';
import {DebugClient} from 'vscode-debugadapter-testsupport';
import {DebugProtocol} from 'vscode-debugprotocol';
import {LaunchRequestArguments} from '../apexDebug';

suite('Node Debug Adapter', () => {

	const DEBUG_ADAPTER = './out/apexDebug.js';

	const PROJECT_ROOT = Path.join(__dirname, '../../');
	const DATA_ROOT = Path.join(PROJECT_ROOT, 'src/tests/data');


	let dc: DebugClient;

	setup( () => {
		dc = new DebugClient('node', DEBUG_ADAPTER, 'apex');
		return dc.start();
		// return dc.start(4711); //uncomment to debug tests
	});

	teardown( () => dc.stop() );

	suite('basic', () => {

		test('unknown request should produce error', done => {
			dc.send('illegal_request').then(() => {
				done(new Error("does not report error on unknown request"));
			}).catch(() => {
				done();
			});
		});
	});

	suite('initialize', () => {

		test('should return supported features', () => {
			return dc.initializeRequest().then(response => {
				assert.equal(response.body.supportsConfigurationDoneRequest, true);
			});
		});

		test('should produce error for invalid \'pathFormat\'', done => {
			dc.initializeRequest({
				adapterID: 'apex',
				linesStartAt1: true,
				columnsStartAt1: true,
				pathFormat: 'url'
			}).then(response => {
				done(new Error("does not report error on invalid 'pathFormat' attribute"));
			}).catch(err => {
				// error expected
				done();
			});
		});
	});

	suite('Anyon Apex', () => {
		let workspace = Path.join(DATA_ROOT, 'setup1');
		let debugFile = Path.join(workspace, 'anonydebug.log');
		let barPath = Path.join(workspace, 'src' ,'classes', 'Bar.cls');
		suite('launch', () => {

			var args: LaunchRequestArguments = {
					workspaceRoot: workspace,
					logFile: debugFile,
					stopOnEntry: false
			};

			test('should run program to the end', () => {

				return Promise.all([
					dc.configurationSequence(),
					dc.launch(args),
					dc.waitForEvent('terminated')
				]);
			});

			test('should stop on entry', () => {

				const ENTRY_LINE = 2;

				args.stopOnEntry = true;

				return Promise.all([
					dc.configurationSequence(),
					dc.launch(args),
					dc.assertStoppedLocation('entry', {path:debugFile, line: ENTRY_LINE} )
				]);
			});
		});

		suite('steps', () => {

			var args: LaunchRequestArguments = {
					workspaceRoot: workspace,
					logFile: debugFile,
					stopOnEntry: true
			};

			test('should step into class method', () => {

				const ENTRY_LINE = 2;

				return Promise.all([
					dc.configurationSequence(),
					dc.launch(args),
					dc.assertStoppedLocation('entry', {path:debugFile, line: ENTRY_LINE} )
				]).then((res)=>{
					return Promise.all([
						dc.nextRequest({threadId:1}),
						dc.assertStoppedLocation('step', {path:debugFile, line: ENTRY_LINE + 1 } )
					]);
				}).then((res)=>{
					return Promise.all([
						dc.stepInRequest({threadId:1}),
						dc.assertStoppedLocation('step', {path:barPath, line: 9 } )
					]);
				});
			});
		});

		suite('setBreakpoints', () => {
			test('should stop on a breakpoint', () => {
				var args: LaunchRequestArguments = {
					workspaceRoot: workspace,
					logFile: debugFile,
					stopOnEntry: false,
					traceLog: true
				};

				const BREAKPOINT_LINE = 10;

				return dc.hitBreakpoint(args, { path: barPath, line: BREAKPOINT_LINE })
				.then(()=>{
					return Promise.all([
						dc.stepInRequest({threadId:1}),
						dc.assertStoppedLocation('step', {path:barPath, line: BREAKPOINT_LINE+1 } )
					]);
				})
			});
		});
	});

	suite('Visual Force Postback', () => {
		let workspace = Path.join(DATA_ROOT, 'setup1');
		let pageActionDebug = Path.join(workspace, 'vfpageaction.log');
		let controllerPath = Path.join(workspace, 'src' ,'classes', 'MyControllerExtension.cls');
		let barPath = Path.join(workspace, 'src' ,'classes', 'Bar.cls');

		var args: LaunchRequestArguments = {
				workspaceRoot: workspace,
				logFile: pageActionDebug,
				stopOnEntry: true
		};

		test('should step into class method', () => {

			const ENTRY_LINE = 1;

			return Promise.all([
				dc.configurationSequence(),
				dc.launch(args),
				dc.assertStoppedLocation('entry', {path:controllerPath, line: ENTRY_LINE} )
			]).then((res)=>{
				return Promise.all([
					dc.nextRequest({threadId:1}),
					dc.assertStoppedLocation('step', {path:controllerPath, line: 16 } )
				]);
			}).then((res)=>{
				return Promise.all([
					dc.nextRequest({threadId:1}),
					dc.assertStoppedLocation('step', {path:controllerPath, line: 17 } )
				]);
			}).then((res)=>{
				return Promise.all([
					dc.nextRequest({threadId:1}),
					dc.assertStoppedLocation('step', {path:controllerPath, line: 18 } )
				]);
			}).then((res)=>{
				return Promise.all([
					dc.nextRequest({threadId:1}),
					dc.assertStoppedLocation('step', {path:controllerPath, line: 45 } )
				]);
			}).then((res)=>{
				return Promise.all([
					dc.continueRequest({threadId:1})
				]);
			})
		});

		test('should break on action method', () => {

			args.stopOnEntry = false;
			return dc.hitBreakpoint(args, { path: controllerPath, line: 46 });
		});


		test('should hit breakpoint then step into and out', () => {

			return dc.hitBreakpoint(args, { path: controllerPath, line: 48 })
			.then(()=>{
				return Promise.all([
					dc.stepInRequest({threadId:1}),
					dc.assertStoppedLocation('step', {path:barPath, line: 9 } )
				]);
			}).then(()=>{
				return Promise.all([
					dc.stepOutRequest({threadId:1}),
					dc.assertStoppedLocation('step', {path:controllerPath, line: 49 } )
				]);
			})
		});
	});

	suite('Visual Force Page Load', () => {
		let workspace = Path.join(DATA_ROOT, 'setup1');
		let log = Path.join(workspace, 'vfpageload.log');
		let controllerPath = Path.join(workspace, 'src' ,'classes', 'MyControllerExtension.cls');
		let barPath = Path.join(workspace, 'src' ,'classes', 'Bar.cls');

		var args: LaunchRequestArguments = {
				workspaceRoot: workspace,
				logFile: log,
				stopOnEntry: true
		};

		test('should step into class method', () => {

			const ENTRY_LINE = 1;

			return Promise.all([
				dc.configurationSequence(),
				dc.launch(args),
				dc.assertStoppedLocation('entry', {path:controllerPath, line: ENTRY_LINE} )
			]).then((res)=>{
				return Promise.all([
					dc.nextRequest({threadId:1}),
					dc.assertStoppedLocation('step', {path:controllerPath, line: 3 } )
				]);
			}).then((res)=>{
				return Promise.all([
					dc.nextRequest({threadId:1}),
					dc.assertStoppedLocation('step', {path:controllerPath, line:5 } )
				]);
			}).then((res)=>{
				return Promise.all([
					dc.nextRequest({threadId:1}),
					dc.assertStoppedLocation('step', {path:controllerPath, line: 15 } )
				]);
			}).then((res)=>{
				return Promise.all([
					dc.nextRequest({threadId:1}),
					dc.assertStoppedLocation('step', {path:controllerPath, line: 25 } )
				]);
			}).then((res)=>{
				return Promise.all([
					dc.continueRequest({threadId:1})
				]);
			})
		});

		test('should break on constructor', () => {
			args.stopOnEntry = false;
			return dc.hitBreakpoint(args, { path: controllerPath, line: 26 });
		});


		test('step through loop', () => {

			return dc.hitBreakpoint(args, { path: controllerPath, line: 35 })
			.then(()=>{
				return Promise.all([
					dc.nextRequest({threadId:1}),
					dc.assertStoppedLocation('step', {path:controllerPath, line: 36 } )
				]);
			}).then(()=>{
				return Promise.all([
					dc.nextRequest({threadId:1}),
					dc.assertStoppedLocation('step', {path:controllerPath, line: 37 } )
				]);
			}).then(()=>{
				return Promise.all([
					dc.continueRequest({threadId:1}),
					dc.assertStoppedLocation('breakpoint', {path:controllerPath, line: 35 } )
				]);
			}).then((res)=>{
				return Promise.all([
					dc.disconnectRequest({threadId:1})
				]);
			})
		});
	});

	suite('Future Context', () => {
		let workspace = Path.join(DATA_ROOT, 'setup1');
		let log = Path.join(workspace, 'futureWException.log');
		let accountTriggerHelper = Path.join(workspace, 'src' ,'classes', 'AccountTriggerHelper.cls');

		var args: LaunchRequestArguments = {
				workspaceRoot: workspace,
				logFile: log,
				stopOnEntry: true
		};

		test('should step into class method', () => {

			const ENTRY_LINE = 1;

			return Promise.all([
				dc.configurationSequence(),
				dc.launch(args),
				dc.assertStoppedLocation('entry', {path:accountTriggerHelper, line: ENTRY_LINE} )
			]).then((res)=>{
				return Promise.all([
					dc.nextRequest({threadId:1}),
					dc.assertStoppedLocation('step', {path:accountTriggerHelper, line: 25 } )
				]);
			}).then((res)=>{
				return Promise.all([
					dc.nextRequest({threadId:1}),
					dc.assertStoppedLocation('step', {path:accountTriggerHelper, line:26 } )
				]);
			}).then((res)=>{
				return Promise.all([
					dc.nextRequest({threadId:1}),
					dc.assertStoppedLocation('step', {path:accountTriggerHelper, line: 27 } )
				]);
			})
		});

		test('should break on constructor', () => {
			args.stopOnEntry = false;
			return dc.hitBreakpoint(args, { path: accountTriggerHelper, line: 26 });
		});

	});

	suite('Trigger Context', () => {
		let workspace = Path.join(DATA_ROOT, 'setup1');
		let log = Path.join(workspace, 'trigger.log');
		let accountTriggerHelper = Path.join(workspace, 'src' ,'classes', 'AccountTriggerHelper.cls');
		let accountTrigger= Path.join(workspace, 'src' ,'triggers', 'AccountTrigger.trigger');
		let triggerHandler = Path.join(workspace, 'src' ,'classes', 'TriggerHandler.cls');
		let fooBase = Path.join(workspace, 'src' ,'classes', 'FooBase.cls');

		var args: LaunchRequestArguments = {
				workspaceRoot: workspace,
				logFile: log,
				stopOnEntry: true
		};

		test('should step into class method', () => {

			const ENTRY_LINE = 1;

			return Promise.all([
				dc.configurationSequence(),
				dc.launch(args),
				dc.assertStoppedLocation('entry', {path:accountTrigger, line: ENTRY_LINE} )
			]).then((res)=>{
				return Promise.all([
					dc.nextRequest({threadId:1}),
					dc.assertStoppedLocation('step', {path:accountTrigger, line: 10 } )
				]);
			}).then((res)=>{
				return Promise.all([
					dc.nextRequest({threadId:1}),
					dc.assertStoppedLocation('step', {path:accountTrigger, line:11 } )
				]);
			}).then((res)=>{
				return Promise.all([
					dc.nextRequest({threadId:1}),
					dc.assertStoppedLocation('step', {path:accountTrigger, line:12 } )
				]);
			})
		});

		test('should break on trigger', () => {
			args.stopOnEntry = false;
			return dc.hitBreakpoint(args, { path: accountTrigger, line: 14 })
			.then((res)=>{
				return Promise.all([
					dc.stepInRequest({threadId:1}),
					dc.assertStoppedLocation('step', {path:triggerHandler, line:43 } )
				]);
			})
		});

		test('should break on trigger end', () => {
			args.stopOnEntry = false;
			return dc.hitBreakpoint(args, { path: accountTriggerHelper, line: 18 });
		});

		//tests for logic where method calls are not proceeded with a statement execute
		test('method execute statement', () => {
			args.stopOnEntry = false;
			return dc.hitBreakpoint(args, { path: accountTriggerHelper, line: 8 })
			.then((res)=>{
				return Promise.all([
					dc.nextRequest({threadId:1}),
					dc.assertStoppedLocation('step', {path:accountTriggerHelper, line:9 } )
				]);
			}).then((res)=>{
				return Promise.all([
					dc.stepInRequest({threadId:1}),
					dc.assertStoppedLocation('step', {path:fooBase, line:3 } )
				]);
			}).then((res)=>{
				return Promise.all([
					dc.stepOutRequest({threadId:1}),
					dc.assertStoppedLocation('step', {path:accountTrigger, line:1 } ) //maybe this should go back to 9?
				]);
			})
		});

	});

});

	// suite('setExceptionBreakpoints', () => {

	// 	test('should stop on an exception', () => {

	// 		const PROGRAM_WITH_EXCEPTION = Path.join(DATA_ROOT, 'testWithException.md');
	// 		const EXCEPTION_LINE = 4;

	// 		return Promise.all([

	// 			dc.waitForEvent('initialized').then(event => {
	// 				return dc.setExceptionBreakpointsRequest({
	// 					filters: [ 'all' ]
	// 				});
	// 			}).then(response => {
	// 				return dc.configurationDoneRequest();
	// 			}),

	// 			dc.launch({ program: PROGRAM_WITH_EXCEPTION }),

	// 			dc.assertStoppedLocation('exception', { line: EXCEPTION_LINE } )
	// 		]);
	// 	});
	// });