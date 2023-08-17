class ArrayBufferCache {
  /** @type {Map<string, string>} */
  #cachedFiles = new Map()

  #hashString(str) {
    let hash = 0,
      i,
      chr
    if (str.length === 0) return hash
    for (i = 0; i < str.length; i++) {
      chr = str.charCodeAt(i)
      hash = (hash << 5) - hash + chr
      hash |= 0
    }
    return hash.toString(36)
  }

  #hashArrayBuffer(arrayBuffer, mimeType) {
    const str = new Uint8Array(arrayBuffer).reduce((sum, item) => (sum += item.toString(36)), mimeType ?? "")
    return this.#hashString(str)
  }

  /**
   * @param {ArrayBuffer} arrayBuffer
   * @param {string} mimeType
   * @returns {string}
   */
  getFileUrl(arrayBuffer, mimeType) {
    const _hash = this.#hashArrayBuffer(arrayBuffer, mimeType)
    const cachedFiles = this.#cachedFiles.get(_hash)
    if (cachedFiles) return cachedFiles

    const _blob = new Blob([arrayBuffer], { type: mimeType })
    const url = URL.createObjectURL(_blob)
    this.#cachedFiles.set(_hash, url)
    return url
  }
}

const arrayBufferCache = new ArrayBufferCache()
export default arrayBufferCache
