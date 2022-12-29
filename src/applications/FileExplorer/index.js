import Window, { WindowEvents } from "../../modules/Window"
import { createWindowMessages } from "../../modules/Window/WindowMessage"
import ImageViewer from "../ImageViewer"
import fileSystem, { FileMeta, FILE_SYSTEM_EVENTS } from "./FileSystem"
import LocationStack from "./LocationStack"
import { bytesToReadable } from "./Storage"
import "./styles.scss"

/**
 * @param {FileMeta} file
 * @returns {string}
 */
const getFileIcon = (file) => {
  if (file.isDirectory) return "📁"
  switch (true) {
    case file.mimeType.startsWith("image/"):
      return "🖼️"
    case file.mimeType.startsWith("video/"):
      return "📼"
    case file.mimeType === "application/msword":
      return "📑"
    case file.mimeType === "application/pdf":
      return "📈"
    case file.mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
      return "📔"
    case file.mimeType === "text/plain":
      return "🗒️"
    default:
      return "📄"
  }
}

class FileExplorer extends Window {
  constructor(params) {
    super(params)

    this.title = "File Explorer"
    this.icon = "🗄️"
    this.locationStack = new LocationStack(params?.path || "/home")
    this.locationStack.addEventListener("change", (e) => {
      if (this.locationStringElement) this.locationStringElement.value = this.locationStack.current
      this.#rerenderWindow()
    })

    this.windowMessages = createWindowMessages(this)

    console.log(require.context("../", true, /\.\/([A-Z]\w+\.js|.*\/index.js)$/).keys())
  }

  get topButtonsElement() {
    if (!this.contentElement) return
    return this.contentElement.querySelector(".file-explorer-top-bar__buttons")
  }

  get directoryContentElement() {
    if (!this.contentElement) return
    return this.contentElement.querySelector(".file-explorer__directory-content")
  }

  get locationForm() {
    if (!this.contentElement) return
    return this.contentElement.querySelector(".file-explorer-top-bar__path")
  }

  get locationStringElement() {
    if (!this.locationForm) return
    return this.locationForm.querySelector("input")
  }

  get bottomBarElement() {
    if (!this.contentElement) return
    return this.contentElement.querySelector(".file-explorer__bottom-bar")
  }

  #rerenderWindow() {
    this.#renderTopbuttons()
    this.#renderDirectoryContent()
    this.#renderBottomBar()
  }

  async init() {
    super.init()
    this.contentElement.classList.add("file-explorer")
    this.contentElement.innerHTML = `
      <div class="file-explorer__top-bar">
        <div class="file-explorer-top-bar__buttons"></div>
        <form class="file-explorer-top-bar__path">
          <input type="text" value="${this.locationStack.current}" />
        </form>
      </div>
      <div class="files-grid file-explorer__directory-content"></div>
      <div class="file-explorer__bottom-bar"></div>
    `

    this.contentElement.addEventListener("mousedown", () => {
      this.contentElement.querySelector(".files-grid-item.active")?.classList.remove("active")
    })

    this.locationForm.addEventListener("submit", (e) => {
      e.preventDefault()
      if (!this.locationStringElement) return

      const newPath = this.locationStringElement?.value?.replace(/\/+$/, "").trim() || "/"
      this.locationStringElement.value = newPath

      this.locationStringElement.blur()
      if (newPath === this.locationStack.current) return

      this.locationStack.push(newPath)
    })
  }

  async #renderTopbuttons() {
    if (!this.topButtonsElement) return

    /**
     * BACK BUTTON
     */
    const backButtonClass = "file-explorer-top-bar__button-back"
    let backButton = this.topButtonsElement.querySelector(`.${backButtonClass}`)
    if (!backButton) {
      backButton = document.createElement("button")
      backButton.className = `file-explorer-top-bar__button ${backButtonClass}`
      backButton.innerText = "←"
      backButton.title = "Go back"
      backButton.addEventListener("click", (e) => {
        this.locationStack.goBack()
      })
      this.topButtonsElement.append(backButton)
    }
    backButton.disabled = !this.locationStack.canGoBack

    /**
     * FORWARD BUTTON
     */
    const forwardButtonClass = "file-explorer-top-bar__button-forward"
    let forwardButton = this.topButtonsElement.querySelector(`.${forwardButtonClass}`)
    if (!forwardButton) {
      forwardButton = document.createElement("button")
      forwardButton.className = `file-explorer-top-bar__button ${forwardButtonClass}`
      forwardButton.innerText = "→"
      forwardButton.title = "Go forward"
      forwardButton.addEventListener("click", (e) => {
        this.locationStack.goForward()
      })
      this.topButtonsElement.append(forwardButton)
    }
    forwardButton.disabled = !this.locationStack.canGoForward

    /**
     * UP BUTTON
     */
    const upButtonClass = "file-explorer-top-bar__button-up"
    let upButton = this.topButtonsElement.querySelector(`.${upButtonClass}`)
    if (!upButton) {
      upButton = document.createElement("button")
      upButton.className = `file-explorer-top-bar__button ${upButtonClass}`
      upButton.innerText = "↑"
      upButton.title = "Go to upper level"
      upButton.addEventListener("click", (e) => {
        let oldPath = this.locationStack.current.split("/")
        oldPath.splice(-1)
        this.locationStack.push(oldPath.join("/") || "/")
      })
      this.topButtonsElement.append(upButton)
    }
    upButton.disabled = this.locationStack.current === "/"
  }

  async #renderDirectoryContent() {
    if (!this.directoryContentElement) return
    this.directoryContentElement.innerHTML = ""

    /**
     * Checking for directory exists
     */
    if (this.locationStack.current !== "/") {
      const directoryModel = await fileSystem.getFile(this.locationStack.current)
      if (!directoryModel) {
        return this.windowMessages.showMessageError("Failed to open directory", `Directory "${this.locationStack.current}" not found.`)
      } else if (!directoryModel.isDirectory) {
        return this.windowMessages.showMessageError("This is not a directory", `File "${this.locationStack.current}" is not a directory.`)
      }
    }

    /**
     * Looking for directory content and render it
     */
    for await (let file of fileSystem.getFilesInDirectory(this.locationStack.current)) {
      const icon = getFileIcon(file)

      const fileLink = document.createElement("div")
      fileLink.className = "files-grid-item"
      if (file.isDirectory) fileLink.classList.add("files-grid-item__directory")
      fileLink.innerHTML = `
        <div class="files-grid-item__icon">${icon}</div>
        <div class="files-grid-item__title" title="${file.name || ""}">${file.name || ""}</div>
      `
      fileLink.draggable = true
      this.directoryContentElement.append(fileLink)

      /**
       * On file click
       */
      fileLink.addEventListener("mousedown", (e) => {
        e.stopPropagation()
        this.domElement.querySelector(".files-grid-item.active")?.classList.remove("active")
        fileLink.classList.add("active")
      })
      /**
       * On file double click
       */
      fileLink.addEventListener("dblclick", async () => {
        fileLink.classList.remove("active")
        if (file.isDirectory) {
          this.locationStack.push(file.fullPath)
        } else {
          this.dispatchEvent(new CustomEvent(WindowEvents.ATTACH_SUB_WINDOW, { detail: new ImageViewer({ filePath: file.fullPath }) }))
        }
      })
    }
  }

  async #renderBottomBar() {
    if (!this.bottomBarElement) return
    this.bottomBarElement.innerHTML = ""

    const { quota, usage } = await navigator.storage.estimate()
    const memoryUsageText = `Used ${bytesToReadable(usage)} of ${bytesToReadable(quota)}`
    this.bottomBarElement.innerText = memoryUsageText
  }

  /**
   * @param {File} file
   */
  async #uploadFile(file, path) {
    try {
      await fileSystem.uploadFile(file, path)
    } catch (e) {
      return this.windowMessages.showMessageError("Failed to upload file", e.message)
    }
  }

  async #createDropZone() {
    const dropZone = document.createElement("div")
    dropZone.innerHTML = `<div>Drag one or more files to this <i>drop zone</i>.</div>`
    dropZone.className = "file-explorer__dropzone"

    const isDragHasFiles = (event) => {
      if (event.dataTransfer.items) {
        for (let item of event.dataTransfer.items) {
          if (item.kind === "file") return true
        }
      } else {
        for (let item of event.dataTransfer.files) {
          if (item) return true
        }
      }

      return false
    }
    let isDragChecked = false

    this.directoryContentElement.addEventListener("drop", (e) => {
      e.preventDefault()
      e.stopPropagation()
      dropZone.style.visibility = "hidden"
      if (e.dataTransfer.items) {
        ;[...e.dataTransfer.items].forEach((item, i) => {
          if (item.kind === "file") {
            const file = item.getAsFile()
            this.#uploadFile(file, this.locationStack.current)
          }
        })
      } else {
        ;[...e.dataTransfer.files].forEach((file, i) => this.#uploadFile(file, this.locationStack.current))
      }
      isDragChecked = false
    })
    this.directoryContentElement.addEventListener("dragover", (e) => {
      e.preventDefault()
      e.stopPropagation()
      if (!isDragChecked) {
        const result = isDragHasFiles(e)
        isDragChecked = true
        if (result) {
          dropZone.style.visibility = "visible"
        }
      }
    })
    this.directoryContentElement.addEventListener("dragleave", (e) => {
      e.preventDefault()
      e.stopPropagation()
      dropZone.style.visibility = "hidden"
      isDragChecked = false
    })
    this.contentElement.append(dropZone)
  }

  async run() {
    this.#rerenderWindow()
    this.#createDropZone()

    fileSystem.addEventListener(FILE_SYSTEM_EVENTS.DIRECTORY_CHANGED, (e) => {
      if (e.detail === this.locationStack.current) this.#rerenderWindow()
    })
  }
}

export default FileExplorer
