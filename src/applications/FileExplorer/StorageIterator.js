class StorageIterator {
  /** @type {IDBObjectStore | IDBIndex} */
  #objectStore
  /** @type {IDBKeyRange} */
  #keyRange
  /** @type {IDBRequest} */
  #cursorRequest
  /** @type {IDBCursorWithValue} */
  #cursor
  /** @type {Function<{result: IteratorResult}>} */
  #curResolver

  /**
   * @param {IDBObjectStore | IDBIndex} objectStore
   * @param {IDBKeyRange} keyRange
   */
  constructor(objectStore, keyRange = null) {
    this.#objectStore = objectStore
    this.#keyRange = keyRange
  }

  /**
   * @returns {AsyncIterableIterator}
   */
  [Symbol.asyncIterator]() {
    return this
  }

  /**
   * @returns {Promise<IteratorResult>}
   */
  next() {
    return new Promise(async (resolve) => {
      // We need to store the resolver as an instance variable, since else the
      // success callback would always try to resolve the promise of the first
      // next() call only:
      this.#curResolver = resolve

      if (!this.#cursorRequest) {
        // Initial request -> Open the cursor and listen for subsequent success events:
        this.#cursorRequest = this.#objectStore.openCursor(this.#keyRange)
        this.#cursorRequest.onsuccess = (e) => {
          this.#cursor = e.target.result
          if (this.#cursor) {
            this.#curResolver({ value: this.#cursor.value, done: false })
          } else {
            // We have reached the end:
            this.#curResolver({ value: null, done: true })
          }
        }
      } else {
        // 2nd request or later -> continue (Still, the above success
        // listener will be called when the cursor has been moved forward):
        this.#cursor.continue()
      }
    })
  }
}

export default StorageIterator
