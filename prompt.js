const colors = require('ansi-colors')
const stripAnsi = require('strip-ansi')
const ArrayPrompt = require('enquirer/lib/types/array')
const utils = require('enquirer/lib/utils')
const fuzzy = require('fuzzy')

const { wrapInSpaces, replaceWithCharacter, replaceWithNotAvailable } = require('./string-utils')

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

    this.filterText = ''
    this.on('keypress', (ch, key) => {
      this.onKeyPress(ch, key)
    })
  }

  onKeyPress(ch, key) {
    if (key.action === 'delete') {
      this.filterText = this.filterText.substring(0, this.filterText.length - 1)

      this.index = 0
      this.render()
    } else if (typeof ch === 'string') {
      this.filterText = this.filterText || ''

      this.filterText += ch.toLowerCase()

      this.index = 0
      this.render()
    }
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

  right() {
    let choice = this.focused

    if (choice.scaleIndex >= this.scale.length - 1) return this.alert()

    choice.scaleIndex++

    this.checkIfPackageScriptInstanceShouldBeAdded(choice)

    return this.render()
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
    choice.scaleIndex--

    this.checkIfPackageScriptInstanceShouldBeRemoved(choice)

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

  scaleIndicator(choice, item, rowIndex) {
    let selectedRowIndex = this.index

    const optionName = this.scale[item.index].name
    const isScriptAvailable = (optionName) =>
      choice.availableScripts && choice.availableScripts.includes(optionName)

    let itemInRowIsSelected = choice.scaleIndex === item.index
    let rowIsFocused = selectedRowIndex === rowIndex

    const itemInRowIsDisabled = !isScriptAvailable(optionName)

    const allRowItemsAreDisabled =
      choice.availableScripts &&
      choice.scale.every(({ index }) => !isScriptAvailable(this.scale[index].name))

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
      return this.styles.yellow(wrapInSpaces(replaceWithNotAvailable(optionName, ' ')))
    } else if (itemInRowIsDisabled) {
      // this particular selection in the choice row is disabled
      if (rowIsFocused && itemInRowIsSelected) {
        return this.styles.strong(
          this.styles.magenta(wrapInSpaces(replaceWithNotAvailable(optionName, ' ')))
        )
      }
      if (itemInRowIsSelected)
        return this.styles.green(wrapInSpaces(replaceWithNotAvailable(optionName, ' ')))
      if (rowIsFocused)
        return this.styles.strong(wrapInSpaces(replaceWithNotAvailable(optionName, ' ')))
      return this.styles.yellow(wrapInSpaces(replaceWithNotAvailable(optionName, ' ')))
    }

    // row and item is available for selection
    if (rowIsFocused && itemInRowIsSelected) {
      return this.styles.strong(this.styles.magenta(wrapInSpaces(optionName)))
    }
    if (itemInRowIsSelected) return this.styles.strong(this.styles.green(wrapInSpaces(optionName)))
    if (rowIsFocused) return this.styles.white(wrapInSpaces(optionName))
    return this.styles.strong(this.styles.dark(wrapInSpaces(optionName)))
  }

  /**
   * Render the actual scale => ◯────◯────◉────◯────◯
   */

  renderScale(choice, i) {
    let scale = choice.scale.map((item) => this.scaleIndicator(choice, item, i))
    let padding = this.term === 'Hyper' ? '' : ' '
    return scale.join(padding + this.symbols.line.repeat(this.edgeLength))
  }

  /**
   * Render a category =>
   *   "Libraries"
   */

  async renderCategory(categoryName) {
    return categoryName
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

    let pad = (str) => this.margin[3] + str.replace(/\s+$/, '').padEnd(this.widths[0], ' ')
    let newline = this.newline
    let ind = this.indent(choice)
    let message = await this.resolve(choice.message, this.state, choice, i)
    let scale = await this.renderScale(choice, i)
    let margin = this.margin[1] + this.margin[3]
    this.scaleLength = colors.unstyle(scale).length
    this.widths[0] = Math.min(this.widths[0], this.width - this.scaleLength - margin.length)
    let msg = utils.wordWrap(message, { width: this.widths[0], newline })
    let lines = msg.split('\n').map((line) => pad(line) + this.margin[1])

    if (focused) {
      scale = this.styles.info(scale)
      lines = lines.map((line) => this.styles.info(line))
      lines[0] = bulletIndentation ? '- > ' + lines[0] : '> '
    } else {
      lines[0] = bulletIndentation ? '-   ' + lines[0] : lines[0]
    }

    lines[0] += scale

    if (this.linebreak) lines.push('')
    return [ind + pointer, lines.join('\n')].filter(Boolean)
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

    const appendVisiblesInCategory = (category) => {
      if (this.filterText !== '') {
        let filtered = this.getFilteredChoices(this.filterText, mappedByCategories[category])

        if (filtered.length > 0) {
          visibles = visibles.concat(filtered)
        }
      } else if (mappedByCategories[category]) {
        visibles = visibles.concat(mappedByCategories[category])
      }
    }

    // do fuzzy matching in each category
    Object.keys(mappedByCategories).forEach(appendVisiblesInCategory)

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
          let renderedCategory = await this.renderCategory(ch.category)
          choicesAndCategories.push(renderedCategory)
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
