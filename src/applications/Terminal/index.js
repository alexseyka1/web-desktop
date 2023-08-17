import Application from "../../modules/Application"
import "./styles.scss"
import { WindowEvents } from "../../modules/Window"
import appRunner from "../../modules/AppRunner"
import systemBus, { SYSTEM_BUS_COMMANDS, SYSTEM_BUS_EVENTS } from "../../modules/SystemBus"
import { resolvePath } from "../../modules/FileSystem"
import Readline from "../../classes/Readline"
import READLINE_COMMANDS from "../../classes/Readline/ReadlineCommands"
import Shell from "./Shell"
import { StandardStreams } from "../../modules/StandardStreams"

const MODES = {
  COMMANDS_TYPING: "mode:commands-typing",
  APPLICATION_INPUT: "mode:application-input",
}

class Terminal extends Application {
  #state = {
    isWindowActive: true,
    isPromptActive: true,
    path: "/",
  }
  #window
  #mode = MODES.COMMANDS_TYPING
  #lastChar = null
  #isAutocompleteRunning = false
  #fileAutocomplete = {
    directory: null,
    results: [],
    searchAll: null,
    partName: null,
    currentFileIndex: 0,
  }
  /** @type {Readline} */
  #readline
  /** @type {StandardStreams} */
  #streams

  async main() {
    this.#window = await this.createWindow({
      width: 500,
      height: 400,
      title: "Terminal",
      icon: `<span class="material-symbols-outlined">terminal</span>`,
    })
    this.#window.domElement.classList.add("terminal-app")
    this.#window.contentElement.innerHTML = `<div>
      <pre class="terminal-app__logs"></pre><pre class="terminal-app__command-string"></pre>
    </div>`
    const background = document.createElement("template")
    background.innerHTML = `<div class="terminal-app__background"></div>`
    this.#window.domElement.prepend(background.content)

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
          range.collapse(true)
        }
      } else {
        const clipboardText = await globalThis.navigator.clipboard.readText()
        if (clipboardText && clipboardText.length) {
          clipboardText.split("").forEach((char) => this.#readline.execute(char))
        }
      }
    })

    this.#initState()

    this.#window.addEventListener(WindowEvents.BLURED, () => {
      this.#state.isWindowActive = false
      this.#unregisterEvents()
    })
    this.#window.addEventListener(WindowEvents.FOCUSED, () => {
      this.#state.isWindowActive = true
      this.#registerEvents()
    })

    this.renderCommandLine()

    this.#streams = new StandardStreams()
    this.#streams.output.onByte((char) => this.#log(char))
    this.#streams.error.onComplete((error) => this.#log(error + "\n"))

    systemBus.execute(SYSTEM_BUS_COMMANDS.APP_RUNNER.RUN_APPLICATION, { app: Shell, streams: this.#streams }).then(({ exitCode }) => {
      if (exitCode) {
        this.#log(`Command "sh" exited with code: ${exitCode}`)
      } else {
        this.close()
      }
    })
  }

  #registerEvents() {
    appRunner.setOnInput(this.#onInputRequested.bind(this))
  }

  #unregisterEvents() {
    appRunner.setOnInput(null)
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
    console.log("AUTOCOMPLETE START")
    if (this.#isAutocompleteRunning) return
    this.#isAutocompleteRunning = true

    const _commandParts = this.#state.inputString.replace(/\s{2,}/, " ").split(" ")
    const _lastPart = _commandParts.pop()
    /** If string starts from ".", ".." or "/" */
    if ([".", "/"].includes(_lastPart.substring(0, 1)) || _lastPart.substring(0, 2) === "..") {
      if (!/^.*\/.*/.test(this.#state.inputString)) {
        this.#isAutocompleteRunning = false
        return
      }

      if (this.#fileAutocomplete.searchAll === null) {
        /**
         * Setting files search mode
         */
        /** User don't typed any suggestion */
        if (/^.*\/$/.test(this.#state.inputString)) this.#fileAutocomplete.searchAll = true
        /** User typed some suggestion */
        if (/^[^\/]*\/[^\/]+$/.test(this.#state.inputString)) this.#fileAutocomplete.searchAll = false
      }

      const _resolvedPath = resolvePath(this.#state.path, _lastPart)
      let [, _directory, _filename] = _resolvedPath.match(/^(.*)\/(.*)/)
      _directory = _directory || "/"

      if (this.#fileAutocomplete.directory === _directory) {
        /**
         * If user don't typed any suggestion and looking for all files in directory
         * Or if user typed a parted of suggested filename and we already found this file
         */
        if (this.#fileAutocomplete.searchAll || (!this.#fileAutocomplete.searchAll && this.#fileAutocomplete.partName === _filename)) {
          this.#isAutocompleteRunning = false
          return
        }
      }
      this.#fileAutocomplete.partName = _filename

      const { iterator } = await systemBus.execute(SYSTEM_BUS_COMMANDS.FILE_SYSTEM.GET_FILES_ITERATOR, _directory)
      let _foundFileNames = []
      for await (let _file of iterator) {
        if (_filename.trim().length) {
          /** If user typed a part of current file name */
          if (_file.name.startsWith(_filename)) _foundFileNames.push(_file.name)
          if (_file.name === this.#fileAutocomplete.partName) this.#fileAutocomplete.partName = null
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
      const onInputStringChanged = () => {
        if (this.#readline.string.endsWith("/")) {
          this.#fileAutocomplete.directory = null
          this.#fileAutocomplete.searchAll = null
        }
      }

      /**
       * @param {KeyboardEvent} e
       */
      const keydownHandler = async (e) => {
        e.preventDefault()
        if (e.key.length === 1 && !e.ctrlKey) {
          this.#readline.execute(e.key)
          onInputStringChanged()
        } else if (["delete", "backspace"].includes(e.key.toLowerCase())) {
          this.#readline.execute(READLINE_COMMANDS.REMOVE_CHARACTER)
          onInputStringChanged()
        } else if (e.key.toLowerCase() === "enter") {
          /**
           * Enter was pressed
           */
          this.#state.cursorPosition = null
          let _str = this.#readline.string
          this.#readline.execute(READLINE_COMMANDS.CLEAR_STRING)
          this.#readline.addToHistory(_str)
          globalThis.removeEventListener("keydown", keydownHandler)
          resolve(_str)
          onInputStringChanged()
        } else if (e.key.toLowerCase() === "arrowleft") {
          /**
           * Left arrow button pressed
           */
          this.#readline.execute(READLINE_COMMANDS.MOVE_CURSOR_BACKWARD)
        } else if (e.key.toLowerCase() === "arrowright") {
          /**
           * Right arrow button pressed
           */
          this.#readline.execute(READLINE_COMMANDS.MOVE_CURSOR_FORWARD)
        } else if (e?.key.toLowerCase() === "arrowup") {
          /**
           * Up arrow button pressed
           */
          this.#readline.execute(READLINE_COMMANDS.NAVIGATE_HISTORY_BACKWARD)
          onInputStringChanged()
        } else if (e?.key.toLowerCase() === "arrowdown") {
          /**
           * Down arrow button pressed
           */
          this.#readline.execute(READLINE_COMMANDS.NAVIGATE_HISTORY_FORWARD)
          onInputStringChanged()
        } else if (e.key.toLowerCase() === "tab") {
          /**
           * Tab pressed
           */
          if (this.#readline.string.length) {
            /**
             * Autocomplete command
             */
            console.log("Autocomplete must be here")
            // await this.fetchAutocomplete()
            // const _nextNameAutocomplete = this.filenameAutocomplete
            // if (_nextNameAutocomplete) {
            //   this.#state.inputString = this.#state.inputString.replace(/^(.*\/).*$/, "$1") + _nextNameAutocomplete
            // }
          } else if (e.key.toLowerCase() === this.#lastChar && this.#mode === MODES.COMMANDS_TYPING && !this.#readline.string.length) {
            this.runCommand("all-commands")
          }
        }

        this.#lastChar = this.#lastChar !== null ? null : e.key.toLowerCase()
      }

      globalThis.addEventListener("keydown", keydownHandler)
      this.#window.addEventListener(WindowEvents.BLURED, () => removeHandler())
    })
  }

  // async #startTyping() {
  //   while (this.#state.isWindowActive && this.#state.isPromptActive) {
  //     try {
  //       const command = await this.#getInputString()
  //       this.#state.cursorPosition = null
  //       if (command.trim().length) {
  //         this.#log(`${this.prompt} ${command}`)

  //         await this.runCommand(command)
  //       } else {
  //         this.#log(`${this.prompt}`)
  //       }
  //     } catch (e) {}
  //   }
  // }

  #initReadline() {
    this.#readline = new Readline()
    this.#readline.onChange = () => {
      this.renderCommandLine()
      this.commandStringElement.scrollIntoView({ block: "end", inline: "end" })
    }
  }

  #initState() {
    this.#state = new Proxy(this.#state, {
      get: (target, prop) => {
        return target[prop]
      },
      set: (target, prop, value, receiver) => {
        const result = Reflect.set(target, prop, value, receiver)
        this.renderCommandLine()
        return result
      },
    })
  }

  #onInputRequested() {
    const _prevReadline = this.#readline,
      revertReadline = () => (this.#readline = _prevReadline)
    this.#initReadline()

    return new Promise((_resolve, _reject) => {
      const resolve = (...args) => {
          revertReadline()
          _resolve(...args)
        },
        reject = (...args) => {
          revertReadline()
          _reject(...args)
        }

      const getInput = () => {
        return this.#getInputString()
          .then((_inputString) => {
            this.#log(`${_inputString}\n`)
            resolve(_inputString)
          })
          .catch(() => reject())
      }

      getInput()
      this.#window.addEventListener(WindowEvents.FOCUSED, () => getInput())
    })
  }

  renderCommandLine() {
    const { isWindowActive } = this.#state
    const inputString = this.#readline?.string || "",
      cursorPosition = this.#readline?.cursorPosition || null
    const cursorStyle = cursorPosition !== null ? `margin-left: ${cursorPosition}ch` : ""

    const commandString = isWindowActive ? `${inputString}<span class="terminal-app__cursor" style="${cursorStyle}"></span>` : `${inputString}`

    this.commandStringElement.innerHTML = commandString
  }

  #log(message) {
    if (!message) return
    const addTextNode = (_text) => {
      this.logsElement.innerHTML += _text
    }

    // if (message.indexOf("\r") !== -1) {
    //   message = message.replace(/\\r/g, "")
    //   if (!this.logsElement.childNodes.length) addTextNode(message.replace)
    //   else {
    //     const lastTextNode = this.logsElement.childNodes[this.logsElement.childNodes.length - 1]
    //     lastTextNode.textContent = message
    //   }
    // } else {
    addTextNode(message)
    // }

    this.commandStringElement.scrollIntoView({ block: "start", inline: "end" })
  }

  // async runCommand(command) {
  //   this.#state.isPromptActive = false
  //   this.#mode = MODES.APPLICATION_INPUT
  //   let _availableCommands = this.COMMANDS

  //   if (this.#state.path === "/applications") {
  //     _availableCommands = { ..._availableCommands }
  //   }

  //   /**
  //    * Replace each relative path to absolute one
  //    */
  //   let _command = command
  //   const _paths = _command.match(/(\.{1,2})?\/[^\s]+/g)
  //   if (_paths) {
  //     for (let _path of _paths) {
  //       _command = _command.replace(_path, resolvePath(this.#state.path, _path))
  //     }
  //   }

  //   try {
  //     await systemBus.execute(SYSTEM_BUS_COMMANDS.APP_RUNNER.RUN_COMMAND_WITH_DEFINED_COMMANDS, [_command, _availableCommands])
  //   } catch (e) {
  //     this.#log(`Internal error: ${e.message}`)
  //   }

  //   this.#state.isPromptActive = true
  //   this.#mode = MODES.COMMANDS_TYPING
  // }
}

export default Terminal
