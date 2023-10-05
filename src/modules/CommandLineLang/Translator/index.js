import {
  AstArrayNode,
  AstAssignNode,
  AstBinaryNode,
  AstBooleanNode,
  AstBraceExpansionNode,
  AstCallNode,
  AstExecuteStringNode,
  AstForInLoopNode,
  AstForLoopNode,
  AstFunctionNode,
  AstIfNode,
  AstKeywordNode,
  AstNode,
  AstNumberNode,
  AstOperatorNode,
  AstParamExpansionNode,
  AstProgramNode,
  AstStringNode,
  AstValueNode,
  AstVariableNode,
} from "../AstNodes"
import Environment from "../Environment"
import { deepCopy, quickParse } from "../Helpers"
import { NUMBER_RANGE_REGEXP } from "../InputIterator"
import { isInstanceOf } from "../Parser"
import { substituteBraceExpansion } from "./branceExpansions"
import { substituteParamExpansion } from "./parameterExpansions"

const getApplyOperator = (env) => {
  return (op, a, b) => {
    const num = (x) => {
      if (x == null) x = 0
      if (typeof x != "number") throw new Error("Expected number but got " + typeof x)
      return x
    }
    const div = (x) => {
      if (num(x) == 0) throw new Error("Divide by zero")
      return x
    }
    const ev = (obj) => evaluate(obj, env)

    switch (op.value) {
      case "+":
      case "+=":
        const [_a, _b] = [ev(a), ev(b)]
        if (typeof _a === "number" && typeof _b === "number") {
          return num(_a) + num(_b)
        } else if (typeof _a === "string" && typeof _b === "string") {
          return `${_a}${_b}`
        } else if (Array.isArray(_a) && Array.isArray(_b)) {
          return _a.concat(_b)
        }
        throw new Error(`You can not sum ${typeof a} and ${typeof b}`)
      case "-":
      case "-=":
        return num(ev(a)) - num(ev(b))
      case "*":
      case "*=":
        return num(ev(a)) * num(ev(b))
      case "/":
      case "/=":
        return num(ev(a)) / div(ev(b))
      case "%":
      case "%=":
        return num(ev(a)) % div(ev(b))
      case "&&":
        return ev(a) !== false && ev(b)
      case "||":
        const leftResult = ev(a)
        return leftResult !== false ? leftResult : ev(b)
      case "<":
        return num(ev(a)) < num(ev(b))
      case ">":
        return num(ev(a)) > num(ev(b))
      case "<=":
        return num(ev(a)) <= num(ev(b))
      case ">=":
        return num(ev(a)) >= num(ev(b))
      case "==":
        return ev(a) === ev(b)
      case "!=":
        return ev(a) !== ev(b)
      case "++":
        return num(ev(a)) + 1
      case "--":
        return num(ev(a)) - 1
    }
    throw new Error(`Can't apply operator ${JSON.stringify(op)}`)
  }
}

/**
 * @param {Environment} env
 * @param {AstFunctionNode} func
 * @returns {Function}
 */
const makeFunction = (env, func) => {
  return function (...args) {
    const scope = env.extend()
    scope.def("#", args.length)
    scope.def("*", args.join(" "))
    scope.def("@", args)

    for (let i = 0; i < func.args.length; ++i) {
      const token = func.args[i]
      let name = token,
        value = i < args.length ? args[i] : null

      if (token instanceof AstVariableNode) {
        name = token.value
      } else if (token instanceof AstAssignNode) {
        /** Argument with default value */
        name = token.left.value
        if (!value) value = evaluate(token.right)
      }

      scope.def(name, value)
    }

    for (let i = 0; i < args.length; i++) {
      scope.def(i + 1, args[i])
    }

    return evaluate(func.body, scope)
  }
}

/**
 * @param {AstNode} exp
 * @param {Environment} env
 */
export const evaluate = (exp, env) => {
  const applyOperator = getApplyOperator(env)

  switch (true) {
    case exp instanceof AstKeywordNode:
      return exp.value
    case exp instanceof AstOperatorNode:
      return null
    case exp instanceof AstNumberNode:
    case exp instanceof AstBooleanNode:
      return exp.value
    case exp instanceof AstExecuteStringNode:
      const parsed = quickParse(exp.value)
      return evaluate(parsed[0], env)
    case exp instanceof AstStringNode:
      if (exp.quote === `"`) return substituteParamExpansion(exp.value, env)
      return exp.value

    case exp instanceof AstParamExpansionNode:
      return substituteParamExpansion(exp.value, env)

    case exp instanceof AstBraceExpansionNode:
      return substituteBraceExpansion(exp, env)

    case exp instanceof AstVariableNode: {
      const result = env.get(exp.value)
      if (exp.index != null) {
        if (!result?.[exp.index]) throw new Error(`Undefined variable ${exp.value}[${exp.index}]`)
        return result[exp.index]
      }
      return result
    }

    case exp instanceof AstArrayNode: {
      if (!Array.isArray(exp.value)) return []
      /** @type {any[]} */
      const list = exp.value?.reduce(
        /** @param {AstValueNode} item */ (res, item) => {
          const _evaluated = evaluate(item, env)
          return res.concat(_evaluated)
        },
        []
      )

      if (list.some((item) => !Array.isArray(item))) return list.flat(1)
      return list
    }

    case exp instanceof AstAssignNode:
      if (!(exp.left instanceof AstVariableNode)) {
        console.log(exp)
        throw new Error("Cannot assign to " + JSON.stringify(exp.left))
      }

      const flattenArray = (arr) => {
        if (Array.isArray(arr) && arr.some((item) => Array.isArray(item))) {
          return arr.flat(1)
        }
        return arr
      }

      if (exp.left.index == null) {
        const _evaluated = flattenArray(evaluate(exp.right, env))
        return env.set(exp.left.value, deepCopy(_evaluated))
      }

      /** If variable is array */
      let leftValue = env.has(exp.left.value) ? env.get(exp.left.value) : {}
      if (typeof leftValue !== "object") leftValue = {}

      let _index = exp.left.index
      try {
        _index = evaluate(quickParse(exp.left.index)[0], env)
        if (_index == null) _index = exp.left.index
      } catch (e) {}

      if (typeof exp.right === "undefined") {
        delete leftValue[_index]
        if (Array.isArray(leftValue)) leftValue = leftValue.filter((item) => item)
      } else {
        leftValue[_index] = flattenArray(evaluate(exp.right, env))
      }
      return env.set(exp.left.value, deepCopy(leftValue))

    case exp instanceof AstBinaryNode:
      const result = applyOperator(exp.operator, exp.left, exp.right)

      if (exp?.readOnly) return result
      if (!(exp.left instanceof AstVariableNode)) return result
      return evaluate(new AstAssignNode(exp.left, new AstNumberNode(result)), env)

    case exp instanceof AstFunctionNode: {
      const func = makeFunction(env, exp)
      env.def(exp.name, func)
      return func
    }

    case exp instanceof AstIfNode:
      const cond = evaluate(exp.cond, env)
      if (cond !== false) return evaluate(exp.then, env)
      return exp.else ? evaluate(exp.else, env) : false

    case exp instanceof AstProgramNode: {
      let val = false
      exp.prog.forEach(function (exp) {
        val = evaluate(exp, env)
      })
      return val
    }

    case exp instanceof AstCallNode: {
      const func = evaluate(exp.func, env)
      switch (true) {
        case typeof func === "undefined":
        case func == null:
          throw new Error(`Undefined function "${exp.func.value}"`)
        case typeof func === "function":
          const _arguments = exp.args
            ?.map(function (arg) {
              // if (arg instanceof AstNode) {
              //   const resultString = substituteVariableValues(arg.value, env)
              //   arg = new AstStringNode(resultString)
              // }

              return evaluate(arg, env)
            })
            .flat()

          return func.apply(null, _arguments)
        default:
          return func
      }
    }

    case exp instanceof AstForLoopNode: {
      const { variables, conditions, steps, body } = exp
      const _loopEnv = env.extend()

      if (variables) variables.forEach((_var) => evaluate(_var, _loopEnv))
      const getCondResult = () =>
        conditions.reduce((res, cond) => {
          cond.readOnly = true
          return res && evaluate(cond, _loopEnv)
        }, true)
      const program = new AstProgramNode(Array.isArray(body) ? body : [body])

      while (getCondResult()) {
        evaluate(program, _loopEnv)
        if (steps) {
          steps.forEach((step) => _loopEnv.set(step.left.value, deepCopy(evaluate(step, _loopEnv))))
        }
      }

      break
    }

    case exp instanceof AstForInLoopNode: {
      if (!exp.body) return false
      const _loopEnv = env.extend()
      let result

      switch (true) {
        case exp.range instanceof AstParamExpansionNode: {
          let range = substituteParamExpansion(exp.range.value, _loopEnv)
          if (!Array.isArray(range) && typeof range === "string") range = [range]

          /** @type {AstVariableNode} */
          const variable = exp.variable
          _loopEnv.def(variable.value, null)
          for (let rangeItem of range || []) {
            _loopEnv.set(variable.value, deepCopy(rangeItem))
            result = evaluate(exp.body, _loopEnv)
          }
          break
        }
        case exp.range instanceof AstBraceExpansionNode: {
          /** @type {AstVariableNode} */
          const variable = exp.variable
          _loopEnv.def(variable.value, null)
          const range = substituteBraceExpansion(exp.range, _loopEnv)
          for (let rangeItem of range || []) {
            _loopEnv.set(variable.value, deepCopy(rangeItem))
            result = evaluate(exp.body, _loopEnv)
          }
          break
        }
        // case exp.range instanceof AstStringNode: {
        //   const range = evaluate(exp.range, env)
        //   console.log({ range })
        //   break
        // }
        case exp.range instanceof AstVariableNode && exp.range.isUse: {
          /** @type {AstVariableNode} */
          const variable = exp.variable
          const variableValue = env.get(exp.range.value)
          if (typeof variableValue !== "object") throw new Error(`${exp.range.value} is not an array`)
          _loopEnv.def(variable.value, null)
          for (let rangeItem of Object.values(variableValue)) {
            _loopEnv.set(variable.value, deepCopy(rangeItem))
            result = evaluate(exp.body, _loopEnv)
          }
          break
        }
        case exp.range instanceof AstArrayNode: {
          /** @type {AstVariableNode} */
          const variable = exp.variable
          _loopEnv.def(variable.value, null)
          for (let rangeItem of Object.values(exp.range.value)) {
            const item = env.has(rangeItem.value) ? evaluate(rangeItem, env) : rangeItem.value
            _loopEnv.set(variable.value, deepCopy(item))
            result = evaluate(exp.body, _loopEnv)
          }
          break
        }
        default:
          throw new Error(`Wrong for-in range specified "${JSON.stringify(exp.range)}"`)
      }

      return result
    }

    default:
      console.log("ERROR", { exp })
      throw new Error(`I don't know how to evaluate ${exp?.type ?? "unknown"}`)
  }
}
