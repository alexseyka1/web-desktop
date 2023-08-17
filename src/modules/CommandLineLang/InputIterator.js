import IteratorInterface from "./IteratorInterface"

export const VARIABLE_VALID_NAME_REGEXP = /[a-zA-Z0-9_]/
export const NUMBER_RANGE_REGEXP = /{([0-9]+)\\\.\\\.([0-9]+)(?:\\\.\\\.)?([0-9]+)?}/
export const BRACE_EXPANSION_REGEXP = new RegExp(`([^ {}]+)?(?:(?:(?:{)(.*\\\,[^,].*|.+\\\.\\\..+)(?:}))+)([^ ;{}\\\n]+)?`, "gm")

/**
 * @implements {IteratorInterface}
 */
class InputIterator {
  #input
  #position = 0
  #line = 1
  #column = 0

  /** @param {string} input */
  constructor(input) {
    this.#input = this.#prepare(input)
    console.log(this.#input)
  }

  getInput = () => this.#input
  getRestInput = () => this.#input.substring(this.#position)
  fastForward = (length) => (this.#position += length)

  #prepare(input) {
    return (
      input
        /** Removes all commented strings and dont remove hastags inside strings */
        .replace(/#(?!.+}['"`]?).*$/gm, "\n")
        .replace(/(?<!['"`]?\${.*)#.*$/gm, "\n")
        /** Wraps varable substutions by string */
        .replace(/([^'"`])(\${[^}]*})/gm, `$1"$2"`)
        /** Wraps brance expansions by string */
        .replace(BRACE_EXPANSION_REGEXP, `"$&"`)
        /** Addes semicolons to the end of lines */
        .replace(/([^;{])$/gm, "$1;\n")
        /** Removes semicolons after do */
        .replace(/(do);$/gm, "$1")
        .replace(/^\s*;$/gm, "")
        /** Removes all unnecessary spaces */
        .replace(/\s+$/gm, "\n")
        /** Removes all unnecessary new line characters */
        .replace(/\n+$/gm, "")
    )
  }

  next() {
    const char = this.#input.charAt(this.#position++)
    this.#column++
    if (char == "\n") this.#line++, (this.#column = 0)
    return char
  }

  peek() {
    return this.#input.charAt(this.#position)
  }

  isEof() {
    return this.peek() == ""
  }

  throwError(msg) {
    throw new Error(`${msg} (${this.#line}:${this.#column})`)
  }
}

export default InputIterator
