import Window, { WindowEvents } from "../../modules/Window"
import { WindowMessages } from "../../modules/Window/WindowMessage"
import gesturesHandler from "../../modules/HandleGestures"
import "./styles.scss"
import imageProcessing from "../../modules/ImageProcessing"

class ImageViewer extends Window {
  MIN_ZOOM = 0.1
  MAX_ZOOM = 100

  filePath
  /** @type {Worker} */
  _processingWorker
  _transformMatrix = {
    scale: 1,
  }

  constructor(props) {
    props = { width: 500, height: 400, ...props }
    super(props)
    this.windowMessages = new WindowMessages(this)
    this.filePath = props?.filePath

    this.domElement.classList.add("image-viewer")
    this.domElement.innerHTML = `
      <div class="image-viewer__loader"></div>
      <div class="image-viewer__image"></div>
    `
    this.icon = "🖼️"
  }

  get imageContentElement() {
    return this.domElement.querySelector(".image-viewer__image")
  }

  #resetTransformMatrix() {
    this._transformMatrix = {
      scale: 1,
    }
  }

  #applyImageTransformMatrix() {
    /** matrix(scaleX, skewY, skewX, scaleY, translateX, translateY) */
    this.imageContentElement.style.transform = `matrix(${this._transformMatrix.scale}, 0, 0, ${this._transformMatrix.scale}, 0, 0)`
  }

  #workerCommands = {
    "set-parsed-image": (url, fileMeta) => {
      this.#resetTransformMatrix()
      this.#applyImageTransformMatrix()
      this.imageContentElement.style.backgroundImage = `url(${url})`
      this.title = fileMeta.name
    },
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

    imageProcessing.executeCommand("open-image", filePath).then(([url, fileMeta]) => {
      this.#workerCommands["set-parsed-image"](url, fileMeta)
    })

    if (!window.DOMMatrix) {
      if (window.WebKitCSSMatrix) {
        window.DOMMatrix = window.WebKitCSSMatrix
      } else {
        throw new Error("Couldn't find a DOM Matrix implementation")
      }
    }

    let origin
    let initialCtm = new DOMMatrix()
    let el = this.imageContentElement
    el.style.transformOrigin = "0 0"

    gesturesHandler.handleGestures(this.domElement, {
      onGestureStart(gesture) {
        el.style.transform = ""
        origin = gesturesHandler.getOrigin(el, gesture)
        gesturesHandler.applyMatrix(el, gesturesHandler.gestureToMatrix(gesture, origin).multiply(initialCtm))
      },
      onGesture(gesture) {
        gesturesHandler.applyMatrix(el, gesturesHandler.gestureToMatrix(gesture, origin).multiply(initialCtm))
      },
      onGestureEnd(gesture) {
        initialCtm = gesturesHandler.gestureToMatrix(gesture, origin).multiply(initialCtm)
        gesturesHandler.applyMatrix(el, initialCtm)
      },
    })
  }
}

export default ImageViewer
