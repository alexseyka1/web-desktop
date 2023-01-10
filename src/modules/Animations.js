/**
 *
 * @param {HTMLElement} element
 * @param {Keyframe[]} keyframes
 * @param {KeyframeAnimationOptions} options
 * @returns {Promise<Animation>}
 */
const getPromise = (element, keyframes, options) => {
  return new Promise((resolve, reject) => {
    requestAnimationFrame(() => {
      const _options = Object.assign({ duration: 250 }, options)
      const animation = element.animate(keyframes, _options)

      animation.addEventListener("finish", () => resolve(animation))
      animation.addEventListener("cancel", () => reject(animation))
    })
  })
}

class Animations {
  /**
   * @param {HTMLElement} element
   * @param {KeyframeAnimationOptions} options
   * @returns {Promise<Animation>}
   */
  hide = (element, options) => getPromise(element, [{ opacity: 1 }, { opacity: 0 }], options)

  /**
   *
   * @param {HTMLElement} element
   * @param {KeyframeAnimationOptions} options
   * @returns {Promise<Animation>}
   */
  toggleWindowScreenSize = (element, { x, y, width, height }, options) => {
    const boundings = element.getBoundingClientRect()
    return getPromise(
      element,
      [
        {
          top: `${boundings.top}px`,
          left: `${boundings.left}px`,
          width: `${boundings.width}px`,
          height: `${boundings.height}px`,
        },
        {
          top: `${y}px`,
          left: `${x}px`,
          width: `${width}px`,
          height: `${height}px`,
        },
      ],
      options
    )
  }
}

const animations = new Animations()
export default animations
