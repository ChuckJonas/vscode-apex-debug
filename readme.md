# Apex Debug (alpha)

This is an opensource Visual Studio Code debugger for the Salesforce Apex language.

**Apex 'Log Reply' Debug** simulates Apex debugging by reading a log file and restructing stack frames.
It supports *step*, *step-into*, *step-return*, *continue* and *breakpoints*
but it is not connected to any real debugger.

## Configuring Apex Debug

* Install **Mavensmate** Extension (required dependancy)
* Install the **Apex Debug** extension in VS Code.
* Create/Open a Mavensmate project
* Check that `config/.local_store` has been populated
* Add a new file to the project root called `debug.log`
* add new `launch.json` file under .vscode folder with following:

``` json
{
    "version": "0.2.0",

    "configurations": [{
        "name": "Apex Debug",
        "request": "launch",
        "type": "apex",
        "program": "${workspaceRoot}/debug.log",
        "stopOnEntry": true
    }]
}
```

## Running Debugger
* Make sure `apex` log level to `Finest`
* run `Mavensmate: Start logging` from command pallet
* Run Anyonmous Apex (currenly only execution type supported)
* Copy downloaded log text to `debug.log` file
* Switch into debug view
* Select the debug environment "Apex Debug".
* Press the green 'play' button to start debugging.

## TODO
* Add support for other execution types (visualforce, batch, etc)
* Improve Configuration and Launch process
* Improve Stack Variable display
* Get rid of redudant/bad steps
* Add support for break on exception
* Improve general stability and error handling

## Contributing
Please Do!

This was built by starting with the [Mock Debug Sample](https://github.com/Microsoft/vscode-mock-debug.git).

[This tutorial](https://code.visualstudio.com/docs/extensions/example-debuggers) will help you get setup to
develope the debugger.

Or discuss debug adapters on Gitter:
[![Gitter Chat](http://img.shields.io/badge/chat-online-brightgreen.svg)](https://gitter.im/Microsoft/vscode)
