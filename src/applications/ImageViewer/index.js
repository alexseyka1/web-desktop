import Window, { WindowEvents } from "../../modules/Window"
import { createWindowMessages } from "../../modules/Window/WindowMessage"
import "./styles.scss"

class ImageViewer extends Window {
  filePath
  /** @type {Worker} */
  _processingWorker

  constructor(props) {
    props = { width: 500, height: 400, ...props }
    super(props)
    this.windowMessages = createWindowMessages(this)
    this.filePath = props?.filePath

    this.contentElement.classList.add("image-viewer")
    this.contentElement.innerHTML = `
      <div class="image-viewer__loader"></div>
      <div class="image-viewer__image"></div>
    `
    this.icon = "🖼️"

    this.#initWorker()
  }

  get imageContentElement() {
    return this.contentElement.querySelector(".image-viewer__image")
  }

  #workerCommands = {
    "set-parsed-image": (url, fileMeta) => {
      this.imageContentElement.style.backgroundImage = `url(${url})`
      this.title = fileMeta.name
    },
  }

  #initWorker() {
    this._processingWorker = new Worker(new URL("./imageProcessingWorker.js", import.meta.url))
    this.addEventListener(WindowEvents.CLOSE, () => {
      this._processingWorker.terminate()
    })

    this._processingWorker.onmessage = (e) => {
      const [command, ...params] = e.data
      if (command in this.#workerCommands) this.#workerCommands[command].apply(this, params)
    }
  }

  async run() {
    if (!this.filePath) {
      this.windowMessages.showMessageError("Failed to open file", "File is not specified")
      this.dispatchEvent(new Event(WindowEvents.CLOSE))
      return
    }

    let filePath = this.filePath
    if (Array.isArray(filePath)) {
      filePath = filePath.pop()
    }

    this._processingWorker.postMessage(["open-image", filePath])
  }
}

export default ImageViewer
