import { AstProgramNode } from "./AstNodes"
import InputIterator from "./InputIterator"
import Parser from "./Parser"
import TokenIterator from "./TokenIterator"

/**
 * @param {string} string
 * @returns {AstProgramNode}
 */
export const quickParse = (string) => {
  const inputIterator = new InputIterator(string)
  const tokenIterator = new TokenIterator(inputIterator)
  const parser = new Parser(tokenIterator)
  return parser.parse().prog
}
