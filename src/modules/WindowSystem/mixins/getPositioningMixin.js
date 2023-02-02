import Vector from "../../Vector"
import { WindowEvents } from "../../Window"

const WINDOW_DEFAULTS = {
  X: 0,
  Y: 0,
  WIDTH: 100,
  HEIGHT: 100,
}

const getPositioningMixin = () => ({
  registerPosition() {
    const self = this
    const { x, y } = this._window.params || {}

    this.position = new Proxy(new Vector(x || WINDOW_DEFAULTS.X, y || WINDOW_DEFAULTS.Y), {
      set(target, prop, value) {
        target[prop] = value
        self.moveWindow(prop == "x" ? value : self.position.x, prop == "y" ? value : self.position.y)
        return true
      },
    })

    if (x) this.position.x = x
    if (y) this.position.y = y
  },

  moveWindow(x, y) {
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
  },

  registerSize() {
    const self = this
    const { width, height, minWidth, minHeight } = this._window.params || {}

    this.size = new Proxy(new Vector(width || WINDOW_DEFAULTS.WIDTH, height || WINDOW_DEFAULTS.HEIGHT), {
      set(target, prop, value) {
        target[prop] = value
        self.resizeWindow(prop == "x" ? value : self.size.x, prop == "y" ? value : self.size.y)
        return true
      },
    })

    if (width) this.size.x = width
    if (height) this.size.y = height
    if (minWidth) this.minSize.x = minWidth
    if (minHeight) this.minSize.y = minHeight
  },

  resizeWindow(x, y) {
    if (x) this.domElement.style.width = `${x}px`
    if (y) this.domElement.style.height = `${y}px`
    this._window.dispatchEvent(new Event(WindowEvents.RESIZED))
  },
})

export default getPositioningMixin
