import Window from "../Window"
import RandomColor from "../../applications/RandomColor"
import NotePad from "../../applications/Notepad"
import WindowSystem from "../WindowSystem"
import "../../styles/desktop.scss"

const APPLICATIONS = [
  {
    icon: "📘",
    title: "Notepad",
    run() {
      return new NotePad({ x: 250, y: 200, width: 350, height: 350 })
    },
  },
  {
    icon: "🌈",
    title: "Random color Random color Random color Random color Random color Random color",
    run() {
      return new RandomColor({ x: 200, y: 150, width: 350, height: 200 })
    },
  },
  {
    icon: "1️⃣",
    title: "Test window 1",
    run() {
      return new Window({ x: 100, y: 50, width: 200, height: 200, title: "First window" })
    },
  },
  {
    icon: "2️⃣",
    title: "Test window 2",
    run() {
      return new Window({ x: 150, y: 100, width: 200, height: 200, title: "Second window" })
    },
  },
]

class Desktop extends EventTarget {
  /** @type {WindowSystem} */
  windowSystem

  #domElement

  constructor(windowSystem) {
    super()
    this.windowSystem = windowSystem
    this.render()

    this.domElement.addEventListener("mousedown", () => {
      this.domElement.querySelector(".desktop-app.active")?.classList.remove("active")
    })
  }

  get domElement() {
    if (!this.#domElement) {
      this.#domElement = document.createElement("desktop")
      this.#domElement.className = "desktop"
    }

    return this.#domElement
  }

  render() {
    APPLICATIONS.forEach((app) => {
      const appLink = document.createElement("div")
      appLink.className = "desktop-app"
      appLink.innerHTML = `
        <div class="desktop-app__icon">${app.icon || ""}</div>
        <div class="desktop-app__title" title="${app.title || ""}">${app.title || ""}</div>
      `
      this.domElement.append(appLink)

      appLink.addEventListener("mousedown", (e) => {
        e.stopPropagation()
        this.domElement.querySelector(".desktop-app.active")?.classList.remove("active")
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
