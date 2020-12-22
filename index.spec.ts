// let mockLastSavedResult = {}
// let mockLastLoadedResult = {}
import stripAnsi from 'strip-ansi'
import { SavedEntries, SubmittedChoice } from './interfaces'

const cleanupFunctionsToCall: Array<() => void> = []
let mockLastPrinted: string

const setup = async () => {
  global.console.log = jest.fn() // console.log are ignored in tests
  // Keep native behaviour for other methods, use those to print out things in your own tests, not `console.log`
  global.console.error = console.error
  global.console.warn = console.warn
  global.console.info = console.info
  global.console.debug = console.debug

  let mockLastSavedResult
  let mockLastLoadedResult: SavedEntries

  jest.mock('./save-load', () => ({
    save: jest.fn((directory: string, data: Array<SubmittedChoice>) => {
      // eslint-disable-next-line
      mockLastSavedResult = data
    }),
    load: jest.fn(() => {
      // faked stored data
      mockLastLoadedResult = {}

      return mockLastLoadedResult
    })
  }))

  jest.mock('find-up', () => ({
    sync: jest.fn(() => {
      return 'mocks/rush.json'
    })
  }))

  jest.mock('@lerna/child-process', () => ({
    spawnStreaming: jest.fn(() => ({
      once: () => Promise.resolve()
    }))
  }))

  jest.mock('./choice-generation', () => ({
    createChoices: jest.fn(() => ({
      choices: [
        {
          name: 'browser-package',
          category: 'libraries',
          availableScripts: ['build', 'build:prod', 'test']
        },
        {
          name: 'mfe-package-a',
          category: 'micro-frontends',
          availableScripts: ['build', 'build:prod']
        },
        {
          name: 'mfe-package-b',
          category: 'micro-frontends',
          availableScripts: ['build', 'build:prod']
        },
        {
          name: 'cli-package',
          category: 'tooling',
          availableScripts: ['build', 'build:prod']
        },
        {
          name: 'random-package',
          category: undefined,
          availableScripts: ['build', 'build:prod']
        }
      ],
      allScriptNames: ['build', 'build:prod', 'test']
    })),
    applySelectedScriptsOnChoicesFromCache: jest.fn()
  }))

  let mockPromptInstance: any
  let mockRunPromise: any
  let mockReadyResolve: any
  const promptReadyPromise = new Promise((resolve: any) => {
    mockReadyResolve = resolve
  })
  jest.mock('./prompt', () => {
    return class RushSelect extends jest.requireActual('./prompt').default {
      stdout: any
      constructor(options: any) {
        super(options)
        mockPromptInstance = this

        this.stdout = {
          write: jest.fn((text) => {
            text = stripAnsi(text)

            if (text !== '') {
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              mockLastPrinted = text
            }
          }),
          removeListener: jest.fn()
        }
      }

      async run() {
        mockRunPromise = super.run()
        return mockRunPromise

        // returning the answers immediately here can be helpful too.
        // return []
      }

      async reset() {
        await super.reset()

        mockReadyResolve()
      }
    }
  })

  // start the prompt
  require('./index')

  // wait for initial render completion
  await promptReadyPromise

  const runAndSubmit = () => {
    // perform and await the final submit step
    mockPromptInstance.submit()
    return mockRunPromise
  }

  cleanupFunctionsToCall.push(runAndSubmit)

  return {
    promptInstance: mockPromptInstance,
    runAndSubmit
  }
}
describe('index', () => {
  beforeEach(async () => {
    jest.resetModules()
    jest.clearAllMocks()
  })

  afterEach(async () => {
    cleanupFunctionsToCall.splice(0).forEach((f) => f())
  })

  test('submitting immediately should leave basically empty results', async () => {
    const { runAndSubmit } = await setup()

    expect(await runAndSubmit()).toEqual([
      {
        packageName: 'rush build',
        script: 'smart',
        scriptExecutable: 'rush',
        scriptCommand: []
      }
    ])
  })
  test('should list some packages', async () => {
    const { promptInstance, runAndSubmit } = await setup()

    await promptInstance.down()
    await promptInstance.down()
    await promptInstance.right()
    await promptInstance.right()

    expect(await runAndSubmit()).toEqual([
      {
        packageName: 'rush build',
        script: 'smart',
        scriptExecutable: 'rush',
        scriptCommand: []
      },
      {
        packageName: 'random-package',
        script: 'build:prod',
        scriptExecutable: undefined,
        scriptCommand: undefined
      }
    ])
  })
  test('scrolling', async () => {
    const { promptInstance } = await setup()

    for (let i = 0; i < 30; i++) {
      await promptInstance.down()
    }

    expect(promptInstance.choices[promptInstance.index].name).toBe('random-package')

    for (let i = 0; i < 60; i++) {
      await promptInstance.up()
    }

    expect(promptInstance.choices[promptInstance.index].name).toBe('mfe-package-b')
  })
  test('navigation should be intact', async () => {
    const { promptInstance } = await setup()

    await promptInstance.down()
    await promptInstance.down()
    await promptInstance.down()
    expect(promptInstance.choices[promptInstance.index].name).toBe('browser-package')
    await promptInstance.down()
    await promptInstance.down()
    expect(promptInstance.choices[promptInstance.index].name).toBe('mfe-package-b')
    await promptInstance.up()
    expect(promptInstance.choices[promptInstance.index].name).toBe('mfe-package-a')
    await promptInstance.up()
    expect(promptInstance.choices[promptInstance.index].name).toBe('browser-package')
    await promptInstance.down()
    await promptInstance.down()
    await promptInstance.up()
    await promptInstance.up()
    expect(promptInstance.choices[promptInstance.index].name).toBe('browser-package')
  })
  test('filtering', async () => {
    const { promptInstance, runAndSubmit } = await setup()

    promptInstance.onKeyPress('r', {})
    promptInstance.onKeyPress('a', {})
    promptInstance.onKeyPress('n', {})
    promptInstance.onKeyPress('d', {})

    await promptInstance.right()

    expect(promptInstance.visible).toHaveLength(1)
    expect(promptInstance.visible[0].name).toBe('random-package')
    expect(promptInstance.visible[0].scaleIndex).toBe(1)

    promptInstance.onKeyPress('', { action: 'delete' })

    expect(promptInstance.visible).toHaveLength(1)
    expect(promptInstance.visible[0].name).toBe('random-package')
    expect(promptInstance.visible[0].scaleIndex).toBe(1)

    promptInstance.onKeyPress('', { action: 'delete' })
    promptInstance.onKeyPress('', { action: 'delete' })
    promptInstance.onKeyPress('', { action: 'delete' })
    promptInstance.onKeyPress('', { action: 'delete' })

    const result = await runAndSubmit()
    expect(result).toEqual([
      {
        packageName: 'rush build',
        script: 'smart',
        scriptExecutable: 'rush',
        scriptCommand: []
      },
      {
        packageName: 'random-package',
        script: 'build',
        scriptExecutable: undefined,
        scriptCommand: undefined
      }
    ])
  })
})
