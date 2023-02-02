import Hashes from "../../classes/Hashes"

class ImageProcessing {
  #worker

  /**
   * @returns {Worker}
   */
  #getWorker() {
    if (!this.#worker) {
      this.#worker = new Worker(new URL("./imageProcessingWorker.js", import.meta.url))
    }
    return this.#worker
  }

  /**
   * @param {string} command
   * @param  {...any} props
   * @returns {Promise<any[]>}
   */
  async executeCommand(command, ...props) {
    const commandId = Hashes.uuidv4()

    return new Promise((resolve) => {
      const worker = this.#getWorker()
      const _handler = (e) => {
        const [_commandId, ...params] = e.data
        if (_commandId === commandId) {
          worker.removeEventListener("message", _handler)
          resolve(params)
        }
      }
      worker.addEventListener("message", _handler)
      worker.postMessage([command, commandId, ...props])
    })
  }
}

const imageProcessing = new ImageProcessing()
export default imageProcessing
