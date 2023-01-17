import systemBus, { SYSTEM_BUS_COMMANDS, SYSTEM_BUS_EVENTS } from "../SystemBus"
import Window, { WindowEvents } from "../Window"
import WindowWrapper, { createWindowWrapper } from "./WindowWrapper"
import "./styles.scss"

class WindowSystem {
  windows = []
  /** @type {HTMLElement} */
  root
  /** @type {Window} */
  windowInFocus

  constructor(containerElement) {
    this.root = containerElement
    this.root.addEventListener("contextmenu", (e) => {
      e.preventDefault()
      e.stopPropagation()
    })
    this.#attachSystemBus()
  }

  get isAlreadyRan() {
    return this.root.children.length
  }

  focusOnWindow(window) {
    if (this.windowInFocus) {
      if (this.windowInFocus === window) return
      this.windowInFocus.dispatchEvent(new Event(WindowEvents.BLURED))
      this.windowInFocus.domElement.classList.remove("active")
    }
    this.windowInFocus = window
    window.dispatchEvent(new Event(WindowEvents.FOCUSED))
    this.windowInFocus.domElement.classList.add("active")

    this.windows = [...this.windows.filter((item) => item !== window), window]
    this.windows.forEach((item, index) => {
      item.domElement.style.zIndex = index
    })
  }

  /**
   * @param {Window|Window[]} item
   */
  attach(item) {
    const _attachWindow = (_window) => {
      /**
       * Center the new window
       */
      const boundings = this.root.getBoundingClientRect(),
        x = boundings.width / 2 - (_window.params.width || 0) / 2,
        y = boundings.height / 2 - (_window.params.height || 0) / 2

      _window.params.x = Math.max(x, 0)
      _window.params.y = Math.max(y, 0)
      _window.params.width = Math.min(_window.params.width, boundings.width)
      _window.params.height = Math.min(_window.params.height, boundings.height)

      if (_window.params.width === boundings.width && _window.params.height === boundings.height) {
        _window.isMaximized = true
      }

      const wrapper = createWindowWrapper(_window)
      this.windows.push(wrapper)
      this.#attachWindowEvents(wrapper)

      this.focusOnWindow(wrapper)
      wrapper.domElement.addEventListener("mousedown", () => this.focusOnWindow(wrapper))
      if (this.isAlreadyRan) {
        this.#appendAndRunWindow(wrapper)
      }

      return wrapper
    }

    if (Array.isArray(item)) return item.map((window) => _attachWindow(window))
    else return _attachWindow(item)
  }

  /**
   * @param {Window} _window
   */
  #attachWindowEvents(_window) {
    _window.addEventListener(WindowEvents.CLOSE, (e) => {
      if (e.defaultPrevented) return
      _window.domElement.remove()
      _window.dispatchEvent(new Event(WindowEvents.CLOSED))
    })

    const closeHandler = () => {
      this.windows = this.windows.filter((item) => item !== _window)
      systemBus.dispatchEvent(SYSTEM_BUS_EVENTS.WINDOW_SYSTEM.STACK_CHANGED)
      _window.removeEventListener(WindowEvents.CLOSED, closeHandler)
    }

    _window.addEventListener(WindowEvents.CLOSED, closeHandler)
  }

  /**
   * @param {WindowWrapper} _windowWrapper
   */
  #appendAndRunWindow(_windowWrapper) {
    this.root.append(_windowWrapper.domElement)
    _windowWrapper.init()
    _windowWrapper.run()
    systemBus.dispatchEvent(SYSTEM_BUS_EVENTS.WINDOW_SYSTEM.STACK_CHANGED)
  }

  #attachSystemBus() {
    systemBus.addMiddleware(SYSTEM_BUS_COMMANDS.WINDOW_SYSTEM.OPEN_WINDOW, (_window, response, next) => {
      response.window = this.attach(_window)
      next()
    })
  }

  run() {
    this.windows.forEach((window) => this.#appendAndRunWindow(window))
  }
}

export default WindowSystem
