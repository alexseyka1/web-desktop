import LinkedList from "./LinkedList"

export const SYSTEM_BUS_COMMANDS = {
  WINDOW_SYSTEM: {
    OPEN_WINDOW: "window-system:open-window",
  },
  FILE_SYSTEM: {
    OPEN_FILE: "file-system:open-file",
    READ_FILE_META: "file-system:read-file-meta",
    UPDATE_FILE_META: "file-system:update-file-meta",
    READ_FILE_CONTENT: "file-system:read-file-content",
    GET_FILE_CONTENT_BY_ID: "file-system:get-file-content-by-id",
    WRITE_FILE_CONTENT: "file-system:write-file-content",
    CREATE_FILE_STRUCTURE: "file-system:create-file-structure",
    IS_STRUCTURE_EXISTS: "file-system:is-structure-exists",
    GET_FILES_ITERATOR: "file-system:get-files-iterator",
    UPLOAD_FILES_LIST: "file-system:upload-files-list",
    DELETE_FILES_LIST: "file-system:delete-files-list",
  },
  APP_RUNNER: {
    RUN_COMMAND: "app-runner:run-command",
    RUN_COMMAND_WITH_DEFINED_COMMANDS: "app-runner:run-command-with-defined-commands",
    RUN_APPLICATION: "app-runner:run-application",
  },
}

export const SYSTEM_BUS_EVENTS = {
  FILE_SYSTEM: {
    STRUCTURE_CREATED: "file-system:structure-created",
    DIRECTORY_CHANGED: "file-system:directory-changed",
    FILE_UPDATED: "file-system:file-updated",
    UPLOAD_FILES_STARTED: "file-system:upload-files-started",
    UPLOAD_FILE_PROGRESS: "file-system:upload-file-progress",
    UPLOAD_FILES_ABORT: "file-system:upload-files-abort",
    UPLOAD_FILES_FINISHED: "file-system:upload-files-finished",
    DELETE_FILES_STARTED: "file-system:delete-files-started",
    DELETE_FILE_PROGRESS: "file-system:delete-file-progress",
    DELETE_FILES_ABORT: "file-system:delete-files-abort",
    DELETE_FILES_FINISHED: "file-system:delete-files-finished",
  },
  WINDOW_SYSTEM: {
    STACK_CHANGED: "window-system:stack-changed",
  },
}

/**
 * This is the system bus.
 * All application command and events MUST pass through it
 *
 * With its help you can:
 * 1. Subscribe to the execution of some command
 * 2. Execute a command and get the result of its work
 * 3. Subscribe to some event
 * 4. Notify subscribers about some event
 */
class SystemBus {
  /** @type {Map<string, LinkedList} */
  #commandsMap = new Map()
  #eventTarget = new EventTarget()
  #timeout

  /**
   * Execute command and specify result inside response object or just call next()
   * @callback SystemBusMiddleware
   * @param {any} request
   * @param {{isCompleted: boolean}} response
   * @param {Function} next
   */
  /**
   * Subscribe to the execution of command
   * @param {string} commandName
   * @param {SystemBusMiddleware} middleware
   * @returns {SystemBus}
   */
  addMiddleware(commandName, middleware) {
    if (globalThis.__DEBUG__) {
      console.info(`➕[system-bus][command][add] ${commandName}`, { middleware })
    }

    let _linkedList
    if (this.#commandsMap.has(commandName)) {
      _linkedList = this.#commandsMap.get(commandName)
    } else {
      _linkedList = new LinkedList()
      this.#commandsMap.set(commandName, _linkedList)
    }

    _linkedList.add(middleware)
    return this
  }

  /**
   * Remove subscriber of the command
   * @param {string} commandName
   * @param {SystemBusMiddleware} middleware
   */
  removeMiddleware(commandName, middleware) {
    if (globalThis.__DEBUG__) {
      console.info(`➖[system-bus][command][remove] ${commandName}`, { middleware })
    }

    if (!this.#commandsMap.has(commandName)) return
    const _linkedList = this.#commandsMap.get(commandName)

    _linkedList.remove(middleware)
  }

  /**
   * Set timeout of comand execution
   * @param {number|null} ms
   * @returns {SystemBus}
   */
  setTimeout(ms) {
    this.#timeout = ms
    return this
  }

  /**
   * Execute command
   * @param {string} commandName
   * @see SYSTEM_BUS_COMMANDS
   * @param  {...any} args
   * @returns {any|null}
   */
  execute(commandName, ...args) {
    if (!args.length) args = [null]
    if (globalThis.__DEBUG__) {
      console.info(`▶︎[system-bus][command][execute] ${commandName}`, { args })
    }

    return new Promise((resolve, reject) => {
      if (!this.#commandsMap.has(commandName)) return
      const _linkedList = this.#commandsMap.get(commandName)
      const head = _linkedList.head
      if (!head || !head.value) return

      /**
       * Create response object
       */
      let isCompleted = false
      let response = Object.create(null, {
        isCompleted: {
          enumerable: true,
          get: () => isCompleted,
          set: (value) => (isCompleted = !!value),
        },
      })
      response = new Proxy(response, {
        set: (target, prop, value) => {
          target[prop] = value
          if (prop !== "isCompleted") isCompleted = true
          return true
        },
      })

      /**
       * If timeout specified
       */
      let timer
      let isTimeOut = false
      const rerunTimer = () => {
        if (timer) clearTimeout(timer)
        if (!this.#timeout || typeof this.#timeout !== "number") return
        timer = window.setTimeout(() => {
          isTimeOut = true
          this.setTimeout(null)
        }, this.#timeout)
      }

      const catchErrors = (result) => {
        if (result instanceof Promise) {
          result.catch((e) => reject(e))
        }
      }

      const getNextCallback = (item) => {
        if (item.next && item.next.value) {
          return () => {
            if (isTimeOut) {
              reject()
              return
            }
            rerunTimer()
            catchErrors(item.next.value.apply(item.next, [...args, response, getNextCallback(item.next)]))
          }
        }
        return () => resolve({ ...response })
      }

      rerunTimer()
      catchErrors(head.value.apply(this, [...args, response, getNextCallback(head)]))
    }).then((result) => {
      if (globalThis.__DEBUG__) {
        console.info(`✅[system-bus][command][resolve] ${commandName}`, { result })
      }

      return result
    })
  }

  /**
   * @param {string} eventName
   * @param {Function|EventListenerOrEventListenerObject} listener
   * @param {Boolean|AddEventListenerOptions} options
   */
  addEventListener(eventName, listener, options) {
    if (globalThis.__DEBUG__) {
      console.info(`➕[system-bus][event][add] ${eventName}`, { listener })
    }

    return this.#eventTarget.addEventListener(eventName, listener, options)
  }

  /**
   * @param {string} eventName
   * @param {Function|EventListenerOrEventListenerObject} listener
   * @param {Boolean|AddEventListenerOptions} options
   */
  removeEventListener(eventName, listener, options) {
    if (globalThis.__DEBUG__) {
      console.info(`➖[system-bus][event][remove] ${eventName}`, { listener })
    }

    return this.#eventTarget.removeEventListener(eventName, listener, options)
  }

  /**
   * @param {string} eventName
   * @param {any|undefined} detail
   * @see SYSTEM_BUS_EVENTS
   * @returns {boolean}
   */
  dispatchEvent(eventName, detail) {
    if (globalThis.__DEBUG__) {
      console.info(`🔔[system-bus][event][dispatch] ${eventName}`, { detail })
    }

    const event = detail === undefined ? new Event(eventName) : new CustomEvent(eventName, { detail })
    return this.#eventTarget.dispatchEvent(event)
  }
}

const systemBus = new SystemBus()
export default systemBus
