// Utility functions for string operations
module.exports = {
  wrapInSpaces: (text, spaceCharacter = ' ') =>
    spaceCharacter + text + spaceCharacter,

  replaceWithCharacter: (text, character = ' ') =>
    text.replace(/./g, character),

  replaceWithNotAvailable: (text) => {
    var notAvailableText = 'n/a'
    let result = ''

    result += ''.padStart(
      Math.floor(text.length / 2 - notAvailableText.length / 2),
      ' '
    )
    result += notAvailableText
    result += ''.padEnd(
      Math.ceil(text.length / 2 - notAvailableText.length / 2),
      ' '
    )
    return result
  }
}
