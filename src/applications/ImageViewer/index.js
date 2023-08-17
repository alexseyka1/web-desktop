import { WindowMessages } from "../../modules/Window/WindowMessage"
import gesturesHandler from "./HandleGestures"
import "./styles.scss"
import imageProcessing from "../../modules/ImageProcessing"
import Application from "../../modules/Application"
import WindowWrapper from "../../modules/WindowSystem/WindowWrapper"
import systemBus, { SYSTEM_BUS_COMMANDS } from "../../modules/SystemBus"
import manifest from "./manifest.json"

class ImageViewer extends Application {
  MIN_ZOOM = 0.1
  MAX_ZOOM = 100

  filePath
  /** @type {Worker} */
  _processingWorker
  _transformMatrix = {
    scale: 1,
  }
  /** @type {WindowWrapper} */
  #window

  get loaderElement() {
    return this.#window.contentElement.querySelector(".image-viewer__loader")
  }

  #hideLoader() {
    this.loaderElement.style.visibility = "hidden"
  }

  async main(filePaths) {
    this.windowMessages = new WindowMessages(this)
    this.filePath = filePaths?.[0] || null

    this.#window = await this.createWindow({
      width: 500,
      height: 400,
      title: manifest.appName,
      icon: manifest.icon,
    })
    this.#window.domElement.classList.add("image-viewer")
    this.#window.contentElement.innerHTML = `
      <div class="image-viewer__image"></div>
      <div class="image-viewer__loader"></div>
    `

    if (!this.filePath) {
      const selectedFiles = await systemBus.execute(SYSTEM_BUS_COMMANDS.APP_RUNNER.RUN_COMMAND, "file-explorer.app --view=table")
      console.log({ selectedFiles })
      // this.windowMessages.showMessageError("Failed to open file", "File is not specified")
    } else {
      let filePath = this.filePath
      if (Array.isArray(filePath)) {
        filePath = filePath.pop()
      }

      imageProcessing.executeCommand("open-image", filePath).then(([url, fileMeta]) => {
        this.#workerCommands["set-parsed-image"](url, fileMeta)
      })
    }

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

    gesturesHandler.handleGestures(this.#window.domElement, {
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

  get imageContentElement() {
    return this.#window.contentElement.querySelector(".image-viewer__image")
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

      const _image = new Image()
      _image.onload = () => {
        this.imageContentElement.style.backgroundImage = `url(${_image.src})`
        this.#window._window.title = fileMeta.name
        setTimeout(() => this.#hideLoader(), 50)
      }
      _image.src = url
    },
  }
}

export default ImageViewer
