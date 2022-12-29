import WindowSystem, { WindowSystemEvents } from "./modules/WindowSystem"
import "./styles/document.scss"
import "./styles/dropdown-menu.scss"
import Desktop from "./modules/desktop"
import BottomBar from "./modules/desktop/BottomBar"
import FileExplorer from "./applications/FileExplorer"
import fileSystem, { FILE_SYSTEM_EVENTS } from "./applications/FileExplorer/FileSystem"
import ImageViewer from "./applications/ImageViewer"

document.addEventListener("DOMContentLoaded", async () => {
  if (!(await fileSystem.getIsCreated())) {
    fileSystem.addEventListener(FILE_SYSTEM_EVENTS.CREATED, () => {
      setTimeout(() => window.location.reload())
    })
    fileSystem.dispatchEvent(new Event(FILE_SYSTEM_EVENTS.CREATE))
    return
  }

  /**
   * WINDOW SYSTEM
   */
  const windowSystem = new WindowSystem(document.getElementById("windows"))
  windowSystem.attach(new FileExplorer({ x: 250, y: 200, width: 350, height: 350 }))
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

  windowSystem.addEventListener(WindowSystemEvents.STACK_CHANGED, () => bottomBar.render())
})
