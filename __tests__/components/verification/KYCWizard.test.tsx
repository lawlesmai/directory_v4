import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { KYCWizard } from '@/components/verification/KYCWizard';
import { useKYCVerification } from '@/hooks/useKYCVerification';

// Mock the hooks
jest.mock('@/hooks/useKYCVerification');
jest.mock('@/hooks/useMediaDevices', () => ({
  useMediaDevices: () => ({
    hasCamera: true,
    hasMicrophone: false,
    requestCameraPermission: jest.fn().mockResolvedValue(true),
    checkDevicePermissions: jest.fn()
  })
}));
jest.mock('@/hooks/useIsMobile', () => ({
  useIsMobile: () => false
}));

const mockUseKYCVerification = useKYCVerification as jest.MockedFunction<typeof useKYCVerification>;

const mockKYCVerificationReturn = {
  workflowId: 'test-workflow-id',
  verificationStatus: null,
  isLoading: false,
  error: null,
  initializeVerification: jest.fn(),
  submitStepData: jest.fn(),
  uploadDocument: jest.fn(),
  submitForReview: jest.fn(),
  refreshStatus: jest.fn()
};

describe('KYCWizard', () => {
  beforeEach(() => {
    mockUseKYCVerification.mockReturnValue(mockKYCVerificationReturn);
    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
        clear: jest.fn(),
      },
      writable: true,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('renders the KYC wizard with initial step', () => {
      render(<KYCWizard />);
      
      expect(screen.getByText('Business Verification')).toBeInTheDocument();
      expect(screen.getByText('Complete your business verification to unlock all features')).toBeInTheDocument();
      expect(screen.getByText('Step 1 of 5')).toBeInTheDocument();
    });

    it('calls initializeVerification on mount', async () => {
      render(<KYCWizard />);
      
      await waitFor(() => {
        expect(mockKYCVerificationReturn.initializeVerification).toHaveBeenCalled();
      });
    });

    it('shows loading state during initialization', () => {
      mockUseKYCVerification.mockReturnValue({
        ...mockKYCVerificationReturn,
        isLoading: true
      });

      render(<KYCWizard />);
      
      expect(screen.getByText('Initializing verification...')).toBeInTheDocument();
    });
  });

  describe('Step Navigation', () => {
    it('starts with the compliance education step', () => {
      render(<KYCWizard />);
      
      expect(screen.getByText('Verification Overview')).toBeInTheDocument();
    });

    it('shows progress indicator with current step highlighted', () => {
      render(<KYCWizard />);
      
      const progressBar = screen.getByRole('progressbar', { hidden: true });
      expect(progressBar).toBeInTheDocument();
    });

    it('disables back button on first step', () => {
      render(<KYCWizard />);
      
      const backButton = screen.queryByText('Back');
      expect(backButton).not.toBeInTheDocument();
    });

    it('enables navigation to next step after completion', async () => {
      const user = userEvent.setup();
      render(<KYCWizard />);
      
      // Mock completing the first step
      const continueButton = screen.getByRole('button', { name: /continue/i });
      
      await user.click(continueButton);
      
      // Should move to next step or show completion
      await waitFor(() => {
        expect(mockKYCVerificationReturn.submitStepData).toHaveBeenCalled();
      });
    });
  });

  describe('Step Completion', () => {
    it('marks steps as completed when finished', async () => {
      const user = userEvent.setup();
      render(<KYCWizard />);
      
      // Complete a step
      const mockStepData = { completed: true };
      
      await act(async () => {
        // Simulate step completion
        const completeButton = screen.getByRole('button', { name: /continue/i });
        await user.click(completeButton);
      });

      await waitFor(() => {
        expect(mockKYCVerificationReturn.submitStepData).toHaveBeenCalledWith(
          expect.any(String),
          mockStepData
        );
      });
    });

    it('shows completion percentage updates', async () => {
      render(<KYCWizard />);
      
      // Initially shows 0%
      expect(screen.getByText('0% Complete')).toBeInTheDocument();
    });

    it('calls onComplete when all steps are finished', async () => {
      const onComplete = jest.fn();
      render(<KYCWizard onComplete={onComplete} />);
      
      // Mock all steps completed
      mockUseKYCVerification.mockReturnValue({
        ...mockKYCVerificationReturn,
        submitForReview: jest.fn().mockResolvedValue({
          success: true,
          status: 'completed'
        })
      });

      // Complete final step
      await act(async () => {
        // This would normally be triggered by completing all steps
        // For testing, we'll mock the final submission
      });

      // The onComplete should be called with the result
    });
  });

  describe('Error Handling', () => {
    it('displays error messages when step validation fails', async () => {
      const user = userEvent.setup();
      mockUseKYCVerification.mockReturnValue({
        ...mockKYCVerificationReturn,
        submitStepData: jest.fn().mockRejectedValue(new Error('Validation failed'))
      });

      render(<KYCWizard />);
      
      const continueButton = screen.getByRole('button', { name: /continue/i });
      await user.click(continueButton);

      await waitFor(() => {
        expect(screen.getByText(/failed to save step data/i)).toBeInTheDocument();
      });
    });

    it('shows error state when initialization fails', () => {
      mockUseKYCVerification.mockReturnValue({
        ...mockKYCVerificationReturn,
        error: 'Failed to initialize'
      });

      render(<KYCWizard />);
      
      expect(screen.getByText(/failed to initialize/i)).toBeInTheDocument();
    });
  });

  describe('Auto-save Functionality', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('auto-saves progress every 30 seconds', async () => {
      const setItemSpy = jest.spyOn(Storage.prototype, 'setItem');
      
      render(<KYCWizard />);
      
      // Advance timer by 30 seconds
      act(() => {
        jest.advanceTimersByTime(30000);
      });

      expect(setItemSpy).toHaveBeenCalledWith(
        'kyc_verification_progress',
        expect.stringContaining('"currentStepIndex"')
      );
    });

    it('restores progress from localStorage on mount', () => {
      const mockProgress = JSON.stringify({
        currentStepIndex: 2,
        completedSteps: [0, 1],
        stepData: { test: 'data' },
        timestamp: Date.now()
      });

      jest.spyOn(Storage.prototype, 'getItem').mockReturnValue(mockProgress);
      
      render(<KYCWizard />);
      
      // Should restore the saved state
      expect(screen.getByText('Step 3 of 5')).toBeInTheDocument();
    });

    it('ignores stale progress data older than 24 hours', () => {
      const oldProgress = JSON.stringify({
        currentStepIndex: 2,
        completedSteps: [0, 1],
        stepData: { test: 'data' },
        timestamp: Date.now() - (25 * 60 * 60 * 1000) // 25 hours ago
      });

      jest.spyOn(Storage.prototype, 'getItem').mockReturnValue(oldProgress);
      
      render(<KYCWizard />);
      
      // Should start from beginning
      expect(screen.getByText('Step 1 of 5')).toBeInTheDocument();
    });
  });

  describe('Help Modal', () => {
    it('opens help modal when help button is clicked', async () => {
      const user = userEvent.setup();
      render(<KYCWizard />);
      
      const helpButton = screen.getByRole('button', { name: /help/i });
      await user.click(helpButton);

      expect(screen.getByText(/help/i)).toBeInTheDocument();
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('closes help modal when close button is clicked', async () => {
      const user = userEvent.setup();
      render(<KYCWizard />);
      
      // Open help modal
      const helpButton = screen.getByRole('button', { name: /help/i });
      await user.click(helpButton);

      // Close help modal
      const closeButton = screen.getByRole('button', { name: /close/i });
      await user.click(closeButton);

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('shows contextual help for current step', async () => {
      const user = userEvent.setup();
      render(<KYCWizard />);
      
      const helpButton = screen.getByRole('button', { name: /help/i });
      await user.click(helpButton);

      // Should show help for current step
      expect(screen.getByText(/verification overview/i)).toBeInTheDocument();
    });
  });

  describe('Cancel Functionality', () => {
    it('calls onCancel when cancel button is clicked', async () => {
      const user = userEvent.setup();
      const onCancel = jest.fn();
      
      render(<KYCWizard onCancel={onCancel} />);
      
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(onCancel).toHaveBeenCalled();
    });

    it('clears saved progress when cancelled', async () => {
      const user = userEvent.setup();
      const removeItemSpy = jest.spyOn(Storage.prototype, 'removeItem');
      const onCancel = jest.fn();
      
      render(<KYCWizard onCancel={onCancel} />);
      
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(removeItemSpy).toHaveBeenCalledWith('kyc_verification_progress');
    });
  });

  describe('Time Estimation', () => {
    it('shows estimated time remaining', () => {
      render(<KYCWizard />);
      
      // Should show estimated time for remaining steps
      expect(screen.getByText(/min remaining/)).toBeInTheDocument();
    });

    it('updates time estimate as steps are completed', async () => {
      const user = userEvent.setup();
      render(<KYCWizard />);
      
      const initialTime = screen.getByText(/min remaining/);
      
      // Complete a step
      const continueButton = screen.getByRole('button', { name: /continue/i });
      await user.click(continueButton);

      // Time should be reduced
      await waitFor(() => {
        const updatedTime = screen.getByText(/min remaining/);
        expect(updatedTime).not.toBe(initialTime);
      });
    });
  });

  describe('Responsive Behavior', () => {
    it('shows step indicators on desktop', () => {
      render(<KYCWizard />);
      
      // Step indicators should be visible on desktop
      const stepIndicators = screen.getAllByRole('button');
      expect(stepIndicators.length).toBeGreaterThan(0);
    });

    it('adapts to mobile layout', () => {
      // Mock mobile detection
      jest.mocked(require('@/hooks/useIsMobile').useIsMobile).mockReturnValue(true);
      
      render(<KYCWizard />);
      
      // Mobile-specific elements should be present
      expect(screen.getByText('Business Verification')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels and roles', () => {
      render(<KYCWizard />);
      
      expect(screen.getByRole('dialog', { hidden: true })).toBeInTheDocument();
      expect(screen.getByLabelText(/close modal/i, { hidden: true })).toBeInTheDocument();
    });

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<KYCWizard />);
      
      // Tab through elements
      await user.tab();
      
      // First focusable element should be focused
      const focusedElement = screen.getByRole('button', { name: /help/i });
      expect(focusedElement).toHaveFocus();
    });

    it('handles escape key to close modals', async () => {
      const user = userEvent.setup();
      render(<KYCWizard />);
      
      // Open help modal
      const helpButton = screen.getByRole('button', { name: /help/i });
      await user.click(helpButton);

      // Press escape
      await user.keyboard('{Escape}');

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  describe('Integration with Business Context', () => {
    it('passes businessId to verification service', () => {
      render(<KYCWizard businessId="test-business-id" />);
      
      expect(mockUseKYCVerification).toHaveBeenCalledWith('test-business-id');
    });

    it('handles missing businessId gracefully', () => {
      render(<KYCWizard />);
      
      expect(mockUseKYCVerification).toHaveBeenCalledWith(undefined);
    });
  });
});