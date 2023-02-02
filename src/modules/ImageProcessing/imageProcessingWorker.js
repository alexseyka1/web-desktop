import systemBus, { SYSTEM_BUS_COMMANDS } from "../SystemBus"
import { FileMeta } from "../FileSystem"
import arrayBufferCache from "../../classes/ArrayBufferCache"

/**
 *
 * @param {FileMeta} file
 * @returns
 */
const generateImageThumbnail = (file) => {
  return new Promise(async (resolve) => {
    const { content } = await systemBus.execute(SYSTEM_BUS_COMMANDS.FILE_SYSTEM.GET_FILE_CONTENT_BY_ID, file.fileId)
    const blob = new Blob([content.arrayBuffer], { type: file.mimeType })

    const img = await createImageBitmap(blob)

    const maxSize = 128,
      aspectRatio = img.width / img.height,
      newWidth = Math.round(aspectRatio > 1 ? maxSize : maxSize * aspectRatio),
      newHeight = Math.round(aspectRatio > 1 ? newWidth / aspectRatio : maxSize)

    const canvas = new OffscreenCanvas(newWidth, newHeight)
    canvas.getContext("2d").drawImage(img, 0, 0, img.width, img.height, 0, 0, newWidth, newHeight)
    const newBlob = await canvas.convertToBlob({ type: file.mimeType, quality: 0.6 })
    resolve(await newBlob.arrayBuffer())
  })
}

const commands = {
  "open-image": async (_id, filePath) => {
    try {
      const { file: fileMeta } = await systemBus.execute(SYSTEM_BUS_COMMANDS.FILE_SYSTEM.READ_FILE_META, filePath)
      const { content: fileContent } = await systemBus.execute(SYSTEM_BUS_COMMANDS.FILE_SYSTEM.GET_FILE_CONTENT_BY_ID, fileMeta.fileId)
      const url = arrayBufferCache.getFileUrl(fileContent.arrayBuffer, fileMeta.mimeType)
      postMessage([_id, url, fileMeta])
    } catch (e) {
      throw new Error("Failed to open file: " + e.message)
    }
  },
  "create-image-thumbnail": async (_id, filePath) => {
    try {
      /** @type {FileMeta} */
      const file = (await systemBus.execute(SYSTEM_BUS_COMMANDS.FILE_SYSTEM.READ_FILE_META, filePath)).file
      file.thumbnailBuffer = await generateImageThumbnail(file)
      await systemBus.execute(SYSTEM_BUS_COMMANDS.FILE_SYSTEM.UPDATE_FILE_META, file)
      postMessage([_id, file.thumbnailBuffer])
    } catch (e) {
      throw new Error("Failed to open file: " + e.message)
    }
  },
}

onmessage = (e) => {
  const [command, _id, ...params] = e.data
  if (command in commands) commands[command].apply(commands, [_id, ...params])
}
