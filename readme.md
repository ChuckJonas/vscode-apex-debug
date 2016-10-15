# Apex Debug (alpha)
A Visual Studio Code debugger for the Salesforce Apex language.

**'Log Reply' Debugging** simulates Apex debugging by reading a log file and restructing stack frames.

Supports *step*, *step-into*, *step-return*, *continue* and *breakpoints*
but it is not connected to any real debugger.

## Getting Started

### Configuring Apex Debug

* Install **Mavensmate** Extension (required dependency)
* Install the **Apex Debug** extension in VS Code.
* Create/Open a Mavensmate project
* Check that `config/.local_store` has been populated
* Add a new file to the project root called `debug.log`
* add new `launch.json` by going to the Debug view, clicking the 'Gear' icon and selecting `Apex-Debug`
* You can replace `${command.AskForProgramName}` with a hardcoded filename, but it the debug log must remain at the root of the workspace (for now)

### Running Debugger

* Set `apex` log level to `Finest` in `/config/.debug`
* run `Mavensmate: Start logging` from command pallet
* Run Anyonmous Apex (currenly only execution type supported)
* Copy downloaded log text to `debug.log` file
* Switch into Debug View
* Press the green 'play' button to start debugging.

## [TODO]

* Better exception handling
* Add support for other execution types (visualforce, batch, etc)
* Improve Configuration and Launch process
* Improve Stack Variable display
* Get rid of redudant/bad steps
* Add support for break on exception and watch variables
* Add test coverage
* Hook up to CI process

## Contributing

***Please Do!***

### Debugging the Debugger

* Fork
* Clone
* Open in VS code
* Open `src/apexDebug.ts`. Set a break point at start of `launchRequest()`
* Open Debug Window, select `Run Server` configuration
* F5 (starts debugging)
* Setup/Open a mavensmate project (See getting started)
* Open `launch.json` and add `"debugServer": 4711,` above configurations
* F5
* Your `vs-apex-debugger` project should stop on breakpoint

### Developer Resources

* VS Code Gitter: [![Gitter Chat](http://img.shields.io/badge/chat-online-brightgreen.svg)](https://gitter.im/Microsoft/vscode)
* [Debug Adapter tutorial](https://code.visualstudio.com/docs/extensions/example-debuggers)
* [Mock Debug Sample](https://github.com/Microsoft/vscode-mock-debug.git) (used as scaffolding for this project)




