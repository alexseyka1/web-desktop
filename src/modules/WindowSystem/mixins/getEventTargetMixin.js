/**
 * @param {EventTarget} eventTarget
 * @returns {object}
 */
const getEventTargetMixin = (eventTarget) => ({
  /**
   * @param {string} eventName
   * @param {Function|EventListenerOrEventListenerObject} listener
   * @param {Boolean|AddEventListenerOptions} options
   */
  addEventListener(eventName, listener, options) {
    return eventTarget.addEventListener(eventName, listener, options)
  },

  /**
   * @param {string} eventName
   * @param {Function|EventListenerOrEventListenerObject} listener
   * @param {Boolean|AddEventListenerOptions} options
   */
  removeEventListener(eventName, listener, options) {
    return eventTarget.removeEventListener(eventName, listener, options)
  },

  /**
   * @param {Event} event
   * @returns {boolean}
   */
  dispatchEvent(event) {
    return eventTarget.dispatchEvent(event)
  },
})

export default getEventTargetMixin
