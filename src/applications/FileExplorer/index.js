import Window, { WindowEvents } from "../../modules/Window"
import { createWindowMessages } from "../../modules/Window/WindowMessage"
import fileSystem, { FileMeta } from "../../modules/FileSystem"
import LocationStack from "./LocationStack"
import { bytesToReadable } from "../../modules/FileSystem/Storage"
import WindowProcess, { WindowProcessItem, WINDOW_PROCESS_EVENTS } from "../../modules/Window/WindowProcess"
import "./styles.scss"
import { addDropdownSubMenu } from "../../modules/MenuPanel"
import systemBus, { SYSTEM_BUS_COMMANDS, SYSTEM_BUS_EVENTS } from "../../modules/SystemBus"

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
  /** @type {string} */
  #prevRenderedPath
  /** @type {Set<FileMeta>} */
  #selectedFiles = new Set()
  /** @type {Map<FileMeta, number>} */
  #showedFiles = new Map()

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
    this.#registerKeyboardEvents()
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

  #registerKeyboardEvents() {
    const keyPressHandler = (e) => {
      console.log(e)
    }

    this.addEventListener(WindowEvents.FOCUSED, () => {
      window.addEventListener("keypress", keyPressHandler)
    })
    this.addEventListener(WindowEvents.BLURED, () => {
      window.removeEventListener("keypress", keyPressHandler)
    })
  }

  #rerenderWindow() {
    this.#selectedFiles.clear()
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
      this.#selectedFiles.clear()
      this.contentElement.querySelectorAll(".files-grid-item.active").forEach((elem) => elem.classList.remove("active"))
      this.#renderBottomBar()
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

  /**
   * @param {FileMeta} file
   * @returns {object}
   */
  #getFileContextMenu(file) {
    const typeName = file.isDirectory ? "directory" : "file"
    let items = [
      {
        title: `Delete ${typeName}`,
        icon: "✖️",
        onClick: (e) => {
          const deleteFile = () => this.#deleteFiles([file])
          this.windowMessages.showMessageQuestion("Are you sure?", `Are you sure you want to delete ${typeName} ${file.name}?`, deleteFile)
        },
      },
    ]

    if (file.isDirectory) {
      items = [
        {
          title: `Open ${typeName}`,
          onClick: () => this.locationStack.push(file.fullPath),
        },
        ...items,
      ]
    }

    return [
      ...items,
      {
        title: "Properties",
        icon: "ℹ️",
      },
    ]
  }

  async #renderDirectoryContent() {
    if (!this.directoryContentElement) return
    this.directoryContentElement.innerHTML = ""

    /**
     * If location was changed
     */
    if (this.locationStack.current !== this.#prevRenderedPath) {
      this.#prevRenderedPath = this.locationStack.current

      if (this.locationStack.current !== "/") {
        /**
         * Checking for directory exists
         */
        const { file: directoryModel } = await systemBus.execute(SYSTEM_BUS_COMMANDS.FILE_SYSTEM.READ_FILE_META, this.locationStack.current)
        if (!directoryModel) {
          return this.windowMessages.showMessageError("Failed to open directory", `Directory "${this.locationStack.current}" not found.`)
        } else if (!directoryModel.isDirectory) {
          return this.windowMessages.showMessageError("This is not a directory", `File "${this.locationStack.current}" is not a directory.`)
        }
      }
    }

    /**
     * Looking for directory content and render it
     */
    const addFileToList = (file, fileLink) => {
      this.#selectedFiles.add(file)
      fileLink.classList.add("active")
    }
    this.directoryContentElement.innerHTML = ""
    this.#showedFiles = new Map()
    let index = 0
    const { iterator } = await systemBus.execute(SYSTEM_BUS_COMMANDS.FILE_SYSTEM.GET_FILES_ITERATOR, this.locationStack.current)

    for await (let file of iterator) {
      this.#showedFiles.set(file, index)
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

        if (e.ctrlKey || e.metaKey) {
          /** Select some files with CTRL or META keys */
          if (this.#selectedFiles.has(file)) {
            this.#selectedFiles.delete(file)
            fileLink.classList.remove("active")
          } else {
            addFileToList(file, fileLink)
          }
        } else if (e.shiftKey) {
          /** Select list of files with SHIFT key */
          if (!this.#selectedFiles.size) addFileToList(file, fileLink)
          else {
            this.domElement.querySelectorAll(".files-grid-item.active").forEach((elem) => elem.classList.remove("active"))

            const firstSelectedFile = this.#selectedFiles.values().next().value
            const fromIndex = this.#showedFiles.get(firstSelectedFile)
            const toIndex = this.#showedFiles.get(file)
            if (fromIndex != null && toIndex) {
              const _showedFiles = this.#showedFiles.keys()
              let _fileIndex = 0
              for (let _showedFile of _showedFiles) {
                if (_fileIndex < fromIndex) {
                  ++_fileIndex
                  continue
                }

                if (!this.#selectedFiles.has(_showedFile)) this.#selectedFiles.add(_showedFile)
                const _elem = this.domElement.querySelectorAll(".files-grid-item")[_fileIndex]
                if (_elem) _elem.classList.add("active")
                if (++_fileIndex > toIndex) break
              }
            }
          }
        } else {
          /** Just click on file */
          this.domElement.querySelectorAll(".files-grid-item.active").forEach((elem) => elem.classList.remove("active"))
          this.#selectedFiles.clear()
          this.#selectedFiles.add(file)
          fileLink.classList.add("active")
        }

        fileLink.scrollIntoView({ behavior: "smooth", block: "end" })

        this.#renderBottomBar()
      })

      /**
       * On file double click
       */
      const doubleClickHandler = async (e) => {
        fileLink.classList.remove("active")
        if (file.isDirectory) {
          this.locationStack.push(file.fullPath)
        } else {
          systemBus.execute(SYSTEM_BUS_COMMANDS.FILE_SYSTEM.OPEN_FILE, file.fullPath)
        }
      }
      fileLink.addEventListener("dblclick", doubleClickHandler)
      let doubleTouchTimer
      fileLink.addEventListener("touchstart", (e) => {
        if (!doubleTouchTimer) {
          doubleTouchTimer = setTimeout(() => {
            if (doubleTouchTimer) clearTimeout(doubleTouchTimer)
          }, 250)
          return
        }

        clearTimeout(doubleTouchTimer)
        doubleClickHandler(e)
      })

      /**
       * On file right click
       */
      fileLink.addEventListener("contextmenu", (e) => {
        e.preventDefault()
        e.stopPropagation()
        const contextMenu = this.#getFileContextMenu(file)
        addDropdownSubMenu(contextMenu, document.body, { x: e.clientX, y: e.clientY })
      })

      index++
    }
  }

  async #renderBottomBar() {
    if (!this.bottomBarElement) return
    this.bottomBarElement.innerHTML = ""

    let _text
    if (!this.#selectedFiles.size) {
      const { quota, usage } = await navigator.storage.estimate()
      _text = `Used ${bytesToReadable(usage)} of ${bytesToReadable(quota)}`
    } else {
      const _count = this.#selectedFiles.size
      _text = `Selected ${_count} file${_count > 1 ? "s" : ""}`
    }
    this.bottomBarElement.innerText = _text
  }

  /**
   * @param {File[]} files
   */
  async #uploadFiles(files, path) {
    let loadingWindow
    const closeLoadingWindow = () => {
      if (loadingWindow) {
        loadingWindow.dispatchEvent(new CustomEvent(WindowEvents.CLOSE, { detail: { forced: true } }))
      }
    }

    try {
      const loadingProcesses = files.reduce((sum, file) => {
        return { ...sum, [file.name]: new WindowProcessItem(file.name, false) }
      }, {})

      const uploadFileProgressHandler = ({ detail: { _file, e } }) => {
        if (!loadingWindow) return
        const _percent = (e.loaded / e.total) * 100
        loadingProcesses[_file.name].percentage = _percent
        loadingWindow.dispatchEvent(new CustomEvent(WINDOW_PROCESS_EVENTS.UPDATE_PROCESSES, { detail: Object.values(loadingProcesses) }))
      }

      const startUploadingHandler = () => {
        loadingWindow = new WindowProcess({
          title: "Uploading files",
          processes: Object.values(loadingProcesses),
          onCancelProcess: () => {
            throw new Error("Files uploading cancelled.")
          },
        })
        systemBus.execute(SYSTEM_BUS_COMMANDS.WINDOW_SYSTEM.OPEN_WINDOW, loadingWindow)

        systemBus.addEventListener(SYSTEM_BUS_EVENTS.FILE_SYSTEM.UPLOAD_FILES_FINISHED, () => {
          systemBus.removeEventListener(SYSTEM_BUS_EVENTS.FILE_SYSTEM.UPLOAD_FILES_STARTED, startUploadingHandler)
          systemBus.removeEventListener(SYSTEM_BUS_EVENTS.FILE_SYSTEM.UPLOAD_FILE_PROGRESS, uploadFileProgressHandler)
          closeLoadingWindow()
        })
      }
      systemBus.addEventListener(SYSTEM_BUS_EVENTS.FILE_SYSTEM.UPLOAD_FILES_STARTED, startUploadingHandler)
      systemBus.addEventListener(SYSTEM_BUS_EVENTS.FILE_SYSTEM.UPLOAD_FILE_PROGRESS, uploadFileProgressHandler)

      await systemBus.execute(SYSTEM_BUS_COMMANDS.FILE_SYSTEM.UPLOAD_FILES_LIST, { files, path })
    } catch (e) {
      closeLoadingWindow()
      return this.windowMessages.showMessageError("Failed to upload file", e.message)
    }
  }

  /**
   * @param {FileMeta[]} files
   */
  async #deleteFiles(files) {
    let loadingWindow
    const closeLoadingWindow = () => {
      if (loadingWindow) {
        loadingWindow.dispatchEvent(new CustomEvent(WindowEvents.CLOSE, { detail: { forced: true } }))
      }
    }

    try {
      const processTitle = files.length > 1 ? `Deleting ${files.length} files` : files[0].name
      const loadingProcess = new WindowProcessItem(processTitle, false)
      const deleteFileProgressHandler = ({ detail: { _file, e } }) => {
        if (!loadingWindow) return
        const _percent = (e.loaded / e.total) * 100
        loadingProcess.percentage = _percent
        loadingWindow.dispatchEvent(new CustomEvent(WINDOW_PROCESS_EVENTS.UPDATE_PROCESSES, { detail: [loadingProcess] }))
      }

      const startDeletingHandler = () => {
        loadingWindow = new WindowProcess({
          title: "Deleting files",
          processes: [loadingProcess],
          onCancelProcess: () => {
            throw new Error("Files deleting cancelled.")
          },
        })
        systemBus.execute(SYSTEM_BUS_COMMANDS.WINDOW_SYSTEM.OPEN_WINDOW, loadingWindow)

        systemBus.addEventListener(SYSTEM_BUS_EVENTS.FILE_SYSTEM.DELETE_FILES_FINISHED, () => {
          systemBus.removeEventListener(SYSTEM_BUS_EVENTS.FILE_SYSTEM.DELETE_FILES_STARTED, startDeletingHandler)
          systemBus.removeEventListener(SYSTEM_BUS_EVENTS.FILE_SYSTEM.DELETE_FILE_PROGRESS, deleteFileProgressHandler)
          closeLoadingWindow()
        })
      }
      systemBus.addEventListener(SYSTEM_BUS_EVENTS.FILE_SYSTEM.DELETE_FILES_STARTED, startDeletingHandler)
      systemBus.addEventListener(SYSTEM_BUS_EVENTS.FILE_SYSTEM.DELETE_FILE_PROGRESS, deleteFileProgressHandler)

      await systemBus.execute(SYSTEM_BUS_COMMANDS.FILE_SYSTEM.DELETE_FILES_LIST, files)
    } catch (e) {
      console.log({ e })
      closeLoadingWindow()
      return this.windowMessages.showMessageError("Failed to delete files", e.message)
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

    /**
     * ON FILES DROP
     */
    this.directoryContentElement.addEventListener("drop", (e) => {
      e.preventDefault()
      e.stopPropagation()
      dropZone.style.visibility = "hidden"
      let droppedFiles = []

      if (e.dataTransfer.items) {
        ;[...e.dataTransfer.items].forEach((item, i) => {
          if (item.kind === "file") droppedFiles.push(item.getAsFile())
        })
      } else {
        ;[...e.dataTransfer.files].forEach((file, i) => droppedFiles.push(file))
      }

      if (droppedFiles.length) this.#uploadFiles(droppedFiles, this.locationStack.current)
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

    systemBus.addEventListener(SYSTEM_BUS_EVENTS.FILE_SYSTEM.DIRECTORY_CHANGED, (e) => {
      if (e.detail === this.locationStack.current) {
        if (this.changingDirectoryTimer) clearTimeout(this.changingDirectoryTimer)
        this.changingDirectoryTimer = setTimeout(() => this.#rerenderWindow(), 20)
      }
    })
  }
}

export default FileExplorer
