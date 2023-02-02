import WindowSystem from "../WindowSystem"
import "../../styles/desktop.scss"

const APPLICATIONS = []

class Desktop extends EventTarget {
  /** @type {WindowSystem} */
  windowSystem

  #domElement

  constructor(windowSystem) {
    super()
    this.windowSystem = windowSystem
    this.render()

    this.domElement.addEventListener("mousedown", () => {
      this.domElement.querySelector(".files-grid-item.active")?.classList.remove("active")
    })
  }

  get domElement() {
    if (!this.#domElement) {
      this.#domElement = document.createElement("desktop")
      this.#domElement.className = "files-grid desktop"
    }

    return this.#domElement
  }

  render() {
    APPLICATIONS.forEach((app) => {
      const appLink = document.createElement("div")
      appLink.className = "files-grid-item"
      appLink.innerHTML = `
        <div class="files-grid-item__icon">${app.icon || ""}</div>
        <div class="files-grid-item__title" title="${app.title || ""}">${app.title || ""}</div>
      `
      this.domElement.append(appLink)

      appLink.addEventListener("mousedown", (e) => {
        e.stopPropagation()
        this.domElement.querySelector(".files-grid-item.active")?.classList.remove("active")
        appLink.classList.add("active")
      })

      if (app?.run && typeof app.run === "function") {
        appLink.addEventListener("dblclick", () => {
          this.windowSystem.attach(app.run())
          appLink.classList.remove("active")
        })
      }
    })
  }
}

export default Desktop
