import WindowSystem from "./modules/WindowSystem"
import "./styles/document.scss"
import "./styles/dropdown-menu.scss"
import Desktop from "./modules/desktop"
import BottomBar from "./modules/desktop/BottomBar"
import { FileMeta } from "./modules/FileSystem"
import systemBus, { SYSTEM_BUS_COMMANDS, SYSTEM_BUS_EVENTS } from "./modules/SystemBus"
import ImageViewer from "./applications/ImageViewer"
import Notepad from "./applications/Notepad"
import WindowMessage, { WINDOW_MESSAGE_TYPES } from "./modules/Window/WindowMessage"
import Terminal from "./applications/Terminal"
import FileExplorer from "./applications/FileExplorer"
import Window from "./modules/Window"

globalThis.__DEBUG__ = false

document.addEventListener("DOMContentLoaded", async () => {
  /**
   * INIT THE FILE SYSTEM
   */
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
      systemBus.execute(SYSTEM_BUS_COMMANDS.WINDOW_SYSTEM.OPEN_WINDOW, new Notepad({ filePath: file.fullPath }))
    } else {
      systemBus.execute(
        SYSTEM_BUS_COMMANDS.WINDOW_SYSTEM.OPEN_WINDOW,
        new WindowMessage({ title: "Oops", message: "We haven't application that can open this file", type: WINDOW_MESSAGE_TYPES.ERROR })
      )
    }
  })

  /**
   * REGISTER SERVICE WORKER
   */
  // ;(async () => {
  //   if ("serviceWorker" in navigator) {
  //     try {
  //       const registration = await navigator.serviceWorker.register("/serviceWorker.js", {
  //         scope: "/",
  //       })
  //       if (registration.installing) {
  //         console.log("Service worker installing")
  //       } else if (registration.waiting) {
  //         console.log("Service worker installed")
  //       } else if (registration.active) {
  //         console.log("Service worker active")
  //       }
  //     } catch (error) {
  //       console.error(`Registration failed with ${error}`)
  //     }
  //   }
  // })()

  /**
   * WINDOW SYSTEM
   */
  const windowSystem = new WindowSystem(document.getElementById("windows"))
  windowSystem.run()

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
  systemBus.addEventListener(SYSTEM_BUS_EVENTS.WINDOW_SYSTEM.STACK_CHANGED, () => bottomBar.render())

  /**
   * MOVE THIS FUNCIONALITY TO SEPARATE CLASS (SOME APPLICATION RUNNER)
   */
  // const app = new Terminal()
  // app.main(["/applications"])

  const app = new FileExplorer()
  app.main(["/home/images"])
})
