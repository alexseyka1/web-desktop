const AST_NODE_TYPES = {
  KEYWORD: "keyword",
  OPERATOR: "operator",
  PUNCTUATION: "punctuation",
  NUMBER: "number",
  STRING: "string",
  BOOLEAN: "boolean",
  VARIABLE: "variable",
  FUNCTION: "function",
  CALL: "call",
  IF: "if",
  ASSIGN: "assign",
  BINARY: "binary",
  PROGRAM: "prog",
  LOOP: "loop",
  PARAM_EXPANSION: "param-expansion",
  BRACE_EXPANSION: "brace-expansion",
  ARRAY: "array",
}

export class AstNode {
  constructor(type) {
    this.type = type
  }
}

export class AstValueNode extends AstNode {
  constructor(type, value) {
    super(type)
    this.value = value
  }
}

export class AstWithOperatorNode extends AstNode {
  /**
   * @param {string} type
   * @param {AstOperatorNode} operator
   * @param {AstNode} left
   * @param {AstNode} right
   */
  constructor(type, operator, left, right) {
    super(type)
    this.operator = operator
    this.left = left
    this.right = right
  }
}

export class AstKeywordNode extends AstValueNode {
  constructor(value) {
    super(AST_NODE_TYPES.KEYWORD, value)
  }
}

export class AstOperatorNode extends AstValueNode {
  constructor(value) {
    super(AST_NODE_TYPES.OPERATOR, value)
  }
}

export class AstPunctuationNode extends AstValueNode {
  constructor(value) {
    super(AST_NODE_TYPES.PUNCTUATION, value)
  }
}

export class AstNumberNode extends AstValueNode {
  constructor(value) {
    super(AST_NODE_TYPES.NUMBER, value)
  }
}

export class AstParamExpansionNode extends AstValueNode {
  constructor(value) {
    super(AST_NODE_TYPES.PARAM_EXPANSION, value)
  }
}

export class AstBraceExpansionNode extends AstValueNode {
  constructor(value) {
    super(AST_NODE_TYPES.BRACE_EXPANSION, value)
  }
}

export class AstStringNode extends AstValueNode {
  constructor(value, quote) {
    super(AST_NODE_TYPES.STRING, value)
    this.quote = quote
  }
}

export class AstBooleanNode extends AstValueNode {
  constructor(value) {
    super(AST_NODE_TYPES.BOOLEAN, value)
  }
}

export class AstVariableNode extends AstValueNode {
  constructor(name, isUse = false, index) {
    super(AST_NODE_TYPES.VARIABLE, name)
    this.isUse = isUse
    this.index = index
  }
}

export class AstArrayNode extends AstValueNode {
  constructor(values) {
    super(AST_NODE_TYPES.ARRAY, values)
  }
}

export class AstFunctionNode extends AstNode {
  /**
   * @param {string[]} args
   * @param {AstNode} body
   */
  constructor(name, args, body) {
    super(AST_NODE_TYPES.FUNCTION)
    this.name = name
    this.args = args
    this.body = body
  }
}

export class AstCallNode extends AstNode {
  /**
   * @param {AstNode} func
   * @param {AstNode[]} args
   */
  constructor(func, args) {
    super(AST_NODE_TYPES.CALL)
    this.func = func
    this.args = args
  }
}

export class AstIfNode extends AstNode {
  /**
   * @param {AstNode} cond
   * @param {AstNode} _then
   * @param {AstNode} _else
   */
  constructor(cond, _then, _else) {
    super(AST_NODE_TYPES.IF)
    this.cond = cond
    this.then = _then
    this.else = _else
  }
}

export class AstAssignNode extends AstWithOperatorNode {
  /**
   * @param {AstNode} left
   * @param {AstNode} right
   */
  constructor(left, right) {
    super(AST_NODE_TYPES.ASSIGN, new AstOperatorNode("="), left, right)
  }
}

export class AstBinaryNode extends AstWithOperatorNode {
  /**
   * @param {AstOperatorNode} operator
   * @param {AstNode} left
   * @param {AstNode} right
   */
  constructor(operator, left, right) {
    super(AST_NODE_TYPES.BINARY, operator, left, right)
  }
}

export class AstProgramNode extends AstNode {
  /**
   * @param {AstNode[]} prog
   */
  constructor(prog) {
    super(AST_NODE_TYPES.PROGRAM)
    this.prog = prog
  }
}

export class AstForInLoopNode extends AstNode {
  /**
   * @param {AstVariableNode} variable
   * @param {AstStringNode} range
   * @param {AstNode} body
   */
  constructor(variable, range, body) {
    super(AST_NODE_TYPES.LOOP)
    this.variable = variable
    this.range = range
    this.body = body
  }
}

export class AstForLoopNode extends AstNode {
  /**
   * C-style for loop
   * @param {AstVariableNode[]} variables
   * @param {AstBinaryNode[]} conditions
   * @param {AstBinaryNode[]} steps
   * @param {AstNode} body
   */
  constructor(variables, conditions, steps, body) {
    super(AST_NODE_TYPES.LOOP)
    this.variables = variables
    this.conditions = conditions
    this.steps = steps
    this.body = body
  }
}

export class AstWhileLoopNode extends AstNode {
  /**
   * @param {AstBinaryNode[]} conditions
   * @param {AstNode} body
   */
  constructor(conditions, body) {
    super(AST_NODE_TYPES.LOOP)
    this.conditions = conditions
    this.body = body
  }
}
