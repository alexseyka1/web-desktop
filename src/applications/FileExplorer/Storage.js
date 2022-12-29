export const bytesToReadable = (bytes, precision = 2) => {
  const thresh = 1024

  if (Math.abs(bytes) < thresh) {
    return bytes + " B"
  }

  const units = ["kB", "MB", "GB", "TB"]
  let unitIndex = -1
  const r = 10 ** precision

  do {
    bytes /= thresh
    ++unitIndex
  } while (Math.round(Math.abs(bytes) * r) / r >= thresh && unitIndex < units.length - 1)

  return bytes.toFixed(precision) + " " + units[unitIndex]
}

class StorageQueryBuilder {
  #databaseName
  #version
  #storeNames = ""

  params = {
    /**
     * @param {IDBVersionChangeEvent} e
     * @param {IDBDatabase} db
     */
    onUpgradeNeeded: (e, db) => {},
    onVersionChange: () => {},
  }

  constructor(databaseName, version = 1, params) {
    this.#databaseName = databaseName
    this.#version = version

    if (params && typeof params === "object") {
      Object.assign(this.params, params)
    }
  }

  /**
   * @param {string|string[]} storeNames
   * @returns {StorageQueryBuilder}
   */
  setStoreNames(storeNames) {
    this.#storeNames = storeNames
    return this
  }

  async deleteDatabase() {
    return await indexedDB.deleteDatabase(this.#databaseName)
  }

  /**
   * @returns {IDBDatabase}
   */
  #openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.#databaseName, this.#version)

      request.onerror = () => {
        reject(request.error)
        return
      }

      request.onupgradeneeded = (e) => {
        const db = request.result
        this.params.onUpgradeNeeded(e, db)
      }

      request.onsuccess = () => {
        const db = request.result
        db.onversionchange = () => {
          db.close()
          alert("The database is out of date, please reload the page.")
        }

        resolve(db)
      }
    })
  }

  /**
   * @param {string} [mode=] May be "readonly" or "readwrite"
   * @returns {IDBTransaction}
   */
  async createTransaction(mode = "readonly") {
    const db = await this.#openDatabase()
    return db.transaction(this.#storeNames, mode)
  }

  /**
   * @callback transactionCallback
   * @param {IDBTransaction} transaction
   */
  /**
   * @param {string} mode May be "readonly" or "readwrite"
   * @param {transactionCallback} callback {transaction: IDBTransaction}
   * @returns {Promise}
   */
  doInTransaction(mode = "readonly", callback) {
    return new Promise(async (resolve, reject) => {
      let callbackResponse
      const db = await this.#openDatabase()
      const transaction = db.transaction(this.#storeNames, mode)
      transaction.oncomplete = () => resolve(callbackResponse)
      try {
        callbackResponse = await callback(transaction)
      } catch (e) {
        transaction.abort()
        reject(e)
      }
    })
  }

  /**
   * @param {object|any} item
   * @returns {Promise<number>}
   */
  addOne(item) {
    return new Promise(async (resolve, reject) => {
      const db = await this.#openDatabase()

      const transaction = db.transaction(this.#storeNames, "readwrite")
      const storage = transaction.objectStore(this.#storeNames)
      const request = storage.add(item)

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }
}

export default StorageQueryBuilder
