# Apex Debug (alpha)
[![Build Status](https://travis-ci.org/ChuckJonas/vscode-apex-debug.svg?branch=master)](https://travis-ci.org/ChuckJonas/vscode-apex-debug)

[![Visual Studio Marketplace](https://vsmarketplacebadge.apphb.com/installs-short/chuckjonas.apex-debug.svg?style=flat-square)](https://marketplace.visualstudio.com/items?itemName=chuckjonas.apex-debug)

A Visual Studio Code debugger for the Salesforce Apex language.

**'Log Reply' Debugging** simulates Apex debugging by reading a log file and restructing stack frames.

Supports *step*, *step-into*, *step-return*, *continue* and *breakpoints*
but it is not connected to any real debugger.

## Getting Started

### Configuring Apex Debug

* Install [Mavensmate Extension](https://marketplace.visualstudio.com/items?itemName=DavidHelmer.mavensmate#review-details) (required dependency)
* Install the **Apex Debug** extension in VS Code.
* Create/Open a Mavensmate project
* Check that `config/.local_store` has been populated
* add new `launch.json` by going to the Debug view, clicking the 'gear' icon and selecting `Apex-Debug`
  * `workspaceRoot` must point to the root of a mavensmate project
  * You can set `logFile` to a hardcoded value, if desired.  `${command.AskForLogName}` will allow you to select files from `debug\logs\`

#### Example launch.json

``` json
{
    "version": "0.2.0",
    "configurations": [
        {
            "name": "Apex-Debug",
            "type": "apex",
            "request": "launch",
            "logFile": "${command.AskForLogName}",
            "workspaceRoot": "${workspaceRoot}",
            "stopOnEntry": true,
            "traceLog": false //output log lines as they are processed
        }
    ]
}
```

### Running Debugger

* Set log levels in `/config/.debug` to `"ApexCode": "FINEST"` & `"System": "FINE"`
* run `Mavensmate: Start logging` from command pallet
* Trigger a log event (Run Anyonmous Apex, load a page, etc)
* Switch into Debug View
* Press the green 'play' button
* Select a file (if not hardcoded in `launch.json`)

### Usage Notes

* If your classes change from the time you generated the log, things will certainly break
* If your log gets too long, Salesforce will truncate it.  Try reducing non-required levels.
* Depending on the execution type, some lines might never be stepped on, dispite the fact they were actually executed.  *Don't rely on the fact that a breakpoint wasn't hit to indicate that the line was not executed*
* This will probably never be perfect (although it can be much better than it currently is).  Salesforce only gives us so much info to work with.

## [TODO]

* Better exception handling
* Add/Improve support for all execution types (Visualforce, tests, batch, etc)
* Improve stack variable display
* Get rid of redudant/bad steps
* Add support for break on exception and watch variables?! (maybe)
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




