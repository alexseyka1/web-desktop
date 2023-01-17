import Application, { APPLICATION_EVENTS } from "./Application"
import { camelToKebabCase } from "./Helper"
import systemBus, { SYSTEM_BUS_COMMANDS } from "./SystemBus"

export const getDefinedApplications = () => {
  const requireAll = (r) =>
    r
      .keys()
      .map(r)
      .map((item) => item.default)
  const result = requireAll(require.context("../applications/", true, /\.\/.*\/index\.js$/))
  return result.reduce((response, item) => {
    return { ...response, [camelToKebabCase(item.name) + ".app"]: item }
  }, {})
}

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
    async main() {
      this._output(`\n`)
      for (let i = 0; i < 100; i++) {
        this._output(`\r[${i}/100] loading...`)
        await new Promise((resolve) => requestAnimationFrame(() => resolve()))
      }
    }
  },
  sum: class extends Application {
    async main(args) {
      if (args.length) {
        return this._output(
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
      this._output(`Please specify any numbers to sum:`)

      while (true) {
        const string = await this._input()
        if (!string.length) break

        const number = parseFloat(string)
        sum += number
      }

      this._output(`Sum: ${sum}`)
    }
  },
}

class AppRunner {
  onInput = () => ""
  onOutput = () => {}
  onError = () => {}

  setOnInput(callback) {
    if (!callback || typeof callback !== "function") callback = () => ""
    this.onInput = callback
  }

  setOnOutput(callback) {
    if (!callback || typeof callback !== "function") callback = () => {}
    this.onOutput = callback
  }

  setOnError(callback) {
    if (!callback || typeof callback !== "function") callback = () => {}
    this.onError = callback
  }

  /**
   * @param {Application|Function} application
   */
  run(application, inputString) {
    return new Promise((resolve) => {
      /**
       * Get input arguments
       */
      let args = []
      let keys = { __input: inputString }
      if (inputString && typeof inputString === "string") {
        let _str = inputString
        const getNextKey = () => _str.match(/--([\w-_]+)\=(["'`])(.*)\2[\s|$]/) || _str.match(/--([\w-_]+)(\=([^\s]*))?/)
        let _key
        while ((_key = getNextKey())) {
          const [_match, _paramName, , _value] = _key
          keys[_paramName.toLowerCase()] = _value ?? true
          _str = _str.replace(_match, "")
        }
        args = _str.trim().split(" ")
      }

      if (application.toString().indexOf("_classCallCheck(") !== -1) {
        const dispatchExitCode = (_app, exitCode) => _app.dispatchEvent(new CustomEvent(APPLICATION_EVENTS.CLOSED, { detail: exitCode }))

        /** @type {Application} */
        const app = new application()
        app.addEventListener(APPLICATION_EVENTS.INPUT_REQUESTED, async () => {
          const _inputString = await this.onInput()
          app.dispatchEvent(new CustomEvent(APPLICATION_EVENTS.INPUT_STREAM, { detail: _inputString }))
        })
        app.addEventListener(APPLICATION_EVENTS.OUTPUT_STREAM, (e) => {
          this.onOutput(e?.detail || "")
        })
        app.addEventListener(APPLICATION_EVENTS.ERROR_STREAM, (e) => {
          this.onError(e?.detail || "")
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
                this.onOutput(_response)
                resolve(_response)
              })
              .catch((error) => {
                this.onError(error instanceof Error ? error.message : error)
                resolve()
              })
          } else {
            if (mainReturns) this.onOutput(mainReturns)
            resolve(mainReturns)
          }
        } catch (error) {
          this.onError(error instanceof Error ? error.message : error)
          resolve()
        }
      } else {
        throw new Error("Specifie application is not a class extends Application and not a function.")
      }
    })
  }
}

const appRunner = new AppRunner()

const runWithDefinedCommands = async ([command, definedCommands], response, next) => {
  const [, appName, inputString] = command.match(/^([^\s]+)\s?(.*)?/)
  console.log({ definedCommands })

  if (appName === "all-commands") {
    response.exitCode = await appRunner.run(async () => {
      return `\nAll commands available:\n - ${Object.keys({ ...COMMANDS, ...definedCommands }).join("\n - ")}`
    })
    next()
  } else if (appName in definedCommands) {
    response.exitCode = await appRunner.run(definedCommands[appName], inputString)
    next()
  } else if (appName in COMMANDS) {
    response.exitCode = await appRunner.run(COMMANDS[appName], inputString)
    next()
  } else {
    // @todo Try to find application file
    appRunner.onError(`Unknown command "${appName}"\n`)
    next()
  }
}

systemBus
  .addMiddleware(SYSTEM_BUS_COMMANDS.APP_RUNNER.RUN, async (command, response, next) => {
    await runWithDefinedCommands([command, {}], response, next)
  })
  .addMiddleware(SYSTEM_BUS_COMMANDS.APP_RUNNER.RUN_WITH_DEFINED_COMMANDS, runWithDefinedCommands)

export default appRunner
