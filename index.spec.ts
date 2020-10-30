// let mockLastSavedResult = {}
// let mockLastLoadedResult = {}

const setup = async () => {
  // @ts-expect-error ts-migrate(2740) FIXME: Type '{ log: any; error: { (...data: any[]): void;... Remove this comment to see the full error message
  global.console = {
    // @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'jest'.
    log: jest.fn(), // console.log are ignored in tests

    // Keep native behaviour for other methods, use those to print out things in your own tests, not `console.log`
    error: console.error,
    warn: console.warn,
    info: console.info,
    debug: console.debug
  }

  let mockLastSavedResult
  let mockLastLoadedResult: any

  // @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'jest'.
  jest.mock('./save-load.js', () => ({
    // @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'jest'.
    save: jest.fn((directory: any, data: any) => {
      // eslint-disable-next-line
      mockLastSavedResult = data
    }),
    // @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'jest'.
    load: jest.fn(() => {
      // faked stored data
      mockLastLoadedResult = []

      return mockLastLoadedResult
    })
  }))

  // @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'jest'.
  jest.mock('find-up', () => ({
    // @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'jest'.
    sync: jest.fn(() => {
      return 'mocks/rush.json'
    })
  }))

  // @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'jest'.
  jest.mock('@lerna/child-process', () => ({
    // @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'jest'.
    spawnStreaming: jest.fn(() => ({
      once: () => Promise.resolve()
    }))
  }))

  // @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'jest'.
  jest.mock('./choice-generation.js', () => ({
    // @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'jest'.
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
    // @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'jest'.
    setInitialValuesOnChoices: jest.fn()
  }))

  let mockPromptInstance: any
  let mockRunPromise: any
  let mockReadyResolve: any
  const promptReadyPromise = new Promise((resolve) => {
    mockReadyResolve = resolve
  })

  // @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'jest'.
  jest.mock('./prompt', () => {
    // @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'jest'.
    return class RushSelect extends jest.requireActual('./prompt.js') {
      stdout: any;
      constructor(options: any) {
        super(options)
        mockPromptInstance = this

        this.stdout = {
          // @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'jest'.
          write: jest.fn(),
          // @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'jest'.
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
    };
  })

  // start the prompt
  require('./index.js')

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

// @ts-expect-error ts-migrate(2582) FIXME: Cannot find name 'describe'. Do you need to instal... Remove this comment to see the full error message
describe('index.js', () => {
  // @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'beforeEach'.
  beforeEach(async () => {
    // @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'jest'.
    jest.resetModules()
    // @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'jest'.
    jest.clearAllMocks()
  })

  // @ts-expect-error ts-migrate(2582) FIXME: Cannot find name 'test'. Do you need to install ty... Remove this comment to see the full error message
  test('submitting immediately should leave basically empty results', async () => {
    const { submitAndRun } = await setup()

    // @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'expect'.
    expect(await submitAndRun()).toEqual([
      {
        packageName: 'rush build',
        script: 'smart',
        scriptExecutable: 'rush',
        scriptCommand: []
      }
    ])
  })

  // @ts-expect-error ts-migrate(2582) FIXME: Cannot find name 'test'. Do you need to install ty... Remove this comment to see the full error message
  test('should list some packages', async () => {
    const { promptInstance, submitAndRun } = await setup()

    // set random-package to build-prod
    await promptInstance.down()
    await promptInstance.down()
    await promptInstance.right()
    await promptInstance.right()

    // @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'expect'.
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

  // @ts-expect-error ts-migrate(2582) FIXME: Cannot find name 'test'. Do you need to install ty... Remove this comment to see the full error message
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

    // @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'expect'.
    expect(promptInstance.choices).toHaveLength(2)
    // @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'expect'.
    expect(promptInstance.choices[0].name).toBe('random-package')
    // @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'expect'.
    expect(promptInstance.choices[0].scaleIndex).toBe(1)
    // @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'expect'.
    expect(promptInstance.choices[1].name).toBe('random-package')
    // @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'expect'.
    expect(promptInstance.choices[1].scaleIndex).toBe(1)

    promptInstance.onKeyPress('', { action: 'delete' })

    // @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'expect'.
    expect(promptInstance.choices).toHaveLength(2)
    // @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'expect'.
    expect(promptInstance.choices[0].name).toBe('random-package')
    // @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'expect'.
    expect(promptInstance.choices[0].scaleIndex).toBe(1)
    // @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'expect'.
    expect(promptInstance.choices[1].name).toBe('random-package')
    // @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'expect'.
    expect(promptInstance.choices[1].scaleIndex).toBe(1)

    promptInstance.onKeyPress('', { action: 'delete' })
    promptInstance.onKeyPress('', { action: 'delete' })
    promptInstance.onKeyPress('', { action: 'delete' })
    promptInstance.onKeyPress('', { action: 'delete' })

    const result = await submitAndRun()
    // @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'expect'.
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
      },
      {
        packageName: 'random-package',
        script: 'build',
        scriptExecutable: undefined,
        scriptCommand: undefined
      }
    ])
  })

  // TODO: Make a test that shows how filtering breaks the navigation
})
