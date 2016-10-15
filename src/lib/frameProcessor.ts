import {StackFrame, Source}
from 'vscode-debugadapter';

import {DebugProtocol} from 'vscode-debugprotocol';
import {basename} from 'path';

import {ApexDebugSession} from '../apexDebug';

export class FrameProcessor{
	private _logPointer = 0;

	private _frames = new Array<ApexFrame>();

	private _frameVariables = new Map<number, Map<string,DebugProtocol.Variable>>();

	//used as workaround for VF where it doesn't call the controller contructor
	private _lastPoppedFrame: ApexFrame;


	private _classPaths = new Map<string, string>();
	private _debugSession : ApexDebugSession;
	private _logLines = new Array<string>();

	public constructor(debugSession : ApexDebugSession, logLines : Array<string>, classPaths : Map<string, string>) {
		this._debugSession = debugSession;
		this._logLines = logLines;
		this._classPaths = classPaths;
	}

	public setNextFrame(){
		while (this._logPointer < this._logLines.length) {

			let line = new LogLine(this._logLines[this._logPointer]);
			console.log('LN:' + (this._logPointer+1) + ' | ' + this._logLines[this._logPointer]);
			this._logPointer++
			if(line._action == null) continue;
			let assignmentLine;
			let classPath;
			switch(line._action){
				case 'CONSTRUCTOR_ENTRY':
					assignmentLine = new LogLine(this._logLines[this._logPointer+1]);

					classPath = this.getFileFromId(line._parts[3]);
					//really we want to find the next exit and start there since this is step over
					this._frames.push(
						new ApexFrame(
							this._logPointer+1,
							`${line._parts[4]}(${this._logPointer+1})`,
							new Source(basename(classPath),
							this._debugSession.convertPathToClient(classPath)),
							assignmentLine._lineNumber,
							0
						)
					);
					break;
				case 'METHOD_ENTRY':
					assignmentLine = new LogLine(this._logLines[this._logPointer+1]);

					classPath = this.getFileFromId(line._parts[3]);
					//really we want to find the next exit and start there since this is step over
					this._frames.push(
						new ApexFrame(
							this._logPointer+1,
							`${line._parts[4]}(${this._logPointer+1})`,
							new Source(basename(classPath),
							this._debugSession.convertPathToClient(classPath)),
							assignmentLine._lineNumber,
							0
						)
					);
					break;
				case 'SYSTEM_METHOD_ENTRY':

					classPath = this.getFileFromSigniture(line._parts[3]);
					//really we want to find the next exit and start there since this is step over
					this._frames.push(
						new ApexFrame(
							this._logPointer+1,
							`${line._parts[3]}(${this._logPointer+1})`,
							new Source(basename(classPath),
							this._debugSession.convertPathToClient(classPath)),
							line._lineNumber,
							0
						)
					);
					break;
				case 'SYSTEM_METHOD_EXIT':
				case 'METHOD_EXIT':
				case 'CONSTRUCTOR_EXIT':
					this._lastPoppedFrame = this._frames.pop();
					// return;
					break;
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

					if(!this._frames.length && this._lastPoppedFrame){
						this._frames.push(this._lastPoppedFrame);
					}
					this.setFrameVariable(this.getCurrentFrame().id, variable);
					break;
				case 'USER_DEBUG':
					let debug = line._parts[4];
					this._debugSession.log(`Debug: ${debug}\n`);
					break;
				case 'execute_anonymous_apex':
					if(this._frames.length == 0){
						let name = 'Execute Anonymous';
						let logFile = this.getFileFromId('_logFile');
						this._frames.push(
							new ApexFrame(
								this._logPointer,
								`${name}(${this._logPointer})`,
								new Source(basename(logFile),
								this._debugSession.convertPathToClient(logFile)),
								this._logPointer,
								0)
						);
						return;
					}
					break;
			}
		}
	}

	public hasLines(): boolean{
		return this._logPointer < this._logLines.length-1;
	}

	public getFrames(): Array<ApexFrame>{
		return this._frames;
	}

	public getCurrentFrame(): ApexFrame{
		if(this._frames.length){
			return this._frames[this._frames.length-1];
		}
		return null;
	}

	public getFrameVariables(frameId : string): Map<string,DebugProtocol.Variable>{
		return this._frameVariables.get(parseInt(frameId));
	}

	private getFileFromId(id :string): string{
		return this._classPaths.get(id);
	}

	private getFileFromSigniture(sig :string): string{
		let parts = sig.split('.');
		if(parts && this._classPaths.get(parts[0])){
			return this._classPaths.get(parts[0]);
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
}

export class LogLine{
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

class ApexFrame implements DebugProtocol.StackFrame{
	id: number;
    source: Source;
    line: number;
    column: number;
    name: string;
    constructor(i: number, nm: string, src?: Source, ln?: number, col?: number){
		this.id = i;
		this.source = src;
		this.line = ln;
		this.column = col;
		this.name = nm;
	}
}
