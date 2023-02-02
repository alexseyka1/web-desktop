import Hier, { HierRef } from "../../../hier/hier"
import { ast as h } from "../../../hier/hier-parser"
import { FileMeta } from "../../../modules/FileSystem/FileMeta"
import { bytesToReadable } from "../../../modules/FileSystem/Storage"
import { addDropdownSubMenu } from "../../../modules/MenuPanel"
import systemBus, { SYSTEM_BUS_COMMANDS, SYSTEM_BUS_EVENTS } from "../../../modules/SystemBus"
import LocationStack from "../LocationStack"
import FavoritesPanel from "./panels/FavoritesPanel"
import TopPanel from "./panels/TopPanel"
import GridView from "./ViewTypeSelector/GridView"
import ListView from "./ViewTypeSelector/ListView"
import ViewTypeSelector, { VIEW_TYPE_GRID, VIEW_TYPE_LIST } from "./ViewTypeSelector"

const FAVORITES_FILE_PATH = "/home/.config/explorer-favorites.json"

class Explorer extends Hier.Component {
  /** @type {string} */
  #prevRenderedPath
  /** @type {LocationStack} */
  #locationStack
  /** @type {Map<FileMeta, number>} */
  #showedFiles = new Map()
  /** @type {Map<number, number>} */
  #showedFileIds = new Map()
  /** @type {Set<FileMeta>} */
  #selectedFiles = new Set()
  /** @type {HierRef} */
  #directoryContentRef
  #itemsInRow = 1

  constructor(props) {
    super(props)
    this.#directoryContentRef = Hier.createRef()
    this.clearSelectedFiles()

    this.#locationStack = new LocationStack(props.path || "/home")
    this.#locationStack.addEventListener("change", () => {
      this.setState({ path: this.#locationStack.current })
    })

    this._state = {
      timestamp: Date.now(),
      path: this.#locationStack.current,
      isShowUploadDropZone: false,
      favorites: [],
      viewType: VIEW_TYPE_GRID,
    }

    systemBus.addEventListener(SYSTEM_BUS_EVENTS.FILE_SYSTEM.DIRECTORY_CHANGED, (e) => {
      if (e.detail === this.#locationStack.current) {
        if (this.changingDirectoryTimer) clearTimeout(this.changingDirectoryTimer)
        this.changingDirectoryTimer = setTimeout(() => {
          this.checkItemsInRow()
          this.#selectedFiles.clear()
          this.#forceUpdate()
        }, 20)
      }
    })

    systemBus.addEventListener(SYSTEM_BUS_EVENTS.FILE_SYSTEM.FILE_UPDATED, (e) => {
      if (e.detail === FAVORITES_FILE_PATH) {
        this.#readFavorites()
        this.#forceUpdate()
      }
    })
  }

  #forceUpdate() {
    this.setState({ timestamp: Date.now() })
  }

  get selectedFileIds() {
    const selectedFileIds = []
    for (let _file of this.#selectedFiles.values()) {
      selectedFileIds.push(_file.fileId)
    }
    return selectedFileIds
  }

  clearSelectedFiles(values = []) {
    this.#selectedFiles = new Set(values)
  }

  onSelectAllFiles() {
    this.#selectedFiles.clear()
    for (let _file of this.#showedFiles.values()) {
      this.#selectedFiles.add(_file)
    }
    this.#forceUpdate()
  }

  onDeleteSelectedFiles() {
    const { onDeleteFiles, windowMessages } = this.props
    const filesCount = this.#selectedFiles.size
    if (!filesCount) return
    const _filesToDelete = Array.from(this.#selectedFiles.values())
    const _deleteFiles = () => onDeleteFiles(_filesToDelete)
    windowMessages.showMessageQuestion("Are you sure?", `Are you sure you want to delete ${filesCount} file${filesCount > 1 ? "s" : ""}?`, _deleteFiles)
  }

  afterMount() {
    const { path } = this.state

    this.node.addEventListener("mousedown", () => {
      this.clearSelectedFiles()
      this.#forceUpdate()
    })

    this.#createDropZone()
    this.onWindowFocus()
    this.checkItemsInRow()
    this.#readFavorites()
  }

  afterUpdate(props, prevProps, state, prevState) {
    if (prevState.viewType != state.viewType) {
      this.checkItemsInRow()
    }
  }

  async #readFavorites() {
    let favorites = [
      {
        path: "/home",
        title: "Home",
      },
      {
        path: "/home/images",
        title: "Images",
      },
      {
        path: "/home/documents",
        title: "Documents",
      },
      {
        path: "/home/videos",
        title: "Videos",
      },
      {
        path: "/applications",
        title: "Applications",
      },
    ]

    const favoritesFile = (await systemBus.execute(SYSTEM_BUS_COMMANDS.FILE_SYSTEM.READ_FILE_CONTENT, FAVORITES_FILE_PATH))?.content
    if (favoritesFile) {
      const favoritesText = new TextDecoder("utf-8").decode(favoritesFile?.arrayBuffer)
      try {
        favorites = JSON.parse(favoritesText)
      } catch (e) {}
    }
    this.setState({ favorites })
  }

  checkItemsInRow() {
    let itemsInRow = 1,
      elem
    if (this.state.viewType == VIEW_TYPE_LIST) {
      this.#itemsInRow = 1
      return
    }

    if (this.state.viewType == VIEW_TYPE_GRID) elem = this.node.querySelector(`.files-grid .files-grid-item`)
    if (elem) {
      const top = elem.getBoundingClientRect().top
      while ((elem = elem.nextElementSibling)) {
        if (elem.getBoundingClientRect().top === top) itemsInRow++
        else break
      }
      this.#itemsInRow = itemsInRow
    }
  }

  #onArrowKeyDown = (e) => {
    e.preventDefault()
    if (!this.#selectedFiles.size) {
      if (!this.#showedFiles.size) return
      this.clearSelectedFiles([this.#showedFiles.values().next().value])
      this.#forceUpdate()
      return
    }

    let _selectedFiles = Array.from(this.#selectedFiles.values())
    const firstSelectedFile = _selectedFiles[0],
      lastSelectedFile = _selectedFiles[_selectedFiles.length - 1]
    _selectedFiles = null
    const firstIndex = this.#showedFileIds.get(firstSelectedFile.fileId)
    let _currentIndex = null

    switch (e.key.toLowerCase()) {
      case "arrowleft": {
        if (firstIndex <= 0) return
        this.#selectedFiles.clear()
        _currentIndex = firstIndex - 1
        break
      }
      case "arrowright": {
        if (firstIndex >= this.#showedFileIds.size - 1) return
        this.#selectedFiles.clear()
        _currentIndex = firstIndex + 1
        break
      }
      case "arrowup": {
        if (firstIndex <= 0 || firstIndex < this.#itemsInRow) return
        this.#selectedFiles.clear()
        _currentIndex = Math.max(firstIndex - this.#itemsInRow, 0)
        break
      }
      case "arrowdown": {
        if (firstIndex >= this.#showedFileIds.size - 1) return
        this.#selectedFiles.clear()
        _currentIndex = Math.min(firstIndex + this.#itemsInRow, this.#showedFileIds.size - 1)
        break
      }
    }

    if (_currentIndex != null) {
      const newFileCursor = this.#showedFiles.get(_currentIndex)
      this.#selectedFiles.add(newFileCursor)
      requestAnimationFrame(() => {
        const elem = this.node.querySelector(`.files-grid .files-grid-item:nth-child(${_currentIndex})`)
        elem?.scrollIntoView({ behavior: "smooth", block: "start", inline: "start" })
      })
    }

    this.#forceUpdate()
  }

  #keyDownHandler = (e) => {
    if (e.key.toLowerCase() === "escape") {
      /**
       * On escape pressed
       */
      this.clearSelectedFiles()
      this.#forceUpdate()
    } else if (e.key.toLowerCase() === "a" && e.metaKey) {
      /**
       * On select all files
       */
      this.onSelectAllFiles()
    } else if (["delete", "backspace"].includes(e.key.toLowerCase())) {
      /**
       * On delete pressed
       */
      this.onDeleteSelectedFiles()
    } else if (e.key.toLowerCase() === "enter") {
      if (!this.#selectedFiles.size) return
      const firstSelectedFile = this.#selectedFiles.values().next().value
      // this.clearSelectedFiles()
      this.#forceUpdate()

      if (firstSelectedFile.isDirectory) {
        this.#locationStack.push(firstSelectedFile.fullPath)
      } else {
        systemBus.execute(SYSTEM_BUS_COMMANDS.FILE_SYSTEM.OPEN_FILE, firstSelectedFile.fullPath)
      }
    } else if (["arrowleft", "arrowright", "arrowup", "arrowdown"].includes(e.key.toLowerCase())) {
      this.#onArrowKeyDown(e)
    }
  }

  onWindowFocus() {
    globalThis.addEventListener("keydown", this.#keyDownHandler)
  }
  onWindowBlur() {
    globalThis.removeEventListener("keydown", this.#keyDownHandler)
  }

  async #renderStatusBar() {
    const { viewType } = this.state
    const { quota, usage } = await navigator.storage.estimate()
    const _selectedCount = this.#selectedFiles.size
    const _showedCount = this.#showedFiles.size
    const _selectedText = _selectedCount ? `Selected ${_selectedCount} file${_selectedCount > 1 ? "s" : ""}` : ""
    const _totalText = _showedCount ? `${_showedCount} file${_showedCount > 1 ? "s" : ""}` : "Empty directory"

    return h`
      <div>${_selectedCount ? _selectedText : _totalText}</div>
      <div style="display: flex">
        Used ${bytesToReadable(usage)}&nbsp;of ${bytesToReadable(quota)}
        <${ViewTypeSelector} type=${viewType}
          onChange=${(_type) => this.setState({ viewType: _type })}
        />
      </div>
    `
  }

  async #createDropZone() {
    const { onUploadFiles } = this.props
    const elem = this.#directoryContentRef?.elem
    if (!elem) return

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
    elem.addEventListener("drop", (e) => {
      e.preventDefault()
      e.stopPropagation()
      this.setState({ isShowUploadDropZone: false })
      let droppedFiles = []
      if (e.dataTransfer.items) {
        ;[...e.dataTransfer.items].forEach((item, i) => {
          if (item.kind === "file") droppedFiles.push(item.getAsFile())
        })
      } else {
        ;[...e.dataTransfer.files].forEach((file, i) => droppedFiles.push(file))
      }
      if (droppedFiles.length) onUploadFiles(droppedFiles, this.#locationStack.current)
      isDragChecked = false
    })
    elem.addEventListener("dragover", (e) => {
      e.preventDefault()
      e.stopPropagation()
      if (!isDragChecked) {
        const result = isDragHasFiles(e)
        isDragChecked = true
        if (result) {
          this.setState({ isShowUploadDropZone: true })
        }
      }
    })
    elem.addEventListener("dragleave", (e) => {
      e.preventDefault()
      e.stopPropagation()
      this.setState({ isShowUploadDropZone: false })
      isDragChecked = false
    })
  }

  /**
   * @param {FileMeta} file
   * @returns {object}
   */
  #getFileContextMenu(file) {
    const { onDeleteFiles, windowMessages } = this.props

    const typeName = file.isDirectory ? "directory" : "file"
    let items = [
      {
        title: `Delete ${typeName}`,
        icon: "✖️",
        onClick: (e) => {
          const deleteFile = () => onDeleteFiles([file])
          windowMessages.showMessageQuestion("Are you sure?", `Are you sure you want to delete ${typeName} ${file.name}?`, deleteFile)
        },
      },
    ]

    if (file.isDirectory) {
      items = [
        {
          title: `Open ${typeName}`,
          onClick: () => this.#locationStack.push(file.fullPath),
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
    const { windowMessages } = this.props
    const { path, viewType } = this.state

    /**
     * If location was changed
     */
    if (path !== this.#prevRenderedPath) {
      this.#prevRenderedPath = path

      if (path !== "/") {
        /**
         * Checking for directory exists
         */
        const { file: directoryModel } = await systemBus.execute(SYSTEM_BUS_COMMANDS.FILE_SYSTEM.READ_FILE_META, path)
        if (!directoryModel) {
          return windowMessages.showMessageError("Failed to open directory", `Directory "${path}" not found.`)
        } else if (!directoryModel.isDirectory) {
          return windowMessages.showMessageError("This is not a directory", `File "${path}" is not a directory.`)
        }
      }
    }

    /**
     * Looking for directory content and render it
     */
    const addFileToList = (file) => {
      this.#selectedFiles.add(file)
    }
    this.#showedFiles.clear()
    this.#showedFileIds.clear()
    const filesList = []
    let index = 0
    const { iterator } = await systemBus.execute(SYSTEM_BUS_COMMANDS.FILE_SYSTEM.GET_FILES_ITERATOR, path)
    for await (let file of iterator) {
      this.#showedFiles.set(index, file)
      this.#showedFileIds.set(file.fileId, index)

      filesList.push(file)
      index++
    }

    /**
     * File event handlers
     */
    const onMouseDown = (e, file) => {
      e.stopPropagation()
      this.node.closest(".window").dispatchEvent(new Event("mousedown"))

      if (e.ctrlKey || e.metaKey) {
        /** Select some files with CTRL or META keys */
        if (this.selectedFileIds.includes(file.fileId)) {
          this.#selectedFiles.delete(file)
        } else {
          addFileToList(file)
        }
      } else if (e.shiftKey) {
        /** Select list of files with SHIFT key */
        if (!this.#selectedFiles.size) {
          addFileToList(file)
        } else {
          const firstSelectedFile = this.#selectedFiles.values().next().value
          this.clearSelectedFiles()

          let fromIndex
          for (let [_fileId, _index] of this.#showedFileIds.entries()) {
            if (_fileId !== firstSelectedFile.fileId) continue
            fromIndex = _index
          }
          let toIndex = this.#showedFileIds.get(file.fileId)

          /**
           * Selecting files depending on direction
           */
          if (fromIndex != null && toIndex != null) {
            if (toIndex > fromIndex) {
              for (let i = fromIndex; i <= toIndex; i++) {
                const file = this.#showedFiles.get(i)
                addFileToList(file)
              }
            } else {
              for (let i = fromIndex; i >= toIndex; i--) {
                const file = this.#showedFiles.get(i)
                addFileToList(file)
              }
            }
          }
        }
      } else {
        /** Just click on file */
        this.clearSelectedFiles(file ? [file] : [])
      }

      // e.target.closest(".files-grid-item")?.scrollIntoView({ behavior: "smooth", block: "end" })
      this.#forceUpdate()
    }
    const onDblClick = async (e, file) => {
      if (!file) return
      // this.clearSelectedFiles()
      if (file.isDirectory) {
        this.#locationStack.push(file.fullPath)
      } else {
        systemBus.execute(SYSTEM_BUS_COMMANDS.FILE_SYSTEM.OPEN_FILE, file.fullPath)
      }
    }
    let doubleTouchTimer
    const onTouchStart = (e, file) => {
      if (!doubleTouchTimer) {
        doubleTouchTimer = setTimeout(() => {
          if (doubleTouchTimer) clearTimeout(doubleTouchTimer)
        }, 250)
        return
      }

      clearTimeout(doubleTouchTimer)
      _doubleClickHandler(e)
    }
    const onContextMenu = (e, file) => {
      e.preventDefault()
      e.stopPropagation()
      const contextMenu = this.#getFileContextMenu(file)
      addDropdownSubMenu(contextMenu, document.body, { x: e.clientX, y: e.clientY })
    }
    const onFocus = (e, file) => {
      this.node.closest(".window").dispatchEvent(new Event("mousedown"))
      if (!this.#selectedFiles.size) {
        this.clearSelectedFiles([file])
        this.#forceUpdate()
      }
    }
    const onBlur = (e, file) => {}

    const attrs = {
      ref: this.#directoryContentRef,
      className: (viewType === VIEW_TYPE_GRID ? "files-grid" : "files-list") + " file-explorer__directory-content",
      files: filesList,
      selectedIds: this.selectedFileIds,
      onMouseDown,
      onDblClick,
      onTouchStart,
      onContextMenu,
      onFocus,
      onBlur,
    }
    if (viewType === VIEW_TYPE_GRID) {
      return h`
        <${GridView} ${attrs}/>`
    } else if (viewType === VIEW_TYPE_LIST) {
      return h`
        <${ListView} ${attrs}/>`
    }
    return
  }

  async render() {
    const { isShowUploadDropZone } = this.state

    return h`
      <${TopPanel} className="file-explorer__top-bar"
        locationStack=${this.#locationStack}
        onChangePath=${(newPath) => this.#locationStack.push(newPath)}
        onUploadFiles=${this.props.onUploadFiles}
      />
      <div class="file-explorer__panels">
          <${FavoritesPanel} className="file-explorer__favorites-panel" 
            items=${this.state.favorites}
            currentPath=${this.#locationStack.current}
            onClick=${(item) => this.#locationStack.push(item.path)}
          />
          ${await this.#renderDirectoryContent()}
      </div>

      <div class="file-explorer__bottom-bar">${await this.#renderStatusBar()}</div>

      <div class="file-explorer__dropzone" style="visibility: ${isShowUploadDropZone ? "visible" : "hidden"}">
        <div>Drag one or more files to this <i>drop zone</i>.</div>
      </div>
    `
  }
}

export default Explorer
