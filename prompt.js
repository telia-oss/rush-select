const colors = require('ansi-colors')
const stripAnsi = require('strip-ansi')
// const ansiStyles = require('ansi-styles')
const ArrayPrompt = require('enquirer/lib/types/array')
const utils = require('enquirer/lib/utils')
const fuzzy = require('fuzzy')

class RushSelect extends ArrayPrompt {
  constructor(options = {}) {
    options.ignoreText = options.ignoreText || 'ignore'
    options.uncategorizedText = options.uncategorizedText || 'uncategorized'

    options.scale.unshift({
      name: options.ignoreText
    })

    super(options)

    this.widths = [].concat(options.messageWidth || 50)
    this.align = [].concat(options.align || 'left')
    this.linebreak = options.linebreak || false
    this.edgeLength = options.edgeLength || 3
    this.newline = options.newline || '\n   '
    let start = options.startNumber || 1
    if (typeof this.scale === 'number') {
      this.scaleKey = false
      this.scale = Array(this.scale)
        .fill(0)
        .map((v, i) => ({ name: i + start }))
    }

    options.executionGroups.forEach((executionGroup, index) => {
      this.choices.unshift({
        ...executionGroup,
        name: executionGroup.name,
        scriptExecutable: executionGroup.scriptExecutable,
        scriptCommand: executionGroup.scriptCommand,
        initial:
          executionGroup.initial !== undefined
            ? this.scale.length + executionGroup.initial - 1
            : -1,
        category: executionGroup.category,
        allowMultipleScripts: executionGroup.allowMultipleScripts,
        scriptNames: executionGroup.scriptNames,
        executionGroupIndex: index,
        availableScripts: executionGroup.scriptNames
      })

      this.scale = [
        ...this.scale,
        ...executionGroup.scriptNames.map((name) => ({ name, executionGroupIndex: index }))
      ]
    })

    this.choices.forEach((choice) => {
      // ensure _some_ category exists
      choice.category = choice.category || this.options.uncategorizedText

      // add "ignore" to availableScripts, if missing
      choice.availableScripts = [options.ignoreText].concat(
        choice.availableScripts.filter((script) => script !== options.ignoreText)
      )

      // increase initial by 1, since we added "ignore"
      choice.initial++
    })

    this.choices = this.getSortedChoices(this.choices)

    // for the filtering, we store all choices here
    this.allChoices = this.choices

    // for padding
    this.longestPackageNameLength = this.allChoices.reduce((val, curr) => {
      const result = curr.name.length + 4

      return result > val ? result : val
    }, 0)

    // for padding
    this.shortestPackageNameLength = this.allChoices.reduce((val, curr) => {
      const result = curr.name.length

      return result < val ? result : val
    }, this.longestPackageNameLength)

    // for padding, although not really used atm
    this.longestScaleItemNameLength = Math.min(
      this.allChoices.reduce((longest, currentChoice) => {
        let longestInsideChoice = currentChoice.availableScripts.reduce(
          (longestInsideChoiceSoFar, currentScaleItem) => {
            return currentScaleItem.length > longestInsideChoiceSoFar
              ? currentScaleItem.length
              : longestInsideChoiceSoFar
          },
          0
        )

        return longestInsideChoice > longest ? longestInsideChoice : longest
      }, 0),
      15
    )

    this.filterText = ''
    const keyPressHandler = (ch, key) => {
      this.onKeyPress(ch, key)
    }
    this.on('keypress', keyPressHandler)

    const resizeHandler = () => {
      this.render()
    }
    this.stdout.on('resize', resizeHandler)

    this.on('close', () => {
      this.removeListener('keypress', keyPressHandler)
      this.stdout.removeListener('resize', resizeHandler)
    })
  }

  getSortedChoices(choices) {
    return choices.sort((a, b) => {
      const customSortOrder = (input) => {
        switch (input) {
          case this.uncategorizedText:
            return '`'
          default:
            return input
        }
      }

      return customSortOrder(a.customSortText || a.category) <
        customSortOrder(b.customSortText || b.category)
        ? -1
        : 1
    })
  }

  onKeyPress(ch, key) {
    const noFilterPreviouslyApplied = this.filterText === ''
    const wasDelete = this.filterText !== '' && key.action === 'delete'

    if (wasDelete) {
      this.filterText = this.filterText.substring(0, this.filterText.length - 1)
    } else if (
      key.action !== 'delete' &&
      typeof ch === 'string' &&
      key.raw === key.sequence &&
      !key.ctrl &&
      !key.meta &&
      !key.option
    ) {
      // it's a typable character, and it's not a special character like a \n
      this.filterText += ch.toLowerCase()
    } else {
      // no filter-related key presses, return early
      return
    }

    if (this.filterText !== '') {
      if (noFilterPreviouslyApplied) {
        // ensure we have all the extra lines by extra script instances stored
        // before we start filtering the choices
        this.allChoices = this.choices
      }

      this.choices = this.getFilteredChoices(this.filterText, this.allChoices)
    } else if (this.filterText === '' && !noFilterPreviouslyApplied) {
      // back to no filtering, restore the view
      this.choices = this.allChoices
    }

    this.index = 0
    this.render()
  }

  async reset() {
    this.tableized = false
    await super.reset()

    return this.render()
  }

  tableize() {
    if (this.tableized === true) return
    this.tableized = true
    let longest = 0

    for (let ch of this.choices) {
      longest = Math.max(longest, ch.message.length)

      ch.initial = ch.initial || 0

      if (!this.isValidScaleItem(this.scale[ch.initial], ch)) {
        ch.initial = 0
      }

      ch.scaleIndex = ch.initial
      ch.scale = []

      for (let i = 0; i < this.scale.length; i++) {
        ch.scale.push({ index: i })
      }
    }
    this.widths[0] = Math.min(this.widths[0], longest + 3)

    this.choices.forEach((choice) =>
      this.checkIfPackageScriptInstanceShouldBeAdded(choice, this.choices)
    )
  }

  async dispatch(s, key) {
    if (this.multiple) {
      return this[key.name] ? await this[key.name](s, key) : await super.dispatch(s, key)
    }
    this.alert()
  }

  separator() {
    return this.styles.muted(this.symbols.ellipsis)
  }

  ignoresLeftFromChoiceScripts(choice) {
    let ignoreIndex = this.getChoiceAvailableScriptIndexes(choice)[0].index

    return this.choices.filter(
      (ch) =>
        ch.name === choice.name &&
        (ch.scaleIndex !== undefined
          ? ch.scaleIndex === ignoreIndex
          : ch.initial === ignoreIndex || isNaN(ch.initial))
    ).length
  }

  checkIfPackageScriptInstanceShouldBeAdded(choice, choicesToModify) {
    if (choice.allowMultipleScripts === false) {
      return
    }

    let specialIndexes
    if (choice.scale) {
      specialIndexes = this.getChoiceAvailableScriptIndexes(choice)
    }

    let anyIgnoresLeft = this.ignoresLeftFromChoiceScripts(choice) > 0

    const choiceCountDerivedFromCurrentPackage = choicesToModify.filter(
      (ch) => ch.name === choice.name
    ).length

    if (
      !anyIgnoresLeft &&
      choiceCountDerivedFromCurrentPackage < choice.availableScripts.length - 1
    ) {
      let newChoiceWithIgnoreSelected = {
        ...choice,
        message: choice.name,
        index: choice.index + 1,
        initial: specialIndexes ? specialIndexes[0].index : 0,
        scaleIndex: specialIndexes ? specialIndexes[0].index : 0
      }

      choicesToModify.splice(choice.index + 1, 0, newChoiceWithIgnoreSelected)

      if (this.filterText !== '') {
        this.allChoices.splice(
          this.allChoices.findIndex((ch) => ch === choice) + 1,
          0,
          newChoiceWithIgnoreSelected
        )
      }

      // fix index order of the re-arranged choices
      choicesToModify.slice(choice.index + 2).forEach((ch) => ch.index++)
    }
  }

  isValidScaleItem(scaleItemName, choice) {
    return (
      scaleItemName === this.options.ignoreText || this.isScriptAvailable(scaleItemName, choice)
    )
  }

  getNextIndexThatHasAvailableScript(direction, choice) {
    let nextIndex = choice.scaleIndex + (direction === 'right' ? 1 : -1)

    const isIndexWithinBounds = (i) => i >= 0 && i < this.scale.length

    while (
      isIndexWithinBounds(nextIndex) &&
      !this.isValidScaleItem(this.scale[nextIndex], choice)
    ) {
      nextIndex += direction === 'right' ? 1 : -1
    }

    if (isIndexWithinBounds(nextIndex)) {
      return nextIndex
    }

    throw new Error('no scale script item available to move to in that direction')
  }

  right() {
    let choice = this.focused

    if (choice.scaleIndex >= this.scale.length - 1) return this.alert()

    try {
      choice.scaleIndex = this.getNextIndexThatHasAvailableScript('right', choice)

      this.checkIfPackageScriptInstanceShouldBeAdded(choice, this.choices)
      return this.render()
    } catch (e) {
      if (e.message !== 'no scale script item available to move to in that direction') {
        throw e
      }
    }
  }

  checkIfPackageScriptInstanceShouldBeRemoved(choice, choicesToModify) {
    if (choice.allowMultipleScripts === false) {
      return
    }

    let ignoreIndex = this.getChoiceAvailableScriptIndexes(choice)[0].index
    let wasActive = choice.scaleIndex === ignoreIndex

    const choiceCountDerivedFromCurrentPackage = choicesToModify.filter(
      (ch) => ch.name === choice.name
    ).length

    let ignoresLeft = this.ignoresLeftFromChoiceScripts(choice, choicesToModify)

    if (wasActive && choiceCountDerivedFromCurrentPackage > 1 && ignoresLeft > 1) {
      let isLastOccurrence =
        choicesToModify.filter((ch) => ch.name === choice.name).pop().index === choice.index

      choicesToModify.splice(choice.index, 1)

      if (isLastOccurrence) {
        // move cursor up one step since we're deleting where the cursor currently is
        this.index--
      }

      choicesToModify.slice(choice.index).forEach((ch) => ch.index--)
    }
  }

  left() {
    let choice = this.focused
    if (choice.scaleIndex <= 0) return this.alert()

    try {
      choice.scaleIndex = this.getNextIndexThatHasAvailableScript('left', choice)

      this.checkIfPackageScriptInstanceShouldBeRemoved(choice, this.choices)
      return this.render()
    } catch (e) {
      if (e.message !== 'no scale script item available to move to in that direction') {
        throw e
      }
    }

    return this.render()
  }

  indent() {
    return ''
  }

  format() {
    if (this.state.submitted) {
      let values = this.choices.map((ch) => this.styles.info(ch.index))
      return values.join(', ')
    }
    return ''
  }

  pointer() {
    return ''
  }

  /**
   * Render the scale "Key". Something like:
   * @return {String}
   */

  renderScaleKey() {
    if (this.scaleKey === false) return ''
    if (this.state.submitted) return ''
    let scale = this.scale.map((item) => `   ${item.name} - ${item.message}`)
    let key = ['', ...scale].map((item) => this.styles.muted(item))
    return key.join('\n')
  }

  isScriptAvailable(scaleItem, choice) {
    return (
      scaleItem.executionGroupIndex === choice.executionGroupIndex &&
      choice.availableScripts.includes(scaleItem.name)
    )
  }

  /**
   * Render a scale indicator => ignore ── build ── build:prod
   */

  scaleIndicator(choice, item, choiceIndex) {
    const scaleItem = this.scale[item.index]

    let scaleItemIsSelected = choice.scaleIndex === item.index
    let choiceIsFocused = this.index === choiceIndex

    // if (
    //   !this.isScriptAvailable(scaleItemName, choice) &&
    //   (choice.category === 'category? TODO' ||
    //     (choice.scriptNames && choice.scriptNames.includes(scaleItemName)))
    // ) {
    //   return ''
    // } else  ...
    if (!this.isScriptAvailable(scaleItem, choice)) {
      return ''
    } else if (choiceIsFocused && scaleItemIsSelected) {
      return this.styles.strong(this.styles.danger(scaleItem.name))
    } else if (scaleItemIsSelected) {
      return this.styles.strong(this.styles.success(scaleItem.name))
    } else if (choiceIsFocused) {
      return this.styles.danger(scaleItem.name)
    }
    return this.styles.strong(scaleItem.name)
  }

  getChoiceSelectedScriptIndex(choice) {
    return this.getChoiceAvailableScriptIndexes(choice).findIndex(
      (item) => item.index === choice.scaleIndex
    )
  }

  getChoiceAvailableScriptIndexes(choice) {
    return choice.scale.filter((s) => this.isScriptAvailable(this.scale[s.index], choice))
  }

  /**
   * Render the actual scale => ◯────◯────◉────◯────◯
   */
  renderScale(choice, i, maxScaleItemsOnScreen) {
    let scaleItems = choice.scale
      .map((item) => this.scaleIndicator(choice, item, i))
      .filter((i) => i !== '')

    const choiceScaleIndex = this.getChoiceSelectedScriptIndex(choice)
    let scrollsFromLeftEdge = null
    let scrollsFromRightEdge = null

    if (scaleItems.length > maxScaleItemsOnScreen) {
      const scrollingIndex =
        choiceScaleIndex -
        (choiceScaleIndex % maxScaleItemsOnScreen) +
        // account for end of right side not being a multiplier of max items count
        Math.max(0, choiceScaleIndex + maxScaleItemsOnScreen - scaleItems.length)

      const sliceStart =
        scrollingIndex + maxScaleItemsOnScreen < scaleItems.length
          ? scrollingIndex
          : scaleItems.length - maxScaleItemsOnScreen

      const sliceEnd = Math.min(scaleItems.length, sliceStart + maxScaleItemsOnScreen)

      scrollsFromLeftEdge = Math.ceil(sliceStart / maxScaleItemsOnScreen)
      scrollsFromRightEdge = Math.ceil((scaleItems.length - sliceEnd) / maxScaleItemsOnScreen)

      scaleItems = scaleItems.slice(sliceStart, sliceStart + maxScaleItemsOnScreen)
    }

    scaleItems = scaleItems.filter((scaleItem) => scaleItem)

    let padding = this.term === 'Hyper' ? '' : ' '
    return (
      (scrollsFromLeftEdge > 0
        ? '[' +
          new Array(scrollsFromLeftEdge)
            .fill(1)
            .map(() => '.')
            .join('') +
          ']' +
          padding
        : '') +
      scaleItems.join(padding + this.symbols.line.repeat(this.edgeLength) + padding) +
      (scrollsFromRightEdge > 0
        ? padding +
          '[' +
          new Array(scrollsFromRightEdge)
            .fill(1)
            .map(() => '.')
            .join('') +
          ']'
        : '')
    )
  }

  get limit() {
    let { state, options, choices } = this
    let limit = state.limit || this._limit || options.limit || choices.length

    let categories = this.choices.reduce((categories, val) => {
      categories.add(val.category)
      return categories
    }, new Set())
    return Math.min(limit, this.height) - categories.size
  }

  /**
   * Render a choice, including scale =>
   *   "The website is easy to navigate. ◯───◯───◉───◯───◯"
   */

  async renderChoice(choice, i, bulletIndentation = false) {
    await this.onChoice(choice, i)

    let focused = this.index === i
    let pointer = await this.pointer(choice, i)
    let hint = await choice.hint

    if (hint && !utils.hasColor(hint)) {
      hint = this.styles.muted(hint)
    }

    let maxScaleItemsOnScreen = 20

    let pad = (str) => this.margin[3] + str.replace(/\s+$/, '').padEnd(this.widths[0], ' ')
    let newline = this.newline
    let ind = this.indent(choice)
    let message = await this.resolve(choice.message, this.state, choice, i)
    let scale = await this.renderScale(choice, i, maxScaleItemsOnScreen)
    let margin = this.margin[1] + this.margin[3]
    this.scaleLength = colors.unstyle(scale).length
    this.widths[0] = Math.min(
      this.widths[0],
      this.longestPackageNameLength + margin - this.shortestPackageNameLength
    )
    let msg = utils.wordWrap(message, { width: this.widths[0], newline })
    let lines = msg.split('\n').map((line) => pad(line) + this.margin[1])

    let selectedBulletCharacter = '-'
    let bulletCharacter = '-'

    var now = new Date()
    if (now.getMonth() == 10 && now.getDate() == 31) {
      selectedBulletCharacter = '😱'
      bulletCharacter = '👻'
    }

    if (focused) {
      lines = lines.map((line) => (this.styles.hasAnsi(line) ? line : this.styles.danger(line)))
      lines[0] = bulletIndentation ? selectedBulletCharacter + ' > ' + lines[0] : '> '
    } else {
      lines[0] = bulletIndentation ? bulletCharacter + '   ' + lines[0] : lines[0]
    }

    if (this.linebreak) lines.push('')

    let renderedChoice
    let columnSpaceRemaining

    let termColumns = process.stdout.columns

    do {
      scale = await this.renderScale(choice, i, maxScaleItemsOnScreen)

      let terminalFittedLines = [...lines]
      terminalFittedLines[0] += this.focused ? this.styles.info(scale) : scale

      renderedChoice = [ind + pointer, terminalFittedLines.join('\n')].filter(Boolean)
      columnSpaceRemaining =
        termColumns -
        stripAnsi(Array.isArray(renderedChoice) ? renderedChoice[0] : renderedChoice).length

      maxScaleItemsOnScreen--
    } while (columnSpaceRemaining < 25 && maxScaleItemsOnScreen > 0)

    return renderedChoice
  }

  isChoiceCategorized(choice) {
    return choice.category !== this.options.uncategorizedText
  }

  areAllChoicesUncategorized(choices) {
    return choices.every((ch) => ch.category === this.options.uncategorizedText)
  }

  async renderChoicesAndCategories() {
    if (this.state.submitted) return ''
    this.tableize()

    // fix the indexing
    this.visible.forEach((ch, index) => (ch.index = index))

    const categorizedChoicesExist = this.visible.some((ch) => this.isChoiceCategorized(ch))

    let choicesAndCategories = []
    for (let i = 0; i < this.visible.length; i++) {
      let ch = this.visible[i]
      let renderedChoice = await this.renderChoice(ch, i, true)

      if (categorizedChoicesExist || this.filterText !== '') {
        let prevChoiceCategory = i === 0 ? null : this.visible[i - 1].category

        if (prevChoiceCategory !== ch.category) {
          choicesAndCategories.push(this.styles.underline(ch.category))
        }
      }

      choicesAndCategories.push(renderedChoice)
    }

    let visible = (await Promise.all(choicesAndCategories)).flat()
    return this.margin[0] + visible.join('\n')
  }

  async getFilterHeading() {
    if (this.filterText !== '') {
      return 'Filtering by: ' + this.filterText + '\n'
    }
    return '[Type to filter -- up/down: change selected project -- left/right: switch scripts to run]\n'
  }

  getFilteredChoices(filterText, choices /*, defaultItem*/) {
    return fuzzy
      .filter(filterText || '', choices, {
        // fuzzy options
        // pre: ansiStyles.green.open,
        // post: ansiStyles.green.close,
        extract: (choice) => choice.ansiLessName || stripAnsi(choice.name)
      })
      .map((e) => {
        e.original.ansiLessName = stripAnsi(e.string)
        e.original.name = e.string
        e.original.message = e.string

        return e.original
      })
  }

  async render() {
    let { submitted, size } = this.state

    let prefix = await this.prefix()
    let separator = await this.separator()
    let message = await this.message()

    let prompt = ''
    if (this.options.promptLine !== false) {
      prompt = [prefix, message, separator, ''].join(' ')
      this.state.prompt = prompt
    }

    this.visible.forEach((ch) => {
      if (ch.scaleIndex === undefined) {
        ch.scaleIndex = 1
      }
    })

    let header = await this.header()
    let output = await this.format()
    // let key = await this.renderScaleKey()
    let help = (await this.error()) || (await this.hint())
    let body = await this.renderChoicesAndCategories()
    let footer = await this.footer()
    let err = this.emptyError

    if (output) prompt += output
    if (help && !prompt.includes(help)) prompt += ' ' + help

    if (submitted && !output && !body.trim() && this.multiple && err != null) {
      prompt += this.styles.danger(err)
    }

    let filterHeading = await this.getFilterHeading()

    this.clear(size)
    this.write([header, prompt /*, key*/, filterHeading, body, footer].filter(Boolean).join('\n'))
    if (!this.state.submitted) {
      this.write(this.margin[2])
    }
    this.restore()
  }

  submit() {
    this.value = []

    for (let choice of this.allChoices) {
      const script = choice.availableScripts[this.getChoiceSelectedScriptIndex(choice)]

      if (script !== this.options.ignoreText) {
        this.value.push({
          packageName: choice.name,
          script,
          scriptExecutable: choice.scriptExecutable,
          scriptCommand: choice.scriptCommand
        })
      }
    }
    return this.base.submit.call(this)
  }
}

module.exports = RushSelect
