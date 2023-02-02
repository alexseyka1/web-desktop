import arrayBufferCache from "../../../classes/ArrayBufferCache"
import Hier from "../../../hier/hier"
import { ast as h } from "../../../hier/hier-parser"
import { FileMeta } from "../../../modules/FileSystem/FileMeta"
import imageProcessing from "../../../modules/ImageProcessing"

class FileIcon extends Hier.Component {
  _state = {
    timestamp: Date.now(),
  }

  render() {
    /** @type {FileMeta} */
    const file = this.props?.file
    if (!file) return

    if (file.isDirectory) return h`<span class="material-symbols-outlined">folder</span>`
    switch (true) {
      case typeof file.icon === "string":
        return h([file.icon])
      case file.mimeType.startsWith("image/"):
        if (file.thumbnailBuffer && file.thumbnailBuffer instanceof ArrayBuffer) {
          const _imageUrl = arrayBufferCache.getFileUrl(file.thumbnailBuffer, file.mimeType)
          return h`<img src=${_imageUrl} loading="lazy" />`
        } else {
          imageProcessing.executeCommand("create-image-thumbnail", file.fullPath).then(([_buffer]) => {
            file.thumbnailBuffer = _buffer
            this.setState({ timestamp: Date.now() })
          })
        }
        return h`<span class="material-symbols-outlined">imagesmode</span>`
      case file.mimeType.startsWith("video/"):
        return h`<span class="material-symbols-outlined">smart_display</span>`
      case file.mimeType === "application/msword":
        return h`<span class="material-symbols-outlined">description</span>`
      case file.mimeType === "application/pdf":
        return h`<span class="material-symbols-outlined">picture_as_pdf</span>`
      case file.mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
        return h`<span class="material-symbols-outlined">table_view</span>`
      case file.mimeType === "text/plain":
        return h`<span class="material-symbols-outlined">article</span>`
      default:
        return h`<span class="material-symbols-outlined">note</span>`
    }
  }
}

export default FileIcon
