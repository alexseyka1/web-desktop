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
      const wrapper = createWindowWrapper(_window)
      this.windows.push(wrapper)
      this.#attachWindowEvents(wrapper)

      this.focusOnWindow(wrapper)
      wrapper.domElement.addEventListener("mousedown", () => this.focusOnWindow(wrapper))
      if (this.isAlreadyRan) {
        this.#appendAndRunWindow(wrapper)
      }
    }

    if (Array.isArray(item)) item.forEach((window) => _attachWindow(window))
    else _attachWindow(item)
  }

  #onWindowClosed(window) {
    this.windows = this.windows.filter((item) => item !== window)
    systemBus.dispatchEvent(SYSTEM_BUS_EVENTS.WINDOW_SYSTEM.STACK_CHANGED)
  }

  #getWindowSizeEvents(window) {
    const transitionMs = 250
    let prevSize, prevPosition

    return {
      [WindowEvents.SCREEN_FULL]() {
        const screenWidth = this.root.getBoundingClientRect().width,
          screenHeight = this.root.getBoundingClientRect().height,
          maxWidth = Math.min(window?.maxSize?.x || Infinity, screenWidth),
          maxHeight = Math.min(window?.maxSize?.y || Infinity, screenHeight)

        prevPosition = window.position.clone()
        prevSize = window.size.clone()

        window.domElement.style.transition = `all ${transitionMs}ms ease-in-out`
        window.size.set(maxWidth, maxHeight)
        if (window.position.x + maxWidth > screenWidth) {
          const leftOffset = window.position.x + maxWidth - screenWidth
          window.position.x -= leftOffset
        }
        if (window.position.y + maxHeight > screenHeight) {
          const topOffset = window.position.y + maxHeight - screenHeight
          window.position.y -= topOffset
        }
        setTimeout(() => (window.domElement.style.transition = null), transitionMs)

        window.isMaximized = true
      },

      [WindowEvents.SCREEN_WINDOWED]() {
        if (!prevSize) return

        window.domElement.style.transition = `all ${transitionMs}ms ease-in-out`
        window.size.setFromVector(prevSize)
        if (prevPosition) window.position.setFromVector(prevPosition)
        setTimeout(() => (window.domElement.style.transition = null), transitionMs)

        window.isMaximized = false
      },
    }
  }

  /**
   * @param {Window} window
   */
  #attachWindowEvents(window) {
    window.addEventListener(WindowEvents.CLOSED, () => this.#onWindowClosed(window))

    // const windowScreenSizeEvents = this.#getWindowSizeEvents(window)
    // /**
    //  * Scale Window to fullscreen
    //  */
    // window.addEventListener(WindowEvents.SCREEN_FULL, windowScreenSizeEvents[WindowEvents.SCREEN_FULL].bind(this))
    // /**
    //  * Scale window to previous size
    //  */
    // window.addEventListener(WindowEvents.SCREEN_WINDOWED, windowScreenSizeEvents[WindowEvents.SCREEN_WINDOWED].bind(this))
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
    systemBus.addMiddleware(SYSTEM_BUS_COMMANDS.WINDOW_SYSTEM.OPEN_WINDOW, (_window, _, next) => {
      this.attach(_window)
      next()
    })
  }

  run() {
    this.windows.forEach((window) => this.#appendAndRunWindow(window))
  }
}

export default WindowSystem
