import colors from 'ansi-colors'
import stripAnsi from 'strip-ansi'
import ArrayPrompt from 'enquirer/lib/types/array'
import utils from 'enquirer/lib/utils'
import fuzzy from 'fuzzy'
import {
  Choice,
  ChoiceInPrompt,
  ScaleWithIndex,
  ScaleWithName,
  KeyPressEvent,
  ExecutionGroup
} from './interfaces'

class RushSelect extends ArrayPrompt {
  constructor(options = {}) {
    // @ts-expect-error ts-migrate(2339) FIXME: Property 'ignoreText' does not exist on type '{}'.
    options.ignoreText = options.ignoreText || 'ignore'
    // @ts-expect-error ts-migrate(2339) FIXME: Property 'uncategorizedText' does not exist on typ... Remove this comment to see the full error message
    options.uncategorizedText = options.uncategorizedText || 'uncategorized'

    // @ts-expect-error ts-migrate(2339) FIXME: Property 'scale' does not exist on type '{}'.
    options.scale.unshift({
      // @ts-expect-error ts-migrate(2339) FIXME: Property 'ignoreText' does not exist on type '{}'.
      name: options.ignoreText
    })

    super(options)

    // @ts-expect-error ts-migrate(2339) FIXME: Property 'messageWidth' does not exist on type '{}... Remove this comment to see the full error message
    this.widths = [].concat(options.messageWidth || 50)
    // @ts-expect-error ts-migrate(2339) FIXME: Property 'align' does not exist on type '{}'.
    this.align = [].concat(options.align || 'left')
    // @ts-expect-error ts-migrate(2339) FIXME: Property 'linebreak' does not exist on type '{}'.
    this.linebreak = options.linebreak || false
    // @ts-expect-error ts-migrate(2339) FIXME: Property 'edgeLength' does not exist on type '{}'.
    this.edgeLength = options.edgeLength || 3
    // @ts-expect-error ts-migrate(2339) FIXME: Property 'newline' does not exist on type '{}'.
    this.newline = options.newline || '\n   '
    // @ts-expect-error ts-migrate(2339) FIXME: Property 'startNumber' does not exist on type '{}'... Remove this comment to see the full error message
    const start = options.startNumber || 1
    if (typeof this.scale === 'number') {
      this.scaleKey = false
      this.scale = Array(this.scale)
        .fill(0)
        .map((v, i) => ({ name: i + start }))
    }

    // @ts-expect-error ts-migrate(2339) FIXME: Property 'executionGroups' does not exist on type ... Remove this comment to see the full error message
    options.executionGroups.forEach((executionGroup: ExecutionGroup, index: number) => {
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
        ...executionGroup.scriptNames.map((name: string) => ({
          name,
          executionGroupIndex: index
        }))
      ]

      this.choices.forEach((choice: Choice) => {
        if (typeof choice.initial === 'string' && choice.initial !== '') {
          choice.initial = this.scale.findIndex((s: ScaleWithName) => s.name === choice.initial) - 1
        }
      })
    })

    this.choices.forEach((choice: ChoiceInPrompt) => {
      // ensure _some_ category exists
      choice.category = choice.category || this.options.uncategorizedText

      // add "ignore" to availableScripts, if missing
      // @ts-expect-error ts-migrate(2339) FIXME: Property 'ignoreText' does not exist on type '{}'.
      choice.availableScripts = [options.ignoreText].concat(
        // @ts-expect-error ts-migrate(2339) FIXME: Property 'ignoreText' does not exist on type '{}'.
        choice.availableScripts.filter((script: string) => script !== options.ignoreText)
      )

      // increase initial by 1, since we added "ignore"
      if (choice.initial !== undefined) {
        choice.initial++
      }
    })

    this.choices = this.getSortedChoices(this.choices)

    // for padding
    this.longestPackageNameLength = this.choices.reduce((longest: number, curr: ChoiceInPrompt) => {
      const result = curr.name.length + 4

      return result > longest ? result : longest
    }, 0)

    // for padding
    this.shortestPackageNameLength = this.choices.reduce(
      (shortest: number, curr: ChoiceInPrompt) => {
        const result = curr.name.length

        return result < shortest ? result : shortest
      },
      this.longestPackageNameLength
    )

    // for padding, although not really used atm
    this.longestScaleItemNameLength = Math.min(
      this.choices.reduce((longest: number, currentChoice: ChoiceInPrompt) => {
        const longestInsideChoice = currentChoice.availableScripts.reduce(
          (longestInsideChoiceSoFar: number, currentScaleItem: string) => {
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
    
    const resizeHandler = () => {
      this.render()
    }
    this.stdout.on('resize', resizeHandler)

    this.on('close', () => {
      this.stdout.removeListener('resize', resizeHandler)
    })
  }

  getSortedChoices(choices: Array<ChoiceInPrompt>): Array<ChoiceInPrompt> {
    return choices.sort((a: ChoiceInPrompt, b: ChoiceInPrompt) => {
      const customSortOrder = (input: string) => {
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

  onKeyPress(ch: string, key: KeyPressEvent): void {
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
      this.visible = this.getFilteredChoices(this.filterText, this.choices)
    } else if (this.filterText === '' && !noFilterPreviouslyApplied) {
      // back to no filtering, restore the view
      this.state.visible = undefined
    }

    // this.index = this.choices.findIndex((ch: ChoiceInPrompt) => ch === this.visible[0])
    this.index = 0
    this.render()
  }

  async reset(): Promise<void> {
    this.tableized = false
    await super.reset()

    return this.render()
  }

  tableize(): void {
    if (this.tableized === true) return
    this.tableized = true
    let longest = 0

    for (const ch of this.choices) {
      longest = Math.max(longest, ch.message.length)

      ch.initial = ch.initial || 0

      // if (!this.isValidScaleItem(this.scale[ch.initial], ch)) {
      //   ch.initial = 0
      // }

      ch.scaleIndex = ch.initial
      ch.scale = []

      for (let i = 0; i < this.scale.length; i++) {
        ch.scale.push({ index: i })
      }
    }
    this.widths[0] = Math.min(this.widths[0], longest + 3)

    this.choices.forEach((choice: ChoiceInPrompt) =>
      this.checkIfPackageScriptInstanceShouldBeAdded(choice, this.choices)
    )
  }

  async dispatch(s: string, key: KeyPressEvent): Promise<void> {
    if (this.multiple) {
      // not sure what multiple is, was here when I got here!
      return this[key.name] ? await this[key.name](s, key) : await super.dispatch(s, key)
    } else {
        this.onKeyPress(s, key)
    }
  }

  separator(): string {
    return this.styles.muted(this.symbols.ellipsis)
  }

  ignoresLeftFromChoiceScripts(choice: ChoiceInPrompt): number {
    const ignoreIndex = this.getChoiceAvailableScriptIndexes(choice)[0].index

    return this.choices.filter(
      (ch: ChoiceInPrompt) =>
        ch.name === choice.name &&
        (ch.scaleIndex !== undefined
          ? ch.scaleIndex === ignoreIndex
          : ch.initial === ignoreIndex || isNaN(ch.initial))
    ).length
  }

  checkIfPackageScriptInstanceShouldBeAdded(
    choice: ChoiceInPrompt,
    choicesToModify: Array<ChoiceInPrompt>
  ): void {
    if (choice.allowMultipleScripts === false) {
      return
    }

    let specialIndexes
    if (choice.scale) {
      specialIndexes = this.getChoiceAvailableScriptIndexes(choice)
    }

    const anyIgnoresLeft = this.ignoresLeftFromChoiceScripts(choice) > 0

    const choiceCountDerivedFromCurrentPackage = choicesToModify.filter(
      (ch: ChoiceInPrompt) => ch.name === choice.name
    ).length

    if (
      !anyIgnoresLeft &&
      choiceCountDerivedFromCurrentPackage < choice.availableScripts.length - 1
    ) {
      const newChoiceWithIgnoreSelected = {
        ...choice,
        message: choice.name,
        index: choice.index + 1,
        initial: specialIndexes ? specialIndexes[0].index : 0,
        scaleIndex: specialIndexes ? specialIndexes[0].index : 0
      }

      choicesToModify.splice(choice.index + 1, 0, newChoiceWithIgnoreSelected)

      // fix index order of the re-arranged choices
      choicesToModify.slice(choice.index + 2).forEach((ch: ChoiceInPrompt) => ch.index++)
    }
  }

  isValidScaleItem(scaleItemName: ScaleWithName, choice: ChoiceInPrompt): boolean {
    return (
      scaleItemName === this.options.ignoreText || this.isScriptAvailable(scaleItemName, choice)
    )
  }

  getNextIndexThatHasAvailableScript(direction: 'left' | 'right', choice: ChoiceInPrompt): number {
    let nextIndex = choice.scaleIndex + (direction === 'right' ? 1 : -1)

    const isIndexWithinBounds = (i: number) => i >= 0 && i < this.scale.length

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

  right(): Promise<void> {
    const choice = this.visible[this.index]

    if (choice.scaleIndex >= this.scale.length - 1) return this.alert()

    try {
      choice.scaleIndex = this.getNextIndexThatHasAvailableScript('right', choice)

      this.checkIfPackageScriptInstanceShouldBeAdded(choice, this.choices)
    } catch (e) {
      if (e.message !== 'no scale script item available to move to in that direction') {
        throw e
      }
    }

    return this.render()
  }

  checkIfPackageScriptInstanceShouldBeRemoved(
    choice: ChoiceInPrompt,
    choicesToModify: Array<ChoiceInPrompt>
  ): void {
    if (!choicesToModify) {
      throw Error('bla')
    }

    if (!choice) {
      throw Error('bla')
    }

    if (choice.allowMultipleScripts === false) {
      return
    }

    const ignoreIndex = this.getChoiceAvailableScriptIndexes(choice)[0].index
    const wasActive = choice.scaleIndex === ignoreIndex

    const choiceCountDerivedFromCurrentPackage = choicesToModify.filter(
      (ch: ChoiceInPrompt) => ch.name === choice.name
    ).length

    // @ts-expect-error ts-migrate(2554) FIXME: Expected 1 arguments, but got 2.
    const ignoresLeft = this.ignoresLeftFromChoiceScripts(choice, choicesToModify)

    if (wasActive && choiceCountDerivedFromCurrentPackage > 1 && ignoresLeft > 1) {
      const matching = choicesToModify.filter((ch: ChoiceInPrompt) => ch.name === choice.name)
      const isLastOccurrence = matching.slice(-1)[0].index === choice.index

      choicesToModify.splice(choice.index, 1)

      if (isLastOccurrence) {
        // move cursor up one step since we're deleting where the cursor currently is
        this.index--
      }

      choicesToModify.slice(choice.index).forEach((ch: ChoiceInPrompt) => ch.index--)
    }
  }

  left(): Promise<void> {
    const choice = this.visible[this.index]
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

  indent(): string {
    return ''
  }

  format(): string {
    if (this.state.submitted) {
      const values = this.choices.map((ch: ChoiceInPrompt) => this.styles.info(ch.index))
      return values.join(', ')
    }
    return ''
  }

  pointer(): string {
    return ''
  }

  /**
   * Render the scale "Key". Something like:
   * @return {String}
   */

  renderScaleKey(): string {
    if (this.scaleKey === false) return ''
    if (this.state.submitted) return ''
    const scale = this.scale.map((item: ScaleWithName) => `   ${item.name} - ${item.message}`)
    const key = ['', ...scale].map((item) => this.styles.muted(item))
    return key.join('\n')
  }

  isScriptAvailable(scaleItem: ScaleWithName, choice: ChoiceInPrompt): boolean {
    return (
      scaleItem.executionGroupIndex === choice.executionGroupIndex &&
      choice.availableScripts.includes(scaleItem.name)
    )
  }

  /**
   * Render a scale indicator => ignore ── build ── build:prod
   */

  scaleIndicator(choice: ChoiceInPrompt, item: ScaleWithIndex, choiceIndex: number): string {
    const scaleItem = this.scale[item.index]
    const scaleItemIsSelected = choice.scaleIndex === item.index
    const choiceIsFocused = this.index === choiceIndex

    if (!this.isScriptAvailable(scaleItem, choice)) {
      return ''
    } else if (choiceIsFocused && scaleItemIsSelected) {
      return this.styles.strong(this.styles.danger(' [' + scaleItem.name + '] '))
    } else if (scaleItemIsSelected) {
      return this.styles.strong(this.styles.success(' [' + scaleItem.name + '] '))
    } else if (choiceIsFocused) {
      return this.styles.danger('  ' + scaleItem.name + '  ')
    }
    return this.styles.default('  ' + scaleItem.name + '  ')
  }

  getChoiceSelectedScriptIndex(choice: ChoiceInPrompt): number {
    return this.getChoiceAvailableScriptIndexes(choice).findIndex(
      (item: ScaleWithIndex) => item.index === choice.scaleIndex
    )
  }

  getChoiceAvailableScriptIndexes(choice: ChoiceInPrompt): Array<ScaleWithIndex> {
    return choice.scale.filter((s: ScaleWithIndex) =>
      this.isScriptAvailable(this.scale[s.index], choice)
    )
  }

  /**
   * Render the actual scale => ◯────◯────◉────◯────◯
   */
  renderScale(choice: ChoiceInPrompt, i: number, maxScaleItemsOnScreen: number): string {
    let scaleItems = choice.scale
      .map((item: ScaleWithIndex) => this.scaleIndicator(choice, item, i))
      .filter((i: string) => i !== '')

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

    scaleItems = scaleItems.filter((scaleItem: string) => scaleItem)

    const padding = this.term === 'Hyper' ? '' : ''
    return (
      // @ts-expect-error ts-migrate(2531) FIXME: Object is possibly 'null'.
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
      // @ts-expect-error ts-migrate(2531) FIXME: Object is possibly 'null'.
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

  get limit(): number {
    const { state, options, choices } = this
    const limit = state.limit || this._limit || options.limit || choices.length

    const categories = this.choices.reduce((categories: Set<string>, val: ChoiceInPrompt) => {
      categories.add(val.category)
      return categories
    }, new Set())
    return Math.min(limit, this.height - categories.size)
  }

  /**
   * Render a choice, including scale =>
   *   "The website is easy to navigate. ◯───◯───◉───◯───◯"
   */

  async renderChoice(
    choice: ChoiceInPrompt,
    i: number,
    bulletIndentation = false
  ): Promise<Array<string>> {
    await this.onChoice(choice, i)

    const focused = this.index === i
    // @ts-expect-error ts-migrate(2554) FIXME: Expected 0 arguments, but got 2.
    const pointer = await this.pointer(choice, i)
    let hint = await choice.hint

    if (hint && !utils.hasColor(hint)) {
      hint = this.styles.muted(hint)
    }

    let maxScaleItemsOnScreen = 20

    const pad = (str: string) =>
      this.margin[3] + str.replace(/\s+$/, '').padEnd(this.widths[0], ' ')
    const newline = this.newline
    const ind = this.indent()
    const message = await this.resolve(choice.message, this.state, choice, i)
    let scale = await this.renderScale(choice, i, maxScaleItemsOnScreen)
    const margin = this.margin[1] + this.margin[3]
    this.scaleLength = colors.unstyle(scale).length
    this.widths[0] = Math.min(
      this.widths[0],
      this.longestPackageNameLength + margin - this.shortestPackageNameLength
    )
    const msg = utils.wordWrap(message, { width: this.widths[0], newline })
    let lines = msg.split('\n').map((line: string) => pad(line) + this.margin[1])

    let selectedBulletCharacter = '─'
    let bulletCharacter = ' '

    const now = new Date()
    if (now.getMonth() == 10 && now.getDate() == 31) {
      selectedBulletCharacter = '😱'
      bulletCharacter = '👻'
    }

    const hasSiblingAbove = this.visible[i - 1] && this.visible[i - 1].name === choice.name
    const hasSiblingBelow = this.visible[i + 1] && this.visible[i + 1].name === choice.name
    const hasSiblingsInBothDirections = hasSiblingAbove && hasSiblingBelow

    let suffixSymbol = ' '
    if (hasSiblingsInBothDirections) {
      suffixSymbol = '│'
    } else if (hasSiblingAbove) {
      suffixSymbol = '└'
    } else if (hasSiblingBelow) {
      suffixSymbol = '┌'
    }

    if (focused) {
      lines = lines.map((line: string) =>
        this.styles.hasAnsi(line) ? line : this.styles.danger(line)
      )
      lines[0] = bulletIndentation ? selectedBulletCharacter + '─> ' + lines[0] : '> '
    } else {
      lines[0] = bulletIndentation ? bulletCharacter + '   ' + lines[0] : lines[0]
    }

    lines[0] += suffixSymbol

    if (this.linebreak) lines.push('')

    let renderedChoice
    let columnSpaceRemaining

    const termColumns = process.stdout.columns

    do {
      scale = await this.renderScale(choice, i, maxScaleItemsOnScreen)

      const terminalFittedLines = [...lines]
      terminalFittedLines[0] += this.focused ? this.styles.info(scale) : scale

      renderedChoice = [ind + pointer, terminalFittedLines.join('\n')].filter(Boolean)
      columnSpaceRemaining =
        termColumns -
        stripAnsi(Array.isArray(renderedChoice) ? renderedChoice[0] : renderedChoice).length

      maxScaleItemsOnScreen--
    } while (columnSpaceRemaining < 25 && maxScaleItemsOnScreen > 0)

    return renderedChoice
  }

  isChoiceCategorized(choice: ChoiceInPrompt): boolean {
    return choice.category !== this.options.uncategorizedText
  }

  areAllChoicesUncategorized(choices: Array<ChoiceInPrompt>): boolean {
    return choices.every((ch: ChoiceInPrompt) => ch.category === this.options.uncategorizedText)
  }

  async renderChoicesAndCategories(): Promise<string | Array<string>> {
    if (this.state.submitted) return ''
    this.tableize()

    // fix the indexing?
    this.visible.forEach((ch: ChoiceInPrompt, index: number) => (ch.index = index))

    const categorizedChoicesExist = this.visible.some((ch: ChoiceInPrompt) =>
      this.isChoiceCategorized(ch)
    )

    const choicesAndCategories = []
    for (let i = 0; i < this.visible.length; i++) {
      const ch = this.visible[i]
      const renderedChoice = await this.renderChoice(ch, i, true)

      if (categorizedChoicesExist || this.filterText !== '') {
        const prevChoiceCategory = i === 0 ? null : this.visible[i - 1].category

        if (prevChoiceCategory !== ch.category) {
          choicesAndCategories.push(this.styles.underline(ch.category))
        }
      }

      choicesAndCategories.push(renderedChoice)
    }

    const visible = (await Promise.all(choicesAndCategories)).flat()
    return this.margin[0] + visible.join('\n')
  }

  async getFilterHeading(): Promise<string> {
    if (this.filterText !== '') {
      return 'Filtering by: ' + this.filterText + '\n'
    }
    return '[Type to filter -- up/down: change selected project -- left/right: switch scripts to run]\n'
  }

  getFilteredChoices(
    filterText: string,
    choices: Array<ChoiceInPrompt> /*, defaultItem*/
  ): Array<ChoiceInPrompt> {
    return this.getSortedChoices(
      fuzzy
        .filter(filterText || '', choices, {
          // fuzzy options
          // pre: ansiStyles.green.open,
          // post: ansiStyles.green.close,
          extract: (choice: ChoiceInPrompt) => choice.ansiLessName || stripAnsi(choice.name)
        })
        .map((e: { string: string; original: ChoiceInPrompt }) => {
          e.original.ansiLessName = stripAnsi(e.string)
          e.original.name = e.string
          e.original.message = e.string

          return e.original
        })
    )
  }

  async render(): Promise<void> {
    const { submitted, size } = this.state

    const prefix = await this.prefix()
    const separator = await this.separator()
    const message = await this.message()

    let prompt = ''
    if (this.options.promptLine !== false) {
      prompt = [prefix, message, separator, ''].join(' ')
      this.state.prompt = prompt
    }

    this.visible.forEach((ch: ChoiceInPrompt) => {
      if (ch.scaleIndex === undefined) {
        ch.scaleIndex = 1
      }
    })

    const header = await this.header()
    const output = await this.format()
    // let key = await this.renderScaleKey()
    const help = (await this.error()) || (await this.hint())
    const body = await this.renderChoicesAndCategories()
    const footer = await this.footer()
    const err = this.emptyError

    if (output) prompt += output
    if (help && !prompt.includes(help)) prompt += ' ' + help

    if (submitted && !output && !(body as string).trim() && this.multiple && err != null) {
      prompt += this.styles.danger(err)
    }

    const filterHeading = await this.getFilterHeading()

    this.clear(size)
    this.write([header, prompt /*, key*/, filterHeading, body, footer].filter(Boolean).join('\n'))
    if (!this.state.submitted) {
      this.write(this.margin[2])
    }
    this.restore()
  }

  async submit(): Promise<void> {
    this.value = []

    for (const choice of this.choices) {
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

export default RushSelect
