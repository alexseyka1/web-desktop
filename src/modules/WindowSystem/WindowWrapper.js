import { withSharedValue } from "../Helper"
import { getRegisterMenuObject } from "../MenuPanel"
import Vector from "../Vector"
import Window, { WindowEvents } from "../Window"
import getEventTargetMixin from "./mixins/getEventTargetMixin"
import getPositioningMixin from "./mixins/getPositioningMixin"
import getWindowHeaderMixin from "./mixins/getWindowHeaderMixin"
import getResizingMixin from "./mixins/getResizingMixin"

class WindowWrapper {
  /** @type {Window} */
  _window
  #domElement

  position = new Vector()
  size = new Vector(100, 100)
  minSize = new Vector(100, 100)
  maxSize

  constructor(_window, params = {}) {
    this._window = _window

    Object.assign(this, getEventTargetMixin(this._window))
    this._window.domElement.classList.add("content")
    this.contentElement.replaceWith(this._window.domElement)
    this.setParams(params)
  }

  setParams(params = {}) {
    if (params && typeof params === "object") {
      Object.keys(params).forEach((param) => {
        if (!(param in this)) return
        this[param] = params[param]
      })
    }
  }

  /**
   * @returns {HTMLElement}
   */
  get domElement() {
    if (!this.#domElement) {
      this.#domElement = document.createElement("div")
      this.#domElement.classList.add("window")
      const template = document.createElement("template")

      template.innerHTML = `
        ${
          this._window.withHeader
            ? `<div class="header">
              <div class="header__title handler">
                <div class="header-title__icon">${this._window.icon ?? ""}</div>
                <div class="header-title__name">${this._window.title ?? ""}</div>
              </div>
              ${!this._window.isModal ? `<div class="header__button minify"></div>` : ""}
              ${this._window.isResizable ? `<div class="header__button fullscreen"></div>` : ""}
              <div class="header__button close"></div>
            </div>`
            : ""
        }
        <div class="content"></div>
      `
      this.#domElement.append(template.content)
    }

    return this.#domElement
  }

  /**
   * @returns {HTMLElement}
   */
  get contentElement() {
    return this.domElement.querySelector(".content")
  }
  /**
   * @returns {HTMLElement}
   */
  get handlerElement() {
    return this.domElement.querySelector(".handler")
  }
  /**
   * @returns {HTMLElement}
   */
  get headerElement() {
    return this.domElement.querySelector(".header")
  }
  /**
   * @returns {HTMLElement}
   */
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

  _registerWindowTitleChanging() {
    withSharedValue(this._window, "title", this._window.title || "", {
      set: () => {
        this._changeTitle()
        this._window.dispatchEvent(new Event(WindowEvents.TITLE_CHANGED))
      },
    })
  }

  _changeTitle() {
    const nameElem = this.domElement.querySelector(".header .header-title__name")
    const iconElem = this.domElement.querySelector(".header .header-title__icon")
    if (nameElem) nameElem.innerText = this._window.title || ""
    if (iconElem) iconElem.innerHTML = this._window.icon || ""
  }

  init() {
    this._registerWindowTitleChanging()
    Object.assign(this, getPositioningMixin())
    this.registerPosition()
    this.registerSize()

    if (this._window.withHeader) {
      Object.assign(this, getWindowHeaderMixin())
      this.initHeader()
    }
    if (this._window.isResizable) {
      Object.assign(this, getResizingMixin())
      this.registerResizeHandle()
    }

    this._window.init()
  }

  registerMenuPanel(menuItems) {
    if (this.menuElement) this.menuElement.remove()
    return getRegisterMenuObject(this.menuElement)(menuItems)
  }

  run() {
    this._window.run()
  }
}

export default WindowWrapper

export const createWindowWrapper = (_window) => {
  const _wrapper = new WindowWrapper(_window)
  return new Proxy(_wrapper, {
    get: (target, prop) => {
      if (!(prop in target) && prop in target?._window) {
        return target._window[prop]
      }

      return target[prop]
    },
    set: (target, prop, value, receiver) => {
      if (!(prop in target) && prop in target?._window) {
        return Reflect.set(target._window, prop, value, receiver)
      }

      return Reflect.set(target, prop, value, receiver)
    },
  })
}
