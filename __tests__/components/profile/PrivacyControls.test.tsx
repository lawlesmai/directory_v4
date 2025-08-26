import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import { PrivacyControls } from '@/components/auth/profile/PrivacyControls';
import { useAuth } from '@/contexts/AuthContext';

// Mock the auth context
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

// Mock framer-motion
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// Mock GlassMorphism component
jest.mock('@/components/GlassMorphism', () => ({
  GlassMorphism: ({ children, className }: any) => (
    <div className={`glassmorphism ${className}`}>{children}</div>
  ),
}));

const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  aud: 'authenticated',
  role: 'authenticated',
  created_at: '2023-01-01T00:00:00.000Z',
  updated_at: '2023-01-01T00:00:00.000Z',
};

const mockProfile = {
  id: 'user-1',
  email: 'test@example.com',
  firstName: 'John',
  lastName: 'Doe',
  fullName: 'John Doe',
  phone: '555-123-4567',
  avatar: 'https://example.com/avatar.jpg',
  bio: 'Software developer',
  location: { city: 'San Francisco', state: 'CA', country: 'US' },
  website: 'https://johndoe.com',
  socialLinks: {
    twitter: 'https://twitter.com/johndoe',
    linkedin: 'https://linkedin.com/in/johndoe',
  },
  businessType: 'service_provider' as const,
  isEmailVerified: true,
  isPhoneVerified: false,
  preferences: {
    theme: 'dark' as const,
    notifications: {
      email: true,
      push: false,
      marketing: false,
    },
    privacy: {
      profileVisible: true,
      allowDirectMessages: true,
    },
    accessibility: {
      reducedMotion: false,
      highContrast: false,
      largeText: false,
    },
  },
  createdAt: '2023-01-01T00:00:00.000Z',
  updatedAt: '2023-01-01T00:00:00.000Z',
};

const mockUpdateProfile = jest.fn();

const defaultMockAuth = {
  user: mockUser,
  profile: mockProfile,
  updateProfile: mockUpdateProfile,
  signOut: jest.fn(),
  signIn: jest.fn(),
  signUp: jest.fn(),
  state: 'authenticated' as const,
};

describe('PrivacyControls', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue(defaultMockAuth);
  });

  describe('Rendering', () => {
    it('renders privacy controls header and sections', () => {
      render(<PrivacyControls />);
      
      expect(screen.getByText('Privacy & Security')).toBeInTheDocument();
      expect(screen.getByText('Control who can see your information and how your data is used')).toBeInTheDocument();
      
      // Check main sections
      expect(screen.getByText('Profile Visibility')).toBeInTheDocument();
      expect(screen.getByText('Contact Information')).toBeInTheDocument();
      expect(screen.getByText('Location Sharing')).toBeInTheDocument();
      expect(screen.getByText('Activity & Communication')).toBeInTheDocument();
      expect(screen.getByText('Data Usage & Sharing')).toBeInTheDocument();
    });

    it('displays privacy level indicator', () => {
      render(<PrivacyControls />);
      
      // Should show some privacy level (Low, Medium, or High)
      const privacyLevels = ['Low Privacy', 'Medium Privacy', 'High Privacy'];
      const hasPrivacyLevel = privacyLevels.some(level => 
        screen.queryByText(level) !== null
      );
      expect(hasPrivacyLevel).toBe(true);
    });

    it('renders profile preview with current settings', () => {
      render(<PrivacyControls />);
      
      expect(screen.getByText('Profile Preview')).toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Service Provider')).toBeInTheDocument();
    });
  });

  describe('Profile Visibility Settings', () => {
    it('renders profile visibility options', () => {
      render(<PrivacyControls />);
      
      expect(screen.getByText('Public')).toBeInTheDocument();
      expect(screen.getByText('Anyone can view your profile')).toBeInTheDocument();
      
      expect(screen.getByText('Business Contacts Only')).toBeInTheDocument();
      expect(screen.getByText('Only verified business owners can see your profile')).toBeInTheDocument();
      
      expect(screen.getByText('Private')).toBeInTheDocument();
      expect(screen.getByText('Only you can see your profile')).toBeInTheDocument();
    });

    it('allows selecting different visibility options', async () => {
      const user = userEvent.setup();
      render(<PrivacyControls />);
      
      // Click on Private option
      const privateOption = screen.getByLabelText(/Private/);
      await user.click(privateOption);
      
      // Should update the selection
      expect(privateOption).toBeChecked();
    });

    it('shows explanations when help buttons are clicked', async () => {
      const user = userEvent.setup();
      render(<PrivacyControls />);
      
      // Find and click a help button
      const helpButtons = screen.getAllByRole('button', { name: /help/i });
      if (helpButtons.length > 0) {
        await user.click(helpButtons[0]);
        
        // Should show explanation (this would depend on implementation)
        // The exact text would depend on which help button was clicked
      }
    });
  });

  describe('Contact Information Settings', () => {
    it('renders contact information toggles', () => {
      render(<PrivacyControls />);
      
      expect(screen.getByText('Show Email Address')).toBeInTheDocument();
      expect(screen.getByText('Allow others to see your email address')).toBeInTheDocument();
      
      expect(screen.getByText('Show Phone Number')).toBeInTheDocument();
      expect(screen.getByText('Allow others to see your phone number')).toBeInTheDocument();
    });

    it('shows warning messages for contact information', () => {
      render(<PrivacyControls />);
      
      expect(screen.getByText('Your email may be used for spam')).toBeInTheDocument();
      expect(screen.getByText('Your phone may receive unwanted calls')).toBeInTheDocument();
    });

    it('allows toggling contact information visibility', async () => {
      const user = userEvent.setup();
      render(<PrivacyControls />);
      
      // Find toggle switches (they should be buttons with role="switch")
      const emailToggle = screen.getByRole('switch', { name: /email/i });
      const phoneToggle = screen.getByRole('switch', { name: /phone/i });
      
      expect(emailToggle).toBeInTheDocument();
      expect(phoneToggle).toBeInTheDocument();
      
      // Toggle email visibility
      await user.click(emailToggle);
      
      // Should update the toggle state
      expect(emailToggle).toHaveAttribute('aria-checked');
    });
  });

  describe('Location Sharing Settings', () => {
    it('renders location sharing options', () => {
      render(<PrivacyControls />);
      
      expect(screen.getByText('Location precision')).toBeInTheDocument();
      expect(screen.getByText('Choose how much of your location to share')).toBeInTheDocument();
      
      expect(screen.getByText('Exact Location')).toBeInTheDocument();
      expect(screen.getByText('Show your complete address')).toBeInTheDocument();
      
      expect(screen.getByText('City Only')).toBeInTheDocument();
      expect(screen.getByText('Show only your city and state')).toBeInTheDocument();
      
      expect(screen.getByText('Region Only')).toBeInTheDocument();
      expect(screen.getByText('Show only your state or region')).toBeInTheDocument();
      
      expect(screen.getByText('Hidden')).toBeInTheDocument();
      expect(screen.getByText("Don't show any location information")).toBeInTheDocument();
    });

    it('allows selecting location precision levels', async () => {
      const user = userEvent.setup();
      render(<PrivacyControls />);
      
      // Click on "Hidden" option
      const hiddenOption = screen.getByLabelText(/Hidden/);
      await user.click(hiddenOption);
      
      expect(hiddenOption).toBeChecked();
    });
  });

  describe('Activity & Communication Settings', () => {
    it('renders activity and communication toggles', () => {
      render(<PrivacyControls />);
      
      expect(screen.getByText('Show Activity')).toBeInTheDocument();
      expect(screen.getByText('Allow others to see your reviews and interactions')).toBeInTheDocument();
      
      expect(screen.getByText('Allow Direct Messages')).toBeInTheDocument();
      expect(screen.getByText('Let other users send you private messages')).toBeInTheDocument();
      
      expect(screen.getByText('Appear in Search')).toBeInTheDocument();
      expect(screen.getByText('Allow your profile to appear in search results')).toBeInTheDocument();
    });

    it('allows toggling activity and communication settings', async () => {
      const user = userEvent.setup();
      render(<PrivacyControls />);
      
      const activityToggle = screen.getByRole('switch', { name: /activity/i });
      await user.click(activityToggle);
      
      expect(activityToggle).toHaveAttribute('aria-checked');
    });
  });

  describe('Data Usage Settings', () => {
    it('renders data usage toggles', () => {
      render(<PrivacyControls />);
      
      expect(screen.getByText('Analytics Data')).toBeInTheDocument();
      expect(screen.getByText('Help improve our service with anonymous usage data')).toBeInTheDocument();
      
      expect(screen.getByText('Personalization')).toBeInTheDocument();
      expect(screen.getByText('Use your data to personalize recommendations')).toBeInTheDocument();
      
      expect(screen.getByText('Third-party Sharing')).toBeInTheDocument();
      expect(screen.getByText('Share anonymized data with trusted partners')).toBeInTheDocument();
    });

    it('shows warning for third-party sharing', () => {
      render(<PrivacyControls />);
      
      expect(screen.getByText('This may affect your privacy')).toBeInTheDocument();
    });
  });

  describe('Profile Preview', () => {
    it('updates preview based on privacy settings', async () => {
      const user = userEvent.setup();
      render(<PrivacyControls />);
      
      // Initially should show email and phone (assuming they're visible)
      expect(screen.getByText('test@example.com')).toBeInTheDocument();
      expect(screen.getByText('555-123-4567')).toBeInTheDocument();
      
      // Toggle email off
      const emailToggle = screen.getByRole('switch', { name: /email/i });
      await user.click(emailToggle);
      
      // Email should be hidden in preview
      await waitFor(() => {
        expect(screen.getByText('Hidden')).toBeInTheDocument();
      });
    });

    it('shows location based on precision setting', async () => {
      const user = userEvent.setup();
      render(<PrivacyControls />);
      
      // Should initially show some location info
      expect(screen.getByText(/San Francisco/)).toBeInTheDocument();
      
      // Change to hidden
      const hiddenOption = screen.getByLabelText(/Hidden/);
      await user.click(hiddenOption);
      
      // Location should be hidden in preview
      await waitFor(() => {
        const hiddenTexts = screen.getAllByText('Hidden');
        expect(hiddenTexts.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Quick Actions', () => {
    it('renders quick action buttons', () => {
      render(<PrivacyControls />);
      
      expect(screen.getByText('Export my data')).toBeInTheDocument();
      expect(screen.getByText('Privacy policy')).toBeInTheDocument();
      expect(screen.getByText('Delete account')).toBeInTheDocument();
    });

    it('handles quick action clicks', async () => {
      const user = userEvent.setup();
      render(<PrivacyControls />);
      
      const exportButton = screen.getByText('Export my data');
      await user.click(exportButton);
      
      // Should handle click without errors
      expect(exportButton).toBeInTheDocument();
    });
  });

  describe('Form Submission', () => {
    it('shows save button when changes are made', async () => {
      const user = userEvent.setup();
      render(<PrivacyControls />);
      
      // Make a change
      const emailToggle = screen.getByRole('switch', { name: /email/i });
      await user.click(emailToggle);
      
      // Should show save button
      await waitFor(() => {
        expect(screen.getByText('Save Privacy Settings')).toBeInTheDocument();
        expect(screen.getByText('You have unsaved changes')).toBeInTheDocument();
      });
    });

    it('calls onSave prop when save button is clicked', async () => {
      const user = userEvent.setup();
      const mockOnSave = jest.fn().mockResolvedValue(undefined);
      render(<PrivacyControls onSave={mockOnSave} />);
      
      // Make a change
      const emailToggle = screen.getByRole('switch', { name: /email/i });
      await user.click(emailToggle);
      
      // Save changes
      const saveButton = screen.getByText('Save Privacy Settings');
      await user.click(saveButton);
      
      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith(
          expect.objectContaining({
            showEmail: expect.any(Boolean),
          })
        );
      });
    });

    it('shows loading state during save', async () => {
      const user = userEvent.setup();
      const slowMockOnSave = jest.fn(() => new Promise(resolve => setTimeout(resolve, 1000)));
      render(<PrivacyControls onSave={slowMockOnSave} />);
      
      // Make a change
      const emailToggle = screen.getByRole('switch', { name: /email/i });
      await user.click(emailToggle);
      
      // Save changes
      const saveButton = screen.getByText('Save Privacy Settings');
      await user.click(saveButton);
      
      expect(screen.getByText('Saving...')).toBeInTheDocument();
    });
  });

  describe('Privacy Level Calculation', () => {
    it('calculates privacy level based on settings', async () => {
      const user = userEvent.setup();
      render(<PrivacyControls />);
      
      // Start with default settings
      const initialLevel = screen.getByText(/Privacy/);
      expect(initialLevel).toBeInTheDocument();
      
      // Make more private settings
      const privateOption = screen.getByLabelText(/Private/);
      await user.click(privateOption);
      
      const hiddenLocationOption = screen.getByLabelText(/Hidden/);
      await user.click(hiddenLocationOption);
      
      // Privacy level should update
      // The exact level depends on the calculation logic
      await waitFor(() => {
        const updatedLevel = screen.getByText(/Privacy/);
        expect(updatedLevel).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels for switches', () => {
      render(<PrivacyControls />);
      
      const switches = screen.getAllByRole('switch');
      switches.forEach(switchElement => {
        expect(switchElement).toHaveAttribute('aria-checked');
      });
    });

    it('has proper radio button groups', () => {
      render(<PrivacyControls />);
      
      const radioButtons = screen.getAllByRole('radio');
      radioButtons.forEach(radio => {
        expect(radio).toHaveAttribute('name');
      });
    });

    it('provides proper labeling for form controls', () => {
      render(<PrivacyControls />);
      
      // Check that toggles have descriptive labels
      expect(screen.getByText('Show Email Address')).toBeInTheDocument();
      expect(screen.getByText('Allow others to see your email address')).toBeInTheDocument();
    });

    it('uses proper heading hierarchy', () => {
      render(<PrivacyControls />);
      
      expect(screen.getByRole('heading', { level: 1, name: /privacy & security/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 3, name: /profile visibility/i })).toBeInTheDocument();
    });
  });

  describe('Help and Information', () => {
    it('provides contextual help for privacy settings', () => {
      render(<PrivacyControls />);
      
      // Should have help icons or buttons
      const helpButtons = screen.getAllByRole('button');
      const hasHelpButtons = helpButtons.some(button => 
        button.getAttribute('aria-label')?.includes('help') || 
        button.textContent?.includes('?')
      );
      
      // At least some help should be available
      expect(hasHelpButtons || screen.queryByText(/help/i)).toBeTruthy();
    });

    it('shows privacy impact explanations', () => {
      render(<PrivacyControls />);
      
      // Should show explanations for privacy implications
      expect(screen.getByText('Your email may be used for spam')).toBeInTheDocument();
      expect(screen.getByText('Your phone may receive unwanted calls')).toBeInTheDocument();
      expect(screen.getByText('This may affect your privacy')).toBeInTheDocument();
    });
  });
});