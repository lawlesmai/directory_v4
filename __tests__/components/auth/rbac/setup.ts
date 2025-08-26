import '@testing-library/jest-dom';
import { configure } from '@testing-library/react';

// Configure testing library
configure({
  testIdAttribute: 'data-testid',
  asyncUtilTimeout: 5000,
});

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock window.getComputedStyle
Object.defineProperty(window, 'getComputedStyle', {
  writable: true,
  value: jest.fn().mockImplementation(() => ({
    getPropertyValue: jest.fn().mockReturnValue(''),
  })),
});

// Mock HTMLElement.scrollIntoView
HTMLElement.prototype.scrollIntoView = jest.fn();

// Mock HTMLElement.focus
HTMLElement.prototype.focus = jest.fn();

// Mock HTMLElement.blur
HTMLElement.prototype.blur = jest.fn();

// Mock window.alert, confirm, prompt
global.alert = jest.fn();
global.confirm = jest.fn();
global.prompt = jest.fn();

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn().mockImplementation(() => Promise.resolve()),
    readText: jest.fn().mockImplementation(() => Promise.resolve(''))
  }
});

// Mock File and FileList for file upload tests
global.File = class MockFile extends Blob {
  name: string;
  lastModified: number;

  constructor(parts: BlobPart[], filename: string, properties?: FilePropertyBag) {
    super(parts, properties);
    this.name = filename;
    this.lastModified = properties?.lastModified || Date.now();
  }
};

global.FileList = class MockFileList extends Array<File> {
  item(index: number): File | null {
    return this[index] || null;
  }
};

// Mock DataTransfer for drag and drop tests
global.DataTransfer = class MockDataTransfer {
  data: { [key: string]: string } = {};
  effectAllowed: string = 'uninitialized';
  dropEffect: string = 'none';
  files: FileList = new FileList();
  items: DataTransferItemList = {} as DataTransferItemList;
  types: readonly string[] = [];

  clearData(format?: string): void {
    if (format) {
      delete this.data[format];
    } else {
      this.data = {};
    }
  }

  getData(format: string): string {
    return this.data[format] || '';
  }

  setData(format: string, data: string): void {
    this.data[format] = data;
  }

  setDragImage(element: Element, x: number, y: number): void {
    // Mock implementation
  }
};

// Mock requestAnimationFrame
global.requestAnimationFrame = (callback: FrameRequestCallback): number => {
  return setTimeout(callback, 16);
};

global.cancelAnimationFrame = (id: number): void => {
  clearTimeout(id);
};

// Mock console methods to reduce noise in tests
const originalError = console.error;
const originalWarn = console.warn;

beforeAll(() => {
  console.error = (...args: any[]) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Warning: ReactDOM.render') ||
       args[0].includes('Warning: componentWillReceiveProps') ||
       args[0].includes('Warning: componentWillMount'))
    ) {
      return;
    }
    originalError.call(console, ...args);
  };

  console.warn = (...args: any[]) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('componentWillReceiveProps has been renamed')
    ) {
      return;
    }
    originalWarn.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
  console.warn = originalWarn;
});

// Clear all mocks after each test
afterEach(() => {
  jest.clearAllMocks();
});

// Clean up DOM after each test
afterEach(() => {
  document.body.innerHTML = '';
});

// Mock crypto for UUID generation in tests
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: jest.fn(() => 'test-uuid-' + Math.random().toString(36).substr(2, 9)),
    getRandomValues: jest.fn((arr: any) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    })
  }
});

// Export utility functions for tests
export const createMockRole = (overrides = {}) => ({
  id: 'test-role-' + Math.random().toString(36).substr(2, 9),
  name: 'test_role',
  displayName: 'Test Role',
  description: 'A test role',
  level: 50,
  permissions: ['read:businesses'],
  inheritedPermissions: [],
  contexts: [],
  isSystemRole: false,
  isActive: true,
  metadata: {
    color: 'blue',
    icon: 'shield',
    category: 'custom'
  },
  constraints: {
    requiresApproval: false
  },
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: 'test-user',
  ...overrides
});

export const createMockPermission = (overrides = {}) => ({
  id: 'test-perm-' + Math.random().toString(36).substr(2, 9),
  name: 'read:test',
  displayName: 'Read Test',
  description: 'Test permission',
  resource: 'test',
  action: 'read',
  category: 'test',
  riskLevel: 'low',
  contexts: [],
  isSystemPermission: false,
  metadata: {
    icon: 'eye',
    color: 'green'
  },
  auditRequired: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides
});

export const createMockBusinessContext = (overrides = {}) => ({
  id: 'test-ctx-' + Math.random().toString(36).substr(2, 9),
  name: 'Test Context',
  type: 'business',
  isActive: true,
  ...overrides
});

export const createMockRBACEvent = (overrides = {}) => ({
  id: 'test-event-' + Math.random().toString(36).substr(2, 9),
  eventType: 'role_assigned',
  userId: 'test-user',
  resourceId: 'test-resource',
  resourceType: 'role',
  details: {},
  metadata: {
    ipAddress: '127.0.0.1',
    userAgent: 'test-agent',
    sessionId: 'test-session'
  },
  riskScore: 0,
  timestamp: new Date(),
  ...overrides
});

export const waitForAsync = () => new Promise(resolve => setTimeout(resolve, 0));