import StorageQueryBuilder from "./Storage"
import StorageIterator from "./StorageIterator"

/**
 * Test file structure
 * / --> root                             /
 *     /home --> user home folder         /home
 *     |   /images                        /home/images
 *     |   |   /wallpapers                /home/images/wallpapers
 *     |   |   |   /wallpaper-1.jpg       /home/images/wallpapers/wallpaper-1.jpg
 *     |   |   |   /wallpaper-2.jpg       /home/images/wallpapers/wallpaper-2.jpg
 *     |   |   |   /wallpaper-3.jpg       /home/images/wallpapers/wallpaper-3.jpg
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

export const FILE_SYSTEM_EVENTS = {
  CREATE: "file-system-create",
  CREATED: "file-system-created",
  DIRECTORY_CHANGED: "file-system-directory-changed",
}

const DATABASE_NAME = "file-system"
const FILE_STORAGE_NAME = "file"
const META_STORAGE_NAME = "file_meta"

const BASE_FILE_STRUCTURE = {
  home: {
    images: {
      wallpapers: {
        "wallpaper-1.jpg": {
          mimeType: "image/jpg",
        },
        "wallpaper-2.png": {
          mimeType: "image/png",
        },
        "wallpaper-3.gif": {
          mimeType: "image/gif",
        },
      },
    },
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
  applications: {
    "deus-ex.app": {
      mimeType: "application",
    },
    "diablo-2.app": {
      mimeType: "application",
    },
    "counter-strike.app": {
      mimeType: "application",
    },
    "microsoft-word.app": {
      mimeType: "application",
    },
    "microsoft-excel.app": {
      mimeType: "application",
    },
    "notepad.app": {
      mimeType: "application",
    },
  },
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

class FileSystem extends EventTarget {
  constructor() {
    super()

    this.addEventListener(FILE_SYSTEM_EVENTS.CREATE, async () => {
      await createInitialFileStructure(BASE_FILE_STRUCTURE)
      this.dispatchEvent(new Event(FILE_SYSTEM_EVENTS.CREATED))
    })
  }

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
   */
  async getFile(path) {
    const pathElements = path.split("/")
    const fileName = pathElements.pop()
    const directoryName = pathElements.join("/") || "/"

    let file
    for await (let _file of this.getFilesInDirectory(directoryName)) {
      if (_file.name !== fileName) continue
      file = _file
    }

    return file
  }

  /**
   * @param {object} file
   * @param {string} path
   */
  async uploadFile(file, path) {
    if (!file?.name) {
      throw new Error("Failed to upload file. File is broken or has not filename.")
    }

    const reader = new FileReader()
    // reader.addEventListener("progress", (e) => {
    //   console.log(e)
    // })

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

          metaInfo.fileId = await new Promise((resolve, reject) => {
            const request = filesStore.add(fileContent)
            request.onsuccess = () => resolve(request.result)
            request.onerror = () => reject(request.error)
          })

          const metaStore = transaction.objectStore(META_STORAGE_NAME)
          metaStore.add(metaInfo)
        })

      this.dispatchEvent(new CustomEvent(FILE_SYSTEM_EVENTS.DIRECTORY_CHANGED, { detail: path }))
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
}

const fileSystem = new FileSystem()

export default fileSystem
