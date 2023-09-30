import IteratorInterface from "./IteratorInterface"

export const VARIABLE_VALID_NAME_REGEXP = /[a-zA-Z0-9_]/
export const NUMBER_RANGE_REGEXP = /{([0-9]+)\\\.\\\.([0-9]+)(?:\\\.\\\.)?([0-9]+)?}/
export const PARAM_EXPANSION_REGEXP = /\${[^$\n}]+}/gm
export const BRACE_EXPANSION_REGEXP = new RegExp(`([^ {}]+)?(?:(?:(?:{)(.*\\\,[^,].*|.+\\\.\\\..+)(?:}))+)([^ ;{}\\\n]+)?`, "gm")
export const NUMBER_REGEXP = /[0-9]+(\.[0-9]+)?/gm
export const ARRAY_LIST_REGEXP = /\((([0-9]+(\.[0-9]+)?|(['"])[^'"]+\4)\s?)+\)/gm

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
  }

  getInput = () => this.#input
  getRestInput = () => this.#input.substring(this.#position)
  fastForward = (length) => (this.#position += length)

  #prepare(input) {
    return (
      input
        /** Removes all unnecessary spaces */
        .replace(/\s+$/gm, "\n")
        /** Removes all commented strings and dont remove hastags inside strings */
        .replace(/#(?!.+}['"`]?).*$/gm, "\n")
        .replace(/(?<!['"`]?\${.*)#.*$/gm, "\n")
        /** Wraps param expansions by string */
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
        .trim()
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
