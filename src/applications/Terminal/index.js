import Application from "../../modules/Application"
import "./styles.scss"
import { WindowEvents } from "../../modules/Window"
import appRunner, { getDefinedApplications } from "../../modules/AppRunner"
import systemBus, { SYSTEM_BUS_COMMANDS } from "../../modules/SystemBus"
import { resolvePath } from "../../modules/FileSystem"

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
    cursorPosition: null,
  }
  #window
  #mode = MODES.COMMANDS_TYPING
  #lastChar = null
  #isAutocompleteRunning = false
  #fileAutocomplete = {
    directory: null,
    results: [],
    currentFileIndex: 0,
  }

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

  get filenameAutocomplete() {
    if (this.#isAutocompleteRunning) return
    if (!this.#fileAutocomplete.results.length) {
      this.#fileAutocomplete.currentFileIndex = 0
      return
    }
    const result = this.#fileAutocomplete.results[this.#fileAutocomplete.currentFileIndex++]
    if (this.#fileAutocomplete.currentFileIndex >= this.#fileAutocomplete.results.length) {
      this.#fileAutocomplete.currentFileIndex = 0
    }
    return result
  }

  async fetchAutocomplete() {
    if (this.#isAutocompleteRunning) return
    this.#isAutocompleteRunning = true

    const _commandParts = this.#state.inputString.replace(/\s{2,}/, " ").split(" ")
    const _lastPart = _commandParts.pop()
    /** If string starts from ".", ".." or "/" */
    if ([".", "/"].includes(_lastPart.substring(0, 1)) || _lastPart.substring(0, 2) === "..") {
      if (!/^.*\/.*/.test(this.#state.inputString)) return
      const _resolvedPath = resolvePath(this.#state.path, _lastPart)
      let [, _directory, _filename] = _resolvedPath.match(/^(.*)\/(.*)/)
      _directory = _directory || "/"
      if (this.#fileAutocomplete.directory === _directory) return

      const { iterator } = await systemBus.execute(SYSTEM_BUS_COMMANDS.FILE_SYSTEM.GET_FILES_ITERATOR, _directory)
      let _foundFileNames = []
      for await (let _file of iterator) {
        if (_filename.trim().length) {
          if (_file.name.startsWith(_filename)) _foundFileNames.push(_file.name)
        } else {
          _foundFileNames.push(_file.name)
        }
      }
      _foundFileNames = _foundFileNames.sort()

      this.#fileAutocomplete.directory = _directory
      this.#fileAutocomplete.currentFileIndex = 0
      this.#fileAutocomplete.results = _foundFileNames
    } else {
      console.log("Command Autocomplete", _lastPart)
    }

    this.#isAutocompleteRunning = false
  }

  async #getInputString() {
    return new Promise((_resolve, _reject) => {
      const removeHandler = () => globalThis.removeEventListener("keydown", keydownHandler)
      const resolve = (value) => {
        removeHandler()
        _resolve(value)
      }
      const reject = (value) => {
        removeHandler()
        _reject(value)
      }

      const keydownHandler = async (e) => {
        e.preventDefault()
        if (e.key.length === 1 && !e.ctrlKey) {
          /**
           * Add character
           */
          if (this.#state.cursorPosition) {
            /**
             * If cursor position is not null
             */
            const _pos = this.#state.inputString.length - Math.abs(this.#state.cursorPosition)
            let _newString = this.#state.inputString.split("")
            _newString.splice(_pos, 0, e.key)
            _newString = _newString.join("")
            this.#state.inputString = _newString
          } else {
            this.#state.inputString = this.#state.inputString + e.key
          }
        } else if (e.ctrlKey && e.key === "c") {
          /**
           * Ctrl+C pressed
           */
          reject(e)
        } else if (["delete", "backspace"].includes(e.key.toLowerCase())) {
          /**
           * Delete last character
           */
          if (this.#state.cursorPosition) {
            /**
             * If cursor position is not null
             */
            const _pos = this.#state.inputString.length - Math.abs(this.#state.cursorPosition)
            let _newString = this.#state.inputString.split("")
            _newString.splice(_pos - 1, 1)
            _newString = _newString.join("")
            this.#state.inputString = _newString
          } else {
            this.#state.inputString = this.#state.inputString.substring(0, this.#state.inputString.length - 1)
          }
        } else if (e.key.toLowerCase() === "enter") {
          /**
           * Enter was pressed
           */
          const _inputString = this.#state.inputString
          this.#state.historyCommandIndex = null
          this.#state.inputString = ""
          globalThis.removeEventListener("keydown", keydownHandler)
          resolve(_inputString)
        } else if (["arrowup", "arrowdown", "arrowleft", "arrowright"].includes(e.key.toLowerCase())) {
          /**
           * Some arrow key pressed
           */
          reject(e)
        } else if (e.key.toLowerCase() === "tab" && this.#state.inputString.length) {
          /**
           * Autocomplete command
           */
          await this.fetchAutocomplete()
          console.log(this.filenameAutocomplete, this.#fileAutocomplete)
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
      this.#window.addEventListener(WindowEvents.BLURED, () => removeHandler())
    })
  }

  async #startTyping() {
    while (this.#state.isWindowActive && this.#state.isPromptActive) {
      try {
        const command = await this.#getInputString()
        this.#state.cursorPosition = null
        if (command.trim().length) {
          this.#state.history.push(command)
          this.#state.historyCommandIndex = null
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
          this.#state.cursorPosition = null
          if (this.#state.history.length) {
            if (this.#state.historyCommandIndex === null) this.#state.historyCommandIndex = this.#state.history.length - 1
            else if (this.#state.historyCommandIndex > 0) this.#state.historyCommandIndex--
            const command = this.#state.history[this.#state.historyCommandIndex]
            this.#state.inputString = command
          }
        } else if (e?.key.toLowerCase() === "arrowdown") {
          /**
           * Next command in history
           */
          this.#state.cursorPosition = null
          if (this.#state.history.length && this.#state.historyCommandIndex !== null) {
            if (this.#state.historyCommandIndex < this.#state.history.length - 1) this.#state.historyCommandIndex++
            else if (this.#state.historyCommandIndex === this.#state.history.length - 1) this.#state.historyCommandIndex = null

            if (this.#state.historyCommandIndex === null) {
              this.#state.inputString = ""
            } else {
              const command = this.#state.history[this.#state.historyCommandIndex]
              this.#state.inputString = command
            }
          }
        } else if (e?.key.toLowerCase() === "arrowleft") {
          this.#state.cursorPosition = Math.max(this.#state.cursorPosition - 1, this.#state.inputString.length * -1)
          if (this.#state.cursorPosition === 0) this.#state.cursorPosition = null
        } else if (e?.key.toLowerCase() === "arrowright") {
          this.#state.cursorPosition = Math.min(this.#state.cursorPosition + 1, 0)
          if (this.#state.cursorPosition === 0) this.#state.cursorPosition = null
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
    this.#window.domElement.addEventListener("contextmenu", async (e) => {
      const selection = globalThis.getSelection()
      if (selection.type === "Range") {
        const range = selection.getRangeAt(0)
        const text = range.toString()
        if (text && text.length) {
          globalThis.navigator.clipboard.writeText(text)
          this.#state.inputString += text
          range.collapse(true)
        }
      } else {
        const clipboardText = await globalThis.navigator.clipboard.readText()
        if (clipboardText && clipboardText.length) {
          this.#state.inputString += clipboardText
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
        if (prop === "inputString") {
          this.commandStringElement.scrollIntoView({ block: "end", inline: "end" })
        }
        return result
      },
    })
  }

  #onInputRequested() {
    return new Promise((resolve, reject) => {
      const getInput = () => {
        return this.#getInputString()
          .then((_inputString) => {
            this.#log(`\n${_inputString}`)
            resolve(_inputString)
          })
          .catch(() => reject())
      }

      getInput()
      this.#window.addEventListener(WindowEvents.FOCUSED, () => getInput())
    })
  }

  render() {
    const { inputString, isWindowActive, isPromptActive, cursorPosition } = this.#state
    const cursorStyle = cursorPosition !== null ? `margin-left: ${cursorPosition}ch` : ""

    const commandString = isWindowActive
      ? `${isPromptActive ? `${this.prompt}&nbsp;` : ""}${inputString}<span class="terminal-app__cursor" style="${cursorStyle}"></span>`
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

    this.commandStringElement.scrollIntoView({ block: "start", inline: "end" })
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
