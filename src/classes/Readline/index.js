import READLINE_COMMANDS from "./ReadlineCommands"

class Readline {
  #state = {
    inputString: "",
    displayString: "",
    cursorPosition: null,
    history: [],
    historyPosition: null,
  }
  #onChange

  get string() {
    return this.#state.displayString
  }

  get cursorPosition() {
    return this.#state.cursorPosition
  }

  get onChange() {
    if (!this.#onChange || typeof this.#onChange !== "function") return () => {}
    return this.#onChange
  }

  /**
   * @param {Function} func
   */
  set onChange(func) {
    this.#onChange = func
  }

  #addCharacter(char) {
    if (this.#state.cursorPosition) {
      /**
       * If cursor position is not null
       */
      const _pos = this.#state.inputString.length - Math.abs(this.#state.cursorPosition)
      let _newString = this.#state.inputString.split("")
      _newString.splice(_pos, 0, char)
      _newString = _newString.join("")

      if (this.#state.historyPosition === null) this.#state.inputString = _newString
      else this.#state.displayString = _newString
    } else {
      if (this.#state.historyPosition === null) this.#state.inputString += char
      else this.#state.displayString += char
    }

    if (this.#state.historyPosition === null) this.#state.displayString = this.#state.inputString
    this.onChange.call()
  }

  #removeCharacter() {
    let _currentString = this.#state.inputString
    if (this.#state.historyPosition !== null) _currentString = this.#state.displayString

    if (this.#state.cursorPosition != null) {
      /**
       * If cursor position is not null
       */
      if (Math.abs(this.#state.cursorPosition) >= _currentString.length) return

      const _pos = _currentString.length - Math.abs(this.#state.cursorPosition)
      let _newString = _currentString.split("")
      _newString.splice(_pos - 1, 1)
      _newString = _newString.join("")

      if (this.#state.historyPosition === null) this.#state.inputString = _newString
      else this.#state.displayString = _newString
    } else {
      if (this.#state.historyPosition === null) this.#state.inputString = _currentString.substring(0, _currentString.length - 1)
      else this.#state.displayString = _currentString.substring(0, _currentString.length - 1)
    }

    if (this.#state.historyPosition === null) this.#state.displayString = this.#state.inputString
    this.onChange.call()
  }

  #moveCursorBackward() {
    this.#state.cursorPosition = Math.max(this.#state.cursorPosition - 1, this.#state.inputString.length * -1)
    if (this.#state.cursorPosition === 0) this.#state.cursorPosition = null
    this.onChange.call()
  }

  #moveCursorForward() {
    this.#state.cursorPosition = Math.min(this.#state.cursorPosition + 1, 0)
    if (this.#state.cursorPosition === 0) this.#state.cursorPosition = null
    this.onChange.call()
  }

  #navigateHistoryBackward() {
    this.#state.cursorPosition = null
    if (this.#state.history.length) {
      if (this.#state.historyPosition === null) this.#state.historyPosition = this.#state.history.length - 1
      else if (this.#state.historyPosition > 0) this.#state.historyPosition--
      const command = this.#state.history[this.#state.historyPosition]
      this.#state.displayString = command
    }

    this.onChange.call()
  }

  #navigateHistoryForward() {
    this.#state.cursorPosition = null
    if (this.#state.history.length && this.#state.historyPosition !== null) {
      if (this.#state.historyPosition < this.#state.history.length - 1) this.#state.historyPosition++
      else if (this.#state.historyPosition === this.#state.history.length - 1) this.#state.historyPosition = null

      if (this.#state.historyPosition === null) {
        this.#state.displayString = this.#state.inputString
      } else {
        const command = this.#state.history[this.#state.historyPosition]
        this.#state.displayString = command
      }
    }

    this.onChange.call()
  }

  #clearString() {
    this.#state.historyPosition = null
    this.#state.cursorPosition = null
    this.#state.inputString = ""
    this.#state.displayString = ""

    this.onChange.call()
  }

  /**
   * Adds string to history
   * @param {string} string
   */
  addToHistory(string) {
    this.#state.history.push(string)
  }

  /**
   * Executes specified command or adds character
   * @param {string} command
   */
  execute(command) {
    switch (command) {
      case READLINE_COMMANDS.REMOVE_CHARACTER:
        return this.#removeCharacter()
      case READLINE_COMMANDS.MOVE_CURSOR_BACKWARD:
        return this.#moveCursorBackward()
      case READLINE_COMMANDS.MOVE_CURSOR_FORWARD:
        return this.#moveCursorForward()
      case READLINE_COMMANDS.NAVIGATE_HISTORY_BACKWARD:
        return this.#navigateHistoryBackward()
      case READLINE_COMMANDS.NAVIGATE_HISTORY_FORWARD:
        return this.#navigateHistoryForward()
      case READLINE_COMMANDS.CLEAR_STRING:
        return this.#clearString()
      default:
        return this.#addCharacter(command)
    }
  }
}

export default Readline
