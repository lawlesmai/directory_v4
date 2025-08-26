import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react-dom/test-utils';
import '@testing-library/jest-dom';

import { ProfileEditor } from '@/components/auth/profile/ProfileEditor';
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
    input: ({ children, ...props }: any) => <input {...props}>{children}</input>,
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
  bio: 'Software developer passionate about creating great user experiences.',
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

describe('ProfileEditor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue(defaultMockAuth);
  });

  describe('Rendering', () => {
    it('renders the profile editor with all tabs', () => {
      render(<ProfileEditor />);
      
      expect(screen.getByText('Edit Profile')).toBeInTheDocument();
      expect(screen.getByText('Basic Info')).toBeInTheDocument();
      expect(screen.getByText('Contact')).toBeInTheDocument();
      expect(screen.getByText('Professional')).toBeInTheDocument();
      expect(screen.getByText('Social Links')).toBeInTheDocument();
    });

    it('renders form fields with current profile data', () => {
      render(<ProfileEditor />);
      
      expect(screen.getByDisplayValue('John')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Doe')).toBeInTheDocument();
      expect(screen.getByDisplayValue('John Doe')).toBeInTheDocument();
      expect(screen.getByDisplayValue('test@example.com')).toBeInTheDocument();
    });

    it('shows disabled email field with info message', () => {
      render(<ProfileEditor />);
      
      const emailInput = screen.getByDisplayValue('test@example.com');
      expect(emailInput).toBeDisabled();
      expect(screen.getByText('Contact support to change your email address')).toBeInTheDocument();
    });
  });

  describe('Tab Navigation', () => {
    it('switches between tabs correctly', async () => {
      const user = userEvent.setup();
      render(<ProfileEditor />);
      
      // Click on Contact tab
      await user.click(screen.getByText('Contact'));
      
      // Should see contact-specific fields
      expect(screen.getByLabelText(/phone number/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/location/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/website/i)).toBeInTheDocument();
    });

    it('maintains form data when switching tabs', async () => {
      const user = userEvent.setup();
      render(<ProfileEditor />);
      
      // Change first name
      const firstNameInput = screen.getByLabelText(/first name/i);
      await user.clear(firstNameInput);
      await user.type(firstNameInput, 'Jane');
      
      // Switch to contact tab and back
      await user.click(screen.getByText('Contact'));
      await user.click(screen.getByText('Basic Info'));
      
      // Should maintain the changed value
      expect(screen.getByDisplayValue('Jane')).toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    it('shows validation errors for required fields', async () => {
      const user = userEvent.setup();
      render(<ProfileEditor />);
      
      // Clear required field
      const firstNameInput = screen.getByLabelText(/first name/i);
      await user.clear(firstNameInput);
      
      // Try to save
      const saveButton = screen.getByRole('button', { name: /save changes/i });
      await user.click(saveButton);
      
      await waitFor(() => {
        expect(screen.getByText('First name is required')).toBeInTheDocument();
      });
    });

    it('validates display name format', async () => {
      const user = userEvent.setup();
      render(<ProfileEditor />);
      
      const displayNameInput = screen.getByLabelText(/display name/i);
      await user.clear(displayNameInput);
      await user.type(displayNameInput, 'invalid display name!');
      
      await waitFor(() => {
        expect(screen.getByText(/Display name can only contain/)).toBeInTheDocument();
      });
    });

    it('validates email format in contact tab', async () => {
      const user = userEvent.setup();
      
      // Mock profile without email to enable editing
      const mockAuthWithoutEmail = {
        ...defaultMockAuth,
        profile: { ...mockProfile, email: '' },
        user: { ...mockUser, email: '' },
      };
      (useAuth as jest.Mock).mockReturnValue(mockAuthWithoutEmail);
      
      render(<ProfileEditor />);
      
      await user.click(screen.getByText('Contact'));
      
      const emailInput = screen.getByLabelText(/email address/i);
      await user.clear(emailInput);
      await user.type(emailInput, 'invalid-email');
      
      await waitFor(() => {
        expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
      });
    });

    it('validates website URL format', async () => {
      const user = userEvent.setup();
      render(<ProfileEditor />);
      
      await user.click(screen.getByText('Contact'));
      
      const websiteInput = screen.getByLabelText(/website/i);
      await user.clear(websiteInput);
      await user.type(websiteInput, 'not-a-url');
      
      await waitFor(() => {
        expect(screen.getByText('Please enter a valid website URL')).toBeInTheDocument();
      });
    });
  });

  describe('Display Name Availability', () => {
    it('shows loading state while checking availability', async () => {
      const user = userEvent.setup();
      render(<ProfileEditor />);
      
      const displayNameInput = screen.getByLabelText(/display name/i);
      await user.clear(displayNameInput);
      await user.type(displayNameInput, 'newdisplayname');
      
      await waitFor(() => {
        expect(screen.getByText('Checking availability...')).toBeInTheDocument();
      });
    });

    it('shows availability status after checking', async () => {
      const user = userEvent.setup();
      render(<ProfileEditor />);
      
      const displayNameInput = screen.getByLabelText(/display name/i);
      await user.clear(displayNameInput);
      await user.type(displayNameInput, 'availablename');
      
      await waitFor(() => {
        expect(screen.getByText('Display name is available')).toBeInTheDocument();
      }, { timeout: 2000 });
    });

    it('shows unavailable status for reserved names', async () => {
      const user = userEvent.setup();
      render(<ProfileEditor />);
      
      const displayNameInput = screen.getByLabelText(/display name/i);
      await user.clear(displayNameInput);
      await user.type(displayNameInput, 'admin');
      
      await waitFor(() => {
        expect(screen.getByText('Display name is already taken')).toBeInTheDocument();
      }, { timeout: 2000 });
    });
  });

  describe('Character Counters', () => {
    it('shows character count for bio field', async () => {
      const user = userEvent.setup();
      render(<ProfileEditor />);
      
      const bioInput = screen.getByLabelText(/bio/i);
      await user.clear(bioInput);
      await user.type(bioInput, 'Test bio');
      
      expect(screen.getByText('8/500 characters')).toBeInTheDocument();
    });

    it('shows warning when approaching character limit', async () => {
      const user = userEvent.setup();
      render(<ProfileEditor />);
      
      const bioInput = screen.getByLabelText(/bio/i);
      const longBio = 'a'.repeat(450); // 90% of limit
      await user.clear(bioInput);
      await user.type(bioInput, longBio);
      
      const counter = screen.getByText('450/500 characters');
      expect(counter).toHaveClass('text-gold-primary');
    });

    it('shows error when exceeding character limit', async () => {
      const user = userEvent.setup();
      render(<ProfileEditor />);
      
      const bioInput = screen.getByLabelText(/bio/i);
      const tooLongBio = 'a'.repeat(501);
      await user.clear(bioInput);
      await user.type(bioInput, tooLongBio);
      
      const counter = screen.getByText('501/500 characters');
      expect(counter).toHaveClass('text-red-error');
    });
  });

  describe('Social Links Tab', () => {
    it('renders social media input fields', async () => {
      const user = userEvent.setup();
      render(<ProfileEditor />);
      
      await user.click(screen.getByText('Social Links'));
      
      expect(screen.getByLabelText(/twitter/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/linkedin/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/instagram/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/facebook/i)).toBeInTheDocument();
    });

    it('populates social links from profile data', async () => {
      const user = userEvent.setup();
      render(<ProfileEditor />);
      
      await user.click(screen.getByText('Social Links'));
      
      expect(screen.getByDisplayValue('https://twitter.com/johndoe')).toBeInTheDocument();
      expect(screen.getByDisplayValue('https://linkedin.com/in/johndoe')).toBeInTheDocument();
    });
  });

  describe('Form Submission', () => {
    it('calls updateProfile with correct data on save', async () => {
      const user = userEvent.setup();
      const mockOnSave = jest.fn().mockResolvedValue(undefined);
      render(<ProfileEditor onSave={mockOnSave} />);
      
      // Make a change
      const firstNameInput = screen.getByLabelText(/first name/i);
      await user.clear(firstNameInput);
      await user.type(firstNameInput, 'Jane');
      
      // Save
      const saveButton = screen.getByRole('button', { name: /save changes/i });
      await user.click(saveButton);
      
      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith(
          expect.objectContaining({
            firstName: 'Jane',
            lastName: 'Doe',
            fullName: 'John Doe', // Display name wasn't changed
          })
        );
      });
    });

    it('shows loading state during save', async () => {
      const user = userEvent.setup();
      const slowMockOnSave = jest.fn(() => new Promise(resolve => setTimeout(resolve, 1000)));
      render(<ProfileEditor onSave={slowMockOnSave} />);
      
      // Make a change
      const firstNameInput = screen.getByLabelText(/first name/i);
      await user.clear(firstNameInput);
      await user.type(firstNameInput, 'Jane');
      
      // Save
      const saveButton = screen.getByRole('button', { name: /save changes/i });
      await user.click(saveButton);
      
      expect(screen.getByText('Saving...')).toBeInTheDocument();
      expect(saveButton).toBeDisabled();
    });

    it('disables save button when no changes are made', () => {
      render(<ProfileEditor />);
      
      const saveButton = screen.getByRole('button', { name: /save changes/i });
      expect(saveButton).toBeDisabled();
    });

    it('enables save button after making changes', async () => {
      const user = userEvent.setup();
      render(<ProfileEditor />);
      
      const firstNameInput = screen.getByLabelText(/first name/i);
      await user.clear(firstNameInput);
      await user.type(firstNameInput, 'Jane');
      
      const saveButton = screen.getByRole('button', { name: /save changes/i });
      expect(saveButton).toBeEnabled();
    });

    it('shows unsaved changes indicator', async () => {
      const user = userEvent.setup();
      render(<ProfileEditor />);
      
      const firstNameInput = screen.getByLabelText(/first name/i);
      await user.clear(firstNameInput);
      await user.type(firstNameInput, 'Jane');
      
      expect(screen.getByText('You have unsaved changes')).toBeInTheDocument();
    });
  });

  describe('Form Reset', () => {
    it('resets form to original values on cancel', async () => {
      const user = userEvent.setup();
      render(<ProfileEditor />);
      
      // Make changes
      const firstNameInput = screen.getByLabelText(/first name/i);
      await user.clear(firstNameInput);
      await user.type(firstNameInput, 'Jane');
      
      // Cancel
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);
      
      // Should reset to original value
      expect(screen.getByDisplayValue('John')).toBeInTheDocument();
      expect(screen.queryByText('You have unsaved changes')).not.toBeInTheDocument();
    });

    it('calls onCancel prop when cancel button is clicked', async () => {
      const user = userEvent.setup();
      const mockOnCancel = jest.fn();
      render(<ProfileEditor onCancel={mockOnCancel} />);
      
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);
      
      expect(mockOnCancel).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('has proper form labels and structure', () => {
      render(<ProfileEditor />);
      
      expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/display name/i)).toBeInTheDocument();
    });

    it('indicates required fields with asterisks', () => {
      render(<ProfileEditor />);
      
      // Check for required field indicators
      const firstNameLabel = screen.getByLabelText(/first name/i).closest('div');
      expect(firstNameLabel).toHaveTextContent('*');
    });

    it('provides helpful field descriptions', () => {
      render(<ProfileEditor />);
      
      expect(screen.getByText('This is how other users will see your name')).toBeInTheDocument();
    });

    it('properly associates error messages with fields', async () => {
      const user = userEvent.setup();
      render(<ProfileEditor />);
      
      const firstNameInput = screen.getByLabelText(/first name/i);
      await user.clear(firstNameInput);
      
      const saveButton = screen.getByRole('button', { name: /save changes/i });
      await user.click(saveButton);
      
      await waitFor(() => {
        const errorMessage = screen.getByText('First name is required');
        expect(errorMessage).toBeInTheDocument();
        
        // Check that the input is associated with the error
        expect(firstNameInput).toHaveAttribute('aria-invalid', 'true');
      });
    });
  });

  describe('Professional Tab', () => {
    it('shows coming soon message for professional tab', async () => {
      const user = userEvent.setup();
      render(<ProfileEditor />);
      
      await user.click(screen.getByText('Professional'));
      
      expect(screen.getByText('Professional Information')).toBeInTheDocument();
      expect(screen.getByText('Additional professional details will be available in future updates')).toBeInTheDocument();
      expect(screen.getByText('Coming Soon')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('handles save errors gracefully', async () => {
      const user = userEvent.setup();
      const mockOnSave = jest.fn().mockRejectedValue(new Error('Save failed'));
      render(<ProfileEditor onSave={mockOnSave} />);
      
      // Make a change
      const firstNameInput = screen.getByLabelText(/first name/i);
      await user.clear(firstNameInput);
      await user.type(firstNameInput, 'Jane');
      
      // Save
      const saveButton = screen.getByRole('button', { name: /save changes/i });
      await user.click(saveButton);
      
      // Should handle error gracefully (not crash)
      await waitFor(() => {
        expect(saveButton).toBeEnabled();
      });
    });
  });
});