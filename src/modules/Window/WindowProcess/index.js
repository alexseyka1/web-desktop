import { WindowEvents } from ".."
import systemBus, { SYSTEM_BUS_COMMANDS } from "../../SystemBus"
import WindowMessage, { WINDOW_MESSAGE_TYPES } from "../WindowMessage"
import "./styles.scss"

export const WINDOW_PROCESS_EVENTS = {
  UPDATE_PROCESSES: "window-process-update-processes",
}

export class WindowProcessItem {
  /** @type {string} */
  title

  /** @type {number|false} */
  percentage = false

  constructor(title, percentage) {
    this.title = title
    this.percentage = percentage
  }
}

const ANIMATION_MS = 1000

class WindowProcess extends WindowMessage {
  /** @type {WindowProcessItem[]} */
  #processes = []
  #prevTitle

  constructor(params) {
    params = { width: 350, isResizable: false, isModal: true, ...params }
    super(params)
    if (params?.processes && Array.isArray(params.processes)) this.#processes = JSON.parse(JSON.stringify(params?.processes))
    if (params?.title) this.#prevTitle = params.title

    /**
     * ON CLOSE WINDOW
     */
    const onCancelProcess = params?.onCancelProcess
    if (onCancelProcess && typeof onCancelProcess === "function") {
      this.addEventListener(WindowEvents.CLOSE, (e) => {
        if (e?.detail?.forced) return

        e.stopImmediatePropagation()
        systemBus.execute(
          SYSTEM_BUS_COMMANDS.WINDOW_SYSTEM.OPEN_WINDOW,
          new WindowMessage({
            type: WINDOW_MESSAGE_TYPES.QUESTION,
            title: "Cancel process",
            message: "Are you sure you want to cancel current process?",
            actions: [
              {
                title: "No",
                onClick: () => {},
              },
              {
                title: "Yes",
                onClick: () => {
                  onCancelProcess()
                  this.dispatchEvent(new CustomEvent(WindowEvents.CLOSE, { detail: { forced: true } }))
                },
              },
            ],
          })
        )
      })
    }
  }

  /**
   * @returns {HTMLElement[]}
   */
  get itemElements() {
    return this.domElement.querySelectorAll(".window-process__item")
  }

  /**
   * @param {WindowProcessItem} process
   */
  #createNewProcess(process) {
    const _percent = Math.round(+process.percentage)

    const elem = document.createElement("div")
    elem.className = "window-process__item"
    elem.style.transition = `all ${ANIMATION_MS}ms ease-in-out`
    elem.innerHTML = `
        <div class="window-process-item__top-bar">
          <div class="window-process-item__title">${process.title}</div>
          <div class="window-process-item__percent">${process.percentage ? _percent + "%" : ""}</div>
        </div>
        <div class="window-process-item__progress-bar ${process.percentage === false ? "active" : ""}">
          <div class="window-process-item__progress-line" style="width: ${_percent}%"></div>
        </div>
      `
    this.domElement.append(elem)

    setTimeout(() => {
      const style = window.getComputedStyle(elem, null)
      elem.style.height = `${style.getPropertyValue("height")}`
    })
  }

  #render() {
    if (!this.#processes) return
    this.domElement.innerHTML = ""

    this.#processes.forEach((item) => this.#createNewProcess(item))
    this.#updateTotalPercentage()
  }

  #updateTotalPercentage() {
    if (this.#processes.length <= 1) {
      if (this.title !== this.#prevTitle) this.title = this.#prevTitle
      return
    }

    let totalPercent = 0
    this.#processes.forEach((item) => {
      const _percent = Math.round(+item.percentage)
      totalPercent += _percent
    })

    totalPercent = Math.round(totalPercent / this.#processes.length)
    this.title = `${this.#prevTitle || ""} (${this.#processes.length}) - ${totalPercent}%`
  }

  #registerEvents() {
    this.addEventListener(WINDOW_PROCESS_EVENTS.UPDATE_PROCESSES, (e) => {
      if (!e.detail || !Array.isArray(e.detail)) return

      this.#processes.forEach((item, index) => {
        const newItemProps = e.detail?.[index]
        if (!newItemProps) return

        if (JSON.stringify(newItemProps) !== JSON.stringify(item)) {
          const elem = this.itemElements[index]
          if (!elem) return

          if (newItemProps?.title !== item.title) {
            elem.querySelector(".window-process-item__title").innerHTML = newItemProps?.title
          }
          if (newItemProps?.percentage !== item.percentage) {
            const _percent = Math.round(+newItemProps.percentage)

            const percent = elem.querySelector(".window-process-item__percent")
            percent.innerHTML = newItemProps.percentage === false ? "" : `${_percent}%`

            const progressBar = elem.querySelector(".window-process-item__progress-bar")
            if (newItemProps.percentage === false) progressBar.classList.add("active")
            else progressBar.classList.remove("active")

            const line = elem.querySelector(".window-process-item__progress-line")
            if (newItemProps.percentage === false) line.style.width = 0
            else line.style.width = `${_percent}%`

            if (_percent >= 100) elem.classList.add("complete")
            else elem.classList.remove("complete")
          }
        }
      })

      /**
       * Hide unnecessary items
       */
      if (this.#processes.length > e.detail.length) {
        for (let index = e.detail.length; index < this.#processes.length; index++) {
          const item = this.itemElements[index]
          if (!item) break
          item.style.height = 0
          item.style.paddingTop = 0
          item.style.paddingBottom = 0
          setTimeout(() => item.remove(), ANIMATION_MS)
        }
      } else if (this.#processes.length < e.detail.length) {
        for (let index = this.#processes.length; index < e.detail.length; index++) {
          this.#createNewProcess(e.detail[index])
        }
      }

      this.#processes = JSON.parse(JSON.stringify(e.detail))
      this.#updateTotalPercentage()

      /**
       * Scroll down to uncomplete item
       */
      const uncompleteElement = document.querySelector(".window-process__item:not(.complete)")
      if (uncompleteElement) uncompleteElement.scrollIntoView({ behavior: "smooth", block: "end", inline: "nearest" })
    })
  }

  run() {
    this.domElement.closest(".window").classList.add("window-process")
    this.#render()
    this.#registerEvents()
  }
}

export default WindowProcess
