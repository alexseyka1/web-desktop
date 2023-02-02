import Application from "../../modules/Application"
import { getDirectoryNameFromPath, getFileNameFromPath } from "../../modules/FileSystem"
import File from "../../modules/FileSystem/File"
import systemBus, { SYSTEM_BUS_COMMANDS } from "../../modules/SystemBus"
import { WindowEvents } from "../../modules/Window"
import { WindowMessages } from "../../modules/Window/WindowMessage"
import WindowWrapper from "../../modules/WindowSystem/WindowWrapper"
import manifest from "./manifest.json"
import "./styles.scss"

class Notepad extends Application {
  /** @type {WindowWrapper} */
  _window
  #state = {
    filePath: null,
    isFileSaved: false,
  }

  get textContentElement() {
    return this._window.contentElement.querySelector(".notepad__text-content")
  }

  get filename() {
    return this.#state.filePath ? getFileNameFromPath(this.#state.filePath) : "untitled.txt"
  }

  async main(args) {
    this._window = await this.createWindow({
      title: manifest.appName,
      icon: manifest.icon,
      width: 400,
      height: 300,
    })
    this._window.registerMenuPanel(this.menuPanel(this._window))
    this._window.domElement.classList.add("notepad")
    this._window.contentElement.innerHTML = `<textarea class="notepad__text-content" autofocus></textarea>`
    this.windowMessages = new WindowMessages(this)

    this.textContentElement.addEventListener("input", (e) => (this.#state.isFileSaved = false))

    this.textContentElement.addEventListener("keydown", (e) => {
      if (e.metaKey) {
        e.stopPropagation()

        if (e.key.toLowerCase() === "s") {
          e.preventDefault()
          this.#onSaveFile()
        } else if (e.key.toLowerCase() === "o") {
          e.preventDefault()
          console.log("Opening needed")
        }
      }
    })

    this.#initState()
    if (args && args.length) this.#openFile(args.pop())
  }

  #initState() {
    this.#state = new Proxy(this.#state, {
      get: (target, prop) => {
        return target[prop]
      },
      set: (target, prop, value, receiver) => {
        const result = Reflect.set(target, prop, value, receiver)
        if (prop === "isFileSaved") {
          this.#onChangeTitle()
        }
        return result
      },
    })
  }

  #onChangeTitle() {
    const title = `${manifest.appName} - ${this.filename}${!this.#state.isFileSaved ? "*" : ""}`
    this._window.title = title
  }

  async #openFile(path) {
    const { file } = await systemBus.execute(SYSTEM_BUS_COMMANDS.FILE_SYSTEM.READ_FILE_META, path)
    if (!file) {
      /**
       * If file doesn't exist
       */
      const directoryPath = getDirectoryNameFromPath(path)
      const { file: directoryModel } = await systemBus.execute(SYSTEM_BUS_COMMANDS.FILE_SYSTEM.READ_FILE_META, directoryPath)
      if (!directoryModel) {
        /**
         * If directory doesn't exist
         */
        return this.windowMessages.showMessageError("Failed to create file", `Directory "${directoryPath}" not found.`)
      } else if (!directoryModel.isDirectory) {
        return this.windowMessages.showMessageError("This is not a directory", `File "${directoryPath}" is not a directory.`)
      } else {
        /**
         * Directory exists
         */
        this.#state.filePath = path
      }
    } else if (file.isDirectory) {
      return this.windowMessages.showMessageError("This is a directory", `File "${path}" is a directory.`)
    } else {
      /**
       * Okay, let's read file content
       */
      this.#state.filePath = path
      /** @type {File} */
      const _fileContent = (await systemBus.execute(SYSTEM_BUS_COMMANDS.FILE_SYSTEM.GET_FILE_CONTENT_BY_ID, file.fileId)).content
      const text = new TextDecoder("utf-8").decode(_fileContent.arrayBuffer)
      this.textContentElement.value = text
      this.#state.isFileSaved = true
    }
    this.#onChangeTitle()
  }

  async #onSaveFile() {
    if (!this.#state.filePath) {
      throw new Error("Not implemented yet.")
    }

    const text = this.textContentElement.value,
      arrayBuffer = new TextEncoder().encode(text).buffer
    try {
      await systemBus.execute(SYSTEM_BUS_COMMANDS.FILE_SYSTEM.WRITE_FILE_CONTENT, { path: this.#state.filePath, arrayBuffer })
      this.#state.isFileSaved = true
    } catch (e) {
      this.windowMessages.showMessageError("Failed to save file", e?.message ?? e)
    }
  }

  #onNewFile() {
    this.textContentElement.value = ""
    this.#state.isFileSaved = false
    this.#state.filePath = null
    requestAnimationFrame(() => this.textContentElement.focus())
  }

  async showAbout() {
    const params = {
      width: 200,
      height: 200,
      isResizable: false,
      title: "About notepad",
    }

    const modalWindow = await this.createWindow(params)
    modalWindow.contentElement.innerHTML = `
        <div style="display: flex; justify-content: center; align-items: center; flex-direction: column; height: 100%">
          <h1 style="margin: 0; font-size: 16pt">📘 Notepad</h1>
          <div style="margin: 0; font-size: 13px; color: #555">Version 1.0.0</div>
        </div>
      `
    modalWindow.addEventListener(
      WindowEvents.BLURED,
      () => {
        modalWindow.dispatchEvent(new Event(WindowEvents.CLOSE))
      },
      { once: true }
    )
  }

  menuPanel(_window) {
    return [
      {
        title: "File",
        children: [
          {
            title: "New",
            onClick: () => this.#onNewFile(),
          },
          {
            title: "Open",
            onClick: () => console.log("Open file"),
          },
          "separator",
          {
            title: "Save",
            onClick: () => this.#onSaveFile(),
          },
          {
            title: "Exit",
            icon: "✖️",
            onClick: () => _window.dispatchEvent(new Event(WindowEvents.CLOSE)),
          },
        ],
      },
      {
        title: "Edit",
        children: [
          {
            title: "Copy",
            onClick: () => console.log("Copy text"),
          },
          {
            title: "Paste",
            onClick: () => console.log("Paste text"),
          },
        ],
      },
      {
        title: "Help",
        children: [
          {
            title: "About Notepad",
            icon: "ℹ️",
            onClick: () => {
              this.showAbout(_window)
            },
          },
        ],
      },
    ]
  }
}

export default Notepad
