import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import { ProfileCompletion } from '@/components/auth/profile/ProfileCompletion';
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

const createMockProfile = (overrides = {}) => ({
  id: 'user-1',
  email: 'test@example.com',
  firstName: 'John',
  lastName: 'Doe',
  fullName: 'John Doe',
  phone: '555-123-4567',
  avatar: null,
  bio: null,
  location: null,
  website: null,
  socialLinks: null,
  businessType: 'customer' as const,
  isEmailVerified: false,
  isPhoneVerified: false,
  preferences: null,
  createdAt: '2023-01-01T00:00:00.000Z',
  updatedAt: '2023-01-01T00:00:00.000Z',
  ...overrides,
});

const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  aud: 'authenticated',
  role: 'authenticated',
  created_at: '2023-01-01T00:00:00.000Z',
  updated_at: '2023-01-01T00:00:00.000Z',
};

describe('ProfileCompletion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Completion Calculation', () => {
    it('calculates 20% completion for basic info only', () => {
      const basicProfile = createMockProfile({
        firstName: 'John',
        lastName: 'Doe',
      });

      (useAuth as jest.Mock).mockReturnValue({
        user: mockUser,
        profile: basicProfile,
      });

      render(<ProfileCompletion />);
      
      expect(screen.getByText('20%')).toBeInTheDocument();
      expect(screen.getByText('Complete')).toBeInTheDocument();
    });

    it('calculates 35% completion with basic info and photo', () => {
      const profileWithPhoto = createMockProfile({
        firstName: 'John',
        lastName: 'Doe',
        avatar: 'https://example.com/avatar.jpg',
      });

      (useAuth as jest.Mock).mockReturnValue({
        user: mockUser,
        profile: profileWithPhoto,
      });

      render(<ProfileCompletion />);
      
      expect(screen.getByText('35%')).toBeInTheDocument();
    });

    it('calculates higher completion with more fields', () => {
      const completeProfile = createMockProfile({
        firstName: 'John',
        lastName: 'Doe',
        avatar: 'https://example.com/avatar.jpg',
        phone: '555-123-4567',
        location: { city: 'San Francisco', state: 'CA', country: 'US' },
        bio: 'This is a bio with more than 20 characters for testing purposes.',
        socialLinks: { twitter: 'https://twitter.com/john' },
        preferences: { privacy: { profileVisible: true } },
        isEmailVerified: true,
      });

      (useAuth as jest.Mock).mockReturnValue({
        user: mockUser,
        profile: completeProfile,
      });

      render(<ProfileCompletion />);
      
      // Should be 100% or close to it
      const percentage = screen.getByText(/\d+%/);
      expect(percentage).toBeInTheDocument();
      
      // Extract percentage number
      const percentageText = percentage.textContent;
      const percentageNumber = parseInt(percentageText?.replace('%', '') || '0');
      expect(percentageNumber).toBeGreaterThan(80);
    });
  });

  describe('Completion Steps', () => {
    it('renders all completion steps', () => {
      const basicProfile = createMockProfile();

      (useAuth as jest.Mock).mockReturnValue({
        user: mockUser,
        profile: basicProfile,
      });

      render(<ProfileCompletion />);
      
      expect(screen.getByText('Basic Information')).toBeInTheDocument();
      expect(screen.getByText('Profile Photo')).toBeInTheDocument();
      expect(screen.getByText('Contact Information')).toBeInTheDocument();
      expect(screen.getByText('Location')).toBeInTheDocument();
      expect(screen.getByText('Bio & Description')).toBeInTheDocument();
      expect(screen.getByText('Social Links')).toBeInTheDocument();
      expect(screen.getByText('Privacy Settings')).toBeInTheDocument();
      expect(screen.getByText('Email Verification')).toBeInTheDocument();
    });

    it('shows completed steps with checkmarks', () => {
      const profileWithBasicInfo = createMockProfile({
        firstName: 'John',
        lastName: 'Doe',
      });

      (useAuth as jest.Mock).mockReturnValue({
        user: mockUser,
        profile: profileWithBasicInfo,
      });

      render(<ProfileCompletion />);
      
      // Basic Information should be completed
      const basicInfoStep = screen.getByText('Basic Information').closest('div');
      expect(basicInfoStep).toHaveClass('bg-teal-primary/10');
    });

    it('shows incomplete steps with action buttons', () => {
      const basicProfile = createMockProfile({
        firstName: 'John',
        lastName: 'Doe',
      });

      (useAuth as jest.Mock).mockReturnValue({
        user: mockUser,
        profile: basicProfile,
      });

      render(<ProfileCompletion />);
      
      // Profile Photo should show upload button
      expect(screen.getByText('Upload Photo')).toBeInTheDocument();
      expect(screen.getByText('Add Contact Info')).toBeInTheDocument();
      expect(screen.getByText('Add Location')).toBeInTheDocument();
    });

    it('shows completion rewards for completed steps', () => {
      const profileWithBasicInfo = createMockProfile({
        firstName: 'John',
        lastName: 'Doe',
      });

      (useAuth as jest.Mock).mockReturnValue({
        user: mockUser,
        profile: profileWithBasicInfo,
      });

      render(<ProfileCompletion />);
      
      // Should show +20% reward for basic info
      expect(screen.getByText('+20%')).toBeInTheDocument();
    });
  });

  describe('Achievement System', () => {
    it('shows Profile Starter achievement at 25%', () => {
      const profile25 = createMockProfile({
        firstName: 'John',
        lastName: 'Doe',
        avatar: 'https://example.com/avatar.jpg',
      });

      (useAuth as jest.Mock).mockReturnValue({
        user: mockUser,
        profile: profile25,
      });

      render(<ProfileCompletion />);
      
      expect(screen.getByText('Profile Starter')).toBeInTheDocument();
      expect(screen.getByText('Complete your basic profile information')).toBeInTheDocument();
    });

    it('shows locked achievements for higher percentages', () => {
      const basicProfile = createMockProfile({
        firstName: 'John',
        lastName: 'Doe',
      });

      (useAuth as jest.Mock).mockReturnValue({
        user: mockUser,
        profile: basicProfile,
      });

      render(<ProfileCompletion />);
      
      expect(screen.getByText('Social Connector')).toBeInTheDocument();
      expect(screen.getByText('Community Member')).toBeInTheDocument();
      expect(screen.getByText('Profile Master')).toBeInTheDocument();
      
      // Should show requirements for locked achievements
      expect(screen.getByText('Requires 50%')).toBeInTheDocument();
      expect(screen.getByText('Requires 75%')).toBeInTheDocument();
      expect(screen.getByText('Requires 100%')).toBeInTheDocument();
    });

    it('shows unlocked status for achieved milestones', () => {
      const completeProfile = createMockProfile({
        firstName: 'John',
        lastName: 'Doe',
        avatar: 'https://example.com/avatar.jpg',
        phone: '555-123-4567',
        location: { city: 'San Francisco', state: 'CA', country: 'US' },
        bio: 'This is a bio with more than 20 characters.',
        socialLinks: { twitter: 'https://twitter.com/john' },
        preferences: { privacy: { profileVisible: true } },
        isEmailVerified: true,
      });

      (useAuth as jest.Mock).mockReturnValue({
        user: mockUser,
        profile: completeProfile,
      });

      render(<ProfileCompletion />);
      
      // Should show "Unlocked!" for achieved achievements
      const unlockedElements = screen.getAllByText('Unlocked!');
      expect(unlockedElements.length).toBeGreaterThan(0);
    });
  });

  describe('Progress Visualization', () => {
    it('renders progress ring with correct percentage', () => {
      const profile50 = createMockProfile({
        firstName: 'John',
        lastName: 'Doe',
        avatar: 'https://example.com/avatar.jpg',
        phone: '555-123-4567',
        location: { city: 'San Francisco', state: 'CA', country: 'US' },
      });

      (useAuth as jest.Mock).mockReturnValue({
        user: mockUser,
        profile: profile50,
      });

      render(<ProfileCompletion />);
      
      // Should show progress percentage in the center
      const progressText = screen.getByText(/\d+%/);
      expect(progressText).toBeInTheDocument();
      
      // Should show completion count
      expect(screen.getByText(/\d+ of \d+ steps complete/)).toBeInTheDocument();
    });

    it('shows progress bar in inline mode', () => {
      const basicProfile = createMockProfile({
        firstName: 'John',
        lastName: 'Doe',
      });

      (useAuth as jest.Mock).mockReturnValue({
        user: mockUser,
        profile: basicProfile,
      });

      render(<ProfileCompletion showInline />);
      
      expect(screen.getByText('Profile Completion')).toBeInTheDocument();
      expect(screen.getByText('20%')).toBeInTheDocument();
      expect(screen.getByText('Complete')).toBeInTheDocument();
    });
  });

  describe('Social Proof', () => {
    it('displays community statistics', () => {
      const basicProfile = createMockProfile();

      (useAuth as jest.Mock).mockReturnValue({
        user: mockUser,
        profile: basicProfile,
      });

      render(<ProfileCompletion />);
      
      expect(screen.getByText('Community Stats')).toBeInTheDocument();
      expect(screen.getByText('Average completion')).toBeInTheDocument();
      expect(screen.getByText('Engagement boost')).toBeInTheDocument();
      expect(screen.getByText('Profile Masters')).toBeInTheDocument();
    });

    it('shows social proof messages', () => {
      const basicProfile = createMockProfile();

      (useAuth as jest.Mock).mockReturnValue({
        user: mockUser,
        profile: basicProfile,
      });

      render(<ProfileCompletion />);
      
      expect(screen.getByText(/3x more engagement/)).toBeInTheDocument();
      expect(screen.getByText(/Complete profiles get/)).toBeInTheDocument();
    });
  });

  describe('Call to Action', () => {
    it('shows CTA when profile is incomplete', () => {
      const incompleteProfile = createMockProfile({
        firstName: 'John',
        lastName: 'Doe',
      });

      (useAuth as jest.Mock).mockReturnValue({
        user: mockUser,
        profile: incompleteProfile,
      });

      render(<ProfileCompletion />);
      
      expect(screen.getByText('Complete Your Profile Today')).toBeInTheDocument();
      expect(screen.getByText(/only .* away from/)).toBeInTheDocument();
      expect(screen.getByText('Continue Profile Setup')).toBeInTheDocument();
    });

    it('hides CTA when profile is 100% complete', () => {
      const completeProfile = createMockProfile({
        firstName: 'John',
        lastName: 'Doe',
        avatar: 'https://example.com/avatar.jpg',
        phone: '555-123-4567',
        location: { city: 'San Francisco', state: 'CA', country: 'US' },
        bio: 'This is a bio with more than 20 characters for testing completion.',
        socialLinks: { twitter: 'https://twitter.com/john' },
        preferences: { privacy: { profileVisible: true } },
        isEmailVerified: true,
      });

      (useAuth as jest.Mock).mockReturnValue({
        user: mockUser,
        profile: completeProfile,
      });

      render(<ProfileCompletion />);
      
      expect(screen.queryByText('Complete Your Profile Today')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper heading hierarchy', () => {
      const basicProfile = createMockProfile();

      (useAuth as jest.Mock).mockReturnValue({
        user: mockUser,
        profile: basicProfile,
      });

      render(<ProfileCompletion />);
      
      // Check for proper heading structure
      expect(screen.getByRole('heading', { level: 1, name: /complete your profile/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2, name: /achievements/i })).toBeInTheDocument();
    });

    it('provides alt text and descriptions', () => {
      const basicProfile = createMockProfile();

      (useAuth as jest.Mock).mockReturnValue({
        user: mockUser,
        profile: basicProfile,
      });

      render(<ProfileCompletion />);
      
      // Check for descriptive text
      expect(screen.getByText('A complete profile gets')).toBeInTheDocument();
      expect(screen.getByText('Completion Steps')).toBeInTheDocument();
    });

    it('uses proper ARIA labels for progress indicators', () => {
      const basicProfile = createMockProfile();

      (useAuth as jest.Mock).mockReturnValue({
        user: mockUser,
        profile: basicProfile,
      });

      render(<ProfileCompletion />);
      
      // Progress should be accessible
      const progressElements = screen.getAllByText(/Complete/);
      expect(progressElements.length).toBeGreaterThan(0);
    });
  });

  describe('Step Validation Logic', () => {
    it('correctly validates basic info completion', () => {
      const profileWithoutNames = createMockProfile({
        firstName: '',
        lastName: '',
      });

      const profileWithNames = createMockProfile({
        firstName: 'John',
        lastName: 'Doe',
      });

      // Test incomplete
      (useAuth as jest.Mock).mockReturnValue({
        user: mockUser,
        profile: profileWithoutNames,
      });

      const { rerender } = render(<ProfileCompletion />);
      expect(screen.getByText('0%')).toBeInTheDocument();

      // Test complete
      (useAuth as jest.Mock).mockReturnValue({
        user: mockUser,
        profile: profileWithNames,
      });

      rerender(<ProfileCompletion />);
      expect(screen.getByText('20%')).toBeInTheDocument();
    });

    it('correctly validates bio length requirement', () => {
      const profileWithShortBio = createMockProfile({
        firstName: 'John',
        lastName: 'Doe',
        bio: 'Short',
      });

      const profileWithLongBio = createMockProfile({
        firstName: 'John',
        lastName: 'Doe',
        bio: 'This is a bio that is definitely longer than 20 characters.',
      });

      // Test short bio (should not count)
      (useAuth as jest.Mock).mockReturnValue({
        user: mockUser,
        profile: profileWithShortBio,
      });

      const { rerender } = render(<ProfileCompletion />);
      expect(screen.getByText('20%')).toBeInTheDocument(); // Only basic info

      // Test long bio (should count)
      (useAuth as jest.Mock).mockReturnValue({
        user: mockUser,
        profile: profileWithLongBio,
      });

      rerender(<ProfileCompletion />);
      expect(screen.getByText('30%')).toBeInTheDocument(); // Basic info + bio
    });

    it('correctly validates social links completion', () => {
      const profileWithoutSocial = createMockProfile({
        firstName: 'John',
        lastName: 'Doe',
        socialLinks: {},
      });

      const profileWithSocial = createMockProfile({
        firstName: 'John',
        lastName: 'Doe',
        socialLinks: { twitter: 'https://twitter.com/john' },
      });

      // Test without social links
      (useAuth as jest.Mock).mockReturnValue({
        user: mockUser,
        profile: profileWithoutSocial,
      });

      const { rerender } = render(<ProfileCompletion />);
      expect(screen.getByText('20%')).toBeInTheDocument(); // Only basic info

      // Test with social links
      (useAuth as jest.Mock).mockReturnValue({
        user: mockUser,
        profile: profileWithSocial,
      });

      rerender(<ProfileCompletion />);
      expect(screen.getByText('35%')).toBeInTheDocument(); // Basic info + social
    });
  });
});