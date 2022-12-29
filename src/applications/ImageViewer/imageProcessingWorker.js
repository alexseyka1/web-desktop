import fileSystem from "../FileExplorer/FileSystem"

const commands = {
  "open-image": async (filePath) => {
    try {
      const fileMeta = await fileSystem.getFile(filePath)
      const fileContent = await fileSystem.getFileContent(fileMeta.fileId)
      const _blob = new Blob([fileContent.arrayBuffer], { type: fileMeta.mimeType })
      postMessage(["set-parsed-image", URL.createObjectURL(_blob), fileMeta])
    } catch (e) {
      throw new Error("Failed to open file", e.message)
    }
  },
}

onmessage = (e) => {
  const [command, ...params] = e.data
  if (command in commands) commands[command].apply(commands, params)
}
