class IteratorInterface {
  next() {}

  /**
   * @returns {string}
   */
  peek() {}

  /**
   * @returns {boolean}
   */
  isEof() {}

  /**
   * @param {string} msg
   * @throws {Error}
   */
  throwError(msg) {}
}

export default IteratorInterface
