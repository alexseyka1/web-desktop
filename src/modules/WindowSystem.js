import systemBus, { SYSTEM_BUS_COMMANDS } from "./SystemBus"
import Window, { WindowEvents } from "./Window"

export const WindowSystemEvents = {
  STACK_CHANGED: "window-system-stack-changed",
}

class WindowSystem extends EventTarget {
  windows = []
  /** @type {HTMLElement} */
  root
  /** @type {Window} */
  windowInFocus

  constructor(containerElement) {
    super()
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
    const _attachWindow = (window) => {
      this.windows.push(window)
      this.#attachWindowEvents(window)

      this.focusOnWindow(window)
      window.domElement.addEventListener("mousedown", () => this.focusOnWindow(window))
      if (this.isAlreadyRan) {
        this.#appendAndRunWindow(window)
      }
    }

    if (Array.isArray(item)) item.forEach((window) => _attachWindow(window))
    else _attachWindow(item)
  }

  #onWindowClosed(window) {
    this.windows = this.windows.filter((item) => item !== window)
    this.dispatchEvent(new Event(WindowSystemEvents.STACK_CHANGED))
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

    const windowScreenSizeEvents = this.#getWindowSizeEvents(window)
    /**
     * Scale Window to fullscreen
     */
    window.addEventListener(WindowEvents.SCREEN_FULL, windowScreenSizeEvents[WindowEvents.SCREEN_FULL].bind(this))
    /**
     * Scale window to previous size
     */
    window.addEventListener(WindowEvents.SCREEN_WINDOWED, windowScreenSizeEvents[WindowEvents.SCREEN_WINDOWED].bind(this))
  }

  #appendAndRunWindow(_window) {
    this.root.append(_window.domElement)
    _window.init()
    _window.run()
    this.dispatchEvent(new Event(WindowSystemEvents.STACK_CHANGED))
  }

  #attachSystemBus() {
    systemBus.addMiddleware(SYSTEM_BUS_COMMANDS.WINDOW_SYSTEM.OPEN_WINDOW, (request, response, next) => {
      this.attach(request)
      next()
    })
  }

  run() {
    this.windows.forEach((window) => this.#appendAndRunWindow(window))
  }
}

export default WindowSystem
