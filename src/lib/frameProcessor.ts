import {StackFrame, Source, Handles}
from 'vscode-debugadapter';

import {DebugProtocol} from 'vscode-debugprotocol';
import {basename} from 'path';

import {ApexDebugSession} from '../apexDebug';
import {LogInstructionFactory} from './instructionFactory';
import {ProgramState, ApexFrame} from './programState';

export class FrameProcessor{

	//refactored
	private _logInstructionFactory : LogInstructionFactory;
	private _state : ProgramState;

	public constructor(debugSession : ApexDebugSession, logLines : Array<string>,
		classPaths : Map<string, string>, variableHandles : Handles<string>) {

		this._logInstructionFactory = new LogInstructionFactory();

		this._state = new ProgramState(debugSession, logLines, classPaths, variableHandles);

	}

	public setNextFrame(){
		while (this.hasLines()) {

			let line = this._state._logLines[this._state._logPointer];
			console.log('LN:' + (this._state._logPointer+1) + ' | ' + line);
			this._state._logPointer++;

			let instruction = this._logInstructionFactory.getInstruction(line);
			if(instruction && instruction.execute(this._state)){
				break;
			}
		}
	}

	public hasLines(): boolean{
		return this._state._logPointer < this._state._logLines.length-1;
	}

	public getFrames(): Array<ApexFrame>{
		return this._state._frames;
	}

	public getCurrentFrame(): ApexFrame{
		return this._state.getCurrentFrame();
	}

	public getFrameVariables(frameId : string): Array<DebugProtocol.Variable>{
		let frameMap = this._state._frameVariables.get(parseInt(frameId));
		let vars = new Array<DebugProtocol.Variable>();
		if(frameMap){
			frameMap.forEach((v: any) => {
				let refId = 0;
				let value: string;
				let name: string;
				name = v.name;
				if(v.value instanceof Object){
					refId = this._state._variableHandles.create(v.value);
					value = 'Object';
				}else{
					value = v.value;
				}
				vars.push({
					name: (v.name==null?null:v.name.toString()),
					type: (v.type==null?null:v.type.toString()),
					value: (value==null?null:value.toString()),
					variablesReference: refId
				});
			});
		}

		return vars;
	}

}
