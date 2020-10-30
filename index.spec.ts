// let mockLastSavedResult = {}
// let mockLastLoadedResult = {}

const setup = async () => {
  // @ts-ignore
  global.console = {
    log: jest.fn(), // console.log are ignored in tests

    // Keep native behaviour for other methods, use those to print out things in your own tests, not `console.log`
    error: console.error,
    warn: console.warn,
    info: console.info,
    debug: console.debug
  }

  let mockLastSavedResult
  let mockLastLoadedResult: any

  jest.mock('./save-load', () => ({
    save: jest.fn((directory: any, data: any) => {
      // eslint-disable-next-line
      mockLastSavedResult = data
    }),
    load: jest.fn(() => {
      // faked stored data
      mockLastLoadedResult = []

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
    setInitialValuesOnChoices: jest.fn()
  }))

  let mockPromptInstance: any
  let mockRunPromise: any
  let mockReadyResolve: any
  const promptReadyPromise = new Promise((resolve) => {
    mockReadyResolve = resolve
  })
  jest.mock('./prompt', () => {
    return class RushSelect extends jest.requireActual('./prompt') {
      stdout: any
      constructor(options: any) {
        super(options)
        mockPromptInstance = this

        this.stdout = {
          write: jest.fn(),
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

  const submitAndRun = () => {
    // perform and await the final submit step
    mockPromptInstance.submit()
    return mockRunPromise
  }

  return {
    promptInstance: mockPromptInstance,
    submitAndRun
  }
}
describe('index', () => {
  beforeEach(async () => {
    jest.resetModules()
    jest.clearAllMocks()
  })
  test('submitting immediately should leave basically empty results', async () => {
    const { submitAndRun } = await setup()

    expect(await submitAndRun()).toEqual([
      {
        packageName: 'rush build',
        script: 'smart',
        scriptExecutable: 'rush',
        scriptCommand: []
      }
    ])
  })
  test('should list some packages', async () => {
    const { promptInstance, submitAndRun } = await setup()

    // set random-package to build-prod
    await promptInstance.down()
    await promptInstance.down()
    await promptInstance.right()
    await promptInstance.right()

    expect(await submitAndRun()).toEqual([
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
  test('entries should not randomly disappear despite doing filtering', async () => {
    const { promptInstance, submitAndRun } = await setup()

    promptInstance.onKeyPress('r', {})
    promptInstance.onKeyPress('a', {})
    promptInstance.onKeyPress('n', {})
    promptInstance.onKeyPress('d', {})

    await promptInstance.down()
    await promptInstance.right()
    await promptInstance.down()
    await promptInstance.right()

    expect(promptInstance.visible).toHaveLength(1)
    expect(promptInstance.visible[0].name).toBe('random-package')
    expect(promptInstance.visible[0].scaleIndex).toBe(1)

    promptInstance.onKeyPress('', { action: 'delete' })

    expect(promptInstance.visible).toHaveLength(2)
    expect(promptInstance.visible[0].name).toBe('random-package')
    expect(promptInstance.visible[0].scaleIndex).toBe(1)

    promptInstance.onKeyPress('', { action: 'delete' })
    promptInstance.onKeyPress('', { action: 'delete' })
    promptInstance.onKeyPress('', { action: 'delete' })
    promptInstance.onKeyPress('', { action: 'delete' })

    const result = await submitAndRun()
    expect(result).toEqual([
      {
        packageName: 'random-package',
        script: 'build',
        scriptExecutable: undefined,
        scriptCommand: undefined
      },
      {
        packageName: 'rush build',
        script: 'regular',
        scriptExecutable: 'rush',
        scriptCommand: []
      }
    ])
  })
})
