class LocationStack extends EventTarget {
  #stack = []
  #currentIndex = 0

  constructor(path) {
    super()
    this.#stack.push(path)
  }

  get current() {
    return this.#stack[this.#currentIndex]
  }

  get canGoBack() {
    return this.#currentIndex > 0 && this.#stack.length > 1
  }

  get canGoForward() {
    return this.#currentIndex < this.#stack.length - 1
  }

  get stack() {
    return [...this.#stack]
  }

  push(location) {
    if (!location) return
    /**
     * Delete all forward history items and add new item
     */
    const result = this.#stack.splice(this.#currentIndex + 1, this.#stack.length - this.#currentIndex - 1, location)
    this.#currentIndex++

    this.dispatchEvent(new Event("change"))
    return result
  }

  goBack() {
    if (!this.canGoBack) return null

    this.#currentIndex -= 1
    const result = this.#stack[this.#currentIndex]
    this.dispatchEvent(new Event("change"))
    return result
  }

  goForward() {
    if (!this.canGoForward) return null

    this.#currentIndex++
    const result = this.#stack[this.#currentIndex]
    this.dispatchEvent(new Event("change"))
    return result
  }
}

export default LocationStack
