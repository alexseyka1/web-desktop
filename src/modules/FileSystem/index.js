import { getDefinedApplications } from "../../classes/ApplicationFinder"
import systemBus, { SYSTEM_BUS_COMMANDS, SYSTEM_BUS_EVENTS } from "../SystemBus"
import File from "./File"
import FileMeta from "./FileMeta"
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
        resultPath = resultPath.replace(/^(.*)\/.*/, "$1") || "/"
        break
      case ".":
        break
      default:
        resultPath += `/${_part}`
        break
    }
  }

  return resultPath.replace(/\/{2,}/g, "/")
}

const FILE_PATH_REGEXP = /(.*\/)?([^\/]+)$/
export const getDirectoryNameFromPath = (path) => {
  return path.replace(FILE_PATH_REGEXP, "$1").replace(/\/*$/, "")
}

export const getFileNameFromPath = (path) => {
  return path.replace(FILE_PATH_REGEXP, "$2")
}

/**
 * @param {string} appName
 * @param {object} info
 * @returns {FileMeta}
 */
const getFileMetaForApplication = (appName, info) => {
  return FileMeta.fromStorage({
    fileId: appName
      .split("")
      .map((char) => char.charCodeAt(0).toString(36))
      .join(""),
    name: appName,
    mimeType: "application",
    path: "/applications",
    icon: info?.iconLarge || info?.icon,
    displayName: info?.appName,
    description: info?.description,
  })
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
    ".config": {
      "explorer-favorites.json": {
        mimeType: "application/json",
        content: new TextEncoder().encode(
          JSON.stringify([
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
          ])
        ).buffer,
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

    let fileContent = new File()
    if (!("mimeType" in file)) {
      metaInfo.isDirectory = true
      if (Object.keys(file).length) await createInitialFileStructure(file, metaInfo)
    } else {
      if ("content" in file) {
        fileContent = new File(file.content)
        delete file.content
      } else {
        fileContent = new File(new TextEncoder().encode(filepath).buffer)
      }
      metaInfo.size = fileContent.arrayBuffer.byteLength
      Object.assign(metaInfo, file)
    }

    await getQueryBuilder()
      .setStoreNames([FILE_STORAGE_NAME, META_STORAGE_NAME])
      .doInTransaction("readwrite", async (transaction) => {
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

class FileSystem {
  getIsCreated = async () => (await indexedDB.databases()).length

  /**
   * @param {string} path
   */
  async *getFilesInDirectory(path) {
    /**
     * Hack for showing predefined applications in /applications directory
     */
    if (path === "/applications") {
      let definedApplications = Object.entries(getDefinedApplications()).sort((a, b) => {
        if (a[0].toLowerCase() < b[0].toLowerCase()) return -1
        if (a[0].toLowerCase() > b[0].toLowerCase()) return 1
        return 0
      })

      for (let [appName, { info }] of definedApplications) {
        yield getFileMetaForApplication(appName, info)
      }
    } else {
      const transaction = await getQueryBuilder().setStoreNames(META_STORAGE_NAME).createTransaction()
      const store = transaction.objectStore(META_STORAGE_NAME).index("path-name")
      /** @type {FileMeta[]} */
      const files = new StorageIterator(store, IDBKeyRange.bound([path], [path, "ÿ"], true, true))
      for await (let file of files) yield FileMeta.fromStorage(file)
    }
  }

  async *getSortedFilesInDirectory(path, sort) {
    let files = []
    for await (let file of this.getFilesInDirectory(path)) files.push(file)

    if (sort) {
      if (!Array.isArray(sort)) sort = [sort]
      files = files.sort((a, b) => {
        let result = null

        sort.forEach((attr) => {
          if (typeof attr !== "string") return
          let isDesc = false
          if (attr.substring(0, 1) === "-") {
            isDesc = true
            attr = attr.substring(1)
          }

          let aParam = a[attr],
            bParam = b[attr],
            _res
          if (typeof aParam === "string" || typeof bParam === "string") {
            aParam = (aParam + "").toLowerCase()
            bParam = (bParam + "").toLowerCase()
            _res = isDesc ? bParam.localeCompare(aParam) : aParam.localeCompare(bParam)
          } else {
            _res = isDesc ? aParam - bParam : bParam - aParam
          }

          result = result || _res
        })

        return result
      })
    }
    for (let file of files) yield file
  }

  /**
   * @param {string} path
   * @returns {FileMeta}
   */
  async getFileMeta(path) {
    let [, directory, filename] = path.match(/^(.*)\/(.*)$/)
    directory = directory || "/"

    return new Promise(async (resolve, reject) => {
      /**
       * Hack for showing predefined applications in /applications directory
       */
      if (/.*\.app$/.test(filename)) {
        const definedApplications = getDefinedApplications()
        if (filename in definedApplications) {
          resolve(getFileMetaForApplication(filename))
        }
      } else {
        const transaction = await getQueryBuilder().setStoreNames(META_STORAGE_NAME).createTransaction()
        const pathNameIndex = transaction.objectStore(META_STORAGE_NAME).index("path-name")
        const request = pathNameIndex.get(IDBKeyRange.only([directory, filename]))
        request.onsuccess = (e) => resolve(FileMeta.fromStorage(e.target.result))
        request.onerror = (e) => reject(e)
      }
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

    systemBus.dispatchEvent(SYSTEM_BUS_EVENTS.FILE_SYSTEM.FILE_UPDATED, file.fullPath)
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
          const fileContent = new File(arrayBuffer)
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
          request.onsuccess = () => resolve(File.fromStorage(request.result))
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

    systemBus.dispatchEvent(SYSTEM_BUS_EVENTS.FILE_SYSTEM.FILE_UPDATED, file.fullPath)
    systemBus.dispatchEvent(SYSTEM_BUS_EVENTS.FILE_SYSTEM.DIRECTORY_CHANGED, file.path)
  }

  /**
   * @param {string} path
   * @param {ArrayBuffer} arrayBuffer
   * @param {string} mimeType
   */
  async writeFileContent(path, arrayBuffer, mimeType = "text/plain") {
    let meta = await this.getFileMeta(path)
    /** @type {File} */
    let file
    if (!meta) {
      meta = new FileMeta(path)
      meta.mimeType = mimeType
      meta.size = arrayBuffer.byteLength

      file = new File(arrayBuffer)
    } else {
      file = await this.getFileContent(meta.fileId)
      file.id = meta.fileId
      file.arrayBuffer = arrayBuffer
    }
    meta.updatedAt = new Date()

    await getQueryBuilder()
      .setStoreNames([FILE_STORAGE_NAME, META_STORAGE_NAME])
      .doInTransaction("readwrite", async (transaction) => {
        const filesStore = transaction.objectStore(FILE_STORAGE_NAME)
        const metaStore = transaction.objectStore(META_STORAGE_NAME)

        if (!meta.fileId) {
          /**
           * Create new file content
           */
          meta.fileId = await new Promise((resolve, reject) => {
            const request = filesStore.add(file)
            request.onsuccess = () => resolve(request.result)
            request.onerror = () => reject(request.error)
          })
          metaStore.add(meta)
        } else {
          /**
           * Update file content
           */
          filesStore.put(file)
          metaStore.put(meta)
        }
      })

    systemBus.dispatchEvent(SYSTEM_BUS_EVENTS.FILE_SYSTEM.FILE_UPDATED, meta.fullPath)
    systemBus.dispatchEvent(SYSTEM_BUS_EVENTS.FILE_SYSTEM.DIRECTORY_CHANGED, meta.path)
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
  .addMiddleware(SYSTEM_BUS_COMMANDS.FILE_SYSTEM.GET_FILE_CONTENT_BY_ID, async (fileId, response, next) => {
    response.content = await fileSystem.getFileContent(fileId)
    next()
  })
  .addMiddleware(SYSTEM_BUS_COMMANDS.FILE_SYSTEM.READ_FILE_CONTENT, async (filePath, response, next) => {
    response.meta = await fileSystem.getFileMeta(filePath)
    if (response?.meta?.fileId) {
      response.content = await fileSystem.getFileContent(response.meta.fileId)
    }
    next()
  })
  .addMiddleware(SYSTEM_BUS_COMMANDS.FILE_SYSTEM.WRITE_FILE_CONTENT, async ({ path, arrayBuffer, mimeType }, response, next) => {
    response.content = await fileSystem.writeFileContent(path, arrayBuffer, mimeType)
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
  .addMiddleware(SYSTEM_BUS_COMMANDS.FILE_SYSTEM.GET_SORTED_FILES_IN_DIRECTORY, ({ path, sort }, response, next) => {
    response.iterator = fileSystem.getSortedFilesInDirectory(path, sort)
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
