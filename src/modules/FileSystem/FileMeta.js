export default class FileMeta {
  /** @type {number} */
  fileId = null
  /** @type {string} */
  name = null
  /** @type {string} */
  displayName = null
  /** @type {string} */
  path = null

  createdAt = new Date()
  /** @type {Date} */
  updatedAt = null
  /** @type {Date} */
  accessedAt
  /** @type {string} */
  mimeType = null
  /** @type {number} */
  size = null
  isDirectory = false
  /** @type {ArrayBuffer} */
  thumbnailBuffer = null
  /** @type {string} */
  icon = null
  /** @type {string} */
  description = null

  constructor(filePath) {
    const parsed = filePath?.match(/^(?<directory>\/.+)?\/(?<filename>.+(\..+)?)$/)
    if (parsed?.groups) {
      if (parsed.groups?.filename) this.name = parsed.groups?.filename
    }
    this.path = parsed?.groups?.directory || "/"
  }

  get fullPath() {
    return `${this.path}/${this.name}`.replace(/\/+/, "/")
  }

  static fromStorage(params) {
    const instance = new FileMeta()

    if (!params || typeof params !== "object") return
    Object.keys(params).forEach((param) => {
      if (!(param in instance)) return
      instance[param] = params[param]
    })

    return instance
  }
}
