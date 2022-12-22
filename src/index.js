import WindowSystem, { WindowSystemEvents } from "./modules/WindowSystem"
import "./styles/window.scss"
import "./styles/document.scss"
import "./styles/dropdown-menu.scss"
import Desktop from "./modules/desktop"
import BottomBar from "./modules/desktop/BottomBar"
import NotePad from "./applications/Notepad"

document.addEventListener("DOMContentLoaded", () => {
  /**
   * WINDOW SYSTEM
   */
  const windowSystem = new WindowSystem(document.getElementById("windows"))
  windowSystem.attach(new NotePad({ x: 250, y: 200, width: 350, height: 350 }))
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
