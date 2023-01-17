import Application from "../../modules/Application"
import { WindowEvents } from "../../modules/Window"
import "./styles.scss"

class Notepad extends Application {
  async main() {
    const _window = await this.createWindow({
      title: "Notepad",
      icon: "📘",
      width: 400,
      height: 300,
    })
    _window.registerMenuPanel(this.menuPanel(_window))

    const template = document.createElement("template")
    template.innerHTML = `
        <textarea id="text-content" autofocus>
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
        </textarea>
      `

    _window.contentElement.replaceWith(template.content)

    _window.domElement.querySelector("#text-content").addEventListener("contextmenu", (e) => {
      e.stopPropagation()
    })

    _window.domElement.addEventListener("keydown", (e) => {
      if (e.metaKey && e.key === "s") {
        e.preventDefault()
      }
    })
  }

  async showAbout() {
    const params = {
      width: 200,
      height: 200,
      isResizable: false,
      title: "About notepad",
    }

    const modalWindow = await this.createWindow(params)
    modalWindow.contentElement.innerHTML = `
        <div style="display: flex; justify-content: center; align-items: center; flex-direction: column; height: 100%">
          <h1 style="margin: 0; font-size: 16pt">📘 Notepad</h1>
          <div style="margin: 0; font-size: 13px; color: #555">Version 1.0.0</div>
        </div>
      `
    window.addEventListener("mousedown", (e) => {
      if (!e.path.includes(modalWindow.domElement)) {
        modalWindow.dispatchEvent(new Event(WindowEvents.CLOSE))
      }
    })
  }

  menuPanel(_window) {
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
            onClick: () => _window.dispatchEvent(new Event(WindowEvents.CLOSE)),
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
            onClick: () => {
              this.showAbout(_window)
            },
          },
        ],
      },
    ]
  }
}

export default Notepad
