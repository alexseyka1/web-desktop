import Window, { WindowEvents } from "../../modules/Window"
import { WindowMessages } from "../../modules/Window/WindowMessage"
import FileMeta from "../../modules/FileSystem/FileMeta"
import WindowProcess, { WindowProcessItem, WINDOW_PROCESS_EVENTS } from "../../modules/Window/WindowProcess"
import "./styles.scss"
import systemBus, { SYSTEM_BUS_COMMANDS, SYSTEM_BUS_EVENTS } from "../../modules/SystemBus"
import Application from "../../modules/Application"
import Hier from "../../hier/hier"
import Explorer from "./components/Explorer"
import manifest from "./manifest.json"
import Vector from "../../classes/Vector"

class FileExplorer extends Application {
  /** @type {Window} */
  #window
  /** @type {Explorer} */
  #renderer
  #keys = {}
  /** @type {WindowMessages} */
  #windowMessages

  async main(args, keys) {
    this.#keys = Object.assign(this.#keys, keys)
    this.#window = await this.createWindow({
      width: 600,
      height: 400,
      minSize: new Vector(400, 200),
      title: manifest.appName,
      icon: manifest.icon,
    })

    let path
    if (args) path = args[0]

    this.#windowMessages = new WindowMessages(this)
    this.#window.contentElement.remove()
    const rendererProps = {
      path,
      className: "content file-explorer",
      windowMessages: this.#windowMessages,
      onDeleteFiles: (files) => this.#deleteFiles(files),
      onUploadFiles: (files, path) => this.#uploadFiles(files, path),
      ...this.#keys,
    }
    this.#renderer = await Hier.render(Explorer, this.#window.domElement, rendererProps)

    this.#window.addEventListener(WindowEvents.FOCUSED, () => this.#renderer.onWindowFocus())
    this.#window.addEventListener(WindowEvents.BLURED, () => this.#renderer.onWindowBlur())
    this.#window.addEventListener(WindowEvents.RESIZED, () => this.#renderer.checkItemsInRow())
  }

  /**
   * @param {File[]} files
   */
  async #uploadFiles(files, path) {
    let loadingWindow
    const closeLoadingWindow = () => {
      if (loadingWindow) {
        loadingWindow._window.dispatchEvent(new CustomEvent(WindowEvents.CLOSE, { detail: { forced: true } }))
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
        loadingWindow._window.dispatchEvent(new CustomEvent(WINDOW_PROCESS_EVENTS.UPDATE_PROCESSES, { detail: Object.values(loadingProcesses) }))
      }

      const startUploadingHandler = async () => {
        loadingWindow = await this.createWindow(
          {
            title: "Uploading files",
            processes: Object.values(loadingProcesses),
            onCancelProcess: () => {
              systemBus.dispatchEvent(SYSTEM_BUS_EVENTS.FILE_SYSTEM.UPLOAD_FILES_ABORT)
            },
          },
          WindowProcess
        )

        systemBus.addEventListener(
          SYSTEM_BUS_EVENTS.FILE_SYSTEM.UPLOAD_FILES_FINISHED,
          () => {
            systemBus.removeEventListener(SYSTEM_BUS_EVENTS.FILE_SYSTEM.UPLOAD_FILE_PROGRESS, uploadFileProgressHandler)
            closeLoadingWindow()
          },
          { once: true }
        )
      }
      systemBus.addEventListener(SYSTEM_BUS_EVENTS.FILE_SYSTEM.UPLOAD_FILES_STARTED, startUploadingHandler, { once: true })
      systemBus.addEventListener(SYSTEM_BUS_EVENTS.FILE_SYSTEM.UPLOAD_FILE_PROGRESS, uploadFileProgressHandler)

      await systemBus.execute(SYSTEM_BUS_COMMANDS.FILE_SYSTEM.UPLOAD_FILES_LIST, { files, path })
    } catch (e) {
      closeLoadingWindow()
      return this.#windowMessages.showMessageError(`Failed to upload file${files.length > 1 ? "s" : ""}`, e.message)
    }
  }

  /**
   * @param {FileMeta[]} files
   */
  async #deleteFiles(files) {
    if (!files || !files.length) return
    let loadingWindow
    const closeLoadingWindow = () => {
      if (loadingWindow) {
        loadingWindow._window.dispatchEvent(new CustomEvent(WindowEvents.CLOSE, { detail: { forced: true } }))
      }
    }

    try {
      const processTitle = files.length > 1 ? `Deleting ${files.length} files` : files[0].name
      const loadingProcess = new WindowProcessItem(processTitle, false)
      const deleteFileProgressHandler = ({ detail: { _file, e } }) => {
        if (!loadingWindow) return
        const _percent = (e.loaded / e.total) * 100
        loadingProcess.percentage = _percent
        loadingWindow._window.dispatchEvent(new CustomEvent(WINDOW_PROCESS_EVENTS.UPDATE_PROCESSES, { detail: [loadingProcess] }))
      }

      const startDeletingHandler = async () => {
        loadingWindow = await this.createWindow(
          {
            title: "Deleting files",
            processes: [loadingProcess],
            onCancelProcess: () => {
              systemBus.dispatchEvent(SYSTEM_BUS_EVENTS.FILE_SYSTEM.DELETE_FILES_ABORT)
            },
          },
          WindowProcess
        )

        systemBus.addEventListener(SYSTEM_BUS_EVENTS.FILE_SYSTEM.DELETE_FILES_FINISHED, () => {
          systemBus.removeEventListener(SYSTEM_BUS_EVENTS.FILE_SYSTEM.DELETE_FILE_PROGRESS, deleteFileProgressHandler)
          closeLoadingWindow()
        })
      }
      systemBus.addEventListener(SYSTEM_BUS_EVENTS.FILE_SYSTEM.DELETE_FILES_STARTED, startDeletingHandler, { once: true })
      systemBus.addEventListener(SYSTEM_BUS_EVENTS.FILE_SYSTEM.DELETE_FILE_PROGRESS, deleteFileProgressHandler)

      await systemBus.execute(SYSTEM_BUS_COMMANDS.FILE_SYSTEM.DELETE_FILES_LIST, files)
    } catch (e) {
      closeLoadingWindow()
      return this.#windowMessages.showMessageError("Failed to delete files", e.message)
    }
  }
}

export default FileExplorer
