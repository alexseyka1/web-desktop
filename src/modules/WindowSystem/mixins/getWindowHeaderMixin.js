import animations from "../../Animations"
import { addDropdownSubMenu } from "../../MenuPanel"
import Vector from "../../../classes/Vector"
import Window, { WindowEvents } from "../../Window"
import WindowWrapper from "../WindowWrapper"

/**
 * Window fullscreen/windowed toggle
 * @param {Window|WindowWrapper} _window
 * @returns {object}
 */
const getWindowResizingMethods = (_window) => {
  const resizingDurationMs = 200,
    parent = _window.domElement.parentNode,
    boundings = parent.getBoundingClientRect()
  let prevSize = new Vector(boundings.width / 2, boundings.height / 2),
    prevPosition = new Vector(boundings.width / 4, boundings.height / 4)

  return {
    toggle() {
      if (_window.isMaximized) this.windowed()
      else this.full()
    },

    full() {
      const screenWidth = boundings.width,
        screenHeight = boundings.height,
        maxWidth = Math.min(_window?.maxSize?.x || Infinity, screenWidth),
        maxHeight = Math.min(_window?.maxSize?.y || Infinity, screenHeight)

      prevPosition = _window.position.clone()
      prevSize = _window.size.clone()

      const positioning = {
        width: maxWidth,
        height: maxHeight,
      }

      if (_window.position.x + maxWidth > screenWidth) {
        const leftOffset = _window.position.x + maxWidth - screenWidth
        positioning.x = _window.position.x - leftOffset
      }
      if (_window.position.y + maxHeight > screenHeight) {
        const topOffset = _window.position.y + maxHeight - screenHeight
        positioning.y = _window.position.y - topOffset
      }

      animations.toggleWindowScreenSize(_window.domElement, positioning, { duration: resizingDurationMs }).then(() => {
        _window.size.set(positioning.width, positioning.height)
        _window.position.set(positioning.x, positioning.y)
        _window.isMaximized = true
        _window.dispatchEvent(new Event(WindowEvents.SCREEN_FULL))
      })
    },

    windowed() {
      if (!prevSize) return

      const positioning = {
        x: prevPosition.x,
        y: prevPosition.y,
        width: prevSize.x,
        height: prevSize.y,
      }

      animations.toggleWindowScreenSize(_window.domElement, positioning, { duration: resizingDurationMs }).then(() => {
        _window.size.set(positioning.width, positioning.height)
        _window.position.set(positioning.x, positioning.y)
        _window.isMaximized = false
        _window.dispatchEvent(new Event(WindowEvents.SCREEN_WINDOWED))
      })
    },
  }
}

/**
 * WINDOW HEADER MIXIN
 */
const getWindowHeaderMixin = () => ({
  initHeader() {
    const _window = this
    if (!_window?.domElement?.parentNode) return

    this.registerDragHandle()

    const headerElement = _window.domElement.querySelector(".header"),
      titleIconElement = _window.headerElement.querySelector(".header-title__icon"),
      minifyButton = _window.domElement.querySelector(".minify"),
      fullscreenButton = _window.domElement.querySelector(".fullscreen"),
      closeButton = _window.domElement.querySelector(".close")

    const windowResizingMethods = getWindowResizingMethods(_window)
    const resizeEvent = () => windowResizingMethods.toggle()

    if (titleIconElement) {
      titleIconElement.addEventListener("click", (e) => {
        addDropdownSubMenu(
          [
            {
              title: "Minify",
              onClick: () => _window.dispatchEvent(new Event(WindowEvents.MINIFY)),
            },
            {
              title: "Toggle fullscreen",
              onClick: () => resizeEvent(),
            },
            {
              title: "Close window",
              onClick: () => _window.dispatchEvent(new Event(WindowEvents.CLOSE)),
            },
          ],
          document.body,
          { element: titleIconElement }
        )
      })
    }

    if (headerElement && _window.isResizable) {
      headerElement.addEventListener("dblclick", () => resizeEvent())
    }

    if (minifyButton) {
      minifyButton.addEventListener("click", () => {
        _window.dispatchEvent(new Event(WindowEvents.MINIFY))
      })
    }

    if (fullscreenButton) {
      const getHelperOverlay = () => {
        const overlayClassName = "window-helper-overlay"
        const { x, y, width, height } = _window.domElement.getBoundingClientRect()
        let overlayElem = _window.domElement.querySelector(`.${overlayClassName}`)

        if (!overlayElem) {
          overlayElem = document.createElement("div")
          overlayElem.className = overlayClassName
          overlayElem.style.left = `${x}px`
          overlayElem.style.top = `${y}px`
          overlayElem.style.width = `${width}px`
          overlayElem.style.height = `${height}px`
          overlayElem.style.display = "block"
          _window.domElement.append(overlayElem)
        }

        return overlayElem
      }

      let _timer
      const _clearTimer = () => _timer && clearTimeout(_timer)
      const mouseOverHandler = () => {
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

          _window.position.set(x, y)
          _window.size.set(width, height)
        }

        const _resizeOverlay = (top, left, width, height) => {
          helperOverlay.style.top = top
          helperOverlay.style.left = left
          helperOverlay.style.width = width
          helperOverlay.style.height = height
          _window.isMaximized = false
          _resetOpacityTimer()
        }
        const resizeHelperMenu = {
          className: "window-move-helper",
          children: [
            {
              icon: "↖️",
              title: "Move to top-left",
              onMouseOver: () => {
                const parentWidth = _window.domElement.parentNode.clientWidth,
                  parentHeight = _window.domElement.parentNode.clientHeight
                _resizeOverlay(0, 0, `${parentWidth / 2}px`, `${parentHeight / 2}px`)
              },
              onClick: () => applyNewWindowPosition(),
            },
            {
              icon: "⬆️",
              title: "Move to top",
              onMouseOver: () => {
                const parentWidth = _window.domElement.parentNode.clientWidth,
                  parentHeight = _window.domElement.parentNode.clientHeight
                _resizeOverlay(0, 0, `${parentWidth}px`, `${parentHeight / 2}px`)
              },
              onClick: () => applyNewWindowPosition(),
            },
            {
              icon: "↗️",
              title: "Move to top-right",
              onMouseOver: () => {
                const parentWidth = _window.domElement.parentNode.clientWidth,
                  parentHeight = _window.domElement.parentNode.clientHeight
                _resizeOverlay(0, `${parentWidth / 2}px`, `${parentWidth / 2}px`, `${parentHeight / 2}px`)
              },
              onClick: () => applyNewWindowPosition(),
            },

            {
              icon: "⬅️",
              title: "Move to left",
              onMouseOver: () => {
                const parentWidth = _window.domElement.parentNode.clientWidth,
                  parentHeight = _window.domElement.parentNode.clientHeight
                _resizeOverlay(0, 0, `${parentWidth / 2}px`, `${parentHeight}px`)
              },
              onClick: () => applyNewWindowPosition(),
            },
            {
              className: "center",
              title: "Move to center",
              onMouseOver: () => {
                const parentWidth = _window.domElement.parentNode.clientWidth,
                  parentHeight = _window.domElement.parentNode.clientHeight
                _resizeOverlay(`${parentHeight / 4}px`, `${parentWidth / 4}px`, `${parentWidth / 2}px`, `${parentHeight / 2}px`)
              },
              onClick: () => applyNewWindowPosition(),
            },
            {
              icon: "➡️",
              title: "Move to right",
              onMouseOver: () => {
                const parentWidth = _window.domElement.parentNode.clientWidth,
                  parentHeight = _window.domElement.parentNode.clientHeight
                _resizeOverlay(0, `${parentWidth / 2}px`, `${parentWidth / 2}px`, `${parentHeight}px`)
              },
              onClick: () => applyNewWindowPosition(),
            },

            {
              icon: "↙️",
              title: "Move to bottom-left",
              onMouseOver: () => {
                const parentWidth = _window.domElement.parentNode.clientWidth,
                  parentHeight = _window.domElement.parentNode.clientHeight
                _resizeOverlay(`${parentHeight / 2}px`, 0, `${parentWidth / 2}px`, `${parentHeight / 2}px`)
              },
              onClick: () => applyNewWindowPosition(),
            },
            {
              icon: "⬇️",
              title: "Move to bottom",
              onMouseOver: () => {
                const parentWidth = _window.domElement.parentNode.clientWidth,
                  parentHeight = _window.domElement.parentNode.clientHeight
                _resizeOverlay(`${parentHeight / 2}px`, 0, `${parentWidth}px`, `${parentHeight / 2}px`)
              },
              onClick: () => applyNewWindowPosition(),
            },
            {
              icon: "↘️",
              title: "Move to bottom-right",
              onMouseOver: () => {
                const parentWidth = _window.domElement.parentNode.clientWidth,
                  parentHeight = _window.domElement.parentNode.clientHeight
                _resizeOverlay(`${parentHeight / 2}px`, `${parentWidth / 2}px`, `${parentWidth / 2}px`, `${parentHeight / 2}px`)
              },
              onClick: () => applyNewWindowPosition(),
            },
          ],
        }

        _timer = setTimeout(() => {
          helperOverlay = getHelperOverlay()
          _resetOpacityTimer()
          const menuContainer = addDropdownSubMenu(resizeHelperMenu, document.body, { element: fullscreenButton })

          let _hideMenuTimer
          const _resetHideMenuTimer = () => {
            _hideMenuTimer && clearTimeout(_hideMenuTimer)
            _hideMenuTimer = setTimeout(() => {
              animations.hide(menuContainer, { duration: 200 }).then(() => menuContainer.remove())
            }, 1000)
          }
          _resetHideMenuTimer()

          menuContainer.addEventListener("mouseover", () => _resetHideMenuTimer())
        }, 500)
      }
      fullscreenButton.addEventListener("mouseover", mouseOverHandler)
      fullscreenButton.addEventListener("mouseout", () => _clearTimer())
      fullscreenButton.addEventListener("click", () => resizeEvent())
    }

    if (closeButton) {
      closeButton.addEventListener("click", () => _window.dispatchEvent(new Event(WindowEvents.CLOSE)))
    }
  },

  registerDragHandle() {
    const _window = this
    const handler = _window.handlerElement
    let mousePosition = new Vector(),
      newWindowPosition = new Vector()

    const mouseMoveHandler = (e) => {
      const [dx, dy] = [e.clientX - mousePosition.x, e.clientY - mousePosition.y]
      const screenWidth = _window.domElement.parentNode.getBoundingClientRect().width,
        screenHeight = _window.domElement.parentNode.getBoundingClientRect().height

      let _x = _window.position.x + dx,
        _y = _window.position.y + dy
      if (_x < 0) _x = 0
      if (_y < 0) _y = 0
      if (_x + _window.size.x > screenWidth) _x = screenWidth - _window.size.x
      if (_y + _window.size.y > screenHeight) _y = screenHeight - _window.size.y

      newWindowPosition.set(_x, _y)

      requestAnimationFrame(() => this.moveWindow(newWindowPosition.x, newWindowPosition.y))
    }
    const mouseUpHandler = () => {
      _window.position.setFromVector(newWindowPosition)

      document.removeEventListener("mousemove", mouseMoveHandler)
      document.removeEventListener("mouseup", mouseUpHandler)
      _window.dispatchEvent(new Event(WindowEvents.HANDLE_STOPPED))
    }
    const mouseDownHandler = (e) => {
      if (_window.isMaximized) return
      newWindowPosition = _window.position.clone()
      ;[mousePosition.x, mousePosition.y] = [e.clientX, e.clientY]
      document.addEventListener("mousemove", mouseMoveHandler)
      document.addEventListener("mouseup", mouseUpHandler)
      _window.dispatchEvent(new Event(WindowEvents.HANDLE_STARTED))
    }

    handler.addEventListener("mousedown", mouseDownHandler)
  },
})

export default getWindowHeaderMixin
