const {
  wrapInSpaces,
  replaceWithCharacter,
  replaceWithNotAvailable
} = require('./string-utils')
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
    // contains all the projects, and some fake separators for project categories
    choices,
    // don't show numbers at the top of each entry
    renderScaleHeading() {
      return ''
    },
    scaleIndicator(choice, item, rowIndex) {
      let selectedRowIndex = this.index

      const optionName = scriptsList[item.index]
      const isScriptAvailable = (optionName) =>
        choice.availableScripts && choice.availableScripts.includes(optionName)

      let itemInRowIsSelected = choice.scaleIndex === item.index
      let rowIsFocused = selectedRowIndex === rowIndex

      const itemInRowIsDisabled = !isScriptAvailable(optionName)

      const allRowItemsAreDisabled =
        choice.availableScripts &&
        choice.scale.every(
          ({ index }) => !isScriptAvailable(scriptsList[index])
        )

      if (allRowItemsAreDisabled) {
        // all indexes are disabled, might as well make it unavailable
        choice.disabled = true
      }

      const rowIsDisabled = choice.disabled

      if (rowIsDisabled && !allRowItemsAreDisabled) {
        // this entire choice/row is disabled, which enquirer will ensure to skip selections
        // used for the fake separators
        return replaceWithCharacter(wrapInSpaces(optionName), '─')
      } else if (rowIsDisabled && allRowItemsAreDisabled) {
        // all options are unavailable
        return this.styles.yellow(
          wrapInSpaces(replaceWithNotAvailable(optionName, ' '))
        )
      } else if (itemInRowIsDisabled) {
        // this particular selection in the choice row is disabled
        if (rowIsFocused && itemInRowIsSelected) {
          return this.styles.strong(
            this.styles.magenta(
              wrapInSpaces(replaceWithNotAvailable(optionName, ' '))
            )
          )
        }
        if (itemInRowIsSelected)
          return this.styles.green(
            wrapInSpaces(replaceWithNotAvailable(optionName, ' '))
          )
        if (rowIsFocused)
          return this.styles.strong(
            wrapInSpaces(replaceWithNotAvailable(optionName, ' '))
          )
        return this.styles.yellow(
          wrapInSpaces(replaceWithNotAvailable(optionName, ' '))
        )
      }

      // row and item is available for selection
      if (rowIsFocused && itemInRowIsSelected) {
        return this.styles.strong(this.styles.magenta(wrapInSpaces(optionName)))
      }
      if (itemInRowIsSelected)
        return this.styles.strong(this.styles.green(wrapInSpaces(optionName)))
      if (rowIsFocused) return this.styles.white(wrapInSpaces(optionName))
      return this.styles.strong(this.styles.dark(wrapInSpaces(optionName)))
    },
    // the description above the items
    scale: scriptsList.map((name) => ({
      name,
      message: ''
    }))
  })
