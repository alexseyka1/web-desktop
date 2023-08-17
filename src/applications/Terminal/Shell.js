import Application from "../../modules/Application"
import { resolvePath } from "../../modules/FileSystem"
import FileMeta from "../../modules/FileSystem/FileMeta"
import systemBus, { SYSTEM_BUS_COMMANDS } from "../../modules/SystemBus"

const checkDirectoryExists = async (path) => {
  const { file: directoryModel } = await systemBus.execute(SYSTEM_BUS_COMMANDS.FILE_SYSTEM.READ_FILE_META, path)
  if (!directoryModel) {
    throw new Error(`Directory "${path}" not found.`)
  } else if (!directoryModel.isDirectory) {
    throw new Error(`File "${path}" is not a directory.`)
  }
}

class Shell extends Application {
  #state = {
    workDir: "/home",
    isRunning: true,
  }

  async main(args, keys) {
    if ("work-dir" in keys) this.#state.workDir = keys["work-dir"]

    try {
      await checkDirectoryExists(this.#state.workDir)
    } catch (e) {
      this._error(e.message)
      this.#state.workDir = "/"
    }

    while (this.#state.isRunning) {
      await this.#tty()
    }
  }

  async #tty() {
    this.print(`${this.prompt} `)
    const string = (await this._input()).trim()
    if (string.length) {
      try {
        await this.runCommand(string)
      } catch (e) {
        this._error(e.message)
      }
    }
  }

  get prompt() {
    return `root[${this.#state.workDir}]#`
  }

  COMMANDS = {
    pwd: () => this.#state.workDir + "\n",
    cd: async ([path]) => {
      if (!path) return
      const resolvedPath = resolvePath(this.#state.workDir, path)
      if (resolvedPath !== "/") checkDirectoryExists(resolvedPath)
      this.#state.workDir = resolvedPath
    },
    ls: (() => {
      const parent = this
      return class extends Application {
        async main(args, keys) {
          let path = parent.#state.workDir
          if (args.length) path = args[0]

          const showHidden = "a" in keys

          const sort = "name"
          /** @type {FileMeta[]} */
          const iterator = (await systemBus.execute(SYSTEM_BUS_COMMANDS.FILE_SYSTEM.GET_SORTED_FILES_IN_DIRECTORY, { path, sort })).iterator
          let entriesCount = 0
          for await (let file of iterator) {
            if (file.name.startsWith(".") && !showHidden) continue

            if ("l" in keys) {
              const d = file.isDirectory ? "d" : "-",
                x = file.isApplication ? "x" : "-"
              this.println(`${d}rw${x}rw${x}rw${x} 1 root root ${file.name}`)
            } else {
              this.print(file.name + " ")
              entriesCount++
            }
          }
          if (entriesCount) this.println()
        }
      }
    })(),
    clear: () => {
      // const el = this.#window.contentElement,
      //   divHeight = el.offsetHeight,
      //   lineHeight = el.computedStyleMap().get("line-height").value,
      //   lines = Math.ceil(divHeight / lineHeight)
      // this.#log("\n".repeat(lines))
    },
    exit: () => {
      this.#state.isRunning = false
    },
  }

  async runCommand(command) {
    let _availableCommands = this.COMMANDS

    if (this.#state.workDir === "/applications") {
      _availableCommands = { ..._availableCommands }
    }

    /**
     * Replace each relative path to absolute one
     */
    let _command = command
    const _paths = _command.match(/(\.{1,2})?\/[^\s]+/g)
    if (_paths) {
      for (let _path of _paths) {
        _command = _command.replace(_path, resolvePath(this.#state.workDir, _path))
      }
    }

    try {
      const { exitCode } = await systemBus.execute(SYSTEM_BUS_COMMANDS.APP_RUNNER.RUN_COMMAND_WITH_DEFINED_COMMANDS, [
        _command,
        _availableCommands,
        this.streams,
      ])
      if (exitCode && typeof exitCode === "number") {
        this.println(`Command exited with code: ${exitCode}`)
      }
    } catch (e) {
      this.println(`Internal error: ${e.message}`)
    }
  }
}

export default Shell
