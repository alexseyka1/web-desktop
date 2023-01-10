/**
 * @param {string} name
 * @param {any} initialValue
 * @param {{get: function, set: function}} descriptor {get(value), set(newValue, prevValue)}
 * @returns
 */
export const withSharedValue = (object, name, initialValue = null, descriptor) => {
  const _symbol = Symbol(`Shared value ${name}`)

  let sharedValue = initialValue
  Object.defineProperty(object, name, {
    get() {
      if (descriptor?.get && typeof descriptor.get === "function") {
        return descriptor.get(sharedValue)
      }

      return sharedValue
    },
    set(value) {
      sharedValue = value
      if (descriptor?.set && typeof descriptor.set === "function") {
        return descriptor.set(value, sharedValue)
      }
    },
  })
}

const Helper = {
  isNumberBetween: (num, [from, to]) => num >= from && num <= to,

  /**
   * @param {Vector} cursorPosition
   * @param {Window} window
   * @param {Number} borderSize
   */
  getMouseOnBorderType: (cursorPosition, window, borderSize) => {
    const between = Helper.isNumberBetween
    const { x, y } = cursorPosition
    const leftPosition = window.position.x,
      rightPosition = window.position.x + window.size.x,
      topPosition = window.position.y,
      bottomPosition = window.position.y + window.size.y

    const cursorInsideWindow = between(x, [leftPosition, rightPosition]) && between(y, [topPosition, bottomPosition])
    if (!cursorInsideWindow) return null

    const cursorOnLeft = between(x, [leftPosition + 1, leftPosition + borderSize]),
      cursorOnRight = between(x, [rightPosition - borderSize, rightPosition - 1]),
      cursorOnTop = between(y, [topPosition + 1, topPosition + borderSize]),
      cursorOnBottom = between(y, [bottomPosition - borderSize, bottomPosition - 1])

    if (cursorOnLeft && cursorOnTop) return 1
    if (cursorOnRight && cursorOnTop) return 3
    if (cursorOnLeft && cursorOnBottom) return 7
    if (cursorOnRight && cursorOnBottom) return 9
    if (cursorOnTop) return 2
    if (cursorOnLeft) return 4
    if (cursorOnRight) return 6
    if (cursorOnBottom) return 8

    return null
  },
}

export default Helper
