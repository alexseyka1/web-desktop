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
    const commandId = `${command.toString(36)}_${Date.now().toString(36)}`

    return new Promise((resolve) => {
      const worker = this.#getWorker()
      worker.addEventListener(
        "message",
        (e) => {
          const [_commandId, ...params] = e.data
          if (_commandId === commandId) resolve(params)
        },
        { once: true }
      )
      worker.postMessage([command, commandId, ...props])
    })
  }
}

const imageProcessing = new ImageProcessing()
export default imageProcessing
