import Application from "../../modules/Application"
import "./styles.scss"
import { WindowEvents } from "../../modules/Window"
import appRunner, { getDefinedApplications } from "../../modules/AppRunner"
import systemBus, { SYSTEM_BUS_COMMANDS } from "../../modules/SystemBus"

const MODES = {
  COMMANDS_TYPING: "mode:commands-typing",
  APPLICATION_INPUT: "mode:APPLICATION_INPUT",
}

const checkDirectoryExists = async (path) => {
  const { file: directoryModel } = await systemBus.execute(SYSTEM_BUS_COMMANDS.FILE_SYSTEM.READ_FILE_META, path)
  if (!directoryModel) {
    throw new Error(`Directory "${path}" not found.`)
  } else if (!directoryModel.isDirectory) {
    throw new Error(`File "${path}" is not a directory.`)
  }
}

class Terminal extends Application {
  #state = {
    isWindowActive: true,
    isPromptActive: true,
    historyCommandIndex: null,
    history: [],
    path: "/",
    inputString: "",
  }
  #window
  #mode = MODES.COMMANDS_TYPING
  #lastChar = null

  get prompt() {
    const { path } = this.#state
    return `root[${path}]#`
  }

  /** @returns {HTMLElement} */
  get logsElement() {
    return this.#window.contentElement.querySelector(".terminal-app__logs")
  }

  /** @returns {HTMLElement} */
  get commandStringElement() {
    return this.#window.contentElement.querySelector(".terminal-app__command-string")
  }

  async #getInputString() {
    return new Promise((resolve, reject) => {
      const keydownHandler = async (e) => {
        e.preventDefault()
        if (e.key.length === 1 && !e.key.ctrlKey) {
          /**
           * Add character
           */
          this.#state.inputString = this.#state.inputString + e.key
        } else if (["delete", "backspace"].includes(e.key.toLowerCase())) {
          /**
           * Delete last character
           */
          this.#state.inputString = this.#state.inputString.substring(0, this.#state.inputString.length - 1)
        } else if (e.key.toLowerCase() === "enter") {
          /**
           * Enter was pressed
           */
          const _inputString = this.#state.inputString
          this.#state.historyCommandIndex = null
          this.#state.inputString = ""
          globalThis.removeEventListener("keydown", keydownHandler)
          resolve(_inputString)
        } else if (["arrowup", "arrowdown"].includes(e.key.toLowerCase())) {
          reject(e)
        } else if (
          e.key.toLowerCase() === "tab" &&
          e.key.toLowerCase() === this.#lastChar &&
          this.#mode === MODES.COMMANDS_TYPING &&
          !this.#state.inputString.length
        ) {
          this.runCommand("all-commands")
        }

        this.#lastChar = this.#lastChar !== null ? null : e.key.toLowerCase()
      }

      globalThis.addEventListener("keydown", keydownHandler)
      this.#window.addEventListener(WindowEvents.BLURED, () => globalThis.removeEventListener("keydown", keydownHandler))
    })
  }

  async #startTyping() {
    const { history, historyCommandIndex } = this.#state
    while (this.#state.isWindowActive && this.#state.isPromptActive) {
      try {
        const command = await this.#getInputString()
        if (command.trim().length) {
          this.#state.history.push(command)
          this.#log(`\n${this.prompt} ${command}\n`)

          await this.runCommand(command)
        } else {
          this.#log(`\n${this.prompt}`)
        }
      } catch (e) {
        if (e?.key.toLowerCase() === "arrowup") {
          /**
           * Previous command in history
           */
          if (!history.length) return
          if (historyCommandIndex === null) this.#state.historyCommandIndex = history.length - 1
          else if (historyCommandIndex > 0) this.#state.historyCommandIndex--
          const command = history[historyCommandIndex]
          this.#state.inputString = command
        } else if (e?.key.toLowerCase() === "arrowdown") {
          /**
           * Next command in history
           */
          if (!history.length || historyCommandIndex === null) return
          if (historyCommandIndex < history.length - 1) this.#state.historyCommandIndex++
          else if (historyCommandIndex === history.length - 1) this.#state.historyCommandIndex = null

          if (historyCommandIndex === null) {
            this.#state.inputString = ""
          } else {
            const command = history[historyCommandIndex]
            this.#state.inputString = command
          }
        }
      }
    }
  }

  async main(args) {
    this.#window = await this.createWindow({
      width: 500,
      height: 400,
      title: "Terminal",
      icon: `<span class="material-symbols-outlined">terminal</span>`,
    })
    this.#window.domElement.classList.add("terminal-app")
    this.#window.contentElement.innerHTML = `<div>
      <pre class="terminal-app__logs"></pre>
      <pre class="terminal-app__command-string"></pre>
    </div>`

    /**
     * Copy and paste selected text
     */
    this.#window.domElement.addEventListener("contextmenu", (e) => {
      const selection = globalThis.getSelection()
      if (selection.type === "Range") {
        const range = selection.getRangeAt(0)
        const text = range.toString()
        if (text && text.length) {
          this.#state.inputString += text
          range.collapse(true)
        }
      }
    })

    let path
    if (args) path = args[0]
    if (path) {
      try {
        await checkDirectoryExists(path)
        this.#state.path = path
      } catch (e) {
        this.#log(e.message)
        this.#state.path = "/"
      }
    }
    this.#initState()

    this.#window.addEventListener(WindowEvents.BLURED, () => {
      this.#state.isWindowActive = false
    })
    this.#window.addEventListener(WindowEvents.FOCUSED, () => {
      this.#state.isWindowActive = true
      if (this.#mode === MODES.COMMANDS_TYPING) this.#startTyping()
    })

    appRunner.setOnInput(this.#onInputRequested.bind(this))
    appRunner.setOnOutput((message) => this.#log(message))
    appRunner.setOnError((message) => this.#log(message))
    this.render()
    this.#startTyping()
  }

  #initState() {
    this.#state = new Proxy(this.#state, {
      get: (target, prop) => {
        return target[prop]
      },
      set: (target, prop, value, receiver) => {
        const result = Reflect.set(target, prop, value, receiver)
        this.render()
        return result
      },
    })
  }

  #onInputRequested() {
    return new Promise((resolve) => {
      const getInput = () => {
        return this.#getInputString()
          .then((_inputString) => {
            this.#state.history.push(_inputString)
            this.#log(`\n${_inputString}`)
            resolve(_inputString)
          })
          .catch(() => resolve(""))
      }

      getInput()
      this.#window.addEventListener(WindowEvents.FOCUSED, () => getInput())
    })
  }

  render() {
    const { inputString, isWindowActive, isPromptActive } = this.#state

    const commandString = isWindowActive
      ? `${isPromptActive ? `${this.prompt}&nbsp;` : ""}${inputString}<span class="terminal-app__cursor"></span>`
      : `${isPromptActive ? `${this.prompt}&nbsp;` : ""}${inputString}`

    this.commandStringElement.innerHTML = commandString
  }

  #log(message) {
    if (!message) return
    const addTextNode = (_text) => {
      const span = document.createTextNode(_text)
      this.logsElement.append(span)
    }

    if (message.indexOf("\r") !== -1) {
      message = message.replace(/\\r/g, "")
      if (!this.logsElement.childNodes.length) addTextNode(message.replace)
      else {
        const lastTextNode = this.logsElement.childNodes[this.logsElement.childNodes.length - 1]
        lastTextNode.textContent = message
      }
    } else {
      addTextNode(message)
    }

    this.#window.contentElement.querySelector(".terminal-app__command-string").scrollIntoView()
  }

  COMMANDS = {
    pwd: () => this.#state.path,
    cd: async ([path]) => {
      if (!path) return
      checkDirectoryExists(path)
      this.#state.path = path
    },
    clear: () => {
      const el = this.#window.contentElement,
        divHeight = el.offsetHeight,
        lineHeight = el.computedStyleMap().get("line-height").value,
        lines = Math.ceil(divHeight / lineHeight)
      this.#log("\n".repeat(lines))
    },
  }

  async runCommand(command) {
    this.#state.isPromptActive = false
    this.#mode = MODES.APPLICATION_INPUT
    let _availableCommands = this.COMMANDS

    if (this.#state.path === "/applications") {
      _availableCommands = { ..._availableCommands, ...getDefinedApplications() }
    }

    await systemBus.execute(SYSTEM_BUS_COMMANDS.APP_RUNNER.RUN_WITH_DEFINED_COMMANDS, [command, _availableCommands])

    this.#state.isPromptActive = true
    this.#mode = MODES.COMMANDS_TYPING
  }
}

export default Terminal
