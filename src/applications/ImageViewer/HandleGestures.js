import Vector from "../../classes/Vector"

const WHEEL_SCALE_SPEEDUP = 2
const WHEEL_TRANSLATION_SPEEDUP = 2
const DELTA_LINE_MULTIPLIER = 8
const DELTA_PAGE_MULTIPLIER = 24
const MAX_WHEEL_DELTA = 24

class GesturesHandler {
  /**
   * Normalizes WheelEvent `e`, returning a vector.
   * @param {WheelEvent} e
   * @returns {Vector}
   */
  normalizeWheelEvent(e) {
    const _responseVector = new Vector(e.deltaX, e.deltaY)

    /** swap X and Y */
    if (_responseVector.x === 0 && e.shiftKey) {
      _responseVector.set(_responseVector.y, _responseVector.x)
    }

    if (e.deltaMode === WheelEvent.DOM_DELTA_LINE) {
      _responseVector.set(_responseVector.x * DELTA_LINE_MULTIPLIER, _responseVector.y * DELTA_LINE_MULTIPLIER)
    } else if (e.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
      _responseVector.set(_responseVector.x * DELTA_PAGE_MULTIPLIER, _responseVector.y * DELTA_PAGE_MULTIPLIER)
    }

    /**
     * We're using `Math.sign()` and `Math.min()`
     * to impose a maximum on the *absolute* value of a possibly-negative number.
     */
    _responseVector.set(this.limit(_responseVector.x, MAX_WHEEL_DELTA), this.limit(_responseVector.y, MAX_WHEEL_DELTA))

    return _responseVector
  }

  /**
   * @param {number} delta
   * @param {number} maxDelta
   * @returns {number}
   */
  limit(delta, maxDelta) {
    return Math.sign(delta) * Math.min(maxDelta, Math.abs(delta))
  }

  /**
   * @param {Touch[]} touches
   * @returns {{x: number, y: number}}
   */
  midpoint(touches) {
    let [_touch1, _touch2] = touches
    return {
      x: (_touch1.clientX + _touch2.clientX) / 2,
      y: (_touch1.clientY + _touch2.clientY) / 2,
    }
  }

  /**
   * @param {Touch[]} touches
   * @returns {number}
   */
  distance(touches) {
    let [_touch1, _touch2] = touches
    return Math.hypot(_touch2.clientX - _touch1.clientX, _touch2.clientY - _touch1.clientY)
  }

  /**
   * @param {Touch[]} touches
   * @returns {number} Degrees between touches
   */
  angle(touches) {
    let [_touch1, _touch2] = touches
    let dx = _touch2.clientX - _touch1.clientX
    let dy = _touch2.clientY - _touch1.clientY
    return (Math.atan2(dy, dx) * 180) / Math.PI
  }

  /**
   * @param {{translation: Vector, rotation: number, scale: number}} gesture
   * @param {Vector} origin
   * @returns {DOMMatrix}
   */
  gestureToMatrix(gesture, origin) {
    return new DOMMatrix()
      .translate(origin.x, origin.y)
      .translate(gesture.translation.x || 0, gesture.translation.y || 0)
      .rotate(gesture.rotation || 0)
      .scale(gesture.scale || 1)
      .translate(-origin.x, -origin.y)
  }

  /**
   * @param {HTMLElement|SVGElement} el
   * @param {{translation: Vector, rotation: number, scale: number}} gesture
   * @returns {Vector|DOMPoint}
   */
  getOrigin(el, gesture) {
    if (el instanceof HTMLElement) {
      let rect = el.getBoundingClientRect()
      return {
        x: gesture.origin.x - rect.x,
        y: gesture.origin.y - rect.y,
      }
    }
    if (el instanceof SVGElement) {
      let matrix = el.ownerSVGElement.getScreenCTM().inverse()
      let pt = new DOMPoint(gesture.origin.x, gesture.origin.y)
      return pt.matrixTransform(matrix)
    }
    throw new Error("Expected HTML or SVG element")
  }

  /**
   * @param {HTMLElement|SVGElement} el
   * @param {DOMMatrix} matrix
   * @returns {void}
   */
  applyMatrix(el, matrix) {
    if (el instanceof HTMLElement) {
      el.style.transform = matrix
      return
    }
    if (el instanceof SVGElement) {
      el.setAttribute("transform", matrix)
      return
    }
    throw new Error("Expected HTML or SVG element")
  }

  /**
   * @param {HTMLElement} container
   */
  #enableTouchEvents(container) {
    /**
     * TOUCH GESTURE
     */
    let initialTouches
    let touchGesture = null
    const touchMove = (e) => {
      if (e.touches.length === 2) {
        let mpInit = this.midpoint(initialTouches)
        let mpCurrent = this.midpoint(e.touches)
        touchGesture = {
          scale: e.scale !== undefined ? e.scale : this.distance(e.touches) / this.distance(initialTouches),
          rotation: e.rotation !== undefined ? e.rotation : this.angle(e.touches) - this.angle(initialTouches),
          translation: {
            x: mpCurrent.x - mpInit.x,
            y: mpCurrent.y - mpInit.y,
          },
          origin: mpInit,
        }
        onGesture(touchGesture)
        if (e.cancelable !== false) {
          e.preventDefault()
        }
      }
    }

    /**
     * @param {TouchEvent} e
     */
    const watchTouches = (e) => {
      if (e.touches.length === 2) {
        initialTouches = e.touches
        touchGesture = {
          scale: 1,
          rotation: 0,
          translation: { x: 0, y: 0 },
          origin: this.midpoint(initialTouches),
        }
        if (e.type === "touchstart" && e.cancelable !== false) {
          e.preventDefault()
        }
        onGestureStart(touchGesture)
        container.addEventListener("touchmove", touchMove, { passive: false })
        container.addEventListener("touchend", watchTouches)
        container.addEventListener("touchcancel", watchTouches)
      } else if (touchGesture) {
        onGestureEnd(touchGesture)
        touchGesture = null
        container.removeEventListener("touchmove", touchMove)
        container.removeEventListener("touchend", watchTouches)
        container.removeEventListener("touchcancel", watchTouches)
      }
    }
    container.addEventListener("touchstart", watchTouches, { passive: false })

    /**
     * IF GESTURE EVENT EXISTS
     */
    if (typeof GestureEvent !== "undefined" && typeof TouchEvent === "undefined") {
      let inGesture = false

      const handleGestureStart = (e) => {
        if (!inGesture) {
          onGestureStart({
            translation: { x: 0, y: 0 },
            scale: e.scale,
            rotation: e.rotation,
            origin: { x: e.clientX, y: e.clientY },
          })
          inGesture = true
        }
        if (e.cancelable !== false) {
          e.preventDefault()
        }
      }
      const handleGestureChange = (e) => {
        if (inGesture) {
          onGesture({
            translation: { x: 0, y: 0 },
            scale: e.scale,
            rotation: e.rotation,
            origin: { x: e.clientX, y: e.clientY },
          })
        }
        if (e.cancelable !== false) {
          e.preventDefault()
        }
      }
      const handleGestureEnd = (e) => {
        if (inGesture) {
          onGestureEnd({
            translation: { x: 0, y: 0 },
            scale: e.scale,
            rotation: e.rotation,
            origin: { x: e.clientX, y: e.clientY },
          })
          inGesture = false
        }
      }

      container.addEventListener("gesturestart", handleGestureStart, { passive: false })
      container.addEventListener("gesturechange", handleGestureChange, { passive: false })
      container.addEventListener("gestureend", handleGestureEnd)
    }
  }

  /**
   * @param {HTMLElement} container
   * @param {object} opts
   */
  handleGestures(container, opts) {
    const options = opts || {}

    const noop = () => {}
    const onGestureStart = options.onGestureStart || noop
    const onGesture = options.onGesture || noop
    const onGestureEnd = options.onGestureEnd || noop
    const isTouchEnabled = options.isTouchEnabled || false

    /**
     * WHEEL GESTURE
     */
    let wheelGesture = null
    let timer

    const containerWheelHandler = (e) => {
      if (e.cancelable !== false) {
        e.preventDefault()
      }
      const { x: dx, y: dy } = this.normalizeWheelEvent(e)

      if (!wheelGesture) {
        wheelGesture = {
          origin: { x: e.clientX, y: e.clientY },
          scale: 1,
          translation: { x: 0, y: 0 },
        }
        onGestureStart(wheelGesture)
      }

      if (e.ctrlKey) {
        // pinch-zoom gesture
        let factor = dy <= 0 ? 1 - (WHEEL_SCALE_SPEEDUP * dy) / 100 : 1 / (1 + (WHEEL_SCALE_SPEEDUP * dy) / 100)
        wheelGesture = {
          origin: { x: e.clientX, y: e.clientY },
          scale: wheelGesture.scale * factor,
          translation: wheelGesture.translation,
        }
      } else {
        // pan gesture
        wheelGesture = {
          origin: { x: e.clientX, y: e.clientY },
          scale: wheelGesture.scale,
          translation: {
            x: wheelGesture.translation.x - WHEEL_TRANSLATION_SPEEDUP * dx,
            y: wheelGesture.translation.y - WHEEL_TRANSLATION_SPEEDUP * dy,
          },
        }
      }
      onGesture(wheelGesture)

      if (timer) {
        window.clearTimeout(timer)
      }
      timer = window.setTimeout(function () {
        if (wheelGesture) {
          onGestureEnd(wheelGesture)
          wheelGesture = null
        }
      }, 200)
    }
    container.addEventListener("wheel", containerWheelHandler, { passive: false })

    if (isTouchEnabled) this.#enableTouchEvents(container)
  }
}

const gesturesHandler = new GesturesHandler()

export default gesturesHandler
