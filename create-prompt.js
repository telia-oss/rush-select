const colors = require('ansi-colors')
const RushSelect = require('./prompt')

module.exports = (choices, scriptsList) =>
  new RushSelect({
    name: 'rush-select',
    message:
      (global.extraWarn ? global.extraWarn + '\n\n' : '') +
      'Select what to run. Use left/right arrows to change options, Enter key starts execution.',
    messageWidth: 150,
    styles: { primary: colors.grey },
    choices,
    // the description above the items
    scale: scriptsList.map((name) => ({
      name
    }))
  })
