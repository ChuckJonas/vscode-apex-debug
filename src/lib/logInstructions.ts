import {ProgramState, ApexFrame} from './programState';

export interface LogInstruction {
	//return true if we should break
	execute(state: ProgramState): boolean;
}

class LogLine{
	public _action: string;
	public _lineNumber: number;

	public constructor(parts : Array<string>) {
		this._action = parts[1];
		this._lineNumber = parseInt(parts[2].replace('[','').replace(']',''));
	}
}

/* === INSTRUCTIONS === */

export class ApexEntry implements LogInstruction{
	public _type : string;

	public constructor(type : string) {
		this._type = type;
	}
	public execute(state: ProgramState){
		if(state._frames.length == 0){
			let name = 'Execute Anonymous';
			let classSource = state.getSourceFromId('_logFile');
			state._frames.push(
				new ApexFrame(
					state._logPointer,
					name,
					classSource,
					state._logPointer,
					0)
			);
			return true;
		}

		return false;
	}
}

export class MethodEntry extends LogLine implements LogInstruction{
	public _classId: string;
	public _signiture: string;

	public constructor(parts : Array<string>) {
		super(parts);
		if(this._action == 'SYSTEM_METHOD_ENTRY'){
			this._signiture = parts[3];
		}else{
			this._classId = parts[3];
			this._signiture = parts[4];
		}
	}
	public execute(state: ProgramState){
		let classSource;
		if(this._classId != null){
			classSource = state.getSourceFromId(this._classId);
		}else{
			classSource = state.getSourceFromSigniture(this._signiture);
		}

		state._frames.push(
			new ApexFrame(
				state._logPointer+1,
				this._signiture,
				classSource,
				this._lineNumber,
				0
			)
		);
		return false;
	}
}

export class MethodExit extends LogLine implements LogInstruction{
	public _classId: string;
	public _signiture: string;
	public _isConstructor: boolean

	public constructor(parts : Array<string>) {
		super(parts);
		if(this._action == 'METHOD_EXIT'){
			if(parts.length == 5){
			this._classId = parts[3];
			this._signiture = parts[4];
			this._isConstructor = false;
			}else{
				this._signiture = parts[3];
				this._isConstructor = true;
			}
		}else if(this._action == 'CONSTRUCTOR_EXIT'){
			this._classId = parts[3];
			this._signiture = parts[4];
			this._isConstructor = true;
		}else if(this._action == 'SYSTEM_METHOD_EXIT'){
			this._signiture = parts[3];
			this._isConstructor = false;
		}

	}
	public execute(state: ProgramState){
		let cFrame = state.getCurrentFrame();
		if(state.getCurrentFrame().name.split('.')[0] == this._signiture.split('.')[0]){
			state._lastPoppedFrame = state._frames.pop();
		}
		// return;
		return false;
	}
}

export class StatementExecute extends LogLine implements LogInstruction{

	public constructor(parts : Array<string>) {
		super(parts);
	}
	public execute(state: ProgramState){
		if(state._frames.length == 0) return false;
		let currentFrame = state.getCurrentFrame();

		if(currentFrame.name == 'Execute Anonymous'){
			//increment line # to account for log header
			this._lineNumber++;
		}
		if(currentFrame.line != this._lineNumber){
			currentFrame.line = this._lineNumber;
			return true;
		}
		return false;
	}
}

//variable name,
//type,
//a value that indicates whether the variable can be referenced,
//and a value that indicates whether the variable is static
export class VariableScopeBegin extends LogLine implements LogInstruction{
	public _name: string;
	public _type: string;
	public _referencable: boolean;
	public _static: boolean;
	public constructor(parts : Array<string>) {
		super(parts);
		this._name = parts[3];
		this._type = parts[4];
		this._referencable = (parts[5] === 'true');
		this._static = (parts[6] === 'true');
	}
	public execute(state: ProgramState){
		if(state._frames.length == 0) return false;

		let obj = {"name":this._name, "type": this._type, "static": this._static};
		state.setFrameVariable(state.getCurrentFrame().id, obj);

		return false;
	}
}

//variable name,
//a string representation of the variable's value,
//and the variable's address
export class VariableAssignment extends LogLine implements LogInstruction{
	public _name: string;
	public _value: string;
	public _address: string;
	public constructor(parts : Array<string>) {
		super(parts);
		this._name = parts[3];
		this._value = parts[4];
		this._address = parts[5];
	}
	public execute(state: ProgramState){
		if(state._frames.length == 0 ) return false;

		let valueObj;
		if(this._value.indexOf('0x') == 0 && state._heap.has(this._value)){
			// this._value = state._heap.get(this._value );
		}else{
			try{
			valueObj = JSON.parse(this._value);
			for (let property in valueObj) {
				if (valueObj.hasOwnProperty(property)) {
					let v = valueObj[property];
					if(typeof v === 'string'
						&& v.indexOf('0x') == 0){
						if(state._heap.has(v)){
							valueObj[property] = state._heap.get(v);
						}
					}
				}
			}
			}catch(e){}
		}

		let obj = {"name":this._name, "value": (valueObj==null?this._value:valueObj) , "address": this._address};
		state.setFrameVariable(state.getCurrentFrame().id, obj);

		if(this._address){
			state._heap.set(this._address, obj);
		}

		return false;
	}
}

export class UserDebug extends LogLine implements LogInstruction{
	public _message: string

	public constructor(parts : Array<string>) {
		super(parts);
		this._message = parts[4];

	}
	public execute(state: ProgramState){
		state._debugSession.log(`Debug: ${this._message}\n`);
		return false;
	}
}

export class NoOp implements LogInstruction{
	public constructor() {}
	public execute(state: ProgramState){
		return false;
	}
}