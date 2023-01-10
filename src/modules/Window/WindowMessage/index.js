import Window, { WindowEvents } from ".."
import systemBus, { SYSTEM_BUS_COMMANDS } from "../../SystemBus"
import "./styles.scss"

export const WINDOW_MESSAGE_TYPES = {
  SUCCESS: "success",
  INFO: "info",
  WARNING: "warning",
  ERROR: "error",
  QUESTION: "question",
}

export const createWindowMessages = (_window) => {
  return new (class {
    /**
     * @param {string} title
     * @param {string} message
     * @param {string|null} type
     * @param {object[]|null} actions Buttons list
     * @returns {WindowMessage}
     */
    showMessage(title, message, type = null, actions = null) {
      const _messageWindow = new WindowMessage({ type, title, message, actions })
      systemBus.execute(SYSTEM_BUS_COMMANDS.WINDOW_SYSTEM.OPEN_WINDOW, _messageWindow)
      return _messageWindow
    }

    /**
     * @param {string} title
     * @param {string} message
     * @returns {WindowMessage}
     */
    showMessageInfo(title, message) {
      return this.showMessage(title, message, WINDOW_MESSAGE_TYPES.INFO)
    }

    /**
     * @param {string} title
     * @param {string} message
     * @returns {WindowMessage}
     */
    showMessageSuccess(title, message) {
      return this.showMessage(title, message, WINDOW_MESSAGE_TYPES.SUCCESS)
    }

    /**
     * @param {string} title
     * @param {string} message
     * @returns {WindowMessage}
     */
    showMessageWarning(title, message) {
      return this.showMessage(title, message, WINDOW_MESSAGE_TYPES.WARNING)
    }

    /**
     * @param {string} title
     * @param {string} message
     * @returns {WindowMessage}
     */
    showMessageError(title, message) {
      return this.showMessage(title, message, WINDOW_MESSAGE_TYPES.ERROR)
    }

    /**
     * @param {string} title
     * @param {string} message
     * @param {Function} onConfirm
     * @param {Function} onCancel
     * @returns {WindowMessage}
     */
    showMessageQuestion(title, message, onConfirm = () => {}, onCancel = () => {}) {
      return this.showMessage(title, message, WINDOW_MESSAGE_TYPES.QUESTION, [
        {
          title: "No",
          onClick: onCancel,
        },
        {
          title: "Yes",
          onClick: onConfirm,
        },
      ])
    }
  })()
}

class WindowMessage extends Window {
  constructor(props) {
    props = { ...props, width: 300, height: 200, isResizable: false, isModal: true }
    super(props)
    this.domElement.classList.add("window-message")

    /**
     * CENTER WINDOW
     */
    setTimeout(() => {
      const { width, height } = this.domElement.parentElement.getBoundingClientRect()
      const _positionX = width / 2 - props.width / 2,
        _positionY = height / 2 - props.height / 2
      this.position.set(_positionX, _positionY)
    })

    /**
     * SET WINDOW ICON
     */
    const messageType = props?.type
    if (messageType) {
      this.domElement.classList.add(`window-message__${messageType}`)

      if (!this.icon) {
        if (messageType === WINDOW_MESSAGE_TYPES.SUCCESS) {
          this.icon = "✅"
        } else if (messageType === WINDOW_MESSAGE_TYPES.INFO) {
          this.icon = "ℹ️"
        } else if (messageType === WINDOW_MESSAGE_TYPES.WARNING) {
          this.icon = "⚠️"
        } else if (messageType === WINDOW_MESSAGE_TYPES.ERROR) {
          this.icon = "🚫"
        } else if (messageType === WINDOW_MESSAGE_TYPES.QUESTION) {
          this.icon = "❓"
        }
      }
    }

    this.domElement.innerHTML = `
      <div class="window-message__content">
        ${messageType ? `<div class="window-message__icon">${this?.icon || ""}</div>` : ""}
        <div class="window-message__message">
          <div>${props?.title || ""}</div>
          <div>${props?.message || ""}</div>
        </div>
      </div>
      <div class="window-message__actions"></div>
    `

    let actions = props?.actions
    if (!actions && actions !== false) {
      actions = [
        {
          title: "OK",
          onClick: () => this.dispatchEvent(new Event(WindowEvents.CLOSE)),
        },
      ]
    }

    if (actions && Array.isArray(actions)) {
      const actionsElement = this.domElement.querySelector(".window-message__actions")
      actions.forEach(({ title = "", onClick = () => {} }) => {
        if (!title) return
        const button = document.createElement("button")
        button.innerHTML = title
        button.addEventListener("click", (e) => {
          if (onClick(new CustomEvent(e.type, { detail: this })) !== false) {
            this.dispatchEvent(new Event(WindowEvents.CLOSE))
          }
        })

        actionsElement.append(button)
      })
      setTimeout(() => actionsElement.lastChild.focus())
    }
  }
}

export default WindowMessage
