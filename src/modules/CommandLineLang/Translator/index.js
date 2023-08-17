import {
  AstArrayNode,
  AstAssignNode,
  AstBinaryNode,
  AstBooleanNode,
  AstBraceExpansionNode,
  AstCallNode,
  AstForInLoopNode,
  AstForLoopNode,
  AstFunctionNode,
  AstIfNode,
  AstNode,
  AstNumberNode,
  AstProgramNode,
  AstStringNode,
  AstVariableNode,
} from "../AstNodes"
import Environment from "../Environment"
import { NUMBER_RANGE_REGEXP } from "../InputIterator"
import { isInstanceOf } from "../Parser"
import { substituteBraceExpansion } from "./branceExpansions"
import { substituteVariableValues } from "./parameterExpansions"

const applyOperator = (op, a, b) => {
  const num = (x) => {
    if (typeof x != "number") throw new Error("Expected number but got " + x)
    return x
  }
  const div = (x) => {
    if (num(x) == 0) throw new Error("Divide by zero")
    return x
  }

  switch (op.value) {
    case "+":
    case "+=":
      return num(a) + num(b)
    case "-":
    case "-=":
      return num(a) - num(b)
    case "*":
    case "*=":
      return num(a) * num(b)
    case "/":
    case "/=":
      return num(a) / div(b)
    case "%":
    case "%=":
      return num(a) % div(b)
    case "&&":
      return a !== false && b
    case "||":
      return a !== false ? a : b
    case "<":
      return num(a) < num(b)
    case ">":
      return num(a) > num(b)
    case "<=":
      return num(a) <= num(b)
    case ">=":
      return num(a) >= num(b)
    case "==":
      return a === b
    case "!=":
      return a !== b
    case "++":
      return num(a) + 1
    case "--":
      return num(a) - 1
  }
  throw new Error(`Can't apply operator ${JSON.stringify(op)}`)
}

/**
 * @param {Environment} env
 * @param {AstFunctionNode} func
 * @returns {Function}
 */
const makeFunction = (env, func) => {
  return function (...args) {
    const scope = env.extend()
    for (let i = 0; i < func.args.length; ++i) {
      const token = func.args[i]
      let name = token,
        value = i < args.length ? args[i] : null

      if (token instanceof AstVariableNode) {
        name = token.name
      } else if (token instanceof AstAssignNode) {
        /** Argument with default value */
        name = token.left.value
        if (!value) value = evaluate(token.right)
      }

      scope.def(name, value)
    }
    return evaluate(func.body, scope)
  }
}

/**
 * @param {AstNode} exp
 * @param {Environment} env
 */
export const evaluate = (exp, env) => {
  switch (true) {
    case exp instanceof AstNumberNode:
    case exp instanceof AstBooleanNode:
      return exp.value
    case exp instanceof AstStringNode:
      if (exp.quote === `"`) return substituteVariableValues(exp.value, env)
      return exp.value

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

    case exp instanceof AstAssignNode:
      if (!(exp.left instanceof AstVariableNode)) throw new Error("Cannot assign to " + JSON.stringify(exp.left))
      if (exp.left.index == null) return env.set(exp.left.value, evaluate(exp.right, env))

      /** If variable is array */
      let leftValue = env.has(exp.left.value) ? env.get(exp.left.value) : {}
      if (typeof leftValue !== "object") leftValue = {}
      leftValue[exp.left.index] = evaluate(exp.right, env)
      return env.set(exp.left.value, leftValue)

    case exp instanceof AstBinaryNode:
      const result = applyOperator(exp.operator, evaluate(exp.left, env), exp?.right ? evaluate(exp.right, env) : null)
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
      if (typeof func !== "function") {
        throw new Error(`Undefined function "${exp.func.value}"`)
      }

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
    }

    case exp instanceof AstForLoopNode: {
      const { variables, conditions, steps, body } = exp
      const _loopEnv = env.extend()

      if (variables) variables.forEach((_var) => evaluate(_var, _loopEnv))
      const getCondResult = () => conditions.reduce((res, cond) => res && evaluate(cond, _loopEnv), true)
      const program = new AstProgramNode(Array.isArray(body) ? body : [body])

      while (getCondResult()) {
        evaluate(program, _loopEnv)
        if (steps) {
          steps.forEach((step) => _loopEnv.set(step.left.value, evaluate(step, _loopEnv)))
        }
      }

      break
    }

    case exp instanceof AstForInLoopNode: {
      if (!exp.body) return false
      const _loopEnv = env.extend()
      let result

      switch (true) {
        case exp.range instanceof AstBraceExpansionNode: {
          /** @type {AstVariableNode} */
          const variable = exp.variable
          _loopEnv.def(variable.value, null)
          const range = substituteBraceExpansion(exp.range, _loopEnv)
          for (let rangeItem of range) {
            _loopEnv.set(variable.value, rangeItem)
            result = evaluate(exp.body, _loopEnv)
          }
          break
        }
        case exp.range instanceof AstVariableNode && exp.range.isUse: {
          /** @type {AstVariableNode} */
          const variable = exp.variable
          const variableValue = env.get(exp.range.value)
          if (typeof variableValue !== "object") throw new Error(`${exp.range.value} is not an array`)
          _loopEnv.def(variable.value, null)
          for (let rangeItem of Object.values(variableValue)) {
            _loopEnv.set(variable.value, rangeItem)
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
            _loopEnv.set(variable.value, item)
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
