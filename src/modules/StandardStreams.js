const streams = {}

const createNewWritableStream = (params) => {
  const { onWrite, onComplete, onAbort } = params
  const decoder = new TextDecoder("utf-8")
  const queuingStrategy = new CountQueuingStrategy({ highWaterMark: 1 })
  let result = ""

  return new WritableStream(
    {
      write(chunk) {
        return new Promise((resolve) => {
          const buffer = new ArrayBuffer(1),
            view = new Uint8Array(buffer)
          view[0] = chunk
          const decoded = decoder.decode(view, { stream: true })
          if (onWrite && typeof onWrite === "function") onWrite(decoded, chunk)

          result += decoded
          resolve()
        })
      },
      close() {
        if (onComplete && typeof onComplete === "function") setTimeout(() => onComplete(result))
      },
      abort(error) {
        if (onAbort && typeof onAbort === "function") onAbort(error)
      },
    },
    queuingStrategy
  )
}

function sendMessage(params) {
  const { message, streamName, onClose } = params

  const _checkStreamLocked = () => {
    return new Promise((resolve, reject) => {
      const stream = streams[streamName]
      if (!stream.locked) resolve()
      else reject()
    })
  }
  const _writeToStream = () => {
    const stream = streams[streamName],
      writer = stream.getWriter(),
      encoder = new TextEncoder(),
      encoded = encoder.encode(message)
    encoded.forEach((chunk) => {
      writer.ready
        /** One chunk written */
        .then(() => writer.write(chunk))
        .catch((err) => {
          console.log("Chunk error:", err)
        })
    })

    writer.ready
      /** All chunks written */
      .then(() => {
        writer.close().then(() => {
          if (onClose && typeof onClose === "function") onClose()
        })
      })
      .catch((err) => {
        console.log("Stream error:", err)
      })
  }

  ;(function checker() {
    _checkStreamLocked()
      .then(() => _writeToStream())
      .catch(() => setTimeout(() => checker()))
  })()
}

/**
 * @callback StreamEvent
 * @param {String} char
 * @param {Number} byte
 */

export class Stream {
  write(value) {}

  /**
   * @param {StreamEvent} callback
   */
  onByte(callback) {}

  /**
   * @param {StreamEvent} callback
   */
  onComplete(callback) {}
}

export class StandardStreams {
  /** @type {Stream} */
  input = createStream("input")
  /** @type {Stream} */
  output = createStream("output")
  /** @type {Stream} */
  error = createStream("error")
}

const createStream = (name) => {
  let onWrite, onComplete
  const createStream = () => (streams[name] = createNewWritableStream({ onWrite, onComplete }))

  return new (class extends Stream {
    write(value) {
      return sendMessage({ message: value, streamName: name, onClose: createStream })
    }

    onByte(callable) {
      if (callable && typeof callable === "function") onWrite = callable
      createStream()
      return this
    }

    onComplete(callable) {
      if (callable && typeof callable === "function") onComplete = callable
      createStream()
      return this
    }
  })()
}
