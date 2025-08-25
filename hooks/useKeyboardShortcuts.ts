import { useEffect, useRef, useCallback, useState, useMemo } from 'react';

interface ShortcutHandler {
  key: string;
  modifiers?: ('ctrl' | 'cmd' | 'alt' | 'shift')[];
  handler: (event: KeyboardEvent) => void;
  description?: string;
  preventDefault?: boolean;
  stopPropagation?: boolean;
  enableInInputs?: boolean;
}

interface UseKeyboardShortcutsOptions {
  enabled?: boolean;
  preventDefault?: boolean;
  stopPropagation?: boolean;
  enableInInputs?: boolean;
  debugMode?: boolean;
}

interface ShortcutRegistry {
  [key: string]: ShortcutHandler;
}

const DEFAULT_OPTIONS: UseKeyboardShortcutsOptions = {
  enabled: true,
  preventDefault: true,
  stopPropagation: false,
  enableInInputs: false,
  debugMode: false
};

// Helper to normalize key combinations
const normalizeKey = (key: string): string => {
  const keyMap: { [key: string]: string } = {
    'esc': 'Escape',
    'enter': 'Enter',
    'space': ' ',
    'tab': 'Tab',
    'delete': 'Delete',
    'backspace': 'Backspace',
    'up': 'ArrowUp',
    'down': 'ArrowDown',
    'left': 'ArrowLeft',
    'right': 'ArrowRight',
    'pageup': 'PageUp',
    'pagedown': 'PageDown',
    'home': 'Home',
    'end': 'End'
  };
  
  return keyMap[key.toLowerCase()] || key;
};

// Helper to check if event matches shortcut
const matchesShortcut = (event: KeyboardEvent, shortcut: ShortcutHandler): boolean => {
  const keyMatches = normalizeKey(event.key) === normalizeKey(shortcut.key);
  
  if (!keyMatches) return false;
  
  if (shortcut.modifiers) {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    
    return shortcut.modifiers.every(modifier => {
      switch (modifier) {
        case 'ctrl':
          return event.ctrlKey;
        case 'cmd':
          return isMac ? event.metaKey : event.ctrlKey;
        case 'alt':
          return event.altKey;
        case 'shift':
          return event.shiftKey;
        default:
          return false;
      }
    });
  }
  
  // If no modifiers specified, ensure no modifiers are pressed
  return !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey;
};

export const useKeyboardShortcuts = (
  shortcuts: ShortcutHandler[] = [],
  options: UseKeyboardShortcutsOptions = {}
) => {
  const config = { ...DEFAULT_OPTIONS, ...options };
  const registryRef = useRef<ShortcutRegistry>({});
  const [lastTriggered, setLastTriggered] = useState<string | null>(null);

  // Memoize the registry to prevent infinite loops
  const registry = useMemo(() => {
    const reg: ShortcutRegistry = {};
    shortcuts.forEach(shortcut => {
      const key = shortcut.modifiers ? shortcut.modifiers.join('+') + '+' + shortcut.key : shortcut.key;
      reg[key] = shortcut;
    });
    return reg;
  }, [shortcuts]);

  // Memoize active shortcuts to prevent unnecessary re-renders
  const activeShortcuts = useMemo(() => Object.keys(registry), [registry]);

  // Update registry ref when registry changes
  useEffect(() => {
    registryRef.current = registry;
  }, [registry]);

  // Handle keydown events
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!config.enabled) return;

    // Check if we're in an input element
    const target = event.target as HTMLElement;
    const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
    const isContentEditable = target.contentEditable === 'true';
    
    // Skip if in input and not enabled for inputs
    if ((isInput || isContentEditable) && !config.enableInInputs) {
      return;
    }

    // Find matching shortcut
    for (const shortcut of Object.values(registryRef.current)) {
      if (matchesShortcut(event, shortcut)) {
        // Check if this specific shortcut should work in inputs
        const shouldWorkInInput = shortcut.enableInInputs ?? config.enableInInputs;
        
        if ((isInput || isContentEditable) && !shouldWorkInInput) {
          continue;
        }

        // Prevent default if specified
        if (shortcut.preventDefault ?? config.preventDefault) {
          event.preventDefault();
        }

        // Stop propagation if specified
        if (shortcut.stopPropagation ?? config.stopPropagation) {
          event.stopPropagation();
        }

        // Call handler
        shortcut.handler(event);
        
        // Update last triggered
        const key = shortcut.modifiers ? shortcut.modifiers.join('+') + '+' + shortcut.key : shortcut.key;
        setLastTriggered(key);

        if (config.debugMode) {
          console.log('Keyboard shortcut triggered:', key, shortcut.description);
        }

        break;
      }
    }
  }, [config]);

  // Attach event listener
  useEffect(() => {
    if (!config.enabled) return;

    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [config.enabled, handleKeyDown]);

  // Dynamically register a shortcut
  const registerShortcut = useCallback((shortcut: ShortcutHandler) => {
    const key = shortcut.modifiers ? shortcut.modifiers.join('+') + '+' + shortcut.key : shortcut.key;
    registryRef.current[key] = shortcut;
    
    if (config.debugMode) {
      console.log('Registered shortcut:', key, shortcut.description);
    }
  }, [config.debugMode]);

  // Unregister a shortcut
  const unregisterShortcut = useCallback((key: string, modifiers?: string[]) => {
    const shortcutKey = modifiers ? modifiers.join('+') + '+' + key : key;
    delete registryRef.current[shortcutKey];
    
    if (config.debugMode) {
      console.log('Unregistered shortcut:', shortcutKey);
    }
  }, [config.debugMode]);

  // Check if a shortcut is registered
  const isShortcutActive = useCallback((key: string, modifiers?: string[]) => {
    const shortcutKey = modifiers ? modifiers.join('+') + '+' + key : key;
    return shortcutKey in registryRef.current;
  }, []);

  // Get all registered shortcuts
  const getShortcuts = useCallback(() => {
    return Object.entries(registryRef.current).map(([key, shortcut]) => ({
      key,
      ...shortcut
    }));
  }, []);

  // Enable/disable shortcuts
  const enable = useCallback(() => {
    config.enabled = true;
  }, [config]);

  const disable = useCallback(() => {
    config.enabled = false;
  }, [config]);

  return {
    registerShortcut,
    unregisterShortcut,
    isShortcutActive,
    getShortcuts,
    enable,
    disable,
    activeShortcuts,
    lastTriggered,
    isEnabled: config.enabled
  };
};

// Pre-configured shortcuts for common actions
export const useCommonShortcuts = (handlers: {
  onSearch?: () => void;
  onEscape?: () => void;
  onEnter?: () => void;
  onSave?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onHelp?: () => void;
  onToggleTheme?: () => void;
}) => {
  const shortcuts: ShortcutHandler[] = [];

  if (handlers.onSearch) {
    shortcuts.push({
      key: 'k',
      modifiers: ['cmd'],
      handler: () => handlers.onSearch!(),
      description: 'Focus search'
    });
  }

  if (handlers.onEscape) {
    shortcuts.push({
      key: 'Escape',
      handler: () => handlers.onEscape!(),
      description: 'Close modal/Clear search',
      enableInInputs: true
    });
  }

  if (handlers.onEnter) {
    shortcuts.push({
      key: 'Enter',
      handler: () => handlers.onEnter!(),
      description: 'Submit/Confirm'
    });
  }

  if (handlers.onSave) {
    shortcuts.push({
      key: 's',
      modifiers: ['cmd'],
      handler: () => handlers.onSave!(),
      description: 'Save'
    });
  }

  if (handlers.onUndo) {
    shortcuts.push({
      key: 'z',
      modifiers: ['cmd'],
      handler: () => handlers.onUndo!(),
      description: 'Undo'
    });
  }

  if (handlers.onRedo) {
    shortcuts.push({
      key: 'z',
      modifiers: ['cmd', 'shift'],
      handler: () => handlers.onRedo!(),
      description: 'Redo'
    });
  }

  if (handlers.onHelp) {
    shortcuts.push({
      key: '?',
      modifiers: ['shift'],
      handler: () => handlers.onHelp!(),
      description: 'Show help'
    });
  }

  if (handlers.onToggleTheme) {
    shortcuts.push({
      key: 't',
      modifiers: ['cmd', 'shift'],
      handler: () => handlers.onToggleTheme!(),
      description: 'Toggle theme'
    });
  }

  return useKeyboardShortcuts(shortcuts);
};

export default useKeyboardShortcuts;
