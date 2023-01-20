import systemBus, { SYSTEM_BUS_COMMANDS, SYSTEM_BUS_EVENTS } from "../SystemBus"
import StorageQueryBuilder, { bytesToReadable, getMemoryUsage } from "./Storage"
import StorageIterator from "./StorageIterator"

/**
 * @param {string} currentPath
 * @param {string} location
 */
export const resolvePath = (currentPath, location) => {
  location = location.replace(/\s{2,}/, "/")
  if (location.substring(0, 1) === "/") return location

  let resultPath = currentPath
  const _parts = location.split("/")

  for (let _part of _parts) {
    switch (_part) {
      case "..":
        resultPath = resultPath.replace(/^(.*)\/.*/, "$1")
        break
      case ".":
        break
      default:
        resultPath += `/${_part}`
        break
    }
  }

  return resultPath
}

/**
 * Test file structure
 * / --> root                             /
 *     /home --> user home folder         /home
 *     |   /images                        /home/images
 *     |   /videos                        /home/videos
 *     |   |   /interesting-moovie.mp4    /home/videos/interesting-moovie.mp4
 *     |   |   /scary-moovie.avi          /home/videos/scary-moovie.avi
 *     |   /documents                     /home/documents
 *     |   |   /word-document.doc         /home/documents/word-document.doc
 *     |   |   /excel-document.xlsx       /home/documents/excel-document.xlsx
 *     |   |   /text-document.txt         /home/documents/text-document.txt
 *     |   |   /pdf-document.pdf          /home/documents/pdf-document.pdf
 *     /applications                      /applications
 *     |   /deus-ex.app                   /applications/deus-ex.app
 *     |   /diablo-2.app                  /applications/diablo-2.app
 *     |   /counter-strike.app            /applications/counter-strike.app
 *     |   /microsoft-word.app            /applications/microsoft-word.app
 *     |   /microsoft-excel.app           /applications/microsoft-excel.app
 *     |   /notepad.app                   /applications/notepad.app
 *     /system                            /system
 */

const DATABASE_NAME = "file-system"
const FILE_STORAGE_NAME = "file"
const META_STORAGE_NAME = "file_meta"

const BASE_FILE_STRUCTURE = {
  home: {
    images: {},
    videos: {
      "interesting-moovie.mp4": {
        mimeType: "video/mp4",
      },
      "scary-moovie.avi": {
        mimeType: "video/x-msvideo",
      },
    },
    documents: {
      "word-document.doc": {
        mimeType: "application/msword",
      },
      "excel-document.xlsx": {
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
      "text-document.txt": {
        mimeType: "text/plain",
      },
      "pdf-document.pdf": {
        mimeType: "application/pdf",
      },
    },
  },
  applications: {},
  system: {},
}

/**
 * @returns {StorageQueryBuilder}
 */
const getQueryBuilder = () => {
  return new StorageQueryBuilder(DATABASE_NAME, 1, { onUpgradeNeeded: (_, db) => initialMigrate(db) })
}

/**
 * @param {IDBDatabase} db
 */
const initialMigrate = (db) => {
  if (!db.objectStoreNames.contains(FILE_STORAGE_NAME)) {
    db.createObjectStore(FILE_STORAGE_NAME, { keyPath: "id", autoIncrement: true })
  }

  if (!db.objectStoreNames.contains(META_STORAGE_NAME)) {
    const fileMeta = db.createObjectStore(META_STORAGE_NAME, { keyPath: "fileId" })
    fileMeta.createIndex("name", "name")
    fileMeta.createIndex("path", "path")
    fileMeta.createIndex("path-name", ["path", "name"], { unique: true })
    fileMeta.createIndex("createdAt", "createdAt")
    fileMeta.createIndex("updatedAt", "updatedAt")
    fileMeta.createIndex("accessedAt", "accessedAt")
    fileMeta.createIndex("mimeType", "mimeType")
    fileMeta.createIndex("size", "size")
    fileMeta.createIndex("isDirectory", "isDirectory")
  }
}

/**
 * @param {object} files
 * @param {object|null} parent
 */
const createInitialFileStructure = async (files, parent = null) => {
  for (let filename in files) {
    const file = files[filename]
    const parentPath = `${parent?.path || ""}/${parent?.name || ""}`
    const filepath = `${parentPath}/${filename}`.replace("//", "/")

    const metaInfo = new FileMeta(filepath)
    metaInfo.size = Math.floor(Math.random() * 1024 * 1024 * 100) * 1024 // from 1Kb to 100Mb

    if (!("mimeType" in file)) {
      metaInfo.isDirectory = true
      if (Object.keys(file).length) await createInitialFileStructure(file, metaInfo)
    } else {
      Object.assign(metaInfo, file)
    }

    await getQueryBuilder()
      .setStoreNames([FILE_STORAGE_NAME, META_STORAGE_NAME])
      .doInTransaction("readwrite", async (transaction) => {
        const fileContent = new File(new TextEncoder().encode(filepath).buffer)
        const filesStore = transaction.objectStore(FILE_STORAGE_NAME)

        metaInfo.fileId = await new Promise((resolve, reject) => {
          const request = filesStore.add(fileContent)
          request.onsuccess = () => resolve(request.result)
          request.onerror = () => reject(request.error)
        })

        const metaStore = transaction.objectStore(META_STORAGE_NAME)
        metaStore.add(metaInfo)
      })
  }
}

/**
 * @property {number} id
 */
class File {
  /** @type {ArrayBuffer} */
  arrayBuffer = null

  /**
   * @param {ArrayBuffer}
   */
  constructor(content) {
    this.arrayBuffer = content
  }
}

export class FileMeta {
  /** @type {number} */
  fileId = null
  /** @type {string} */
  name = null
  /** @type {string} */
  path = null

  createdAt = new Date()
  /** @type {Date} */
  updatedAt = null
  /** @type {Date} */
  accessedAt
  /** @type {string} */
  mimeType = null
  /** @type {number} */
  size = null
  isDirectory = false
  /** @type {ArrayBuffer} */
  thumbnailBuffer = null

  constructor(filePath) {
    const parsed = filePath?.match(/^(?<directory>\/.+)?\/(?<filename>.+(\..+)?)$/)
    if (parsed?.groups) {
      if (parsed.groups?.filename) this.name = parsed.groups?.filename
    }
    this.path = parsed?.groups?.directory || "/"
  }

  get fullPath() {
    return `${this.path}/${this.name}`.replace(/\/+/, "/")
  }

  static fromStorage(params) {
    const instance = new FileMeta()

    if (!params || typeof params !== "object") return
    Object.keys(params).forEach((param) => {
      if (!(param in instance)) return
      instance[param] = params[param]
    })

    return instance
  }
}

class FileSystem {
  getIsCreated = async () => (await indexedDB.databases()).length

  /**
   * @param {string} path
   */
  async *getFilesInDirectory(path) {
    const transaction = await getQueryBuilder().setStoreNames(META_STORAGE_NAME).createTransaction()
    const store = transaction.objectStore(META_STORAGE_NAME).index("path")
    /** @type {FileMeta[]} */
    const files = new StorageIterator(store, IDBKeyRange.only(path))
    for await (let file of files) yield FileMeta.fromStorage(file)
  }

  /**
   * @param {string} path
   * @returns {FileMeta}
   */
  async getFileMeta(path) {
    let [, directory, filename] = path.match(/^(.*)\/(.*)$/)
    directory = directory || "/"

    return new Promise(async (resolve, reject) => {
      const transaction = await getQueryBuilder().setStoreNames(META_STORAGE_NAME).createTransaction()
      const pathNameIndex = transaction.objectStore(META_STORAGE_NAME).index("path-name")
      const request = pathNameIndex.get(IDBKeyRange.only([directory, filename]))
      request.onsuccess = (e) => resolve(e.target.result)
      request.onerror = (e) => reject(e)
    })
  }

  /**
   * @param {FileMeta} file
   * @returns {FileMeta}
   */
  async updateFileMeta(file) {
    if (!file.fileId) {
      throw new Error("Failed to update file meta. File doesn't exists.")
    }

    await getQueryBuilder()
      .setStoreNames([META_STORAGE_NAME])
      .doInTransaction("readwrite", async (transaction) => {
        const metaStore = transaction.objectStore(META_STORAGE_NAME)
        const _request = metaStore.get(file.fileId)
        _request.onsuccess = () => metaStore.put(file)
      })
    systemBus.dispatchEvent(SYSTEM_BUS_EVENTS.FILE_SYSTEM.DIRECTORY_CHANGED, file.path)
  }

  /**
   * @callback UploadFileListOnProgress
   * @param {FileSystemFileEntry} file
   * @param {ProgressEvent} onProgress
   */
  /**
   * @param {FileSystemFileEntry[]} files
   * @param {string} path
   * @param {UploadFileListOnProgress} onProgress
   */
  async uploadFilesList(files, path, onProgress = () => {}) {
    systemBus.dispatchEvent(SYSTEM_BUS_EVENTS.FILE_SYSTEM.UPLOAD_FILES_STARTED)

    let isAborted = false
    systemBus.addEventListener(SYSTEM_BUS_EVENTS.FILE_SYSTEM.UPLOAD_FILES_ABORT, () => (isAborted = true), { once: true })

    for (let file of files) {
      if (isAborted) break
      await this.uploadFile(file, path, (e) => onProgress(file, e))
    }

    systemBus.dispatchEvent(SYSTEM_BUS_EVENTS.FILE_SYSTEM.UPLOAD_FILES_FINISHED)
  }

  /**
   * @callback UploadFileOnProgress
   * @param {ProgressEvent} e
   */
  /**
   * @param {FileSystemFileEntry} file
   * @param {string} path
   * @param {UploadFileOnProgress} onProgress
   */
  async uploadFile(file, path, onProgress = () => {}) {
    /**
     * @todo delete this analog of `sleep` function
     */
    await new Promise((resolve) => setTimeout(() => resolve(), 500))

    if (!file?.name) {
      throw new Error("Failed to upload file. File is broken or has not filename.")
    }

    const isFileExists = await this.getFileMeta(`${path}/${file.name}`)
    if (isFileExists) {
      throw new Error(`A file with name "${file.name}" already exists.`)
    }

    const { quota, usage } = await getMemoryUsage()
    if (usage + file.size >= quota) {
      throw new Error(`Not enough memory to upload the file. Used ${bytesToReadable(usage)} of ${bytesToReadable(quota)}`)
    }

    const reader = new FileReader()
    reader.addEventListener("progress", (e) => onProgress(e))

    const arrayBuffer = await new Promise((resolve, reject) => {
      reader.addEventListener("load", (event) => resolve(event.target.result))
      reader.addEventListener("error", (e) => reject(reader.error))
      reader.readAsArrayBuffer(file)
    })
    if (arrayBuffer && arrayBuffer instanceof ArrayBuffer) {
      const metaInfo = new FileMeta(`${path}/${file.name}`)
      metaInfo.size = file.size
      metaInfo.mimeType = file.type

      await getQueryBuilder()
        .setStoreNames([FILE_STORAGE_NAME, META_STORAGE_NAME])
        .doInTransaction("readwrite", async (transaction) => {
          const fileContent = arrayBuffer
          const filesStore = transaction.objectStore(FILE_STORAGE_NAME)
          const metaStore = transaction.objectStore(META_STORAGE_NAME)

          /**
           * Check file exists
           */

          metaInfo.fileId = await new Promise((resolve, reject) => {
            const request = filesStore.add(fileContent)
            request.onsuccess = () => resolve(request.result)
            request.onerror = () => reject(request.error)
          })

          metaStore.add(metaInfo)
        })

      systemBus.dispatchEvent(SYSTEM_BUS_EVENTS.FILE_SYSTEM.DIRECTORY_CHANGED, path)
    }
  }

  /**
   * @param {number} fileId
   * @returns {File}
   */
  async getFileContent(fileId) {
    return await getQueryBuilder()
      .setStoreNames([FILE_STORAGE_NAME])
      .doInTransaction("readonly", async (transaction) => {
        const filesStore = transaction.objectStore(FILE_STORAGE_NAME)
        return await new Promise((resolve, reject) => {
          const request = filesStore.get(fileId)
          request.onsuccess = () => resolve(new File(request.result))
          request.onerror = () => reject(req.error)
        })
      })
  }

  /**
   * @callback DeleteFileListOnProgress
   * @param {FileMeta} file
   * @param {ProgressEvent} onProgress
   */
  /**
   * @param {FileMeta[]} files
   * @param {DeleteFileListOnProgress} onProgress
   */
  async deleteFilesList(files, onProgress = () => {}) {
    systemBus.dispatchEvent(SYSTEM_BUS_EVENTS.FILE_SYSTEM.DELETE_FILES_STARTED)

    let isAborted = false
    systemBus.addEventListener(SYSTEM_BUS_EVENTS.FILE_SYSTEM.DELETE_FILES_ABORT, () => (isAborted = true), { once: true })

    const total = files.length
    let deletedCount = 0
    for (let file of files) {
      if (isAborted) break
      await this.deleteFile(file)
      onProgress(file, new ProgressEvent("file-delete", { total, loaded: ++deletedCount }))
    }
    systemBus.dispatchEvent(SYSTEM_BUS_EVENTS.FILE_SYSTEM.DELETE_FILES_FINISHED)
  }

  /**
   * @param {FileMeta} file
   */
  async deleteFile(file) {
    if (!file?.fileId) {
      throw new Error("Failed to delete file. File is broken or has not filename.")
    }

    await getQueryBuilder()
      .setStoreNames([FILE_STORAGE_NAME, META_STORAGE_NAME])
      .doInTransaction("readwrite", async (transaction) => {
        const filesStore = transaction.objectStore(FILE_STORAGE_NAME)
        const metaStore = transaction.objectStore(META_STORAGE_NAME)

        await new Promise((resolve, reject) => {
          const request = filesStore.delete(file.fileId)
          request.onsuccess = () => resolve(request.result)
          request.onerror = () => reject(request.error)
        })
        await new Promise((resolve, reject) => {
          const request = metaStore.delete(file.fileId)
          request.onsuccess = () => resolve(request.result)
          request.onerror = () => reject(request.error)
        })
      })

    systemBus.dispatchEvent(SYSTEM_BUS_EVENTS.FILE_SYSTEM.DIRECTORY_CHANGED, file.path)
  }
}

const fileSystem = new FileSystem()

/**
 * Registering system bus event handlers
 */
systemBus
  .addMiddleware(SYSTEM_BUS_COMMANDS.FILE_SYSTEM.READ_FILE_META, async (filePath, response, next) => {
    response.file = await fileSystem.getFileMeta(filePath)
    next()
  })
  .addMiddleware(SYSTEM_BUS_COMMANDS.FILE_SYSTEM.UPDATE_FILE_META, async (file, response, next) => {
    response.file = await fileSystem.updateFileMeta(file)
    next()
  })
  .addMiddleware(SYSTEM_BUS_COMMANDS.FILE_SYSTEM.READ_FILE_CONTENT, async (fileId, response, next) => {
    response.content = await fileSystem.getFileContent(fileId)
    next()
  })
  .addMiddleware(SYSTEM_BUS_COMMANDS.FILE_SYSTEM.CREATE_FILE_STRUCTURE, async (_, response, next) => {
    await createInitialFileStructure(BASE_FILE_STRUCTURE)
    response.isCompleted = true
    next()
  })
  .addMiddleware(SYSTEM_BUS_COMMANDS.FILE_SYSTEM.IS_STRUCTURE_EXISTS, async (_, response, next) => {
    response.isCreated = await fileSystem.getIsCreated()
    next()
  })
  .addMiddleware(SYSTEM_BUS_COMMANDS.FILE_SYSTEM.GET_FILES_ITERATOR, (dirPath, response, next) => {
    response.iterator = fileSystem.getFilesInDirectory(dirPath)
    next()
  })
  .addMiddleware(SYSTEM_BUS_COMMANDS.FILE_SYSTEM.UPLOAD_FILES_LIST, async ({ files, path }, _, next) => {
    await fileSystem.uploadFilesList(files, path, (_file, e) => {
      systemBus.dispatchEvent(SYSTEM_BUS_EVENTS.FILE_SYSTEM.UPLOAD_FILE_PROGRESS, { _file, e })
    })
    next()
  })
  .addMiddleware(SYSTEM_BUS_COMMANDS.FILE_SYSTEM.DELETE_FILES_LIST, async (files, _, next) => {
    await fileSystem.deleteFilesList(files, (_file, e) => {
      systemBus.dispatchEvent(SYSTEM_BUS_EVENTS.FILE_SYSTEM.DELETE_FILE_PROGRESS, { _file, e })
    })
    next()
  })

export default fileSystem
