// Utility functions for string operations
// export const replaceWithCharacter = (text: string, character = ' ') =>
//   text.padReplace(/./g, character)

export const padAround = (text: string, padLength: number) => {
  let result = ''

  result += ''.padStart(Math.floor(padLength / 2 - text.length), ' ')
  result += text
  result += ''.padEnd(Math.ceil(padLength / 2 - text.length), ' ')
  return result
}

export const padReplace = (text: string, replaceText = '') => {
  let result = ''

  result += ''.padStart(Math.floor(text.length / 2 - replaceText.length / 2), ' ')
  result += replaceText
  result += ''.padEnd(Math.ceil(text.length / 2 - replaceText.length / 2), ' ')
  return result
}
