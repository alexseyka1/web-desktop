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

  #registerWindowResizeHelper(window) {
    let leftOverlayTimer, rightOverlayTimer, topOverlayTimer, bottomOverlayTimer, overlayElem, currentPosition
    let rootBoundings = this.root.getBoundingClientRect()
    const clearTimers = () => {
      if (leftOverlayTimer) clearTimeout(leftOverlayTimer)
      if (rightOverlayTimer) clearTimeout(rightOverlayTimer)
      if (topOverlayTimer) clearTimeout(topOverlayTimer)
      if (bottomOverlayTimer) clearTimeout(bottomOverlayTimer)
    }
    const removeHelperOverlay = () => {
      if (overlayElem) overlayElem.style.display = "none"
    }
    const onMoveHandler = (e) => {
      const { x, y, prevX, prevY } = e.detail

      const movedToLeft = x < prevX,
        movedToRight = x > prevX,
        movedToTop = y < prevY,
        movedToBottom = y > prevY

      const overlayClassName = "window-helper-overlay"
      const createHelperOverlay = () => {
        const { x, y, width, height } = window.domElement.getBoundingClientRect()
        overlayElem = this.root.querySelector(`.${overlayClassName}`) || document.createElement("div")
        overlayElem.className = overlayClassName
        overlayElem.style.left = `${x}px`
        overlayElem.style.top = `${y}px`
        overlayElem.style.width = `${width}px`
        overlayElem.style.height = `${height}px`
        overlayElem.style.display = "block"
        this.root.append(overlayElem)
      }

      clearTimers()
      if (movedToLeft && x === rootBoundings.x) {
        /**
         * Left side
         */
        if (overlayElem && overlayElem.getBoundingClientRect().x !== x) removeHelperOverlay()

        leftOverlayTimer = setTimeout(() => {
          createHelperOverlay()
          setTimeout(() => {
            overlayElem.style.top = 0
            overlayElem.style.height = "100%"
            overlayElem.style.width = "50%"
            currentPosition = "left"
          }, 10)
        }, 250)
      } else if (movedToRight && x + window.size.x === rootBoundings.x + rootBoundings.width) {
        /**
         * Right side
         */
        if (overlayElem && overlayElem.getBoundingClientRect().x !== x) removeHelperOverlay()

        rightOverlayTimer = setTimeout(() => {
          createHelperOverlay()
          setTimeout(() => {
            overlayElem.style.top = 0
            overlayElem.style.left = Math.floor(rootBoundings.width / 2)
            overlayElem.style.height = "100%"
            overlayElem.style.width = Math.floor(rootBoundings.height / 2)
            currentPosition = "right"
          }, 10)
        }, 250)
      } else if (movedToTop && y === rootBoundings.y) {
        /**
         * Top side
         */
        if (overlayElem && overlayElem.getBoundingClientRect().y !== y) removeHelperOverlay()

        leftOverlayTimer = setTimeout(() => {
          createHelperOverlay()
          setTimeout(() => {
            overlayElem.style.top = 0
            overlayElem.style.left = 0
            overlayElem.style.height = "50%"
            overlayElem.style.width = "100%"
            currentPosition = "top"
          }, 10)
        }, 250)
      } else if (movedToBottom && y + window.size.y === rootBoundings.y + rootBoundings.height) {
        /**
         * Bottom side
         */
        if (overlayElem && overlayElem.getBoundingClientRect().y !== y) removeHelperOverlay()

        leftOverlayTimer = setTimeout(() => {
          createHelperOverlay()
          setTimeout(() => {
            overlayElem.style.top = "50%"
            overlayElem.style.left = 0
            overlayElem.style.height = "50%"
            overlayElem.style.width = "100%"
            currentPosition = "bottom"
          }, 10)
        }, 250)
      } else {
        removeHelperOverlay()
      }
    }

    window.addEventListener(WindowEvents.HANDLE_STARTED, () => {
      rootBoundings = this.root.getBoundingClientRect()
      window.addEventListener(WindowEvents.MOVED, onMoveHandler)

      const stoppedHandler = () => {
        window.removeEventListener(WindowEvents.MOVED, onMoveHandler)

        if (overlayElem && currentPosition) {
          if (currentPosition === "left")
            [window.position.x, window.position.y, window.size.x, window.size.y] = [0, 0, rootBoundings.width / 2, rootBoundings.height]
          else if (currentPosition === "right")
            [window.position.x, window.position.y, window.size.x, window.size.y] = [rootBoundings.width / 2, 0, rootBoundings.width / 2, rootBoundings.height]
          else if (currentPosition === "top")
            [window.position.x, window.position.y, window.size.x, window.size.y] = [0, 0, rootBoundings.width, rootBoundings.height / 2]
          else if (currentPosition === "bottom")
            [window.position.x, window.position.y, window.size.x, window.size.y] = [0, rootBoundings.height / 2, rootBoundings.width, rootBoundings.height / 2]
        }
        clearTimers()
        removeHelperOverlay()
        window.removeEventListener(WindowEvents.HANDLE_STOPPED, stoppedHandler)
      }
      window.addEventListener(WindowEvents.HANDLE_STOPPED, stoppedHandler)
    })
  }

  #onAttachSubWindow(event) {
    if (!event?.detail || !(event?.detail instanceof Window)) return
    this.attach(event.detail)
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

    window.addEventListener(WindowEvents.ATTACH_SUB_WINDOW, (e) => this.#onAttachSubWindow(e))
  }

  #appendAndRunWindow(_window) {
    this.root.append(_window.domElement)
    _window.init()
    _window.run()
    this.dispatchEvent(new Event(WindowSystemEvents.STACK_CHANGED))
  }

  run() {
    this.windows.forEach((window) => this.#appendAndRunWindow(window))
  }
}

export default WindowSystem
