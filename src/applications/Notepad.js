import systemBus, { SYSTEM_BUS_COMMANDS } from "../modules/SystemBus"
import Vector from "../modules/Vector"
import Window, { GET_MENU_METHOD, WindowEvents } from "../modules/Window"

class NotePad extends Window {
  constructor(params) {
    super(params)

    this.title = "Notepad"
    this.icon = "📘"
  }

  showAbout() {
    const modalSize = new Vector(200, 200),
      position = new Vector(this.position.x + this.size.x / 2 - modalSize.x / 2, this.position.y + this.size.y / 2 - modalSize.y / 2),
      params = {
        isResizable: false,
      }

    const modalWindow = new (class extends Window {
      constructor(params) {
        super(params)
        this.title = "About notepad"
        this.size.setFromVector(modalSize)
        this.position.setFromVector(position)
      }

      run() {
        this.domElement.innerHTML = `
          <div style="display: flex; justify-content: center; align-items: center; flex-direction: column; height: 100%">
            <h1 style="margin: 0; font-size: 16pt">📘 Notepad</h1>
            <div style="margin: 0; font-size: 13px; color: #555">Version 1.0.0</div>
          </div>
        `
        window.addEventListener("mousedown", (e) => {
          if (!e.path.includes(this.domElement)) {
            this.dispatchEvent(new Event(WindowEvents.CLOSE))
          }
        })
      }
    })(params)
    systemBus.execute(SYSTEM_BUS_COMMANDS.WINDOW_SYSTEM.OPEN_WINDOW, modalWindow)
  }

  [GET_MENU_METHOD]() {
    return [
      {
        title: "File",
        children: [
          {
            title: "New",
            onClick: () => console.log("New file"),
          },
          {
            title: "Open",
            onClick: () => console.log("Open file"),
          },
          "separator",
          {
            title: "Save",
            onClick: () => console.log("Save file"),
          },
          {
            title: "Exit",
            icon: "✖️",
            onClick: () => this.dispatchEvent(new Event(WindowEvents.CLOSE)),
          },
        ],
      },
      {
        title: "Edit",
        children: [
          {
            title: "Copy",
            onClick: () => console.log("Copy text"),
          },
          {
            title: "Paste",
            onClick: () => console.log("Paste text"),
          },
        ],
      },
      {
        title: "Help",
        children: [
          {
            title: "About Notepad",
            icon: "ℹ️",
            onClick: () => this.showAbout(),
          },
        ],
      },
    ]
  }

  get textElement() {
    if (!this.domElement) return
    return this.domElement.querySelector("#text-content")
  }

  run() {
    const template = document.createElement("template")
    template.innerHTML = `
      <div id="text-content" 
        style="background: white; padding: .5rem; outline: none; cursor: text" 
        contenteditable 
        autofocus
      >
        This is a sample test inside Notepad application.
        This is a sample test inside Notepad application.
        This is a sample test inside Notepad application.
        This is a sample test inside Notepad application.
        This is a sample test inside Notepad application.
        This is a sample test inside Notepad application.
        This is a sample test inside Notepad application.
        This is a sample test inside Notepad application.
        This is a sample test inside Notepad application.
        This is a sample test inside Notepad application.
        This is a sample test inside Notepad application.
        This is a sample test inside Notepad application.
        This is a sample test inside Notepad application.
        This is a sample test inside Notepad application.
        This is a sample test inside Notepad application.
        This is a sample test inside Notepad application.
        This is a sample test inside Notepad application.
        This is a sample test inside Notepad application.
        This is a sample test inside Notepad application.
        This is a sample test inside Notepad application.
        This is a sample test inside Notepad application.
        This is a sample test inside Notepad application.
        This is a sample test inside Notepad application.
      </div>
    `
    this.domElement.append(template.content)

    this.domElement.addEventListener("keydown", (e) => {
      if (e.metaKey && e.key === "s") {
        e.preventDefault()
      }
    })
  }
}

export default NotePad
