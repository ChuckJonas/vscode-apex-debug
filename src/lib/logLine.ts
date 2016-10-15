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