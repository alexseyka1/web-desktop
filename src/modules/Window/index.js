import "./styles.scss"

export const WindowEvents = {
  MINIFY: "window-minify",
  SCREEN_FULL: "window-screen-full",
  SCREEN_WINDOWED: "window-screen-windowed",
  CLOSE: "window-close",
  CLOSED: "window-closed",
  FOCUSED: "window-focus",
  BLURED: "window-blured",
  TITLE_CHANGED: "window-title-changed",
  HANDLE_STARTED: "window-handle-started",
  HANDLE_STOPPED: "window-handle-stopped",
  MOVED: "window-moved",
}

class Window extends EventTarget {
  params = {}
  /** @type {HTMLElement} */
  domElement = document.createElement("div")
  isResizable = true
  isModal = false
  isMaximized = false
  withHeader = true
  title = ""
  icon = ""

  constructor(params = {}) {
    super()
    this.params = params

    /** Setting window params */
    Object.keys(params).forEach((param) => {
      if (!(param in this)) return
      this[param] = params[param]
    })
  }

  init() {}
  run() {}
}

export default Window
