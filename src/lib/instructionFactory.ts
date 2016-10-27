import {CodeUnitStarted,LogInstruction,MethodEntry,MethodExit,
		StatementExecute,VariableScopeBegin,
		VariableAssignment,UserDebug,NoOp,ApexEntry} from './logInstructions';

export class LogInstructionFactory{

	public constructor(){}

	public getInstruction(line :string): LogInstruction{
		let parts = line.split('|');
		if(parts.length >= 3){ //all logs should have at least 3 parts
			switch(parts[1]){
				case 'CODE_UNIT_STARTED':
					return new CodeUnitStarted(parts);
				//add new frames
				case 'CONSTRUCTOR_ENTRY':
				case 'METHOD_ENTRY':
				// case 'SYSTEM_METHOD_ENTRY':
					return new MethodEntry(parts);

				//pop frames
				// case 'SYSTEM_METHOD_EXIT':
				case 'METHOD_EXIT':
				case 'CONSTRUCTOR_EXIT':
				case 'SYSTEM_CONSTRUCTOR_EXIT':
				case 'CODE_UNIT_FINISHED':
					return new MethodExit(parts);

				//execute line number
				case 'STATEMENT_EXECUTE':
					return new StatementExecute(parts);

				//allocate varibles
				case 'VARIABLE_SCOPE_BEGIN': //init frame variable types
					return new VariableScopeBegin(parts);

				//assign varables
				case 'VARIABLE_ASSIGNMENT': //assign frame variable values
					return new VariableAssignment(parts);

				//output debug
				case 'USER_DEBUG':
					return new UserDebug(parts);

				//[TODO]

				// case 'EXCEPTION_THROWN':
				// case 'FATAL_ERROR':

				//noop
				default:
					return new NoOp();
			}
		}
		// else if(line.indexOf('Execute Anonymous:') != -1){
		// 	return new ApexEntry('A');
		// }
		return null;
	}
}


