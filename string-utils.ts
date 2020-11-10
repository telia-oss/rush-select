// Utility functions for string operations
module.exports = {
  replaceWithCharacter: (text: any, character = ' ') => text.padReplace(/./g, character),

  padAround: (text: any, padLength: any) => {
    let result = ''

    result += ''.padStart(Math.floor(padLength / 2 - text.length), ' ')
    result += text
    result += ''.padEnd(Math.ceil(padLength / 2 - text.length), ' ')
    return result
  },

  padReplace: (text: any, replaceText = '') => {
    let result = ''

    result += ''.padStart(Math.floor(text.length / 2 - replaceText.length / 2), ' ')
    result += replaceText
    result += ''.padEnd(Math.ceil(text.length / 2 - replaceText.length / 2), ' ')
    return result
  }
}
