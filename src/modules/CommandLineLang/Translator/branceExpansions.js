import { evaluate } from "."
import { AstBraceExpansionNode, AstNode, AstVariableNode } from "../AstNodes"
import Environment from "../Environment"
import { VARIABLE_VALID_NAME_REGEXP } from "../InputIterator"

const isNumeric = (str) => /^-?[0-9]+(?:\.[0-9]+)?$/.test(str)

const VAR = VARIABLE_VALID_NAME_REGEXP.source
const findAndResolveVariable = (str, env) => {
  const match = str.match(new RegExp(`^\\\$${VAR}+`))
  if (!match) return str
  const variable = new AstVariableNode(match[0].substring(1), true)
  return evaluate(variable, env) ?? str
}

const commaSeparatedWithAfixes = (str, env) => {
  const regexp = new RegExp(`([^ {}]+)?(?:(?:(?:{)(.*\\\,[^,].*)(?:}))+)([^ ;{}\n]+)?`, "m")
  const match = str.match(regexp)
  if (!match) return

  let [, prefix = "", substrings, suffix = ""] = match
  prefix = findAndResolveVariable(prefix, env)
  suffix = findAndResolveVariable(suffix)

  substrings = substrings.split(",")
  return substrings.map((item) => `${prefix}${item}${suffix}`)
}

const numericRange = (str) => {
  const regexp = new RegExp(`{(-?[0-9]+(?:\.[0-9]+)?)\\\.\\\.(-?[0-9]+(?:\.[0-9]+)?)(?:\\\.\\\.([0-9.]+))?}`, "m")
  const match = str.match(regexp)
  if (!match) return

  let [_, from, to, step = 1] = match
  let pad, zeroMatch
  if ((zeroMatch = from.match(/^(0+)\d+/))) {
    pad = zeroMatch[1].length + 1
  }

  ;(from = parseFloat(from)), (to = parseFloat(to)), (step = parseFloat(step))
  if (Number.isNaN(step) || step == 0) step = 1

  if (!isNumeric(from) || !isNumeric(to)) {
    throw new Error(`Wrong range specified: "${_}"`)
  }

  const results = []
  if (from <= to) {
    for (let i = from; i <= to; i += step) results.push(i.toString().padStart(pad, "0"))
  } else {
    for (let i = from; i >= to; i -= step) results.push(i.toString().padStart(pad, "0"))
  }

  return results
}

const alphabetRange = (str) => {
  const alphabetLowercase = "abcdefghijklmnopqrstuvwxyz"
  const alphabetUppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"

  const proceed = (letters) => {
    const regexp = new RegExp(`{([a-zA-Z])\\\.\\\.([a-zA-Z])(?:\\\.\\\.([0-9.]+))?}`, "m")
    const match = str.match(regexp)
    if (!match) return

    let [_, from, to, step = 1] = match
    if (!letters.includes(from) || !letters.includes(to)) return
    const fromIndex = letters.indexOf(from),
      toIndex = letters.indexOf(to)

    step = parseFloat(step)
    if (Number.isNaN(step) || step == 0) step = 1

    const results = []
    if (fromIndex <= toIndex) {
      for (let i = fromIndex; i <= toIndex; i += step) results.push(letters.at(i))
    } else {
      for (let i = fromIndex; i >= toIndex; i -= step) results.push(letters.at(i))
    }
    return results.length ? results : null
  }

  return proceed(alphabetLowercase) ?? proceed(alphabetUppercase)
}

const simpleCommaSeparated = (str) => {
  const regexp = new RegExp(`^(?:(?:{)(.*\,[^,].*)(?:}))+$`, "m")
  const match = str.match(regexp)
  if (!match) return

  const [, substrings] = match
  return substrings.split(",")
}

/**
 *
 * @param {AstBraceExpansionNode} braceExpansion
 * @param {Environment} env
 * @returns {string}
 */
export const substituteBraceExpansion = (braceExpansion, env) => {
  const _substituteBraces = (str) => {
    let resultString
    resultString ??= simpleCommaSeparated(str, env)
    resultString ??= commaSeparatedWithAfixes(str, env)
    resultString ??= alphabetRange(str, env)
    resultString ??= numericRange(str, env)
    return resultString ?? str
  }

  const _substitudeVariables = (str) => {
    if (!str.includes("$")) return str
    let _str = str
    const getMatch = () => _str.match(new RegExp(`\\\$(${VARIABLE_VALID_NAME_REGEXP.source}+)`, "m"))
    let match
    while ((match = getMatch())) {
      const [_matchString, varName] = match
      const value = evaluate(new AstVariableNode(varName, true), env) ?? ""
      _str = _str.substring(0, match.index) + value + _str.substring(match.index + _matchString.length)
    }
    return _str
  }

  const _proceedBraces = (str) => {
    let prefix = str.match(/^[^{]+/)?.[0]
    let postfix = str.match(/[^}]+$/)?.[0]

    let results = []
    let _str = str.substring(prefix?.length ?? 0, str.length - (postfix?.length ?? 0))

    if (prefix?.length) prefix = _substitudeVariables(prefix)
    if (postfix?.length) postfix = _substitudeVariables(postfix)

    if (/^{[^{}]*({.+?}(?:\,{.+})?).*}$/.test(_str)) {
      _str = _str.substring(1, _str.length - 1)
      const _getMatch = () => _str.match(/([^{},]*{.+?}[^{},]*)(?:\,|$)/)?.[1]
      while (_str.length) {
        const match = _getMatch()
        _str = _str.substring(match.length + 1)
        results = results.concat(_proceedBraces(match).map((item) => `${prefix ?? ""}${item}${postfix ?? ""}`))
      }
      return results
    }

    const getBraceExp = () => _str.match(/^{.*?}/)?.[0]
    const getAffix = () => _str.match(/^[^{}]+/)?.[0]

    let match
    while (_str.length) {
      let _currentResults = []

      if ((match = getBraceExp())) {
        _currentResults = _substituteBraces(match)
      } else if ((match = getAffix())) {
        if (match?.length) match = _substitudeVariables(match)
        _currentResults = [match]
      }
      _str = _str.substring(match.length)

      if (!results.length) {
        results = _currentResults
      } else {
        /** Merge previous and current results */
        const _newResults = []
        for (let prevResult of results) {
          for (let currentResult of _currentResults) {
            _newResults.push(`${prevResult}${currentResult}`)
          }
        }
        results = _newResults
      }
    }

    /** Add prefix and postfix */
    if (prefix?.length || postfix?.length) {
      results = results.map((item) => `${prefix ?? ""}${item}${postfix ?? ""}`)
    }

    return results
  }

  return _proceedBraces(braceExpansion.value)
}
