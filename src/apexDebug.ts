/// <reference types="es6-collections" />
/// <reference types="node" />

import {
	DebugSession,
	InitializedEvent, TerminatedEvent, StoppedEvent, BreakpointEvent, OutputEvent, Event,
	Thread, StackFrame, Scope, Source, Handles, Breakpoint
} from 'vscode-debugadapter';
import {DebugProtocol} from 'vscode-debugprotocol';
import {readFileSync} from 'fs';
import {basename} from 'path';


/**
 * This interface should always match the schema found in the apex-debug extension manifest.
 */
export interface LaunchRequestArguments extends DebugProtocol.LaunchRequestArguments {
	/** An absolute path to the program to debug. */
	program: string;
	/** Automatically stop target after launch. If not specified, target does not stop. */
	stopOnEntry?: boolean;
}

/* Helper class to Process Log Lines
 * [TODO:] -move to own class -add constants
 */
class LogLine{
	public _action: string;
	public _lineNumber: number;
	public _parts: Array<string>;

	public constructor(line : string) {
		this._parts = line.split('|');
		if(this._parts.length >= 3){
			this._action = this._parts[1];
			this._lineNumber = parseInt(this._parts[2].replace('[','').replace(']',''));
		}else if(line.indexOf('Execute Anonymous:') != -1){
			this._action = 'execute_anonymous_apex';
		}
	}
}

class ApexDebugSession extends DebugSession {

	// we don't support multiple threads, so we can use a hardcoded ID for the default thread
	private static THREAD_ID = 1;

	// since we want to send breakpoint events, we will assign an id to every event
	// so that the frontend can match events with breakpoints.
	private _breakpointId = 1000;

	// the log file
	private _logFile: string;

	private _logPointer = 0;

	// the contents (= lines) of the one and only file
	private _logLines = new Array<string>();

	// Anoymonous execution lines
	private _anonymousLines = new Array<string>();

	private _frames = new Array<StackFrame>();

	private _frameVariables = new Map<number, Map<string,DebugProtocol.Variable>>();

	//used as workaround for VF where it doesn't call the controller contructor
	private _lastPoppedFrame: StackFrame;

	private _classPaths = new Map<string, string>();

	// maps from sourceFile to array of Breakpoints
	private _breakPoints = new Map<string, DebugProtocol.Breakpoint[]>();

	private _variableHandles = new Handles<string>();

	private _projectRoot: string;

	private _timer;


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

		this.sendResponse(response);
	}

	protected launchRequest(response: DebugProtocol.LaunchResponse, args: LaunchRequestArguments): void {

		this._logFile = args.program;

		//create class paths map
		this._projectRoot = this._logFile.substring(0,this._logFile.lastIndexOf("/")+1);
		let localStore =  JSON.parse(readFileSync(this._projectRoot + 'config/.local_store').toString());
		for (var property in localStore) {
			if (localStore.hasOwnProperty(property)) {
				var metadata = localStore[property];
				if(metadata.type == 'ApexClass' || metadata.type == 'ApexTrigger'){
					this._classPaths.set(metadata.id.substring(0, metadata.id.length - 3) , metadata.fileName.replace('unpackaged','src'));
				}
			}
		}

		//load anyon lines seperately
		this._logLines = readFileSync(this._logFile).toString().split('\n');
		for(let i = 0; i < this._logLines.length; i++){
			let line = new LogLine(this._logLines[i]);
			if(line._action == 'execute_anonymous_apex'){
				this._anonymousLines.push(this._logLines[i]);
			}
		}

		if (args.stopOnEntry) {
			this.sendResponse(response);

			// we stop on the first line
			this.sendEvent(new StoppedEvent("entry", ApexDebugSession.THREAD_ID));
		} else {
			// we just start to run until we hit a breakpoint or an exception
			this.continueRequest(<DebugProtocol.ContinueResponse>response, { threadId: ApexDebugSession.THREAD_ID });
		}
	}

	protected setBreakPointsRequest(response: DebugProtocol.SetBreakpointsResponse, args: DebugProtocol.SetBreakpointsArguments): void {

		var path = args.source.path;
		var clientLines = args.lines;

		// read file contents into array for direct access
		var lines = readFileSync(path).toString().split('\n');

		var breakpoints = new Array<Breakpoint>();

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
			const bp = <DebugProtocol.Breakpoint> new Breakpoint(verified, this.convertDebuggerLineToClient(l));
			bp.id = this._breakpointId++;
			breakpoints.push(bp);
		}
		this._breakPoints.set(path, breakpoints);

		// send back the actual breakpoint positions
		response.body = {
			breakpoints: breakpoints
		};
		this.sendResponse(response);
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

	/**
	 * Returns a StackTrace
	 */
	protected stackTraceRequest(response: DebugProtocol.StackTraceResponse, args: DebugProtocol.StackTraceArguments): void {
		if(this._frames.length == 0){
			this.setNextFrame();
		}

		//Excepts stack in reverse...
		response.body = {
			stackFrames: this._frames.slice(0).reverse(),
			totalFrames: this._frames.length
		};
		this.sendResponse(response);
	}

	protected scopesRequest(response: DebugProtocol.ScopesResponse, args: DebugProtocol.ScopesArguments): void {

		const frameReference = args.frameId;
		const scopes = new Array<Scope>();
		scopes.push(new Scope("Local", this._variableHandles.create(frameReference.toString()), false));

		response.body = {
			scopes: scopes
		};
		this.sendResponse(response);
	}

	protected variablesRequest(response: DebugProtocol.VariablesResponse, args: DebugProtocol.VariablesArguments): void {
		const id = this._variableHandles.get(args.variablesReference);
		let frameMap = this._frameVariables.get(parseInt(id));

		let variables = [];
		if(frameMap){
			frameMap.forEach((value: DebugProtocol.Variable) => {
				variables.push(value);
			});
		}

		response.body = {
			variables: variables
		};
		this.sendResponse(response);
	}

	protected continueRequest(response: DebugProtocol.ContinueResponse, args: DebugProtocol.ContinueArguments): void {

		//advance the log without sending, each time a frame is updated, check if it has a breakpoint
		while(this._logPointer < this._logLines.length-1){
			this.setNextFrame();
			let currentFrame = this.getCurrentFrame();

			//find breakpoints that match frame file
			var breakpoints = this._breakPoints.get(currentFrame.source.path);
			if(breakpoints){
				for(let i = 0; i < breakpoints.length; i++){
					let breakpoint = breakpoints[i];
					if(currentFrame.line == breakpoint.line){
						this.sendEvent(new StoppedEvent("breakpoint", ApexDebugSession.THREAD_ID));
						return;
					}
				}
			}
		}

		this.sendResponse(response);
		// no more lines: run to end
		this.sendEvent(new TerminatedEvent());
	}

	//step into: get next frame update
	protected stepInRequest(response: DebugProtocol.StepInResponse, args: DebugProtocol.StepInArguments): void{
		this.setNextFrame();
		if(this._logPointer < this._logLines.length-1){
			this.sendEvent(new StoppedEvent("step", ApexDebugSession.THREAD_ID));
			return;
		}

		this.sendResponse(response);
		// no more lines: run to end
		this.sendEvent(new TerminatedEvent());
	}

	//step out: run until stack size reduces
	//[TODO] check breakpoints
    protected stepOutRequest(response: DebugProtocol.StepOutResponse, args: DebugProtocol.StepOutArguments): void{
		let currentDepth = this._frames.length;
		while(this._logPointer < this._logLines.length){
			this.setNextFrame();
			if(this._frames.length < currentDepth){
				this.sendEvent(new StoppedEvent("step", ApexDebugSession.THREAD_ID));
				return;
			}
		}

		this.sendResponse(response);
		// no more lines: run to end
		this.sendEvent(new TerminatedEvent());
	}

	//step over: run until stack size is same as current
	//[TODO] check breakpoints
	protected nextRequest(response: DebugProtocol.NextResponse, args: DebugProtocol.NextArguments): void {

		let currentDepth = this._frames.length;
		let newFrames = false
		while(this._logPointer < this._logLines.length){
			this.setNextFrame();
			if(this._frames.length > currentDepth){ //added frames
				newFrames = true;
			}else if(this._frames.length == currentDepth){
				if(newFrames){ //set one more so we go past the starting frame
					this.setNextFrame();
				}
				this.sendEvent(new StoppedEvent("step", ApexDebugSession.THREAD_ID));
				return;
			}else{
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
		// stop sending custom events
		clearInterval(this._timer);
		super.disconnectRequest(response, args);
	}

	//[TODO]
	// protected stepBackRequest(response: DebugProtocol.StepBackResponse, args: DebugProtocol.StepBackArguments): void {}

	/* Private Methods */

	private setNextFrame(){
		for (this._logPointer++; this._logPointer < this._logLines.length; this._logPointer++) {
			let line = new LogLine(this._logLines[this._logPointer]);
			if(line._action == null) continue;
			let assignmentLine;
			let classPath;
			switch(line._action){
				case 'CONSTRUCTOR_ENTRY':
					assignmentLine = new LogLine(this._logLines[this._logPointer+1]);

					classPath = this.getFileFromId(line._parts[3]);
					//really we want to find the next exit and start there since this is step over
					this._frames.push(
						new StackFrame(
							this._logPointer++,
							`${line._parts[4]}(${this._logPointer++})`,
							new Source(basename(classPath),
							this.convertDebuggerPathToClient(classPath)),
							assignmentLine._lineNumber,
							0
						)
					);
					return;
				case 'METHOD_ENTRY':
					assignmentLine = new LogLine(this._logLines[this._logPointer+1]);

					classPath = this.getFileFromId(line._parts[3]);
					//really we want to find the next exit and start there since this is step over
					this._frames.push(
						new StackFrame(
							this._logPointer++,
							`${line._parts[4]}(${this._logPointer++})`,
							new Source(basename(classPath),
							this.convertDebuggerPathToClient(classPath)),
							assignmentLine._lineNumber,
							0
						)
					);
					return;
				case 'METHOD_EXIT':
				case 'CONSTRUCTOR_EXIT':
					this._lastPoppedFrame = this._frames.pop();
					return;
				case 'STATEMENT_EXECUTE':
					let currentFrame = this.getCurrentFrame();
					if(currentFrame.line != line._lineNumber){
						currentFrame.line = line._lineNumber;
						return;
					}
					break;
				case 'VARIABLE_SCOPE_BEGIN': //init frame variable types
					let variableInit = {
								name: line._parts[3],
								type: line._parts[4],
								value: null,
								variablesReference: 0
							};

					//frame has apperently been pre-maturely popped! Re-add
					if(!this._frames.length && this._lastPoppedFrame){
						this._frames.push(this._lastPoppedFrame);
					}
					if(this._frames.length){
						this.setFrameVariable(this.getCurrentFrame().id, variableInit);
					}

					break;
				case 'VARIABLE_ASSIGNMENT': //assign frame variable values
					let variable = {
									name: line._parts[3],
									type: null,
									value: line._parts[4],
									variablesReference: 0
								};
					this.setFrameVariable(this.getCurrentFrame().id, variable);
					break;
				case 'USER_DEBUG':
					let debug = line._parts[4];
					this.sendEvent(new OutputEvent(`Debug: ${debug}\n`));
					break;
				case 'execute_anonymous_apex':
					if(this._frames.length == 0){
						let name = 'Execute Anonymous';
						this._frames.push(
							new StackFrame(
								this._logPointer,
								`${name}(${this._logPointer})`,
								new Source(basename(this._logFile),
								this.convertDebuggerPathToClient(this._logFile)),
								this.convertDebuggerLineToClient(this._logPointer),
								0)
						);
						return;
					}
					break;
			}
		}
	}

	private setFrameVariable(frameId : number, variable : DebugProtocol.Variable){
		let frameMap;
		if(this._frameVariables.has(frameId)){
			frameMap = this._frameVariables.get(frameId);
			if(frameMap.has(variable.name)){
				if(variable.value){
					frameMap.get(variable.name).value = variable.value;
				}
				if(variable.type){
					frameMap.get(variable.name).type = variable.type;
				}
			}else{
				frameMap.set(variable.name, variable);
			}
		}else{
			frameMap = new Map<string,DebugProtocol.Variable>();
			frameMap.set(variable.name, variable);
			this._frameVariables.set(frameId, frameMap);
		}
	}

	private getCurrentFrame(): DebugProtocol.StackFrame{
		if(this._frames.length){
			return this._frames[this._frames.length-1];
		}
		return null;
	}

	private getFileFromId(id :string): string{
		return this._projectRoot + this._classPaths.get(id);
	}
}

DebugSession.run(ApexDebugSession);
