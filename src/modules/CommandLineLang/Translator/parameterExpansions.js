import { evaluate } from "."
import { AstNode, AstStringNode, AstVariableNode } from "../AstNodes"
import Environment from "../Environment"
import { NUMBER_REGEXP, VARIABLE_VALID_NAME_REGEXP } from "../InputIterator"

export class UserRequestedError extends Error {}

const VAR = VARIABLE_VALID_NAME_REGEXP.source
/**
 * @param {string} string
 * @param {RegExp} regexp
 * @returns {string}
 */
const matchIterator = function* (string, regexp) {
  let resultString = string
  const getNextVariable = () => (typeof resultString === "string" ? resultString.match(regexp) : null)
  let match
  while ((match = getNextVariable())) {
    let replacer = yield match
    if (typeof replacer === "string") {
      resultString = resultString.replace(match[0], replacer)
    } else {
      resultString = replacer
    }
  }
  return resultString
}

const isNumeric = (str) => /^-?[0-9]+(?:\.[0-9]+)?$/.test(str)

/**
 * @param {string} str
 * @param {Environment} env
 * @example echo "${name:0:2}"    #=> "John" -> "Jo"
 * @example echo "${name::2}"     #=> "John" -> "Jo"
 * @example echo "${name::-1}"    #=> "John" -> "Joh"
 * @example length = 2
 *          echo "${name:0:length}"  #=> "Jo"
 */
const substitudeSlicing = (str, env) => {
  const regexp = new RegExp(`\\\${(${VAR}+):((?:-?[0-9]*)|(?:${VAR}*))(?::((?:-?[0-9]+)|(?:${VAR}+)))?}`, "m")
  const iterator = matchIterator(str, regexp)
  let iterate = iterator.next()
  while (!iterate.done) {
    let [, variableName, from = 0, to] = iterate.value
    /** If variables are specified instead of numeric values */
    if (typeof from === "string" && !isNumeric(from)) from = evaluate(new AstVariableNode(from), env)
    if (typeof to === "string" && !isNumeric(to)) to = evaluate(new AstVariableNode(to), env)
    ;[from, to] = [isNumeric(from) ? parseInt(from) : 0, isNumeric(to) ? parseInt(to) : 0]

    let value = evaluate(new AstVariableNode(variableName), env)
    value = value.slice(from, from + to)
    iterate = iterator.next(value)
  }

  return iterate.value
}

/**
 * @param {string} str
 * @param {Environment} env
 * @example echo "${name:(-1)}"   #=> "John" -> "n"
 * @example echo "${name:(-2):1}" #=> "John" -> "h"
 * @example echo "${name: -2:1}" #=> "John" -> "h"
 */
const substitudeSlicingRight = (str, env) => {
  const regexp = new RegExp(`\\\${(${VAR}+):[\\\(|\\\s]((?:-?[0-9]+)|(?:${VAR}+))\\\)?(?::((?:-?[0-9]+)|(?:${VAR}+)))?}`, "m")
  const iterator = matchIterator(str, regexp)
  let iterate = iterator.next()
  while (!iterate.done) {
    let [, variableName, from = 0, to] = iterate.value
    /** If variables are specified instead of numeric values */
    if (typeof from === "string" && !isNumeric(from)) from = evaluate(new AstVariableNode(from), env)
    if (typeof to === "string" && !isNumeric(to)) to = evaluate(new AstVariableNode(to), env)
    ;[from, to] = [isNumeric(from) ? parseInt(from) : 0, isNumeric(to) ? parseInt(to) : 0]

    let value = evaluate(new AstVariableNode(variableName), env) + ""
    const actualTo = !to ? undefined : value.length + from + to
    value = value.slice(from, actualTo)

    iterate = iterator.next(value)
  }

  return iterate.value
}

/**
 * @param {string} str
 * @param {Environment} env
 * @example echo "${name/J/j}" #=> "John James" -> "john James" #=> replace first match
 * @example echo "${name//J/j}" #=> "John James" -> "john james" #=> replace all
 * @example echo "${name/%Jo/ja}" #=> "John James" -> "jahn James" #=> replace prefix
 * @example echo "${name/#es/y}" #=> "John James" -> "John jamy" #=> replace suffix
 */
const substitudeRegexpReplace = (str, env) => {
  if (typeof str !== "string") return str

  const regexp = new RegExp(`\\\${(${VAR}+)(\/[%|#]|\/{1,2})(.*)\/(.*)}`, "m")
  const iterator = matchIterator(str, regexp)
  let iterate = iterator.next()
  while (!iterate.done) {
    let [, variableName, separator, from, to] = iterate.value

    const keys = (separator.length === 2 ? "g" : "") + "m"
    if (separator[1] === "%") from = `^${from}`
    else if (separator[1] === "#") from = `${from}$`

    const fromRegexp = new RegExp(from, keys)
    const value = evaluate(new AstVariableNode(variableName), env).replace(fromRegexp, to)
    iterate = iterator.next(value)
  }

  return iterate.value
}

/**
 * @param {string} str
 * @param {Environment} env
 * @example echo "${food:-Cake}"  #=> $food or "Cake"
 */
const substitudeDefaultValue = (str, env) => {
  if (typeof str !== "string") return str

  const regexp = new RegExp(`\\\${(${VAR}+):?([-=+?])(.+)}`, "m")
  const iterator = matchIterator(str, regexp)
  let iterate = iterator.next()
  while (!iterate.done) {
    const [, variableName, separator, defaultValue] = iterate.value
    const value = evaluate(new AstVariableNode(variableName), env)
    const getReplacement = () => evaluate(new AstVariableNode(defaultValue), env) ?? defaultValue

    switch (separator) {
      case "=":
        if (value == null) {
          const replacement = getReplacement()
          env.set(variableName, replacement)
          iterate = iterator.next(replacement)
        } else {
          iterate = iterator.next(value)
        }
        break
      case "+":
        if (value != null) iterate = iterator.next(getReplacement())
        else iterate = iterator.next(value)
        break
      case "?":
        if (value == null) throw new UserRequestedError(defaultValue)
        else iterate = iterator.next(value)
        break
      case "-":
      default:
        iterate = iterator.next(value ?? getReplacement())
    }
  }

  return iterate.value
}

/**
 * @param {string} str
 * @param {Environment} env
 * @see https://wiki.bash-hackers.org/syntax/pe#substring_removal
 * @example str = "Be liberal in what you accept, and conservative in what you send"
 *          echo "${str%in*}"
 *          echo "${str%%in*}"
 *          echo "${str/%in*}"
 *          echo "${str#*in}"
 *          echo "${str##*in}"
 *          echo "${str/#*in}"
 * @example base=${src##*\/} #=> "foo.cpp" (basepath)
 *          dir=${src%$base} #=> "/path/to/" (dirpath)
 */
const substringRemoval = (str, env) => {
  if (typeof str !== "string") return str

  const regexp = new RegExp(`\\\${(${VAR}+)([%|#]{1,2}|\\\/[%|#])(.*)}`, "m")
  const iterator = matchIterator(str, regexp)
  let iterate = iterator.next()
  while (!iterate.done) {
    let [, variableName, separator, template] = iterate.value
    const isPrefix = separator[separator.length - 1] === "#"
    const isLong = separator.length === 2
    let value = evaluate(new AstVariableNode(variableName), env)
    if (value instanceof AstStringNode) value = value.value
    template = template.replace(/([^\\])?\//g, "$1\\/").replace(/([^\/])\./g, "$1\\.")
    template = substitudeSimpleVariable(template, env)

    if (isPrefix) {
      /** Prefix */
      if (isLong) template = template.replace(/([^\.])?\*/g, "$1.*")
      else template = template.replace(/([^\.])?\*/g, "$1.*?")
      iterate = iterator.next(value.replace(new RegExp(`^${template}`), ""))
    } else {
      /** Suffix */
      template = template.replace(/([^\.])\*/g, "$1.*")
      if (isLong) iterate = iterator.next(value.replace(new RegExp(`${template}$`), ""))
      else iterate = iterator.next(value.replace(new RegExp(`(.*)(${template})$`), "$1"))
    }
  }

  return iterate.value
}

/**
 * @param {string} str
 * @param {Environment} env
 * @example echo "${name/J/j}" #=> "John James" -> "john James" #=> replace first match
 * @example echo "${name//J/j}" #=> "John James" -> "john james" #=> replace all
 * @example echo "${name/%Jo/ja}" #=> "John James" -> "jahn James" #=> replace prefix
 * @example echo "${name/#es/y}" #=> "John James" -> "John jamy" #=> replace suffix
 */
const substitudeStringManipulation = (str, env) => {
  if (typeof str !== "string") return str

  const regexp = new RegExp(`\\\${(${VAR}+)([,|\^]{1,2})}`, "m")
  const iterator = matchIterator(str, regexp)
  let iterate = iterator.next()
  while (!iterate.done) {
    const [, variableName, separator] = iterate.value
    let value = evaluate(new AstVariableNode(variableName), env)

    if (separator[0] === ",") {
      if (separator.length === 1) value = value[0].toLocaleLowerCase() + value.substring(1)
      else value = value.toLocaleLowerCase()
    } else if (separator[0] === "^") {
      if (separator.length === 1) value = value[0].toLocaleUpperCase() + value.substring(1)
      else value = value.toLocaleUpperCase()
    }

    iterate = iterator.next(value)
  }

  return iterate.value
}

/**
 * @param {string} str
 * @param {Environment} env
 * @see https://wiki.bash-hackers.org/syntax/pe#simple_usage
 * @example echo "$name"
 * @example echo "${name}"
 */
const substitudeSimpleVariable = (str, env) => {
  if (typeof str !== "string") return str

  const regexp = new RegExp(`\\\${?([#\!]?)(${VAR}+)}?`, "m")
  const iterator = matchIterator(str, regexp)
  let iterate = iterator.next()
  while (!iterate.done) {
    const [, prefix, variableName] = iterate.value
    const value = evaluate(new AstVariableNode(variableName), env)
    let commitValue = value

    if (Array.isArray(value) && prefix === "#") {
      commitValue = value[0]?.length || 0
    }

    iterate = iterator.next(commitValue)
  }

  return iterate.value
}

/**
 * @param {string} str
 * @param {Environment} env
 * @see https://wiki.bash-hackers.org/syntax/pe#string_length
 * @example name = "Alex"; echo "${#name}" #=> 4
 */
const substitudeVariableLength = (str, env) => {
  if (typeof str !== "string") return str

  const regexp = new RegExp(`\\\${#(${VAR}+)}?`, "m")
  const iterator = matchIterator(str, regexp)
  let iterate = iterator.next()
  while (!iterate.done) {
    const [, variableName] = iterate.value
    const value = evaluate(new AstVariableNode(variableName), env)

    if (Array.isArray(value)) {
      iterate = iterator.next(value[0].length)
    } else {
      iterate = iterator.next((value + "").length)
    }
  }

  return iterate.value
}

/**
 * @param {string} str
 * @param {Environment} env
 * @see https://wiki.bash-hackers.org/syntax/pe#simple_usage
 * @example echo "$name[0]"
 * @example echo "${name[3]}"
 * @example echo "${name[-1]}"
 * @example echo "${name[@]}"
 * @example echo "${#name[@]}"
 * @example echo "${#name[3]}"
 * @example echo "${#name[@]:3:2}"
 * @example echo "${name[@]/Ap*\/}"
 */
const substitudeArrayElement = (str, env) => {
  if (typeof str !== "string") return str

  const regexp = new RegExp(`\\\${?([#\!]?)(${VAR}+)\\\[(-?[0-9@]+)\\\](?:\:(-?[0-9]+)\:([0-9]+))?(?:\\\/(.+)\\\/)?}?`, "m")
  const iterator = matchIterator(str, regexp)
  let iterate = iterator.next()
  while (!iterate.done) {
    const [, prefix, variableName, index, sliceFrom, sliceLength, removeRegexp] = iterate.value
    const value = evaluate(new AstVariableNode(variableName), env)
    let commitValue = value

    if (Array.isArray(value)) {
      if (NUMBER_REGEXP.test(index)) {
        if (prefix === "#") {
          commitValue = value?.at(index)?.length || 0
        } else {
          commitValue = value?.at(index) || null
        }
      } else if (index === "@") {
        let preparedValue = value
        if (removeRegexp != null) {
          try {
            const preparedRegexp = new RegExp(`${removeRegexp.replace(/\*/g, ".*")}`)
            preparedValue = preparedValue.filter((item) => !preparedRegexp.test(item))
          } catch (e) {
            throw new Error(`Invalid regexp specified: ${removeRegexp}`)
          }
        }

        if (prefix === "#") {
          commitValue = preparedValue.length
        } else if (prefix === "!") {
          commitValue = Object.keys(preparedValue)
        } else if (sliceFrom != null && sliceLength != null) {
          commitValue = preparedValue.slice(sliceFrom, +sliceFrom + +sliceLength)
        } else {
          commitValue = preparedValue
        }
      }
    }

    iterate = iterator.next(commitValue)
  }

  return iterate.value
}

/**
 *
 * @param {AstNode} value
 * @param {Environment} env
 * @param {boolean} isReturnArray
 * @returns {string}
 */
export const substituteParamExpansion = (value, env, isReturnArray = false) => {
  let resultString = value
  let resultArray = []

  const proceed = (string) => {
    let result = string
    result = substitudeRegexpReplace(result, env)
    result = substitudeSlicing(result, env)
    result = substitudeSlicingRight(result, env)
    result = substitudeDefaultValue(result, env)
    result = substringRemoval(result, env)
    result = substitudeStringManipulation(result, env)
    /** This functions must be called last */
    result = substitudeArrayElement(result, env, resultArray)
    result = substitudeVariableLength(result, env)
    result = substitudeSimpleVariable(result, env)
    return result
  }

  // let beforeProceed
  // do {
  //   beforeProceed = resultString
  resultString = proceed(resultString)
  // } while (resultString !== beforeProceed)

  if (isReturnArray) return resultArray
  else return resultString
}
