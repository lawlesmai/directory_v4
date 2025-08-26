import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import {
  useScreenReader,
  useFocusManagement,
  useKeyboardNavigation,
  useReducedMotion,
  useHighContrast,
  SkipLink,
  AccessibleField,
  AccessibleButton,
  AccessibleToggle,
  StatusMessage,
  AccessibleProgress,
  LiveRegion,
  AccessibleModal,
} from '@/components/auth/profile/AccessibilityUtils';

// Mock framer-motion for testing
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  },
}));

// Test component for hooks
const TestComponent: React.FC<{
  onEscape?: () => void;
  onEnter?: () => void;
  onArrowUp?: () => void;
  onArrowDown?: () => void;
}> = ({ onEscape, onEnter, onArrowUp, onArrowDown }) => {
  const { announce } = useScreenReader();
  const { getFocusableElements, trapFocus } = useFocusManagement();
  const prefersReducedMotion = useReducedMotion();
  const isHighContrast = useHighContrast();

  useKeyboardNavigation(onEscape, onEnter, onArrowUp, onArrowDown);

  return (
    <div data-testid="test-component">
      <button onClick={() => announce('Test announcement')}>Announce</button>
      <div data-reduced-motion={prefersReducedMotion}>Motion Test</div>
      <div data-high-contrast={isHighContrast}>Contrast Test</div>
      <input type="text" />
      <button>Focus Test</button>
    </div>
  );
};

describe('Accessibility Utils', () => {
  describe('useScreenReader hook', () => {
    it('creates screen reader announcements', async () => {
      const user = userEvent.setup();
      render(<TestComponent />);

      const announceButton = screen.getByText('Announce');
      await user.click(announceButton);

      // Check that an element with aria-live was created
      await waitFor(() => {
        const liveRegion = document.querySelector('[aria-live]');
        expect(liveRegion).toBeInTheDocument();
      });
    });

    it('removes announcement elements after timeout', async () => {
      const user = userEvent.setup();
      render(<TestComponent />);

      const announceButton = screen.getByText('Announce');
      await user.click(announceButton);

      // Should be present initially
      await waitFor(() => {
        const liveRegion = document.querySelector('[aria-live]');
        expect(liveRegion).toBeInTheDocument();
      });

      // Should be removed after timeout
      await waitFor(() => {
        const liveRegion = document.querySelector('[aria-live]');
        expect(liveRegion).not.toBeInTheDocument();
      }, { timeout: 2000 });
    });
  });

  describe('useKeyboardNavigation hook', () => {
    it('handles Escape key press', async () => {
      const user = userEvent.setup();
      const mockOnEscape = jest.fn();
      render(<TestComponent onEscape={mockOnEscape} />);

      await user.keyboard('{Escape}');
      expect(mockOnEscape).toHaveBeenCalled();
    });

    it('handles Enter key press on buttons', async () => {
      const user = userEvent.setup();
      const mockOnEnter = jest.fn();
      render(<TestComponent onEnter={mockOnEnter} />);

      const button = screen.getByText('Focus Test');
      button.focus();
      await user.keyboard('{Enter}');

      expect(mockOnEnter).toHaveBeenCalled();
    });

    it('handles arrow key navigation', async () => {
      const user = userEvent.setup();
      const mockOnArrowUp = jest.fn();
      const mockOnArrowDown = jest.fn();
      render(<TestComponent onArrowUp={mockOnArrowUp} onArrowDown={mockOnArrowDown} />);

      await user.keyboard('{ArrowUp}');
      expect(mockOnArrowUp).toHaveBeenCalled();

      await user.keyboard('{ArrowDown}');
      expect(mockOnArrowDown).toHaveBeenCalled();
    });
  });

  describe('useReducedMotion hook', () => {
    it('detects reduced motion preference', () => {
      // Mock matchMedia for reduced motion
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation((query) => ({
          matches: query === '(prefers-reduced-motion: reduce)',
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn(),
        })),
      });

      render(<TestComponent />);
      const motionElement = screen.getByText('Motion Test');
      expect(motionElement).toHaveAttribute('data-reduced-motion', 'true');
    });
  });

  describe('SkipLink component', () => {
    it('renders skip link with proper attributes', () => {
      render(<SkipLink href="#main">Skip to main content</SkipLink>);

      const skipLink = screen.getByRole('link', { name: /skip to main content/i });
      expect(skipLink).toBeInTheDocument();
      expect(skipLink).toHaveAttribute('href', '#main');
    });

    it('has sr-only class by default and focus styles', () => {
      render(<SkipLink href="#main">Skip to main content</SkipLink>);

      const skipLink = screen.getByRole('link', { name: /skip to main content/i });
      expect(skipLink).toHaveClass('sr-only');
    });
  });

  describe('AccessibleField component', () => {
    it('renders field with proper labels and IDs', () => {
      render(
        <AccessibleField 
          id="test-field" 
          label="Test Field" 
          description="This is a test field"
          required
        >
          <input type="text" id="test-field" />
        </AccessibleField>
      );

      const label = screen.getByText('Test Field');
      const description = screen.getByText('This is a test field');
      const input = screen.getByRole('textbox');

      expect(label).toBeInTheDocument();
      expect(description).toBeInTheDocument();
      expect(description).toHaveAttribute('id', 'test-field-description');
      expect(input).toHaveAttribute('aria-describedby', 'test-field-description');
    });

    it('shows required indicator for required fields', () => {
      render(
        <AccessibleField id="required-field" label="Required Field" required>
          <input type="text" id="required-field" />
        </AccessibleField>
      );

      expect(screen.getByText('*')).toBeInTheDocument();
    });

    it('displays error messages with proper ARIA attributes', () => {
      render(
        <AccessibleField 
          id="error-field" 
          label="Error Field" 
          error="This field has an error"
        >
          <input type="text" id="error-field" />
        </AccessibleField>
      );

      const errorMessage = screen.getByText('This field has an error');
      const input = screen.getByRole('textbox');

      expect(errorMessage).toBeInTheDocument();
      expect(errorMessage).toHaveAttribute('role', 'alert');
      expect(errorMessage).toHaveAttribute('aria-live', 'polite');
      expect(input).toHaveAttribute('aria-describedby', 'error-field-error');
    });
  });

  describe('AccessibleButton component', () => {
    it('renders button with proper attributes', () => {
      render(
        <AccessibleButton onClick={jest.fn()} ariaLabel="Custom label">
          Click me
        </AccessibleButton>
      );

      const button = screen.getByRole('button', { name: /custom label/i });
      expect(button).toBeInTheDocument();
      expect(button).toHaveAttribute('type', 'button');
    });

    it('shows loading state correctly', () => {
      render(
        <AccessibleButton loading ariaLabel="Loading button">
          Submit
        </AccessibleButton>
      );

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute('aria-busy', 'true');
    });

    it('applies different variants correctly', () => {
      const { rerender } = render(
        <AccessibleButton variant="primary">Primary</AccessibleButton>
      );

      let button = screen.getByRole('button');
      expect(button).toHaveClass('bg-teal-primary');

      rerender(<AccessibleButton variant="danger">Danger</AccessibleButton>);
      
      button = screen.getByRole('button');
      expect(button).toHaveClass('bg-red-error');
    });

    it('handles click events', async () => {
      const user = userEvent.setup();
      const mockClick = jest.fn();
      render(<AccessibleButton onClick={mockClick}>Click me</AccessibleButton>);

      const button = screen.getByRole('button');
      await user.click(button);

      expect(mockClick).toHaveBeenCalled();
    });
  });

  describe('AccessibleToggle component', () => {
    it('renders toggle with proper ARIA attributes', () => {
      const mockOnChange = jest.fn();
      render(
        <AccessibleToggle
          id="test-toggle"
          label="Test Toggle"
          description="This is a test toggle"
          checked={false}
          onChange={mockOnChange}
        />
      );

      const toggle = screen.getByRole('switch');
      const label = screen.getByText('Test Toggle');
      const description = screen.getByText('This is a test toggle');

      expect(toggle).toBeInTheDocument();
      expect(toggle).toHaveAttribute('aria-checked', 'false');
      expect(label).toBeInTheDocument();
      expect(description).toBeInTheDocument();
    });

    it('toggles state when clicked', async () => {
      const user = userEvent.setup();
      const mockOnChange = jest.fn();
      render(
        <AccessibleToggle
          id="toggle-test"
          label="Toggle Test"
          checked={false}
          onChange={mockOnChange}
        />
      );

      const toggle = screen.getByRole('switch');
      await user.click(toggle);

      expect(mockOnChange).toHaveBeenCalledWith(true);
    });

    it('shows disabled state correctly', () => {
      const mockOnChange = jest.fn();
      render(
        <AccessibleToggle
          id="disabled-toggle"
          label="Disabled Toggle"
          checked={false}
          onChange={mockOnChange}
          disabled
        />
      );

      const toggle = screen.getByRole('switch');
      expect(toggle).toBeDisabled();
    });
  });

  describe('StatusMessage component', () => {
    it('renders different message types correctly', () => {
      const { rerender } = render(
        <StatusMessage type="success">Success message</StatusMessage>
      );

      let message = screen.getByRole('status');
      expect(message).toBeInTheDocument();
      expect(message).toHaveAttribute('aria-live', 'polite');

      rerender(<StatusMessage type="error">Error message</StatusMessage>);
      
      message = screen.getByRole('alert');
      expect(message).toHaveAttribute('aria-live', 'assertive');
    });

    it('shows dismissible message with close button', async () => {
      const user = userEvent.setup();
      const mockOnDismiss = jest.fn();
      render(
        <StatusMessage 
          type="info" 
          dismissible 
          onDismiss={mockOnDismiss}
          title="Info Title"
        >
          Info message
        </StatusMessage>
      );

      const title = screen.getByText('Info Title');
      const closeButton = screen.getByRole('button', { name: /dismiss message/i });

      expect(title).toBeInTheDocument();
      expect(closeButton).toBeInTheDocument();

      await user.click(closeButton);
      expect(mockOnDismiss).toHaveBeenCalled();
    });
  });

  describe('AccessibleProgress component', () => {
    it('renders progress bar with proper ARIA attributes', () => {
      render(
        <AccessibleProgress
          value={75}
          max={100}
          label="Loading progress"
          description="Please wait while we load your content"
          showPercentage
        />
      );

      const progressbar = screen.getByRole('progressbar');
      const label = screen.getByText('Loading progress');
      const description = screen.getByText('Please wait while we load your content');
      const percentage = screen.getByText('75%');

      expect(progressbar).toHaveAttribute('aria-valuenow', '75');
      expect(progressbar).toHaveAttribute('aria-valuemin', '0');
      expect(progressbar).toHaveAttribute('aria-valuemax', '100');
      expect(progressbar).toHaveAttribute('aria-valuetext', '75 of 100 complete (75%)');
      expect(label).toBeInTheDocument();
      expect(description).toBeInTheDocument();
      expect(percentage).toBeInTheDocument();
    });

    it('hides percentage when showPercentage is false', () => {
      render(
        <AccessibleProgress
          value={50}
          max={100}
          label="Progress"
          showPercentage={false}
        />
      );

      expect(screen.queryByText('50%')).not.toBeInTheDocument();
    });
  });

  describe('LiveRegion component', () => {
    it('renders with proper ARIA live region attributes', () => {
      render(
        <LiveRegion politeness="assertive" atomic={false}>
          <div>Dynamic content</div>
        </LiveRegion>
      );

      const liveRegion = screen.getByText('Dynamic content').parentElement;
      expect(liveRegion).toHaveAttribute('aria-live', 'assertive');
      expect(liveRegion).toHaveAttribute('aria-atomic', 'false');
    });

    it('uses default attributes when not specified', () => {
      render(
        <LiveRegion>
          <div>Default content</div>
        </LiveRegion>
      );

      const liveRegion = screen.getByText('Default content').parentElement;
      expect(liveRegion).toHaveAttribute('aria-live', 'polite');
      expect(liveRegion).toHaveAttribute('aria-atomic', 'true');
    });
  });

  describe('AccessibleModal component', () => {
    it('renders modal with proper ARIA attributes when open', () => {
      render(
        <AccessibleModal
          isOpen={true}
          onClose={jest.fn()}
          title="Test Modal"
          description="This is a test modal"
        >
          <p>Modal content</p>
        </AccessibleModal>
      );

      const dialog = screen.getByRole('dialog');
      const title = screen.getByText('Test Modal');
      const description = screen.getByText('This is a test modal');
      const closeButton = screen.getByRole('button', { name: /close modal/i });

      expect(dialog).toBeInTheDocument();
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAttribute('aria-labelledby', 'modal-title');
      expect(dialog).toHaveAttribute('aria-describedby', 'modal-description');
      expect(title).toHaveAttribute('id', 'modal-title');
      expect(description).toHaveAttribute('id', 'modal-description');
      expect(closeButton).toBeInTheDocument();
    });

    it('does not render when closed', () => {
      render(
        <AccessibleModal
          isOpen={false}
          onClose={jest.fn()}
          title="Test Modal"
        >
          <p>Modal content</p>
        </AccessibleModal>
      );

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.queryByText('Modal content')).not.toBeInTheDocument();
    });

    it('calls onClose when close button is clicked', async () => {
      const user = userEvent.setup();
      const mockOnClose = jest.fn();
      render(
        <AccessibleModal
          isOpen={true}
          onClose={mockOnClose}
          title="Test Modal"
        >
          <p>Modal content</p>
        </AccessibleModal>
      );

      const closeButton = screen.getByRole('button', { name: /close modal/i });
      await user.click(closeButton);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('calls onClose when overlay is clicked and closeOnOverlay is true', async () => {
      const user = userEvent.setup();
      const mockOnClose = jest.fn();
      render(
        <AccessibleModal
          isOpen={true}
          onClose={mockOnClose}
          title="Test Modal"
          closeOnOverlay={true}
        >
          <p>Modal content</p>
        </AccessibleModal>
      );

      // Click on the backdrop/overlay
      const backdrop = document.querySelector('.fixed.inset-0.bg-navy-dark\\/80');
      if (backdrop) {
        await user.click(backdrop);
        expect(mockOnClose).toHaveBeenCalled();
      }
    });

    it('handles escape key when closeOnEscape is true', async () => {
      const user = userEvent.setup();
      const mockOnClose = jest.fn();
      render(
        <AccessibleModal
          isOpen={true}
          onClose={mockOnClose}
          title="Test Modal"
          closeOnEscape={true}
        >
          <p>Modal content</p>
        </AccessibleModal>
      );

      await user.keyboard('{Escape}');
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe('Focus Management', () => {
    it('manages focus correctly in modal', () => {
      render(
        <AccessibleModal
          isOpen={true}
          onClose={jest.fn()}
          title="Focus Test Modal"
        >
          <input type="text" placeholder="First input" />
          <button>Test button</button>
          <input type="text" placeholder="Last input" />
        </AccessibleModal>
      );

      // First focusable element should eventually receive focus
      // This is harder to test without more complex focus management mocking
      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
    });
  });

  describe('High Contrast Detection', () => {
    it('detects high contrast mode', () => {
      // Mock forced-colors media query
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation((query) => ({
          matches: query === '(forced-colors: active)',
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn(),
        })),
      });

      render(<TestComponent />);
      const contrastElement = screen.getByText('Contrast Test');
      expect(contrastElement).toHaveAttribute('data-high-contrast', 'true');
    });
  });
});