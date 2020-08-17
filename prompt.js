const colors = require('ansi-colors')
const stripAnsi = require('strip-ansi')
const ArrayPrompt = require('enquirer/lib/types/array')
const utils = require('enquirer/lib/utils')
const fuzzy = require('fuzzy')

const { padReplace } = require('./string-utils')

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

    this.choices.forEach((choice) => {
      // ensure some category exists
      choice.category = choice.category || this.options.uncategorizedText

      choice.availableScripts = [options.ignoreText].concat(
        choice.availableScripts.filter((script) => script !== options.ignoreText)
      )
    })

    this.choices = this.choices.sort((a, b) => {
      return a.category === this.options.uncategorizedText || a < b ? -1 : 1
    })

    // for the filtering, we store the choices here
    this.allChoices = this.choices

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

  onKeyPress(ch, key) {
    if (key.action === 'delete') {
      this.filterText = this.filterText.substring(0, this.filterText.length - 1)
    } else if (typeof ch === 'string') {
      this.filterText = this.filterText || ''
      this.filterText += ch.toLowerCase()
    } else {
      // no filter-related key presses, return early
      return
    }

    this.choices = this.getFilteredChoices(this.filterText, this.allChoices)
    this.index = 0
    this.render()
  }

  async reset() {
    this.tableized = false
    await super.reset()

    this.choices.forEach((choice) => this.checkIfPackageScriptInstanceShouldBeAdded(choice))

    return this.render()
  }

  tableize() {
    if (this.tableized === true) return
    this.tableized = true
    let longest = 0

    for (let ch of this.choices) {
      longest = Math.max(longest, ch.message.length)
      ch.scaleIndex = ch.initial || 0
      ch.scale = []

      for (let i = 0; i < this.scale.length; i++) {
        ch.scale.push({ index: i })
      }
    }
    this.widths[0] = Math.min(this.widths[0], longest + 3)
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

  checkIfPackageScriptInstanceShouldBeAdded(choice) {
    let anyIgnoresLeft = this.choices.some(
      (ch) =>
        ch.name === choice.name &&
        (ch.scaleIndex !== undefined ? ch.scaleIndex === 0 : ch.initial === 0)
    )

    const choiceCountDerivedFromCurrentPackage = this.choices.filter(
      (ch) => ch.name === choice.name
    ).length

    if (
      !anyIgnoresLeft &&
      choiceCountDerivedFromCurrentPackage < choice.availableScripts.length - 1
    ) {
      this.choices.splice(choice.index + 1, 0, {
        ...choice,
        index: choice.index + 1,
        initial: 0,
        scaleIndex: 0
      })

      this.choices.slice(choice.index + 2).forEach((ch) => ch.index++)
    }
  }

  getNextIndexThatHasAvailableScript(direction, choice) {
    let nextIndex = choice.scaleIndex + (direction === 'right' ? 1 : -1)

    const isIndexWithinBounds = (i) => i >= 0 && i < this.scale.length
    const isValidScaleItem = (optionName) =>
      optionName === this.options.ignoreText || choice.availableScripts.includes(optionName)

    while (isIndexWithinBounds(nextIndex) && !isValidScaleItem(this.scale[nextIndex].name)) {
      nextIndex += direction === 'right' ? 1 : -1
    }

    if (isIndexWithinBounds(nextIndex)) {
      return nextIndex
    }

    throw new Error('no scale scrip item available to move to in that direction')
  }

  right() {
    let choice = this.focused

    if (choice.scaleIndex >= this.scale.length - 1) return this.alert()

    try {
      choice.scaleIndex = this.getNextIndexThatHasAvailableScript('right', choice)

      this.checkIfPackageScriptInstanceShouldBeAdded(choice)
      return this.render()
    } catch (e) {
      if (e.message !== 'no scale scrip item available to move to in that direction') {
        throw e
      }
    }
  }

  checkIfPackageScriptInstanceShouldBeRemoved(choice) {
    let wasActive = choice.scaleIndex === 0

    const choiceCountDerivedFromCurrentPackage = this.choices.filter(
      (ch) => ch.name === choice.name
    ).length

    let ignoresLeft = this.choices.filter(
      (ch) =>
        ch.name === choice.name &&
        (ch.scaleIndex !== undefined ? ch.scaleIndex === 0 : ch.initial === 0)
    ).length

    if (wasActive && choiceCountDerivedFromCurrentPackage > 1 && ignoresLeft > 1) {
      let isFirstOccurrence =
        this.choices.findIndex((ch) => ch.name === choice.name) === choice.index

      this.choices.splice(choice.index, 1)

      if (!isFirstOccurrence) {
        // move cursor up one step since we're deleting where the cursor currently is
        this.index--
      }

      this.choices.slice(choice.index).forEach((ch) => ch.index--)
    }
  }

  left() {
    let choice = this.focused
    if (choice.scaleIndex <= 0) return this.alert()

    try {
      choice.scaleIndex = this.getNextIndexThatHasAvailableScript('left', choice)

      this.checkIfPackageScriptInstanceShouldBeRemoved(choice)
      return this.render()
    } catch (e) {
      if (e.message !== 'no scale scrip item available to move to in that direction') {
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

  /**
   * Render a scale indicator => ignore  ─── build:watch  ─── build:prod
   */

  scaleIndicator(choice, item, choiceIndex) {
    const scaleItemName = this.scale[item.index].name
    const isScriptAvailable = (optionName) =>
      choice.availableScripts && choice.availableScripts.includes(optionName)

    let scaleItemIsSelected = choice.scaleIndex === item.index
    let choiceIsFocused = this.index === choiceIndex

    const allScaleItemsAreUnavailable =
      choice.availableScripts &&
      choice.scale.every(({ index }) => !isScriptAvailable(this.scale[index].name))

    let s = this.styles

    if (allScaleItemsAreUnavailable) {
      // all scale items are unavailable, might as well make the choice skipped
      choice.disabled = true
      return s.yellow(padReplace(scaleItemName))
    } else if (!isScriptAvailable(scaleItemName)) {
      // // this particular selection in the choice row is disabled
      // if (choiceIsFocused && scaleItemIsSelected) {
      //   return s.strong(s.magenta(padReplace(scaleItemName)))
      // } else if (scaleItemIsSelected) {
      //   return s.green(padReplace(scaleItemName))
      // } else if (choiceIsFocused) {
      //   return s.strong(padReplace(scaleItemName))
      // }
      return s.yellow(padReplace(scaleItemName))
    }
    // row and item is available for selection
    else if (choiceIsFocused && scaleItemIsSelected) {
      return s.strong(s.magenta(scaleItemName))
    } else if (scaleItemIsSelected) {
      return s.strong(s.green(scaleItemName))
    } else if (choiceIsFocused) {
      return s.white(scaleItemName)
    }
    return s.strong(s.dark(scaleItemName))
  }

  /**
   * Render the actual scale => ◯────◯────◉────◯────◯
   */

  renderScale(choice, i, maxItemsOnScreen) {
    let scaleItems = choice.scale.map((item) => ' ' + this.scaleIndicator(choice, item, i) + ' ')

    const choiceScaleIndex = this.choices[this.index].scaleIndex
    let itemsFromLeftEdge = null
    let itemsFromRightEdge = null

    if (scaleItems.length > maxItemsOnScreen) {
      const scrollingIndex =
        choiceScaleIndex -
        (choiceScaleIndex % maxItemsOnScreen) +
        // account for end of right side not being a multiplier of max items count
        Math.max(0, choiceScaleIndex + maxItemsOnScreen - scaleItems.length)

      const sliceStart =
        scrollingIndex + maxItemsOnScreen < scaleItems.length
          ? scrollingIndex
          : scaleItems.length - maxItemsOnScreen

      const sliceEnd = Math.min(scaleItems.length, sliceStart + maxItemsOnScreen)

      itemsFromLeftEdge = sliceStart
      itemsFromRightEdge = scaleItems.length - sliceEnd

      scaleItems = scaleItems.slice(sliceStart, sliceStart + maxItemsOnScreen)
    }

    let padding = this.term === 'Hyper' ? '' : ' '
    return (
      new Array(itemsFromLeftEdge)
        .fill(1)
        .map(() => '.')
        .join('') +
      scaleItems.join(padding + this.symbols.line.repeat(this.edgeLength)) +
      new Array(itemsFromRightEdge)
        .fill(1)
        .map(() => '.')
        .join('')
    )
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

    let maxScaleItemsVisible = 10

    let pad = (str) => this.margin[3] + str.replace(/\s+$/, '').padEnd(this.widths[0], ' ')
    let newline = this.newline
    let ind = this.indent(choice)
    let message = await this.resolve(choice.message, this.state, choice, i)
    let scale = await this.renderScale(choice, i, maxScaleItemsVisible)
    let margin = this.margin[1] + this.margin[3]
    this.scaleLength = colors.unstyle(scale).length
    this.widths[0] = Math.min(this.widths[0], this.width - this.scaleLength - margin.length)
    let msg = utils.wordWrap(message, { width: this.widths[0], newline })
    let lines = msg.split('\n').map((line) => pad(line) + this.margin[1])

    if (focused) {
      lines = lines.map((line) => this.styles.info(line))
      lines[0] = bulletIndentation ? '- > ' + lines[0] : '> '
    } else {
      lines[0] = bulletIndentation ? '-   ' + lines[0] : lines[0]
    }

    if (this.linebreak) lines.push('')

    let renderedChoice
    let columnSpaceRemaining

    let termColumns = process.stdout.columns

    do {
      scale = await this.renderScale(choice, i, maxScaleItemsVisible)

      let leLines = [...lines]
      leLines[0] += this.focused ? this.styles.info(scale) : scale

      renderedChoice = [ind + pointer, leLines.join('\n')].filter(Boolean)
      columnSpaceRemaining =
        termColumns -
        stripAnsi(Array.isArray(renderedChoice) ? renderedChoice[0] : renderedChoice).length

      maxScaleItemsVisible--
    } while (columnSpaceRemaining < 0 && maxScaleItemsVisible > 0)

    return renderedChoice
  }

  isChoiceCategorized(choice) {
    return choice.category === this.options.uncategorizedText
  }

  areAllChoicesUncategorized(choices) {
    return choices.every((ch) => ch.category === this.options.uncategorizedText)
  }

  async renderChoices() {
    if (this.state.submitted) return ''
    this.tableize()
    let choices = this.visible.map(async (ch, i) => await this.renderChoice(ch, i))
    let visible = await Promise.all(choices)
    return this.margin[0] + visible.map((v) => v.join(' ')).join('\n')
  }

  async renderChoicesAndCategories() {
    if (this.state.submitted) return ''
    this.tableize()

    let visibles = []
    let mappedByCategories

    // ensure the order of which was supplied
    mappedByCategories = this.visible.reduce((coll = {}, curr) => {
      coll[curr.category] = coll[curr.category] || []
      coll[curr.category].push(curr)

      return coll
    }, {})

    Object.keys(mappedByCategories).forEach(
      (category) => (visibles = visibles.concat(mappedByCategories[category]))
    )

    // fix the indexing
    visibles.forEach((ch, index) => (ch.index = index))

    const categorizedChoicesExist = visibles.some((ch) => this.isChoiceCategorized(ch))

    let choicesAndCategories = []
    for (let i = 0; i < visibles.length; i++) {
      let ch = visibles[i]
      let renderedChoice = await this.renderChoice(ch, i, true)

      if (categorizedChoicesExist) {
        let prevChoiceCategory = i === 0 ? null : visibles[i - 1].category

        if (prevChoiceCategory !== ch.category) {
          choicesAndCategories.push(ch.category)
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
    return '[Type to filter packages]\n'
  }

  getFilteredChoices(filterText, choices /*, defaultItem*/) {
    return fuzzy
      .filter(filterText || '', choices, {
        // fuzzy options
        pre: this.styles.green.open,
        post: this.styles.green.close,
        extract: (choice) => choice.ansiLessName || stripAnsi(choice.name)
      })
      .map((e) => {
        e.original.ansiLessName = stripAnsi(e.string)
        e.original.name = e.string

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
    for (let choice of this.choices) {
      if (choice.availableScripts[choice.index] !== this.options.ignoreText) {
        this.value.push({
          packageName: choice.name,
          script: choice.availableScripts[choice.index]
        })
      }
    }
    return this.base.submit.call(this)
  }
}

module.exports = RushSelect
