jest.mock('enquirer', () => ({
  Scale: function () {
    this.run = function () {
      return new Promise((resolve) => resolve())
    }
  }
}))

let mockLastSavedResult = {}
let mockLastLoadedResult = {}

jest.mock('./save-load.js', () => ({
  save: jest.fn((textContent) => {
    mockLastSavedResult = JSON.parse(textContent)
  }),
  load: jest.fn(() => {
    // faked stored data
    mockLastLoadedResult = {
      'mfe-package': 'build:watch'
    }

    return mockLastLoadedResult
  })
}))

jest.mock('find-up', () => ({
  sync: jest.fn(() => {
    return 'mocks/rush.json'
  })
}))

jest.mock('@lerna/child-process', () => ({
  spawnStreaming: jest.fn()
}))

jest.mock('./create-prompt.js', () => (/*choices, scriptsList*/) => ({
  run: jest.fn(() =>
    Promise.resolve({
      '# MICRO-FRONTENDS': 2,
      '-   mfe-package': 1,
      '# TOOLING': 2,
      '-   cli-package': 0,
      '# LIBRARIES': 2,
      '-   browser-package': -1
    })
  )
}))

describe('index.js', () => {
  beforeEach(async () => {
    jest.resetModules()

    await require('./index.js')
  })

  test('save data should match last loaded data', async () => {
    expect(mockLastSavedResult).toEqual(mockLastLoadedResult)
  })
})
