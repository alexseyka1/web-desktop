import {
  AstBinaryNode,
  AstAssignNode,
  AstBooleanNode,
  AstCallNode,
  AstIfNode,
  AstKeywordNode,
  AstFunctionNode,
  AstNode,
  AstOperatorNode,
  AstProgramNode,
  AstPunctuationNode,
  AstVariableNode,
  AstNumberNode,
  AstStringNode,
  AstForInLoopNode,
  AstForLoopNode,
  AstWhileLoopNode,
  AstBraceExpansionNode,
  AstArrayNode,
  AstParamExpansionNode,
  AstExecuteStringNode,
} from "./AstNodes"
import TokenIterator, { KEYWORDS } from "./TokenIterator"

const PRECEDENCE = {
  "*=": 1,
  "/=": 1,
  "%=": 1,
  "+=": 1,
  "-=": 1,
  "<<=": 1,
  ">>=": 1,
  "&=": 1,

  "=": 10,
  "||": 11,
  "&&": 12,
  "|": 13,
  "^": 14,
  "&": 15,

  "==": 20,
  "!=": 20,
  "<": 20,
  ">": 20,
  "<=": 20,
  ">=": 20,

  "+": 30,
  "-": 30,

  "*": 40,
  "/": 40,
  "%": 40,

  "**": 50,

  "!": 60,
  "~": 60,

  "++": 100,
  "--": 100,
}

export const isInstanceOf = (obj, parents) => {
  if (!Array.isArray(parents)) parents = [parents]
  return parents.reduce((result, parent) => result || obj instanceof parent, false)
}

class Parser {
  #tokenIterator

  /**
   * @param {TokenIterator} tokenIterator
   */
  constructor(tokenIterator) {
    this.#tokenIterator = tokenIterator
  }

  /**
   * @param {string|null} start
   * @param {string} stop
   * @param {string} separator
   * @param {Function} parser
   * @returns {string[]}
   */
  #delimited(start, stop, separator, parser) {
    let first = true
    const response = []

    if (start != null) this.#skipPunctuation(start)
    while (!this.#tokenIterator.isEof()) {
      if (this.#isPunctuation(stop)) break

      if (first) first = false
      else if (this.#isPunctuation(separator)) this.#skipPunctuation(separator)

      if (this.#isPunctuation(stop)) break
      response.push(parser())
    }

    this.#skipPunctuation(stop)
    return response
  }

  /**
   * @throws {Error}
   */
  #unexpected() {
    const json = JSON.stringify(this.#tokenIterator.peek())
    this.#tokenIterator.throwError(`Unexpected token: ${json}`)
  }

  /**
   * @returns {AstProgramNode}
   */
  #parseProg() {
    const prog = this.#delimited("{", "}", ";", this.#parseExpression.bind(this))
    if (prog.length == 0) return new AstBooleanNode(false)
    if (prog.length == 1) return prog[0]
    return new AstProgramNode(prog)
  }

  /**
   * @returns {AstNode}
   * @throws {Error}
   */
  #parseAtom() {
    return this.#maybeCall(() => {
      if (this.#isPunctuation("(")) {
        this.#tokenIterator.next()
        const exp = this.#parseExpression()
        this.#skipPunctuation(")")
        return exp
      }

      if (this.#isPunctuation("{")) return this.#parseProg()
      if (this.#isKeyword(KEYWORDS.IF)) return this.#parseIf()
      if (this.#isKeyword(KEYWORDS.TRUE) || this.#isKeyword(KEYWORDS.FALSE)) return this.#parseBool()
      if (this.#isKeyword(KEYWORDS.FUNCTION)) {
        this.#tokenIterator.next()
        return this.#parseFunction()
      }
      if (this.#isKeyword(KEYWORDS.FOR)) return this.#parseLoop(KEYWORDS.FOR)
      if (this.#isKeyword(KEYWORDS.WHILE)) return this.#parseLoop(KEYWORDS.WHILE)
      if (this.#isKeyword(KEYWORDS.UNSET)) return this.#parseUnsetVariable()

      const token = this.#tokenIterator.next()
      if (
        isInstanceOf(token, [
          AstBraceExpansionNode,
          AstOperatorNode,
          AstVariableNode,
          AstNumberNode,
          AstExecuteStringNode,
          AstStringNode,
          AstArrayNode,
          AstParamExpansionNode,
          AstBinaryNode,
        ])
      ) {
        return token
      }

      this.#unexpected()
    })
  }

  #parseForLoop() {
    /** C-style for loop */
    this.#skipPunctuation("(")
    const vars = this.#delimited("(", ";", ",", this.#parseExpression.bind(this))
    const conditions = this.#delimited(null, ";", ",", this.#parseExpression.bind(this))
    const steps = this.#delimited(null, ")", ",", this.#parseExpression.bind(this))
    this.#skipPunctuation(")")
    this.#skipPunctuation(";")

    if (this.#isKeyword(KEYWORDS.DO)) this.#skipKeyword(KEYWORDS.DO)
    else if (this.#isPunctuation("{")) this.#skipPunctuation("{")

    const body = this.#parseExpression()
    this.#skipPunctuation(";")

    if (this.#isKeyword(KEYWORDS.DONE)) this.#skipKeyword(KEYWORDS.DONE)
    else if (this.#isPunctuation("}")) this.#skipPunctuation("}")

    return new AstForLoopNode(vars, conditions, steps, body)
  }

  #parseLoop(type) {
    const parseBodyWithDoDone = () => {
      const prog = []

      this.#skipKeyword(KEYWORDS.DO)
      while (!this.#tokenIterator.isEof()) {
        if (this.#isKeyword(KEYWORDS.DONE)) break
        if (this.#isPunctuation(";")) this.#skipPunctuation(";")

        if (this.#isKeyword(KEYWORDS.DONE)) break
        prog.push(this.#parseExpression.call(this))
      }

      this.#skipKeyword(KEYWORDS.DONE)

      if (prog.length == 0) return new AstBooleanNode(false)
      if (prog.length == 1) return prog[0]
      return new AstProgramNode(prog)
    }
    const parseBodyWithCurlyBraces = () => this.#parseProg()

    this.#skipKeyword(type)
    if (type === KEYWORDS.FOR && this.#isPunctuation("(")) return this.#parseForLoop()

    /** Common for for/while loops */
    let conditions = []
    while (!this.#tokenIterator.isEof() && !this.#isKeyword(KEYWORDS.DO) && !this.#isPunctuation("{")) {
      conditions.push(this.#tokenIterator.peek())
      this.#tokenIterator.next()
    }
    conditions = conditions.filter((node) => !(node instanceof AstPunctuationNode) || node.value != ";")

    let body
    if (this.#isKeyword(KEYWORDS.DO)) body = parseBodyWithDoDone()
    else if (this.#isPunctuation("{")) body = parseBodyWithCurlyBraces()

    if (this.#isKeyword(KEYWORDS.DONE)) this.#skipKeyword(KEYWORDS.DONE)
    else if (this.#isPunctuation("}")) this.#skipPunctuation("}")

    /** For-in */
    if (type === KEYWORDS.FOR) {
      if (conditions[1] instanceof AstKeywordNode && conditions[1].value === KEYWORDS.IN) {
        const _variable = conditions.shift()
        conditions.shift() // remove `in` keyword
        let _range
        if (conditions.length === 1) _range = conditions.pop()
        else _range = new AstArrayNode(conditions)

        if (!isInstanceOf(_variable, [AstVariableNode, AstStringNode, AstBraceExpansionNode])) {
          this.#tokenIterator.throwError("Wrong for-in loop signature")
        }
        return new AstForInLoopNode(_variable, _range, body)
      } else {
        this.#tokenIterator.throwError("Wrong loop signature")
      }
    }

    return new AstWhileLoopNode(conditions, body)
  }

  /**
   * @returns {string}
   */
  #parseVarname() {
    const name = this.#tokenIterator.next()
    if (!(name instanceof AstVariableNode)) this.#tokenIterator.throwError("Expecting variable name")
    return name.value
  }

  #parseFunction() {
    const functionName = this.#parseVarname()
    let vars
    try {
      vars = this.#delimited("(", ")", ",", () => {
        return this.#maybeBinary(this.#parseAtom(), 0)
      })
    } catch (e) {
      vars = this.#parseExpression()
    }

    return new AstFunctionNode(functionName, vars, this.#parseExpression())
  }

  /**
   * @returns {AstBooleanNode}
   */
  #parseBool() {
    const value = (this.#tokenIterator.next().value + "").toLowerCase() == "true"
    return new AstBooleanNode(value)
  }

  /**
   * @returns {AstIfNode}
   */
  #parseIf() {
    this.#skipKeyword(KEYWORDS.IF)
    const cond = this.#parseExpression()
    if (!this.#isPunctuation("{")) this.#skipKeyword(KEYWORDS.THEN)
    const then = this.#parseExpression()
    let _else
    if (this.#isKeyword(KEYWORDS.ELSE)) {
      this.#tokenIterator.next()
      _else = this.#parseExpression()
    }
    return new AstIfNode(cond, then, _else)
  }

  /**
   * @returns {AstVariableNode}
   */
  #parseUnsetVariable() {
    this.#skipKeyword(KEYWORDS.UNSET)
    const variable = this.#parseExpression()
    return new AstAssignNode(variable, undefined)
  }

  /**
   * @returns {AstNode}
   */
  #parseExpression() {
    return this.#maybeCall(() => this.#maybeBinary(this.#parseAtom(), 0))
  }

  /**
   * @param {AstProgramNode} func
   * @returns {AstCallNode}
   */
  #parseCall(func) {
    let token
    let body = []
    while ((token = this.#tokenIterator.peek()) && !isInstanceOf(token, [AstPunctuationNode, AstOperatorNode])) {
      body.push(token)
      token = this.#tokenIterator.next()
    }
    return new AstCallNode(func, body)
  }

  /**
   * @returns {AstCallNode}
   */
  #maybeCall(expr) {
    expr = expr()
    const token = this.#tokenIterator.peek()
    if (expr instanceof AstVariableNode && !isInstanceOf(token, [AstKeywordNode, AstPunctuationNode, AstOperatorNode])) {
      return this.#parseCall(expr)
    }
    // if (isInstanceOf(token, [AstVariableNode /*AstBraceExpansionNode, AstNumberNode, AstStringNode*/])) return this.#parseCall(expr())
    return expr
  }

  /**
   * @param {AstNode} left
   * @param {number} myPrecedence
   */
  #maybeBinary(left, myPrecedence) {
    let token
    if ((token = this.#isOperator())) {
      const hisPrec = PRECEDENCE[token.value]
      if (hisPrec > myPrecedence) {
        this.#tokenIterator.next()

        let right
        if (!(this.#tokenIterator.peek() instanceof AstPunctuationNode)) {
          right = this.#maybeBinary(this.#parseAtom(), hisPrec)
        }
        const _node = token.value == "=" ? new AstAssignNode(left, right) : new AstBinaryNode(token, left, right)
        return this.#maybeBinary(_node, myPrecedence)
      }
    } else if (left instanceof AstVariableNode && !left.isUse && !left.index && this.#isPunctuation(";")) {
      /** Just function call without arguments */
      return new AstCallNode(left)
    }
    return left
  }

  /**
   * @param {string} char
   * @throws {Error}
   */
  #skipPunctuation(char) {
    if (this.#isPunctuation(char)) this.#tokenIterator.next()
    else this.#tokenIterator.throwError(`Expecting punctuation: "${char}" but have ` + JSON.stringify(this.#tokenIterator.peek()))
  }

  /**
   * @param {AstKeywordNode} keyword
   * @throws {Error}
   */
  #skipKeyword(keyword) {
    if (this.#isKeyword(keyword)) this.#tokenIterator.next()
    else this.#tokenIterator.throwError(`Expecting keyword: "${keyword}" but got "${JSON.stringify(this.#tokenIterator.peek())}"`)
  }

  /**
   * @param {AstPunctuationNode} char
   * @returns {AstPunctuationNode}
   */
  #isPunctuation = (char) => {
    const token = this.#tokenIterator.peek()
    if (token && token instanceof AstPunctuationNode && (!char || token.value == char)) return token
    return null
  }

  /**
   * @param {AstKeywordNode} keyword
   * @returns {AstKeywordNode}
   */
  #isKeyword(keyword) {
    const token = this.#tokenIterator.peek()
    if (token && token instanceof AstKeywordNode && (!keyword || token.value == keyword)) return token
    return null
  }

  /**
   * @param {AstOperatorNode} operator
   * @returns {AstOperatorNode}
   */
  #isOperator(operator) {
    const token = this.#tokenIterator.peek()
    if (token && token instanceof AstOperatorNode && (!operator || token.value == operator)) return token
    return null
  }

  /**
   * @returns {AstProgramNode}
   */
  parse() {
    const prog = []
    while (!this.#tokenIterator.isEof()) {
      prog.push(this.#parseExpression())
      if (!this.#tokenIterator.isEof()) this.#skipPunctuation(";")
    }
    return new AstProgramNode(prog)
  }
}

export default Parser
