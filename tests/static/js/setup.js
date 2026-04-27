// Jest setup file
// Setup any global test utilities or mocks here

// Mock global fetch for API tests
global.fetch = jest.fn();

// Reset mocks before each test
beforeEach(() => {
  fetch.mockClear();
});

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});
