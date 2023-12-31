import Shell from "../applications/Terminal/Shell"
import { getDefinedApplications } from "../classes/ApplicationFinder"
import Application, { APPLICATION_EVENTS } from "./Application"
import { getFileNameFromPath } from "./FileSystem"
import { StandardStreams } from "./StandardStreams"
import systemBus, { SYSTEM_BUS_COMMANDS, SYSTEM_BUS_EVENTS } from "./SystemBus"

const COMMANDS = {
  "test-text": ([times = 1]) => {
    return `Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book. It has survived not only five centuries, but also the leap into electronic typesetting, remaining essentially unchanged. It was popularised in the 1960s with the release of Letraset sheets containing Lorem Ipsum passages, and more recently with desktop publishing software like Aldus PageMaker including versions of Lorem Ipsum.\nfirst\nsecond
                  __ooooooooo__
               oOOOOOOOOOOOOOOOOOOOOOo
           oOOOOOOOOOOOOOOOOOOOOOOOOOOOOOo
        oOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOo
      oOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOo
    oOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOo
   oOOOOOOOOOOO*  *OOOOOOOOOOOOOO*  *OOOOOOOOOOOOo
  oOOOOOOOOOOO      OOOOOOOOOOOO      OOOOOOOOOOOOo
  oOOOOOOOOOOOOo  oOOOOOOOOOOOOOOo  oOOOOOOOOOOOOOo
 oOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOo
 oOOOO     OOOOOOOOOOOOOOOOOOOOOOOOOOOOOOO     OOOOo
 oOOOOOO OOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOO OOOOOOo
  *OOOOO  OOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOO  OOOOO*
  *OOOOOO  *OOOOOOOOOOOOOOOOOOOOOOOOOOOOO*  OOOOOO*
   *OOOOOO  *OOOOOOOOOOOOOOOOOOOOOOOOOOO*  OOOOOO*
    *OOOOOOo  *OOOOOOOOOOOOOOOOOOOOOOO*  oOOOOOO*
      *OOOOOOOo  *OOOOOOOOOOOOOOOOO*  oOOOOOOO*
        *OOOOOOOOo  *OOOOOOOOOOO*  oOOOOOOOO*
           *OOOOOOOOo           oOOOOOOOO*
               *OOOOOOOOOOOOOOOOOOOOO*
                    ""ooooooooo""
    `.repeat(times)
  },
  whoami: () => "root",
  counter: class extends Application {
    async main(args) {
      let max = 100
      if (args && args.length) max = args[0]
      for (let i = 1; i <= max; i++) {
        this.println(`[${i}/${max}] loading...`)
        await new Promise((resolve) => requestAnimationFrame(() => resolve()))
      }
    }
  },
  sum: class extends Application {
    async main(args) {
      if (args.length) {
        return this.print(
          args
            .reduce((sum, num) => {
              num = parseFloat(num.replace(",", "."))
              if (Number.isNaN(num)) return sum
              else return sum + num
            }, 0)
            .toString()
        )
      }

      let sum = 0
      this.println(`Please specify any numbers to sum:`)

      while (true) {
        const string = await this._input()
        if (!string.length) break

        const number = parseFloat(string)
        sum += number
      }

      this.println(`Sum: ${sum}`)
    }
  },
  sh: Shell,
}

class AppRunner {
  onInput = () => ""

  setOnInput(callback) {
    if (!callback || typeof callback !== "function") callback = () => ""
    this.onInput = callback
  }

  /**
   * @param {Application|Function} application
   * @param {String} inputString
   * @param {StandardStreams} streams
   */
  run(application, inputString, streams) {
    return new Promise((resolve, reject) => {
      /**
       * Get input arguments
       */
      let args = []
      let keys = { __input: inputString }
      if (inputString && typeof inputString === "string") {
        let _str = inputString
        const getNextKeys = () => _str.match(/-([\w-_]+)/)
        const getNextKeyValue = () => _str.match(/--([\w-_]+)\=(["'`])(.*)\2[\s|$]/) || _str.match(/--([\w-_]+)(\=([^\s]*))?/)
        let _key
        while ((_key = getNextKeyValue())) {
          const [_match, _paramName, , _value] = _key
          keys[_paramName.toLowerCase()] = _value ?? true
          _str = _str.replace(_match, "")
        }
        while ((_key = getNextKeys())) {
          const [_match, _keys] = _key
          _keys.split("").forEach((item) => (keys[item] = true))
          _str = _str.replace(_match, "")
        }
        _str = _str.trim()
        if (_str.length) args = _str.split(" ")
      }

      /**
       * Run application
       */
      if (application.toString().indexOf("_classCallCheck(") !== -1) {
        const dispatchExitCode = (_app, exitCode) => _app.dispatchEvent(new CustomEvent(APPLICATION_EVENTS.CLOSED, { detail: exitCode }))

        /** @type {Application} */
        const app = new application(streams)
        app.addEventListener(APPLICATION_EVENTS.INPUT_REQUESTED, async () => {
          try {
            const _inputString = await this.onInput()
            app.dispatchEvent(new CustomEvent(APPLICATION_EVENTS.INPUT_STREAM, { detail: _inputString }))
          } catch (e) {
            app.dispatchEvent(new Event(APPLICATION_EVENTS.CLOSED))
          }
        })
        app.addEventListener(APPLICATION_EVENTS.OUTPUT_STREAM, (e) => {
          streams.output.write(e?.detail || "")
        })
        app.addEventListener(APPLICATION_EVENTS.ERROR_STREAM, (e) => {
          streams.error.write(e?.detail || "")
        })
        app.addEventListener(APPLICATION_EVENTS.CLOSED, (e) => {
          resolve(e?.detail)
        })

        const mainReturns = app.main(args, keys)
        if (mainReturns instanceof Promise) {
          mainReturns.then((exitCode) => dispatchExitCode(app, exitCode))
        } else if (mainReturns || mainReturns === 0) {
          dispatchExitCode(app, mainReturns)
          resolve(mainReturns)
        }
      } else if (typeof application === "function") {
        try {
          const mainReturns = application(args, keys)
          if (mainReturns instanceof Promise) {
            mainReturns
              .then((_response) => {
                streams.output.write(_response)
                resolve(_response)
              })
              .catch((error) => {
                streams.error.write(error instanceof Error ? error.message : error)
                resolve()
              })
          } else {
            if (mainReturns) streams.output.write(mainReturns)
            resolve(mainReturns)
          }
        } catch (error) {
          streams.error.write(error instanceof Error ? error.message : error)
          resolve()
        }
      } else {
        throw new Error("Specific application is not a class extends Application and not a function.")
      }
    })
  }
}

const appRunner = new AppRunner()

const runWithDefinedCommands = async ([command, definedCommands, streams], response, next) => {
  const [, commandName, inputString] = command.match(/^([^\s]+)\s?(.*)?/)

  if (commandName === "all-commands") {
    response.exitCode = await appRunner.run(
      async () => {
        return `All commands available:\n - ${Object.keys({ ...COMMANDS, ...definedCommands }).join("\n - ")}`
      },
      "",
      streams
    )
    next()
  } else if (commandName in definedCommands) {
    response.exitCode = await appRunner.run(definedCommands[commandName], inputString, streams)
    next()
  } else if (commandName in COMMANDS) {
    response.exitCode = await appRunner.run(COMMANDS[commandName], inputString, streams)
    next()
  } else if (/^\/applications\/.*\.app$/.test(commandName)) {
    const appName = getFileNameFromPath(commandName)
    const definedApplications = getDefinedApplications()
    if (!(appName in definedApplications)) {
      streams?.error?.write(`Unknown command "${appName}"`)
    } else {
      const requiredApplication = definedApplications[appName].module
      response.exitCode = await appRunner.run(requiredApplication, inputString, streams)
    }
    next()
  } else {
    streams?.error?.write(`Unknown command "${commandName}"`)
    next()
  }
}

systemBus
  .addMiddleware(SYSTEM_BUS_COMMANDS.APP_RUNNER.RUN_COMMAND, async (command, response, next) => {
    await runWithDefinedCommands([command, {}], response, next)
  })
  .addMiddleware(SYSTEM_BUS_COMMANDS.APP_RUNNER.RUN_COMMAND_WITH_DEFINED_COMMANDS, runWithDefinedCommands)
  .addMiddleware(SYSTEM_BUS_COMMANDS.APP_RUNNER.RUN_APPLICATION, async ({ app, input, streams }, response, next) => {
    response.exitCode = await appRunner.run(app, input, streams)
    next()
  })

export default appRunner
