import systemBus, { SYSTEM_BUS_COMMANDS } from "../../modules/SystemBus"

const commands = {
  "open-image": async (filePath) => {
    try {
      const { file: fileMeta } = await systemBus.execute(SYSTEM_BUS_COMMANDS.FILE_SYSTEM.READ_FILE_META, filePath)
      const { content: fileContent } = await systemBus.execute(SYSTEM_BUS_COMMANDS.FILE_SYSTEM.READ_FILE_CONTENT, fileMeta.fileId)
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
