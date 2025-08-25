import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Custom hook that debounces a value
 * @param value - The value to debounce
 * @param delay - The delay in milliseconds
 * @returns The debounced value
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // Set up the timeout
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Clean up the timeout if value changes or component unmounts
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Custom hook that returns a debounced callback function
 * @param callback - The callback function to debounce
 * @param delay - The delay in milliseconds
 * @returns A debounced version of the callback
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): (...args: Parameters<T>) => void {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const callbackRef = useRef(callback);

  // Update the callback ref when it changes
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const debouncedCallback = useCallback(
    (...args: Parameters<T>) => {
      // Clear existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Set new timeout
      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args);
      }, delay);
    },
    [delay]
  );

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return debouncedCallback;
}

/**
 * Custom hook that tracks whether a value is being debounced
 * @param value - The value to track
 * @param delay - The delay in milliseconds
 * @returns An object with the debounced value and loading state
 */
export function useDebouncedState<T>(
  value: T,
  delay: number
): {
  debouncedValue: T;
  isDebouncing: boolean;
} {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  const [isDebouncing, setIsDebouncing] = useState(false);

  useEffect(() => {
    // Set debouncing state to true when value changes
    setIsDebouncing(true);

    const handler = setTimeout(() => {
      setDebouncedValue(value);
      setIsDebouncing(false);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return { debouncedValue, isDebouncing };
}

/**
 * Custom hook for debouncing input values with validation
 * @param initialValue - The initial value
 * @param delay - The delay in milliseconds
 * @param validator - Optional validation function
 * @returns An object with value, debounced value, setter, and validation state
 */
export function useDebouncedInput<T = string>(
  initialValue: T,
  delay: number,
  validator?: (value: T) => boolean | string
): {
  value: T;
  debouncedValue: T;
  setValue: (value: T) => void;
  isDebouncing: boolean;
  isValid: boolean;
  error: string | null;
} {
  const [value, setValue] = useState<T>(initialValue);
  const [error, setError] = useState<string | null>(null);
  const { debouncedValue, isDebouncing } = useDebouncedState(value, delay);
  const [isValid, setIsValid] = useState(true);

  useEffect(() => {
    if (validator && !isDebouncing) {
      const result = validator(debouncedValue);
      if (typeof result === 'boolean') {
        setIsValid(result);
        setError(result ? null : 'Invalid input');
      } else if (typeof result === 'string') {
        setIsValid(false);
        setError(result);
      }
    }
  }, [debouncedValue, validator, isDebouncing]);

  return {
    value,
    debouncedValue,
    setValue,
    isDebouncing,
    isValid,
    error
  };
}

export default useDebounce;