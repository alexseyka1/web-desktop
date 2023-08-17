import { StandardStreams } from "./StandardStreams"
import systemBus, { SYSTEM_BUS_COMMANDS } from "./SystemBus"
import Window, { WindowEvents } from "./Window"
import WindowWrapper from "./WindowSystem/WindowWrapper"

export const APPLICATION_EVENTS = {
  INPUT_REQUESTED: "application:input-requested",
  INPUT_STREAM: "application:input-stream",
  OUTPUT_STREAM: "application:output-stream",
  ERROR_STREAM: "application:error-stream",
  CLOSED: "application:closed",
  ALL_WINDOWS_CLOSED: "application:all-windows-closed",
}

class Application extends EventTarget {
  _windows = new Set()
  /** @type {StandardStreams} */
  streams

  /**
   * @param {StandardStreams} streams
   */
  constructor(streams) {
    super()
    this.streams = streams
  }

  /**
   * @param {string[]} args
   * @param {object} keys
   * @returns {number} Error code (0 is OK)
   */
  main(args, keys) {
    throw new Error("Please implement application main() method.")
  }

  close(exitCode) {
    if (this._windows.size) {
      this._windows.forEach((_window) => _window.dispatchEvent(new Event(WindowEvents.CLOSE)))
    }
    return this.dispatchEvent(new CustomEvent(APPLICATION_EVENTS.CLOSED, { detail: exitCode }))
  }

  /**
   * @param {object} params
   * @returns {Promise<WindowWrapper>}
   */
  async createWindow(params, className = Window) {
    const _window = new className(params)

    const { window: windowWrapper } = await systemBus.execute(SYSTEM_BUS_COMMANDS.WINDOW_SYSTEM.OPEN_WINDOW, _window)
    windowWrapper.setParams(params)

    _window.addEventListener(WindowEvents.CLOSED, () => {
      this._windows.delete(windowWrapper)
      if (!this._windows.size) {
        if ("onAllWindowsClosed" in this && typeof this.onAllWindowsClosed === "function") {
          this.onAllWindowsClosed()
        } else {
          this.close(0)
        }
      }
    })
    this._windows.add(windowWrapper)

    return windowWrapper
  }

  /**
   * @returns {Promise<string>}
   */
  _input() {
    return new Promise((resolve) => {
      const inputHandler = (e) => resolve(e?.detail || "")
      this.addEventListener(APPLICATION_EVENTS.INPUT_STREAM, inputHandler)
      this.addEventListener(APPLICATION_EVENTS.CLOSED, () => this.removeEventListener(APPLICATION_EVENTS.INPUT_STREAM, inputHandler))
      this.dispatchEvent(new Event(APPLICATION_EVENTS.INPUT_REQUESTED))
    })
  }

  _output(value) {
    return this.streams.output.write(value)
  }

  print = (value) => this._output(value)
  println = (value) => this.print((value || "") + "\n")

  _error(value) {
    return this.streams.error.write(value)
  }
}

export default Application
