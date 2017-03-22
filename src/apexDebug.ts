/// <reference types="es6-collections" />
/// <reference types="node" />

import {
	DebugSession, InitializedEvent,
	TerminatedEvent, StoppedEvent, BreakpointEvent,
	OutputEvent, Event, Thread, Scope, Handles, Breakpoint, Source
} from 'vscode-debugadapter';
import {DebugProtocol} from 'vscode-debugprotocol';
import {readFile} from 'fs';
import * as path from 'path';
import {FrameProcessor} from './lib/frameProcessor';

/**
 * This interface should always match the schema found in the apex-debug extension manifest.
 */
export interface LaunchRequestArguments extends DebugProtocol.LaunchRequestArguments {
	// The root path
	workspaceRoot:string;
	// An absolute path to the program to debug.
	logFile: string;
	// Automatically stop target after launch. If not specified, target does not stop.
	stopOnEntry?: boolean;
	//outputs LogLines to the console as they are processed
	traceLog?: boolean;
}

export class ApexBreakPoint extends Breakpoint{
	id: number;
	condition: String;
	hitCount: number;
	hitConditionModifer: String;
	hitConditionValue: number;
	line: number;


	public meetsCondition():Boolean{
		if(this.hitConditionValue){
			switch(this.hitConditionModifer){
				case '=':
				case undefined:
					return this.hitCount == this.hitConditionValue;
				case '>':
					return this.hitCount > this.hitConditionValue;
				case '>=':
					return this.hitCount >= this.hitConditionValue;
				case '<':
					return this.hitCount < this.hitConditionValue;
				case '<=':
					return this.hitCount <= this.hitConditionValue;
				case '%':
					return this.hitCount % this.hitConditionValue == 0;
			}
			return false;
		}
		return true;
	}
}

export class ApexDebugSession extends DebugSession {

	// we don't support multiple threads, so we can use a hardcoded ID for the default thread
	private static THREAD_ID = 1;

	// since we want to send breakpoint events, we will assign an id to every event
	// so that the frontend can match events with breakpoints.
	private _breakpointId = 1000;

	private _logFile: string;

	private _classPaths = new Map<string, string>();

	// maps from sourceFile to array of Breakpoints
	private _breakPoints = new Map<string, ApexBreakPoint[]>();

	private _variableHandles = new Handles<any>();

	private _projectRoot: string;

	private _frameProcessor: FrameProcessor;

	/**
	 * Creates a new debug adapter that is used for one debug session.
	 * We configure the default implementation of a debug adapter here.
	 */
	public constructor() {
		super();

		// this debugger uses zero-based lines and columns
		this.setDebuggerLinesStartAt1(false);
		this.setDebuggerColumnsStartAt1(false);
	}

	/* === Public Methods === */

	public log(message : string){
		this.sendEvent(new OutputEvent(message));
	}

	public convertPathToClient(p: string){
		return this.convertDebuggerPathToClient(p);
	}

	/* === Implemented Methods === */

	/**
	 * The 'initialize' request is the first request called by the frontend
	 * to interrogate the features the debug adapter provides.
	 */
	protected initializeRequest(response: DebugProtocol.InitializeResponse, args: DebugProtocol.InitializeRequestArguments): void {

		// since this debug adapter can accept configuration requests like 'setBreakpoint' at any time,
		// we request them early by sending an 'initializeRequest' to the frontend.
		// The frontend will end the configuration sequence by calling 'configurationDone' request.
		this.sendEvent(new InitializedEvent());

		// This debug adapter implements the configurationDoneRequest.
		response.body.supportsConfigurationDoneRequest = true;

		// [TODO: Implement] make VS Code to use 'evaluate' when hovering over source
		response.body.supportsEvaluateForHovers = false;

		response.body.supportsHitConditionalBreakpoints = true;

		this.sendResponse(response);
	}

	protected launchRequest(response: DebugProtocol.LaunchResponse, args: LaunchRequestArguments): void {

		this._logFile = args.logFile;
		this._projectRoot = path.join(args.workspaceRoot, '/');

		//add file for apex
		new Promise(this.loadClassPaths())
		.then(()=>{
			this.loadLogLines()
			.then((logLines)=>{
				this._frameProcessor = new FrameProcessor(this, logLines, this._classPaths, this._variableHandles, args.traceLog);
				if (args.stopOnEntry) {
					this.sendResponse(response);

					// we stop on the first line
					this.sendEvent(new StoppedEvent("entry", ApexDebugSession.THREAD_ID));
				} else {
					// we just start to run until we hit a breakpoint or an exception
					this.continueRequest(<DebugProtocol.ContinueResponse> response, { threadId: ApexDebugSession.THREAD_ID });
				}
			})
		})

	}

	private loadLogLines():Promise<Array<string>>{
		return new Promise((resolve, reject) => {
			let logLines = new Array<string>();

            this._logFile = this._logFile.replace('/c:','');
			//check file
			readFile(this._logFile, (err, data)=>{
				logLines = data.toString().split('\n');
				if(logLines[0].indexOf('APEX_CODE,FINEST')==-1 || logLines[0].indexOf('SYSTEM,FINE')==-1){
					this.log('WARNING: Log does not have proper levels. Unexpected behavoir will likely occur. Set Debug levels to `APEX_CODE=FINEST` && `SYSTEM=FINE` \n');
				}
				for(let i = 0; i < logLines.length; i++){
					let s = logLines[i];
					if(s.indexOf('*** Skipped') == 0){
						this.log('WARNING: Log Was truncated due to length... Try reducing log levels \n');
						// throw new TypeError('Log Was truncated due to length... Try reducing log levels');
					}else if(s.indexOf('* MAXIMUM DEBUG LOG SIZE REACHED *') >= 0){
						this.log('WARNING: Log Was truncated due to length... Try reducing log levels \n');
						// throw new TypeError('Log Was truncated due to length... Try reducing log levels');
					}
				}
				resolve(logLines);
			});
		});
	}

	private loadClassPaths(){
		return (resolve, reject)=>{
			this._classPaths.set('_logFile', this._logFile);

			readFile(path.join(this._projectRoot, 'config','.local_store'), (err, data)=>{
				let localStore = JSON.parse(data.toString());
				for (var property in localStore) {
					if (localStore.hasOwnProperty(property)) {
						var metadata = localStore[property];
						if(metadata.type == 'ApexClass' || metadata.type == 'ApexTrigger'){
							let fileName = this._projectRoot + metadata.fileName.replace('unpackaged','src');
							//add both id and classname for lookup
							this._classPaths.set(metadata.id.substring(0, metadata.id.length - 3) , fileName);
							this._classPaths.set(metadata.fullName , fileName);
						}
					}
				}
				resolve();
			});
		}
	}


	protected setBreakPointsRequest(response: DebugProtocol.SetBreakpointsResponse, args: DebugProtocol.SetBreakpointsArguments): void {

		var path = args.source.path;
		var clientLines = args.lines;

		// read file contents into array for direct access
		readFile(path, (err,data)=>{
			var lines = data.toString().split('\n');
			var breakpoints = new Array<ApexBreakPoint>();

			// verify breakpoint locations
			for (var i = 0; i < clientLines.length; i++) {
				var l = this.convertClientLineToDebugger(clientLines[i]);
				var verified = false;
				if (l < lines.length) {
					const line = lines[l].trim();
					// if a line is empty or starts with '+' we don't allow to set a breakpoint but move the breakpoint down
					if (line.length == 0 || line.indexOf("{") == 0)
						l++;
					// if a line starts with '-' we don't allow to set a breakpoint but move the breakpoint up
					if (line.indexOf("}") == 0)
						l--;
					verified = true;
				}

				const bp = new ApexBreakPoint(verified, this.convertDebuggerLineToClient(l));
				bp.id = this._breakpointId++;
				bp.hitCount = 0;
				for(var k = 0; k < args.breakpoints.length; k++){
					let bpa = args.breakpoints[k];
					if(bpa.line == clientLines[k]){
						bp.condition = bpa.condition;
						if(bpa.hitCondition){
							const regex = /(>|>=|=|<|<=|%)?\s*([0-9]+)/g;
							var match = regex.exec(bpa.hitCondition);
							if(match){
								bp.hitConditionModifer = match[1];
								bp.hitConditionValue =  Number(match[2]);
							}else{
								bp.verified = false;
							}
						}
					}
				}

				breakpoints.push(bp);
			}
			this._breakPoints.set(path, breakpoints);

			// send back the actual breakpoint positions
			response.body = {
				breakpoints: breakpoints
			};
			this.sendResponse(response);
		});
	}

	/**
	 * Returns a StackTrace
	 */
	protected stackTraceRequest(response: DebugProtocol.StackTraceResponse, args: DebugProtocol.StackTraceArguments): void {
		if(this._frameProcessor.getFrames().length == 0){
			this._frameProcessor.setNextFrame();
		}

		//Excepts stack in reverse...
		response.body = {
			stackFrames: this._frameProcessor.getFrames().slice(0).reverse(),
			totalFrames: this._frameProcessor.getFrames().length
		};
		this.sendResponse(response);
	}

	protected scopesRequest(response: DebugProtocol.ScopesResponse, args: DebugProtocol.ScopesArguments): void {

		const frameReference =  args.frameId;
		const scopes = new Array<Scope>();
		scopes.push(new Scope("Local", this._variableHandles.create(frameReference.toString()), false));
		// scopes.push(new Scope("Local", this._variableHandles.create(frameReference.toString()), false));

		response.body = {
			scopes: scopes
		};
		this.sendResponse(response);
	}

	protected variablesRequest(response: DebugProtocol.VariablesResponse, args: DebugProtocol.VariablesArguments): void {
		let vars = new Array<DebugProtocol.Variable>();

		const h = this._variableHandles.get(args.variablesReference);
		if(h instanceof Object){
			for (let property in h) {
				if (h.hasOwnProperty(property)) {
					let v = h[property];
					let value: string;
					let refId = 0;
					if(v instanceof Object){
						refId = this._variableHandles.create(v);
						value = 'Object';
					}else{
						value = h[property];
					}
					vars.push({
						name: property.toString(),
						value: value.toString(),
						variablesReference: refId
					});
					// vars.push({
					// 	name: 'test',
					// 	type: 'v.type',
					// 	value: 'obj',
					// 	variablesReference: 0
					// })
				}
			}
		}else{
			let frameMap = this._frameProcessor.getFrameVariables(h);

			if(frameMap){
				frameMap.forEach((value: DebugProtocol.Variable) => {
					vars.push(value);
				});
			}
		}

		response.body = {
			variables: vars
		};

		// response.body = {
		// 	variables: [{
		// 			name: 'test',
		// 			type: 'v.type',
		// 			value: 'obj',
		// 			variablesReference: 1
		// 		}]
		// };
		this.sendResponse(response);
	}

	protected continueRequest(response: DebugProtocol.ContinueResponse, args: DebugProtocol.ContinueArguments): void {
		// advance the log without sending, each time a frame is updated, check if it has a breakpoint
		while(this._frameProcessor.hasLines()){
			this._frameProcessor.setNextFrame();
			if(this.checkBreakpoints()){
				this.sendResponse(response);
				this.sendEvent(new StoppedEvent("breakpoint", ApexDebugSession.THREAD_ID));
				return;
			}
		}

		this.sendResponse(response);
		// no more lines: run to end
		this.sendEvent(new TerminatedEvent());

	}

	//step into: get next frame update
	protected stepInRequest(response: DebugProtocol.StepInResponse, args: DebugProtocol.StepInArguments): void{
		this._frameProcessor.setNextFrame();
		if(this._frameProcessor.hasLines()){
			this.sendResponse(response);
			this.sendEvent(new StoppedEvent("step", ApexDebugSession.THREAD_ID));
			return;
		}

		this.sendResponse(response);
		// no more lines: run to end
		this.sendEvent(new TerminatedEvent());

	}

	//step out: run until stack size reduces
    protected stepOutRequest(response: DebugProtocol.StepOutResponse, args: DebugProtocol.StepOutArguments): void{
		let currentDepth = this._frameProcessor.getFrames().length;
		while(this._frameProcessor.hasLines()){
			this._frameProcessor.setNextFrame();
			if(this.checkBreakpoints()){
				this.sendResponse(response);
				this.sendEvent(new StoppedEvent("breakpoint", ApexDebugSession.THREAD_ID));
				return;
			}
			if(this._frameProcessor.getFrames().length < currentDepth){
				this.sendResponse(response);
				this.sendEvent(new StoppedEvent("step", ApexDebugSession.THREAD_ID));
				return;
			}
		}

		this.sendResponse(response);
		// no more lines: run to end
		this.sendEvent(new TerminatedEvent());

	}

	//step over: run until stack size is same as current
	protected nextRequest(response: DebugProtocol.NextResponse, args: DebugProtocol.NextArguments): void {
		let currentDepth = this._frameProcessor.getFrames().length;
		while(this._frameProcessor.hasLines()){
			this._frameProcessor.setNextFrame();
			if(this.checkBreakpoints()){
				this.sendResponse(response);
				this.sendEvent(new StoppedEvent("breakpoint", ApexDebugSession.THREAD_ID));
				return;
			}
			if(this._frameProcessor.getFrames().length <= currentDepth){
				this.sendResponse(response);
				this.sendEvent(new StoppedEvent("step", ApexDebugSession.THREAD_ID));
				return;
			}
		}

		this.sendResponse(response);
		// no more lines: run to end
		this.sendEvent(new TerminatedEvent());

	}

	protected evaluateRequest(response: DebugProtocol.EvaluateResponse, args: DebugProtocol.EvaluateArguments): void {

		response.body = {
			result: `evaluate(context: '${args.context}', '${args.expression}')`,
			variablesReference: 0
		};
		this.sendResponse(response);
	}

	protected disconnectRequest(response: DebugProtocol.DisconnectResponse, args: DebugProtocol.DisconnectArguments): void {
		super.disconnectRequest(response, args);
	}

	protected threadsRequest(response: DebugProtocol.ThreadsResponse): void {

		// return the default thread
		response.body = {
			threads: [
				new Thread(ApexDebugSession.THREAD_ID, "thread 1")
			]
		};
		this.sendResponse(response);
	}

	/* === Private Methods === */

	private checkBreakpoints(): boolean{

		let currentFrame = this._frameProcessor.getCurrentFrame();
		if(!currentFrame) return false;

		//find breakpoints that match frame file
		var breakpoints = this._breakPoints.get(currentFrame.source.path);
		if(breakpoints){
			for(let i = 0; i < breakpoints.length; i++){
				let breakpoint = breakpoints[i];
				if(currentFrame.line == breakpoint.line){
					if(breakpoint.condition){
						var frameVars = this._frameProcessor.getFrameVariables(currentFrame.id.toString());
						for(var j = 0; j < frameVars.length; j ++){
							var variable = frameVars[j];
							var expression = `${variable.name}=${variable.value}`;
							if(expression == breakpoint.condition.replace(' ', '')){
								return true;
							}
						}
					}

					breakpoint.hitCount++;
					if(breakpoint.meetsCondition()){
						return true;
					}
				}
			}
		}
		return false;
	}
}

DebugSession.run(ApexDebugSession);
