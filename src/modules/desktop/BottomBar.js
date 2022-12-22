import NotePad from "../../applications/Notepad"
import RandomColor from "../../applications/RandomColor"
import { addDropdownSubMenu } from "../MenuPanel"
import Vector from "../Vector"
import Window, { WindowEvents } from "../Window"
import WindowSystem from "../WindowSystem"
import "../../styles/bottom-bar.scss"

class BottomBar {
  /** @type {WindowSystem} */
  windowSystem

  #domElement
  /** @type {Map<Window, Object>} */
  #windowAttributes = new Map()

  constructor(windowSystem) {
    this.windowSystem = windowSystem
    this.#registerStartButton()
    this.render()
  }

  get domElement() {
    if (!this.#domElement) {
      this.#domElement = document.createElement("div")
      this.#domElement.className = "bottom-bar"
      this.#domElement.innerHTML = `
        <div class="bottom-bar__left-buttons">
          <button class="bottom-bar__start">🚀 Start</button>
        </div>
        <div class="bottom-bar__windows"></div>
        <div class="bottom-bar__right-buttons">
          <button>⬇️</button>
        </div>
      `
    }

    return this.#domElement
  }

  get windowsBar() {
    return this.domElement.querySelector(".bottom-bar__windows")
  }

  get startButton() {
    return this.domElement.querySelector(".bottom-bar__start")
  }

  #registerStartButton() {
    this.startButton.addEventListener("click", () => {
      addDropdownSubMenu(
        [
          {
            icon: "📘",
            title: "Notepad",
            onClick: () => {
              this.windowSystem.attach(new NotePad({ x: 250, y: 200, width: 350, height: 350 }))
            },
          },
          {
            icon: "🌈",
            title: "Random color Random color Random color Random color Random color Random color",
            onClick: () => {
              this.windowSystem.attach(new RandomColor({ x: 200, y: 150, width: 350, height: 200 }))
            },
          },
          {
            icon: "1️⃣",
            title: "Test window 1",
            onClick: () => {
              this.windowSystem.attach(new Window({ x: 100, y: 50, width: 200, height: 200, title: "First window" }))
            },
          },
          {
            icon: "2️⃣",
            title: "Test window 2",
            onClick: () => {
              this.windowSystem.attach(new Window({ x: 150, y: 100, width: 200, height: 200, title: "Second window" }))
            },
          },
        ],
        document.body,
        { element: this.#domElement }
      )
    })
  }

  /**
   * @param {Window} _window
   * @typedef {{isMinified: boolean, prevPosition: Vector, prevSize: Vector}} WindowAttributes
   * @returns {WindowAttributes}
   */
  #getWindowAttributes(_window) {
    if (!this.#windowAttributes.has(_window)) {
      this.#windowAttributes.set(_window, {
        isMinified: false,
        prevPosition: null,
        prevSize: null,
      })
    }

    return this.#windowAttributes.get(_window)
  }

  /**
   * @param {Window} _window
   * @param {WindowAttributes} attributes
   * @returns {WindowAttributes}
   */
  #setWindowAtttributes(_window, attributes) {
    const _wAttributes = { ...this.#getWindowAttributes(_window), ...attributes }
    this.#windowAttributes.set(_window, _wAttributes)
    return this.#getWindowAttributes(_window)
  }

  render() {
    const transitionMs = 250
    this.windowsBar.innerHTML = ""

    this.windowSystem.windows.forEach((_window) => {
      const getWindowTitle = () => `
        <div class="bottom-bar-item__icon"></div>
        <div class="bottom-bar-item__window-name">${_window.title}</div>
      `
      const menuBarItem = document.createElement("div")
      menuBarItem.className = `bottom-bar__item ${this.windowSystem.windowInFocus === _window ? "active" : ""}`
      menuBarItem.innerHTML = getWindowTitle()

      let _windowAttributes = this.#getWindowAttributes(_window)

      const minifyWindow = () => {
        const { x, y, width, height } = menuBarItem.getBoundingClientRect()
        _window.domElement.style.transition = `all ${transitionMs}ms ease-in-out`
        setTimeout(() => {
          _window.domElement.style.transition = null

          const prevFocusedWindow = this.windowSystem.windows[this.windowSystem.length - 2]
          if (prevFocusedWindow) this.windowSystem.focusOnWindow(prevFocusedWindow)
        }, transitionMs)

        _windowAttributes = this.#setWindowAtttributes(_window, {
          isMinified: true,
          prevPosition: _window.position.clone(),
          prevSize: _window.size.clone(),
        })
        _window.position.set(x, y)
        _window.size.set(width, height)
      }
      const restoreWindow = () => {
        _windowAttributes = this.#getWindowAttributes(_window)

        _window.domElement.style.transition = `all ${transitionMs}ms ease-in-out`
        setTimeout(() => (_window.domElement.style.transition = null), transitionMs)
        _window.position.setFromVector(_windowAttributes.prevPosition)
        _window.size.setFromVector(_windowAttributes.prevSize)

        _windowAttributes = this.#setWindowAtttributes(_window, { isMinified: false })
      }
      const toggleMinify = () => {
        if (_windowAttributes.isMinified) restoreWindow()
        else minifyWindow()
      }

      menuBarItem.addEventListener("click", () => {
        if (this.windowSystem.windowInFocus === _window) {
          toggleMinify()
        } else {
          _windowAttributes.isMinified && restoreWindow()
          this.windowSystem.focusOnWindow(_window)
          this.windowsBar.querySelector(".bottom-bar__item.active").classList.remove("active")
          menuBarItem.classList.add("active")
        }
      })

      _window.addEventListener(WindowEvents.TITLE_CHANGED, () => (menuBarItem.innerHTML = getWindowTitle()))
      _window.addEventListener(WindowEvents.MINIFY, () => minifyWindow())
      this.windowsBar.append(menuBarItem)
    })
  }
}

export default BottomBar
