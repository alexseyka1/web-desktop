import IteratorInterface from "./IteratorInterface"
import InputIterator, { BRACE_EXPANSION_REGEXP, VARIABLE_VALID_NAME_REGEXP, ARRAY_LIST_REGEXP, NUMBER_REGEXP, PARAM_EXPANSION_REGEXP } from "./InputIterator"
import {
  AstArrayNode,
  AstBraceExpansionNode,
  AstKeywordNode,
  AstNumberNode,
  AstOperatorNode,
  AstParamExpansionNode,
  AstPunctuationNode,
  AstStringNode,
  AstVariableNode,
} from "./AstNodes"

export const KEYWORDS = {
  TRUE: "true",
  FALSE: "false",
  IF: "if",
  THEN: "then",
  ELSE: "else",
  FUNCTION: "function",
  FOR: "for",
  IN: "in",
  WHILE: "while",
  DO: "do",
  DONE: "done",
  UNSET: "unset",
}

const isKeyword = (x) => {
  return Object.values(KEYWORDS).includes(x)
}
const isMinus = (char) => {
  return /-/.test(char)
}
const isDigit = (char) => {
  return /[0-9]/i.test(char)
}
const isVariableStart = (char) => {
  return /\$/i.test(char)
}
const isIdStart = (char) => {
  return /[a-zA-Z_]/i.test(char)
}
const isId = (char) => {
  return VARIABLE_VALID_NAME_REGEXP.test(char)
}
const isOperator = (char) => {
  return "+-*/%=&|<>!".indexOf(char) >= 0
}
const isPunctuation = (char) => {
  return ",;(){}[]".indexOf(char) >= 0
}
const isWhitespace = (char) => {
  return " \t\n".indexOf(char) >= 0
}
const isFilePathStart = (char) => {
  return /[./]/i.test(char)
}
const isFilePath = (char) => {
  return /[^;\s\t\n$]/i.test(char)
}
const isQuote = (char) => {
  return /['"`]/.test(char)
}

/**
 * @implements {IteratorInterface}
 */
class TokenIterator {
  #inputIterator
  #current
  #hasMinus = false

  /**
   * @param {InputIterator} inputIterator
   */
  constructor(inputIterator) {
    this.#inputIterator = inputIterator
  }

  /**
   * @param {Function} predicate
   * @returns {string}
   */
  readWhile(predicate) {
    let str = ""
    while (!this.#inputIterator.isEof() && predicate(this.#inputIterator.peek())) {
      str += this.#inputIterator.next()
    }
    return str
  }

  /**
   * @returns {AstNumberNode}
   */
  readNumber() {
    let hasDot = false
    const number = this.readWhile((char) => {
      if (char == ".") {
        if (hasDot) return false
        hasDot = true
        return true
      }
      return isDigit(char)
    })
    let value = parseFloat(number)
    if (this.#hasMinus) {
      value *= -1
      this.#hasMinus = false
    }
    return new AstNumberNode(value)
  }

  /**
   * @param {string} [prefix]
   * @returns {AstKeywordNode|AstVariableNode}
   */
  readIdent(prefix) {
    let id = this.readWhile(isId)

    if ((id + "").toLowerCase() == "true") return new AstKeywordNode(true)
    if ((id + "").toLowerCase() == "false") return new AstKeywordNode(false)
    if (this.#hasMinus) {
      this.#hasMinus = false
      id = `-${id}`
    }

    if (isKeyword(id)) return new AstKeywordNode(id)
    const variable = new AstVariableNode(id, prefix === "$")
    const arrayIndexRegexp = new RegExp(`^\\\[(${VARIABLE_VALID_NAME_REGEXP.source}+)\\\]`)
    let indexMatch
    if ((indexMatch = this.#inputIterator.getRestInput()?.match(arrayIndexRegexp))) {
      variable.index = indexMatch[1]
      this.#inputIterator.fastForward(indexMatch[0].length)
    }
    return variable
  }

  /**
   * @param {string} quote
   * @returns {string}
   */
  readEscaped(quote) {
    let escaped = false,
      str = ""

    this.#inputIterator.next()
    while (!this.#inputIterator.isEof()) {
      const char = this.#inputIterator.next()
      if (escaped) {
        str += char
        escaped = false
      } else if (char == "\\") {
        escaped = true
      } else if (char === quote) {
        break
      } else {
        str += char
      }
    }
    return str
  }

  /**
   * @returns {string}
   */
  readFilePath() {
    return new AstStringNode(this.readWhile(isFilePath), `"`)
  }

  /**
   * @param {string} quote
   * @returns {AstStringNode}
   */
  readString(quote) {
    return new AstStringNode(this.readEscaped(quote), quote)
  }

  readNext() {
    this.readWhile(isWhitespace)
    if (this.#inputIterator.isEof()) return null

    const char = this.#inputIterator.peek()

    if (isFilePathStart(char)) {
      return this.readFilePath()
    } else if (isQuote(char)) {
      if (char === `"`) {
        let braceExpansion
        let paramExpansion
        if ((braceExpansion = this.#getBraceExpansion())) return braceExpansion
        else if ((paramExpansion = this.#getParamExpansion())) return paramExpansion
      }
      return this.readString(char)
    } else if (isMinus(char)) {
      this.#hasMinus = true
      this.#inputIterator.next()
      return this.readNext()
    } else if (isDigit(char)) {
      return this.readNumber()
    } else if (isOperator(char)) {
      let operator = this.readWhile(isOperator)
      if (this.#hasMinus) {
        this.#hasMinus = false
        operator = `-${operator}`
      }
      return new AstOperatorNode(operator)
    } else if (isVariableStart(char)) {
      this.#inputIterator.next()
      return this.readIdent("$")
    } else if (isIdStart(char)) {
      return this.readIdent()
    } else if (isPunctuation(char)) {
      let matches
      if (char === "(" && (matches = this.#inputIterator.getRestInput()?.match(ARRAY_LIST_REGEXP))) {
        this.#inputIterator.next()
        let item = this.readNext()
        let listElements = []
        while (item && !(item instanceof AstPunctuationNode && item.value === ")")) {
          listElements.push(item)
          item = this.readNext()
        }
        return new AstArrayNode(listElements)
      }

      return new AstPunctuationNode(this.#inputIterator.next())
    }

    this.#inputIterator.throwError("Can't handle character: " + char)
  }

  /**
   * @returns {AstParamExpansionNode|false}
   */
  #getParamExpansion() {
    const regexp = new RegExp(`^${PARAM_EXPANSION_REGEXP.source}`, "gm")
    if (regexp.test(this.#inputIterator.getRestInput())) {
      return new AstParamExpansionNode(this.readEscaped(`"`))
    }
    return false
  }

  /**
   * @returns {AstBraceExpansionNode|false}
   */
  #getBraceExpansion() {
    const regexp = new RegExp(`^${BRACE_EXPANSION_REGEXP.source}`, "gm")

    if (regexp.test(this.#inputIterator.getRestInput())) {
      return new AstBraceExpansionNode(this.readEscaped(`"`))
    }
    return false
  }

  /**
   * @override
   */
  peek() {
    return this.#current || (this.#current = this.readNext())
  }

  /**
   * @override
   */
  next() {
    const tok = this.#current
    this.#current = null
    return tok || this.readNext()
  }

  /**
   * @override
   */
  isEof() {
    return this.peek() == null
  }

  /**
   * @param {string} msg
   * @override
   */
  throwError(msg) {
    this.#inputIterator.throwError(msg)
  }
}

export default TokenIterator
