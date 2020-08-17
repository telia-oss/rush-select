// Utility functions for string operations
module.exports = {
  replaceWithCharacter: (text, character = ' ') => text.padReplace(/./g, character),

  padReplace: (text, replaceText = '') => {
    let result = ''

    result += ''.padStart(Math.floor(text.length / 2 - replaceText.length / 2), ' ')
    result += replaceText
    result += ''.padEnd(Math.ceil(text.length / 2 - replaceText.length / 2), ' ')
    return result
  }
}
