/**
 * @property {number} id
 */
export default class File {
  /** @type {ArrayBuffer} */
  arrayBuffer = null

  /**
   * @param {ArrayBuffer}
   */
  constructor(content) {
    this.arrayBuffer = content
  }

  static fromStorage(params) {
    const instance = new File()

    if (!params || typeof params !== "object") return
    Object.keys(params).forEach((param) => {
      if (!(param in instance)) return
      instance[param] = params[param]
    })

    return instance
  }
}
