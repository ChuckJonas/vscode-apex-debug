# Apex Debug

This is an opensource Visual Studio Code debugger for the Salesforce Apex language.

**Apex 'Log Reply' Debug** simulates Apex debugging by reading a log file and restructing stack frames.
It supports *step*, *step-into*, *step-return*, *continue* and *breakpoints* (plans to support other features in the future)
but it is not connected to any real debugger.

## Using Apex Debug

* Install **Mavensmate** Extension (currently dependant on)
* Install the **Apex Debug** extension in VS Code.
* Create/Open a Mavensmate project
* Add a new file to the project root called 'debug.log'
* Set Log Levels to Apex:Finest
* Start Logging with Mavensmate
* Execute something
* Copy downloaded log to 'debug.log'
* Switch to the debug viewlet and press the gear dropdown.
* Select the debug environment "Apex Debug".
* Press the green 'play' button to start debugging.

## Contributing
Please Do!

This was built by starting with the [Mock Debug Sample](https://github.com/Microsoft/vscode-mock-debug.git).

[This tutorial](https://code.visualstudio.com/docs/extensions/example-debuggers) will help you get setup to
develope the debugger.

Or discuss debug adapters on Gitter:
[![Gitter Chat](http://img.shields.io/badge/chat-online-brightgreen.svg)](https://gitter.im/Microsoft/vscode)
