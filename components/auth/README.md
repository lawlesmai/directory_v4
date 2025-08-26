# Authentication UI Components

A comprehensive set of authentication components built for the Lawless Directory project, featuring glassmorphism design, advanced validation, accessibility compliance, and mobile-responsive interfaces.

## Overview

This authentication system provides a complete set of components for user registration, login, password management, and social authentication. Built with Next.js, React Hook Form, Zod validation, and Framer Motion animations.

## Key Features

- **🎨 Glassmorphism Design**: Sophisticated glass-effect styling that matches the project's design system
- **📱 Mobile-Responsive**: Touch-optimized interfaces with bottom sheet modals for mobile devices
- **✅ Advanced Validation**: Real-time form validation using Zod schemas with helpful error messages
- **🔐 Password Strength**: Visual password strength indicators with real-time feedback
- **🌐 Social Authentication**: Support for Google, Apple, Facebook, and GitHub OAuth
- **♿ Accessibility**: WCAG 2.1 AA compliance with proper focus management and screen reader support
- **🎭 Animations**: Smooth animations and micro-interactions using Framer Motion
- **🚀 Performance**: Optimized loading states and efficient re-rendering

## Components

### Core Authentication Forms

#### `LoginForm`
Full-featured login form with email/password validation, social login options, and accessibility features.

```tsx
import { LoginForm } from '@/components/auth';

<LoginForm
  onSuccess={(user) => console.log('Login successful:', user)}
  onError={(error) => console.error('Login failed:', error)}
  showSocialLogin={true}
  showRememberMe={true}
  showForgotPassword={true}
  showSignUpLink={true}
/>
```

#### `RegisterForm`
Multi-step registration process with progress indicators, profile information collection, and email verification.

```tsx
import { RegisterForm } from '@/components/auth';

<RegisterForm
  onSuccess={(user) => console.log('Registration successful:', user)}
  onError={(error) => console.error('Registration failed:', error)}
  showSocialLogin={true}
  initialStep={1}
  onStepChange={(step) => console.log('Step changed:', step)}
/>
```

### Modal Containers

#### `AuthModal`
Desktop-optimized modal container for authentication flows with glassmorphism styling.

```tsx
import { AuthModal, useAuthModal } from '@/components/auth';

function MyComponent() {
  const authModal = useAuthModal();

  return (
    <>
      <button onClick={authModal.openLogin}>Sign In</button>
      <button onClick={authModal.openRegister}>Sign Up</button>
      
      <AuthModal
        isOpen={authModal.isOpen}
        onClose={authModal.close}
        mode={authModal.mode}
        onModeChange={authModal.changeMode}
      />
    </>
  );
}
```

#### `MobileAuthSheet`
Mobile-optimized bottom sheet interface with drag-to-dismiss functionality.

```tsx
import { MobileAuthSheet, useMobileAuthSheet } from '@/components/auth';

function MobileComponent() {
  const mobileAuthSheet = useMobileAuthSheet();

  return (
    <>
      <button onClick={mobileAuthSheet.openLogin}>Sign In</button>
      
      <MobileAuthSheet
        isOpen={mobileAuthSheet.isOpen}
        onClose={mobileAuthSheet.close}
        mode={mobileAuthSheet.mode}
        onModeChange={mobileAuthSheet.changeMode}
      />
    </>
  );
}
```

### UI Components

#### Password Strength Indicators

```tsx
import { PasswordStrength, PasswordStrengthWithTips } from '@/components/auth';

// Basic password strength indicator
<PasswordStrength password={password} showRequirements={true} />

// With helpful tips
<PasswordStrengthWithTips password={password} showTips={true} />
```

#### Social Login Buttons

```tsx
import { SocialLoginButton, SocialLoginGroup } from '@/components/auth';

// Individual button
<SocialLoginButton
  provider="google"
  onSuccess={(user) => console.log('Success:', user)}
  onError={(error) => console.error('Error:', error)}
/>

// Group of buttons
<SocialLoginGroup
  providers={['google', 'apple', 'facebook']}
  layout="vertical"
  onSuccess={(user) => console.log('Success:', user)}
/>
```

#### Loading States

```tsx
import { 
  LoadingSpinner, 
  ProgressBar, 
  ButtonWithLoading,
  StepProgress 
} from '@/components/auth';

// Spinning loader
<LoadingSpinner size="md" />

// Progress bar
<ProgressBar progress={75} variant="success" />

// Button with loading state
<ButtonWithLoading
  isLoading={isSubmitting}
  loadingText="Signing in..."
  onClick={handleSubmit}
>
  Sign In
</ButtonWithLoading>

// Multi-step progress
<StepProgress currentStep={2} totalSteps={3} />
```

#### Error & Success Messages

```tsx
import { AuthError, SuccessMessage, ErrorMessage } from '@/components/auth';

// Authentication-specific error handling
<AuthError
  error="Invalid login credentials"
  onDismiss={() => setError(null)}
/>

// Success notification
<SuccessMessage
  message="Account created successfully!"
  onDismiss={() => setSuccess(null)}
/>

// General error message
<ErrorMessage
  message="Something went wrong"
  variant="error"
  onDismiss={() => setError(null)}
/>
```

## Form Validation

The authentication forms use Zod schemas for robust type-safe validation:

```tsx
import { loginSchema, registerFormSchema } from '@/components/auth';

// Login validation
const loginData = loginSchema.parse({
  email: "user@example.com",
  password: "SecurePass123!",
  rememberMe: false
});

// Registration validation (multi-step)
const registrationData = registerFormSchema.parse({
  email: "user@example.com",
  password: "SecurePass123!",
  confirmPassword: "SecurePass123!",
  firstName: "John",
  lastName: "Doe",
  // ... other fields
});
```

### Validation Features

- **Real-time Validation**: Immediate feedback as users type
- **Custom Error Messages**: User-friendly error descriptions
- **Password Strength**: Visual indicators with requirements
- **Email Format**: Proper email validation with helpful suggestions
- **Accessibility**: Screen reader compatible error announcements

## Styling & Theming

Components use the project's glassmorphism design system with customizable variants:

```tsx
// Glassmorphism variants
<LoginForm className="bg-transparent" /> // Custom styling

// Color palette integration (automatic)
- Navy Dark (#001219) - Primary background
- Teal Primary (#005F73) - Interactive elements
- Teal Secondary (#0A9396) - Hover states
- Sage (#94D2BD) - Success states
- Cream (#E9D8A6) - Primary text
- Gold Primary (#EE9B00) - CTAs
- Red Error (#AE2012) - Error states
```

## Accessibility Features

- **WCAG 2.1 AA Compliance**: Meets accessibility standards
- **Keyboard Navigation**: Full keyboard support for all interactions
- **Screen Reader Support**: Proper ARIA labels and announcements
- **Focus Management**: Logical focus flow and visual indicators
- **High Contrast**: Compatible with high contrast modes
- **Reduced Motion**: Respects user motion preferences

## Mobile Optimization

- **Touch-Friendly**: Large touch targets and optimized spacing
- **Bottom Sheets**: Native-feeling modal interfaces
- **Drag Gestures**: Intuitive drag-to-dismiss functionality
- **Safe Areas**: iOS safe area support
- **Keyboard Handling**: Proper virtual keyboard management
- **Performance**: Optimized for mobile devices

## Integration with Supabase

Components are designed to integrate seamlessly with Supabase Auth:

```tsx
// Example integration (replace mock functions with actual Supabase calls)
import { supabase } from '@/lib/supabase/client';

const handleLogin = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });
  
  if (error) {
    throw new Error(error.message);
  }
  
  return data;
};

// Social authentication
const handleSocialLogin = async (provider: 'google' | 'apple') => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${window.location.origin}/auth/callback`
    }
  });
  
  if (error) {
    throw new Error(error.message);
  }
  
  return data;
};
```

## Development & Testing

### Running the Demo

```bash
# Start the development server
npm run dev

# Navigate to the auth demo page
# Components are showcased in /components/auth/AuthDemo.tsx
```

### Component Testing

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LoginForm } from '@/components/auth';

test('handles form submission', async () => {
  const mockSuccess = jest.fn();
  
  render(<LoginForm onSuccess={mockSuccess} />);
  
  fireEvent.change(screen.getByLabelText(/email/i), {
    target: { value: 'test@example.com' }
  });
  
  fireEvent.change(screen.getByLabelText(/password/i), {
    target: { value: 'Test123!' }
  });
  
  fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
  
  await waitFor(() => {
    expect(mockSuccess).toHaveBeenCalled();
  });
});
```

## File Structure

```
components/auth/
├── index.ts                 # Main export file
├── types.ts                 # TypeScript type definitions
├── validations.ts           # Zod validation schemas
├── LoginForm.tsx           # Login form component
├── RegisterForm.tsx        # Multi-step registration form
├── AuthModal.tsx           # Desktop modal container
├── MobileAuthSheet.tsx     # Mobile bottom sheet
├── PasswordStrength.tsx    # Password strength indicators
├── SocialLoginButton.tsx   # Social authentication buttons
├── LoadingStates.tsx       # Loading indicators and states
├── ErrorMessages.tsx       # Error and success messages
├── AuthDemo.tsx           # Demo/showcase component
└── README.md              # This documentation
```

## Dependencies

- **React Hook Form**: Form state management and validation
- **Zod**: Schema validation and type safety
- **Framer Motion**: Animations and transitions
- **Lucide React**: Icon library
- **Tailwind CSS**: Styling and design system

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+
- Mobile browsers (iOS Safari 14+, Chrome Mobile 90+)

## Performance Considerations

- **Code Splitting**: Components are tree-shakeable
- **Lazy Loading**: Modals are rendered only when needed
- **Optimized Animations**: GPU-accelerated transforms
- **Debounced Validation**: Prevents excessive API calls
- **Memoized Components**: Prevents unnecessary re-renders

## Contributing

When contributing to the authentication components:

1. Follow the existing code style and patterns
2. Add proper TypeScript types for all new components
3. Include accessibility attributes (ARIA labels, roles)
4. Test on both desktop and mobile devices
5. Ensure compatibility with the existing design system
6. Add proper error handling and loading states

## Security Notes

- Form data is validated on both client and server sides
- Passwords are never stored in component state longer than necessary
- Social authentication follows OAuth 2.0 best practices
- Components include CSRF protection considerations
- All API calls should be made through secure, authenticated endpoints