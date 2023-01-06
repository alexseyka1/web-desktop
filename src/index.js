import WindowSystem, { WindowSystemEvents } from "./modules/WindowSystem"
import "./styles/document.scss"
import "./styles/dropdown-menu.scss"
import Desktop from "./modules/desktop"
import BottomBar from "./modules/desktop/BottomBar"
import FileExplorer from "./applications/FileExplorer"
import fileSystem, { FileMeta } from "./modules/FileSystem"
import systemBus, { SYSTEM_BUS_COMMANDS } from "./modules/SystemBus"
import ImageViewer from "./applications/ImageViewer"
import NotePad from "./applications/Notepad"
import WindowMessage, { WINDOW_MESSAGE_TYPES } from "./modules/Window/WindowMessage"

globalThis.__DEBUG__ = true

document.addEventListener("DOMContentLoaded", async () => {
  const { isCreated } = await systemBus.execute(SYSTEM_BUS_COMMANDS.FILE_SYSTEM.IS_STRUCTURE_EXISTS)
  if (!isCreated) {
    const { isCompleted } = await systemBus.execute(SYSTEM_BUS_COMMANDS.FILE_SYSTEM.CREATE_FILE_STRUCTURE)
    if (isCompleted) {
      setTimeout(() => window.location.reload())
    }
    return
  }

  /**
   * @todo move this to another file
   */
  systemBus.addMiddleware(SYSTEM_BUS_COMMANDS.FILE_SYSTEM.OPEN_FILE, async (request, response, next) => {
    /** @type {FileMeta} */
    const { file } = await systemBus.execute(SYSTEM_BUS_COMMANDS.FILE_SYSTEM.READ_FILE_META, request)
    if (!file) return
    if (file.mimeType.startsWith("image/")) {
      systemBus.execute(SYSTEM_BUS_COMMANDS.WINDOW_SYSTEM.OPEN_WINDOW, new ImageViewer({ filePath: file.fullPath }))
    } else if (file.mimeType.startsWith("text/")) {
      systemBus.execute(SYSTEM_BUS_COMMANDS.WINDOW_SYSTEM.OPEN_WINDOW, new NotePad({ filePath: file.fullPath }))
    } else {
      systemBus.execute(
        SYSTEM_BUS_COMMANDS.WINDOW_SYSTEM.OPEN_WINDOW,
        new WindowMessage({ title: "Oops", message: "We haven't application that can open this file", type: WINDOW_MESSAGE_TYPES.ERROR })
      )
    }
  })

  /**
   * WINDOW SYSTEM
   */
  const windowSystem = new WindowSystem(document.getElementById("windows"))
  windowSystem.run()

  requestAnimationFrame(() => {
    systemBus.execute(SYSTEM_BUS_COMMANDS.WINDOW_SYSTEM.OPEN_WINDOW, new FileExplorer({ x: 250, y: 200, width: 350, height: 350 }))
  })

  /**
   * DESKTOP
   */
  const desktop = new Desktop(windowSystem)
  windowSystem.root.prepend(desktop.domElement)

  /**
   * BOTTOM BAR
   */
  const bottomBar = new BottomBar(windowSystem)
  document.body.append(bottomBar.domElement)

  windowSystem.addEventListener(WindowSystemEvents.STACK_CHANGED, () => bottomBar.render())
})
