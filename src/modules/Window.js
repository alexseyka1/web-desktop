import Vector from "./Vector"
import Helper, { withSharedValue } from "./Helper"
import { addDropdownSubMenu, withMenuPanel } from "./MenuPanel"

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
  ATTACH_SUB_WINDOW: "window-attach-sub-window",
}

const WINDOW_DEFAULTS = {
  X: 0,
  Y: 0,
  WIDTH: 100,
  HEIGHT: 100,
}

class Window extends EventTarget {
  BORDER_SIZE = 5

  /** @type {HTMLElement} */
  domElement
  /** @type {Vector} */
  position
  /** @type {Vector} */
  size
  minSize = new Vector(100, 100)
  maxSize /* = new Vector(300, 300)*/
  isResizable = true
  isMaximized = false
  withHeader = true

  constructor(params) {
    super()
    const self = this
    const { x, y, width, height, minWidth, minHeight, title, withHeader = true, isResizable = true } = params || {}

    if (isResizable !== undefined) this.isResizable = isResizable

    this.#createHtml()

    withSharedValue(this, "title", title, {
      set: () => {
        this.#changeTitle()
        this.dispatchEvent(new Event(WindowEvents.TITLE_CHANGED))
      },
    })
    withSharedValue(this, "icon", null, {
      set: () => this.#changeTitle(),
    })
    withMenuPanel(this, this.menuElement)

    this.position = new Proxy(new Vector(x || WINDOW_DEFAULTS.X, y || WINDOW_DEFAULTS.Y), {
      set(target, prop, value) {
        target[prop] = value
        self.#moveWindow(prop == "x" ? value : self.position.x, prop == "y" ? value : self.position.y)
        return true
      },
    })
    this.size = new Proxy(new Vector(width || WINDOW_DEFAULTS.WIDTH, height || WINDOW_DEFAULTS.HEIGHT), {
      set(target, prop, value) {
        target[prop] = value
        self.#resizeWindow(prop == "x" ? value : self.size.x, prop == "y" ? value : self.size.y)
        return true
      },
    })

    if (x) this.position.x = x
    if (y) this.position.y = y
    if (width) this.size.x = width
    if (height) this.size.y = height
    if (minWidth) this.minSize.x = minWidth
    if (minHeight) this.minSize.y = minHeight
    if (title) this.title = title
    this.withHeader = !!withHeader
  }

  get headerElement() {
    return this.domElement.querySelector(".header")
  }
  get handlerElement() {
    return this.domElement.querySelector(".handler")
  }
  get contentElement() {
    return this.domElement.querySelector(".content")
  }
  get menuElement() {
    let menuElement = this.domElement.querySelector(".header + .menu")
    if (!menuElement) {
      menuElement = document.createElement("div")
      menuElement.className = "menu"
      if (this.headerElement) this.headerElement.after(menuElement)
      else if (this.contentElement) this.contentElement.before(menuElement)
    }

    return menuElement
  }

  #createHtml() {
    this.domElement = document.createElement("div")
    this.domElement.classList.add("window")

    const template = document.createElement("template")
    template.innerHTML = `
      ${
        this.withHeader
          ? `<div class="header">
            <div class="header__title handler">
              <div class="header-title__icon">${this.icon ?? ""}</div>
              <div class="header-title__name">${this.title}</div>
            </div>
            <div class="header__button minify"></div>
            ${this.isResizable ? `<div class="header__button fullscreen"></div>` : ""}
            <div class="header__button close"></div>
          </div>`
          : ""
      }
      <div class="content"></div>
    `
    this.domElement.append(template.content)
  }

  #moveWindow(x, y) {
    if (!this.domElement) return
    const boundings = this.domElement.getBoundingClientRect()
    const prevX = boundings.x,
      prevY = boundings.y
    if (prevX === x && prevY === y) return

    if (x || x === 0) this.domElement.style.left = `${x}px`
    if (y || y === 0) this.domElement.style.top = `${y}px`

    this.dispatchEvent(
      new CustomEvent(WindowEvents.MOVED, {
        detail: {
          x,
          y,
          prevX,
          prevY,
        },
      })
    )
  }

  #resizeWindow(x, y) {
    if (!this.domElement) return
    if (x) this.domElement.style.width = `${x}px`
    if (y) this.domElement.style.height = `${y}px`
  }

  #changeTitle() {
    if (!this.domElement) return
    const nameElem = this.domElement.querySelector(".header .header-title__name")
    const iconElem = this.domElement.querySelector(".header .header-title__icon")
    if (nameElem) nameElem.innerText = this.title || ""
    if (iconElem) iconElem.innerHTML = this.icon || ""
  }

  #initHeader() {
    /**
     * @todo Move all this functionality to WindowSystem
     * In real operation systems, like linux≤ application responsible for window content only
     * Window System is reponsible for window header and all of this functionality (moving, resizing, etc)
     */
    this.registerDragHandle()
    const headerElement = this.domElement.querySelector(".header"),
      titleIconElement = this.headerElement.querySelector(".header-title__icon"),
      minifyButton = this.domElement.querySelector(".minify"),
      fullscreenButton = this.domElement.querySelector(".fullscreen"),
      closeButton = this.domElement.querySelector(".close")
    const resizeEvent = () => {
      if (this.isMaximized) {
        this.dispatchEvent(new Event(WindowEvents.SCREEN_WINDOWED))
      } else {
        this.dispatchEvent(new Event(WindowEvents.SCREEN_FULL))
      }
    }

    if (titleIconElement) {
      titleIconElement.addEventListener("click", (e) => {
        addDropdownSubMenu(
          [
            {
              title: "Minify",
              onClick: () => this.dispatchEvent(new Event(WindowEvents.MINIFY)),
            },
            {
              title: "Toggle fullscreen",
              onClick: () => resizeEvent(),
            },
            {
              title: "Close window",
              onClick: () => this.dispatchEvent(new Event(WindowEvents.CLOSE)),
            },
          ],
          document.body,
          { element: titleIconElement }
        )
      })
    }

    if (headerElement && this.isResizable) {
      headerElement.addEventListener("dblclick", () => resizeEvent())
    }

    if (minifyButton) {
      minifyButton.addEventListener("click", () => {
        this.dispatchEvent(new Event(WindowEvents.MINIFY))
      })
    }

    if (fullscreenButton) {
      const getHelperOverlay = () => {
        const overlayClassName = "window-helper-overlay"
        const { x, y, width, height } = this.domElement.getBoundingClientRect()
        let overlayElem = this.domElement.querySelector(`.${overlayClassName}`)

        if (!overlayElem) {
          overlayElem = document.createElement("div")
          overlayElem.className = overlayClassName
          overlayElem.style.left = `${x}px`
          overlayElem.style.top = `${y}px`
          overlayElem.style.width = `${width}px`
          overlayElem.style.height = `${height}px`
          overlayElem.style.display = "block"
          this.domElement.append(overlayElem)
        }

        return overlayElem
      }

      let _timer
      const _clearTimer = () => _timer && clearTimeout(_timer)
      fullscreenButton.addEventListener("mouseover", () => {
        _clearTimer()

        let _opacityTimer, helperOverlay
        const _resetOpacityTimer = (callback) => {
          if (!helperOverlay) return

          _opacityTimer && clearTimeout(_opacityTimer)
          helperOverlay.style.opacity = 1
          _opacityTimer = setTimeout(() => (helperOverlay.style.opacity = 0), 1000)
        }
        const applyNewWindowPosition = () => {
          if (!helperOverlay) return
          const x = parseInt(helperOverlay.style.left),
            y = parseInt(helperOverlay.style.top),
            width = parseInt(helperOverlay.style.width),
            height = parseInt(helperOverlay.style.height)

          this.position.set(x, y)
          this.size.set(width, height)
        }

        _timer = setTimeout(() => {
          helperOverlay = getHelperOverlay()
          addDropdownSubMenu(
            {
              className: "window-move-helper",
              children: [
                {
                  icon: "↖️",
                  title: "Move to top-left",
                  onMouseOver: () => {
                    helperOverlay.style.top = 0
                    helperOverlay.style.left = 0
                    helperOverlay.style.width = `${window.innerWidth / 2}px`
                    helperOverlay.style.height = `${window.innerHeight / 2}px`
                    _resetOpacityTimer()
                  },
                  onClick: () => applyNewWindowPosition(),
                },
                {
                  icon: "⬆️",
                  title: "Move to top",
                  onMouseOver: () => {
                    helperOverlay.style.top = 0
                    helperOverlay.style.left = 0
                    helperOverlay.style.width = `${window.innerWidth}px`
                    helperOverlay.style.height = `${window.innerHeight / 2}px`
                    _resetOpacityTimer()
                  },
                  onClick: () => applyNewWindowPosition(),
                },
                {
                  icon: "↗️",
                  title: "Move to top-right",
                  onMouseOver: () => {
                    helperOverlay.style.top = 0
                    helperOverlay.style.left = `${window.innerWidth / 2}px`
                    helperOverlay.style.width = `${window.innerWidth / 2}px`
                    helperOverlay.style.height = `${window.innerHeight / 2}px`
                    _resetOpacityTimer()
                  },
                  onClick: () => applyNewWindowPosition(),
                },

                {
                  icon: "⬅️",
                  title: "Move to left",
                  onMouseOver: () => {
                    helperOverlay.style.top = 0
                    helperOverlay.style.left = 0
                    helperOverlay.style.width = `${window.innerWidth / 2}px`
                    helperOverlay.style.height = `${window.innerHeight}px`
                    _resetOpacityTimer()
                  },
                  onClick: () => applyNewWindowPosition(),
                },
                {
                  className: "center",
                  title: "Move to center",
                  onMouseOver: () => {
                    helperOverlay.style.top = `${window.innerHeight / 2 - this.size.y / 2}px`
                    helperOverlay.style.left = `${window.innerWidth / 2 - this.size.x / 2}px`
                    helperOverlay.style.width = `${window.innerWidth / 2}px`
                    helperOverlay.style.height = `${window.innerHeight / 2}px`
                    _resetOpacityTimer()
                  },
                  onClick: () => applyNewWindowPosition(),
                },
                {
                  icon: "➡️",
                  title: "Move to right",
                  onMouseOver: () => {
                    helperOverlay.style.top = 0
                    helperOverlay.style.left = `${window.innerWidth / 2}px`
                    helperOverlay.style.width = `${window.innerWidth / 2}px`
                    helperOverlay.style.height = `${window.innerHeight}px`
                    _resetOpacityTimer()
                  },
                  onClick: () => applyNewWindowPosition(),
                },

                {
                  icon: "↙️",
                  title: "Move to bottom-left",
                  onMouseOver: () => {
                    helperOverlay.style.top = `${window.innerHeight / 2}px`
                    helperOverlay.style.left = 0
                    helperOverlay.style.width = `${window.innerWidth / 2}px`
                    helperOverlay.style.height = `${window.innerHeight / 2}px`
                    _resetOpacityTimer()
                  },
                  onClick: () => applyNewWindowPosition(),
                },
                {
                  icon: "⬇️",
                  title: "Move to bottom",
                  onMouseOver: () => {
                    helperOverlay.style.top = `${window.innerHeight / 2}px`
                    helperOverlay.style.left = 0
                    helperOverlay.style.width = `${window.innerWidth}px`
                    helperOverlay.style.height = `${window.innerHeight / 2}px`
                    _resetOpacityTimer()
                  },
                  onClick: () => applyNewWindowPosition(),
                },
                {
                  icon: "↘️",
                  title: "Move to bottom-right",
                  onMouseOver: () => {
                    helperOverlay.style.top = `${window.innerHeight / 2}px`
                    helperOverlay.style.left = `${window.innerWidth / 2}px`
                    helperOverlay.style.width = `${window.innerWidth / 2}px`
                    helperOverlay.style.height = `${window.innerHeight / 2}px`
                    _resetOpacityTimer()
                  },
                  onClick: () => applyNewWindowPosition(),
                },
              ],
            },
            document.body,
            { element: fullscreenButton }
          )
        }, 500)
      })
      fullscreenButton.addEventListener("mouseout", () => _clearTimer())

      fullscreenButton.addEventListener("click", () => resizeEvent())
    }

    if (closeButton) {
      closeButton.addEventListener("click", () => this.dispatchEvent(new Event(WindowEvents.CLOSE)))
    }
  }

  registerDragHandle() {
    const handler = this.handlerElement
    let mousePosition = new Vector(),
      newWindowPosition = new Vector()

    const mouseMoveHandler = (e) => {
      const [dx, dy] = [e.clientX - mousePosition.x, e.clientY - mousePosition.y]
      const screenWidth = this.domElement.parentNode.getBoundingClientRect().width,
        screenHeight = this.domElement.parentNode.getBoundingClientRect().height

      let _x = this.position.x + dx,
        _y = this.position.y + dy
      if (_x < 0) _x = 0
      if (_y < 0) _y = 0
      if (_x + this.size.x > screenWidth) _x = screenWidth - this.size.x
      if (_y + this.size.y > screenHeight) _y = screenHeight - this.size.y

      newWindowPosition.set(_x, _y)

      requestAnimationFrame(() => this.#moveWindow(newWindowPosition.x, newWindowPosition.y))
    }
    const mouseUpHandler = () => {
      this.position.setFromVector(newWindowPosition)

      document.removeEventListener("mousemove", mouseMoveHandler)
      document.removeEventListener("mouseup", mouseUpHandler)
      this.dispatchEvent(new Event(WindowEvents.HANDLE_STOPPED))
    }

    handler.addEventListener("mousedown", (e) => {
      if (this.isMaximized) return
      newWindowPosition = this.position.clone()
      ;[mousePosition.x, mousePosition.y] = [e.clientX, e.clientY]
      document.addEventListener("mousemove", mouseMoveHandler)
      document.addEventListener("mouseup", mouseUpHandler)
      this.dispatchEvent(new Event(WindowEvents.HANDLE_STARTED))
    })
  }

  #registerResizeHandle() {
    let mouseOnBorderType,
      startMousePosition = new Vector(),
      newWindowPosition = this.position.clone(),
      newWindowSize = this.size.clone()

    const cursorTypeMouseMoveHandler = (e) => {
      mouseOnBorderType = Helper.getMouseOnBorderType(new Vector(e.clientX, e.clientY), this, this.BORDER_SIZE)

      if (mouseOnBorderType) this.domElement.classList.add("borders-outlined")
      else this.domElement.classList.remove("borders-outlined")

      if ([4, 6].includes(mouseOnBorderType)) document.body.style.cursor = "ew-resize"
      else if ([1, 9].includes(mouseOnBorderType)) document.body.style.cursor = "nwse-resize"
      else if ([3, 7].includes(mouseOnBorderType)) document.body.style.cursor = "nesw-resize"
      else if ([2, 8].includes(mouseOnBorderType)) document.body.style.cursor = "ns-resize"
      else document.body.style.cursor = "default"
    }
    document.addEventListener("mousemove", cursorTypeMouseMoveHandler)

    const mouseMoveHandler = (e) => {
      e.stopPropagation()
      let [x, y] = [Math.min(e.clientX, window.innerWidth), Math.min(e.clientY, window.innerHeight)]

      const [dx, dy] = [x - startMousePosition.x, y - startMousePosition.y]
      const minWidth = this?.minSize?.x || 0,
        maxWidth = this?.maxSize?.x || Infinity,
        minHeight = this?.minSize?.y || 0,
        maxHeight = this?.maxSize?.y || Infinity

      requestAnimationFrame(() => {
        /**
         * Right/bottom resizing
         */
        if ([3, 6, 9].includes(mouseOnBorderType)) {
          let newWidth = this.size.x + dx
          if (newWidth < minWidth) newWidth = minWidth
          if (newWidth > maxWidth) newWidth = maxWidth

          newWindowSize.x = newWidth
          this.#resizeWindow(newWidth)
        }
        if ([7, 8, 9].includes(mouseOnBorderType)) {
          let newHeight = this.size.y + dy
          if (newHeight < minHeight) newHeight = minHeight
          if (newHeight > maxHeight) newHeight = maxHeight

          newWindowSize.y = newHeight
          this.#resizeWindow(null, newHeight)
        }
        /**
         * Left/top resizing
         */
        if ([1, 4, 7].includes(mouseOnBorderType)) {
          let newWidth = this.size.x - dx
          if (newWidth < minWidth) newWidth = minWidth
          if (newWidth > maxWidth) newWidth = maxWidth

          if (newWindowSize.x !== newWidth) {
            newWindowPosition.x = this.position.x + dx
            this.#moveWindow(newWindowPosition.x)
          }

          newWindowSize.x = newWidth
          this.#resizeWindow(newWidth)
        }
        if ([1, 2, 3].includes(mouseOnBorderType)) {
          let newHeight = this.size.y - dy
          if (newHeight < minHeight) newHeight = minHeight
          if (newHeight > maxHeight) newHeight = maxHeight

          if (newWindowSize.y !== newHeight) {
            newWindowPosition.y = this.position.y + dy
            this.#moveWindow(null, newWindowPosition.y)
          }

          newWindowSize.y = newHeight
          this.#resizeWindow(null, newHeight)
        }
      })
    }
    const mouseUpHandler = () => {
      this.position.setFromVector(newWindowPosition)
      this.size.setFromVector(newWindowSize)

      document.addEventListener("mousemove", cursorTypeMouseMoveHandler)
      document.removeEventListener("mousemove", mouseMoveHandler)
      document.removeEventListener("mouseup", mouseUpHandler)
    }

    window.addEventListener("mousedown", (e) => {
      if (!mouseOnBorderType) return
      newWindowPosition = this.position.clone()
      newWindowSize = this.size.clone()
      ;[startMousePosition.x, startMousePosition.y] = [e.clientX, e.clientY]

      document.removeEventListener("mousemove", cursorTypeMouseMoveHandler)
      document.addEventListener("mousemove", mouseMoveHandler)
      document.addEventListener("mouseup", mouseUpHandler)
    })
  }

  #registerWindowSystemEvents() {
    this.addEventListener(WindowEvents.FOCUSED, () => {})
    this.addEventListener(WindowEvents.BLURED, () => {})
  }

  init() {
    this.isResizable && this.#registerResizeHandle()
    this.withHeader && this.#initHeader()
    this.#registerWindowSystemEvents()
    this.addEventListener(WindowEvents.CLOSE, () => {
      this.domElement.remove()
      this.dispatchEvent(new Event(WindowEvents.CLOSED))
    })
  }

  run() {}
}

export default Window
