import IteratorInterface from "./IteratorInterface"

export const VARIABLE_VALID_NAME_REGEXP = /[a-zA-Z0-9_]/
export const NUMBER_RANGE_REGEXP = /{([0-9]+)\\\.\\\.([0-9]+)(?:\\\.\\\.)?([0-9]+)?}/
export const PARAM_EXPANSION_REGEXP = /(['"\`])?(\${[^\n}]+})\1?/gm
export const NUMERIC_CALCULATION_REGEXP = /(['"\`])?\$\(\((.+)\)\)\1?/gm
export const BRACE_EXPANSION_REGEXP = new RegExp(`([^ {}]+)?(?:(?:(?:{)(.*\\\,[^,].*|.+\\\.\\\..+)(?:}))+)([^ ;{}\\\n]+)?`, "gm")
export const NUMBER_REGEXP = /[0-9]+(\.[0-9]+)?/gm
export const ARRAY_LIST_REGEXP = /\((([0-9]+(\.[0-9]+)?|(['"`])[^'"]+\4)\s?)*\)/gm

const QUOTES = `'"\``
const BRACKETS = ` ()[]{}`

/**
 * @implements {IteratorInterface}
 */
class InputIterator {
  #input
  #position = 0
  #line = 1
  #column = 0
  bracketsStack = []

  /** @param {string} input */
  constructor(input) {
    this.#input = this.#prepare(input)
  }

  getInput = () => this.#input
  getRestInput = () => this.#input.substring(this.#position)
  fastForward = (length) => {
    for (let i = 0; i < length; i++) this.next()
  }

  #prepare(input) {
    return (
      input
        /** Removes all unnecessary spaces */
        .replace(/\s+$/gm, "\n")
        /** Removes all commented strings and dont remove hastags inside strings */
        .replace(/#(?!.+}['"`]?).*$/gm, "\n")
        .replace(/(?<!['"`]?\${.*)#.*$/gm, "\n")
        /** Wraps param expansions by string */
        // .replace(/([^'"`])(\${[^}]*})/gm, `$1"$2"`)
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

  #checkBrackets(char) {
    const quoteIndex = QUOTES.indexOf(char)
    const bracketIndex = BRACKETS.indexOf(char)
    if (quoteIndex < 0 && bracketIndex <= 0) return

    if (quoteIndex >= 0) {
      /** This is a quote */
      if (this.bracketsStack.at(-1) === char) this.bracketsStack.pop()
      else this.bracketsStack.push(char)
    } else {
      /** This is a bracket */
      const isStartBracket = bracketIndex % 2 !== 0
      if (isStartBracket) {
        this.bracketsStack.push(char)
      } else if (this.bracketsStack.at(-1) === BRACKETS.at(bracketIndex - 1)) {
        this.bracketsStack.pop()
      }
    }
  }

  next() {
    const char = this.#input.charAt(this.#position++)
    this.#column++
    if (char == "\n") this.#line++, (this.#column = 0)
    this.#checkBrackets(char)
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
