import {StackFrame, Source, Handles}
from 'vscode-debugadapter';

import {DebugProtocol} from 'vscode-debugprotocol';
import {basename} from 'path';

import {ApexDebugSession} from '../apexDebug';

export class ProgramState{
	public _logPointer = 0;

	public _frames = new Array<ApexFrame>();

	public _frameVariables = new Map<number, Map<string,any>>();
	public _variableHandles : Handles<any>;

	public _heap = new Map<string, any>();

	//used as workaround for VF where it doesn't call the controller contructor
	public _lastPoppedFrame: ApexFrame;

	public _classPaths = new Map<string, string>();
	public _debugSession : ApexDebugSession;
	public _logLines = new Array<string>();

	public constructor(debugSession : ApexDebugSession, logLines : Array<string>,
		classPaths : Map<string, string>, variableHandles : Handles<string>) {
		this._debugSession = debugSession;
		this._logLines = logLines;
		this._classPaths = classPaths;
		this._variableHandles = variableHandles;
	}

	public getSourceFromId(id :string): Source{
		let filePath;
		if(this._classPaths.has(id)){
			filePath = this._classPaths.get(id);
		}else{
			filePath = '';
		}
		return new Source(basename(filePath), this._debugSession.convertPathToClient(filePath));
	}

	public getSourceFromSigniture(sig :string): Source{
		let parts: string[];
		if(sig.indexOf('.') == -1){
			parts = sig.split(' ');
		}else{
			parts = sig.split('.');
		}
		return this.getSourceFromId(parts[0]);
	}

	public getCurrentFrame(): ApexFrame{
		if(this._frames.length){
			return this._frames[this._frames.length-1];
		}

		return null;
	}

	public setFrameVariable(frameId : number, variable : any){
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

export class ApexFrame implements DebugProtocol.StackFrame{
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