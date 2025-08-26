// Comprehensive Type Mocking Utilities

export type MockFunction<T extends (...args: any[]) => any> = jest.MockedFunction<T>;

export const createMockFunction = <T extends (...args: any[]) => any>(
  implementation?: T
): MockFunction<T> => {
  return jest.fn(implementation);
};

export const mockResolvedValue = <T>(value: T) => 
  jest.fn().mockResolvedValue(value);

export const mockRejectedValue = <T extends Error>(error: T) => 
  jest.fn().mockRejectedValue(error);

export type PartialMock<T> = {
  [K in keyof T]?: T[K] extends (...args: any[]) => any 
    ? MockFunction<T[K]> 
    : T[K];
};

export const createPartialMock = <T>(obj: PartialMock<T>): T => {
  return obj as T;
};

export const resetMock = <T>(mock: MockFunction<T>) => {
  mock.mockReset();
};

export const resetAllMocks = () => {
  jest.resetAllMocks();
};
