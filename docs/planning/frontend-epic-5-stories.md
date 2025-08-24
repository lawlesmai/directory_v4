# Frontend Epic 5: Payment UI Components & Stripe Integration - Comprehensive Implementation Stories

**Date:** 2024-08-23  
**Epic Lead:** Frontend Developer Agent  
**Priority:** P0 (Critical Revenue Engine)  
**Duration:** 4 Sprints (12 weeks)  
**Story Points Total:** 164 points

## Epic Mission Statement

Create a sophisticated payment and subscription management system with seamless Stripe integration that provides exceptional user experience, comprehensive error handling, and robust security. The interface should guide users through payment flows while maintaining premium aesthetics and providing comprehensive billing management capabilities.

## Payment System Architecture Context

**Payment Integration Requirements:**
- Secure Stripe payment processing with PCI compliance
- Multi-tier subscription management (Basic, Premium, Elite)
- Comprehensive billing dashboard and invoice management
- Payment method management with secure card storage
- International payment support with currency conversion
- Payment failure recovery and dunning management
- Enterprise billing with custom pricing and invoicing

**Security Considerations:**
- PCI DSS compliance with secure card handling
- Stripe Elements integration for secure input collection
- 3D Secure authentication support for international payments
- Fraud detection and prevention measures
- Secure payment method tokenization and storage
- Comprehensive audit logging for all payment operations

**User Experience Priorities:**
- Seamless checkout experience with minimal friction
- Clear pricing display with tax calculations
- Comprehensive error handling and recovery flows
- Mobile-optimized payment interfaces
- Multi-language and multi-currency support
- Accessibility compliance for payment flows

**Technical Architecture:**
- React Stripe.js integration with hooks
- Secure payment form components with validation
- Real-time payment status tracking and updates
- Webhook integration for payment event handling
- Comprehensive error boundary implementations
- Payment analytics and conversion tracking

**Performance Targets:**
- Payment form load time < 1.5s
- Payment processing feedback < 500ms
- Checkout completion rate > 95%
- Payment success rate > 98%
- Failed payment recovery rate > 60%

---

## Story F5.1: Stripe Integration Foundation & Secure Payment Components

**User Story:** As a frontend developer, I want to establish a secure Stripe integration foundation with reusable payment components that ensure PCI compliance while providing excellent user experience and comprehensive error handling.

**Assignee:** Frontend Developer Agent  
**Priority:** P0  
**Story Points:** 25  
**Sprint:** 1

### Detailed Acceptance Criteria

**Stripe Provider Setup:**
- **Given** Stripe integration requirements
- **When** implementing Stripe foundation
- **Then** create:

```typescript
// components/payments/StripeProvider.tsx
interface StripeProviderProps {
  children: React.ReactNode
  publicKey: string
}

export const StripeProvider: React.FC<StripeProviderProps> = ({ 
  children, 
  publicKey 
}) => {
  const stripePromise = useMemo(() => loadStripe(publicKey), [publicKey])

  return (
    <Elements
      stripe={stripePromise}
      options={{
        appearance: {
          theme: 'night',
          variables: {
            colorPrimary: '#0A9396',
            colorBackground: 'rgba(0, 18, 25, 0.8)',
            colorText: '#E9D8A6',
            colorDanger: '#AE2012',
            fontFamily: 'Inter, -apple-system, sans-serif',
            spacingUnit: '4px',
            borderRadius: '8px'
          },
          rules: {
            '.Tab': {
              border: '1px solid rgba(148, 210, 189, 0.2)',
              backgroundColor: 'rgba(0, 95, 115, 0.1)',
              color: '#E9D8A6'
            },
            '.Tab:hover': {
              backgroundColor: 'rgba(0, 95, 115, 0.2)',
              color: '#E9D8A6'
            },
            '.Tab--selected': {
              backgroundColor: 'rgba(10, 147, 150, 0.2)',
              borderColor: '#0A9396',
              color: '#E9D8A6'
            },
            '.Input': {
              backgroundColor: 'rgba(0, 95, 115, 0.1)',
              border: '1px solid rgba(148, 210, 189, 0.2)',
              color: '#E9D8A6'
            },
            '.Input:focus': {
              borderColor: '#0A9396',
              boxShadow: '0 0 0 2px rgba(10, 147, 150, 0.2)'
            },
            '.Error': {
              color: '#AE2012'
            }
          }
        },
        loader: 'auto'
      }}
    >
      {children}
    </Elements>
  )
}
```

**Secure Payment Form Component:**
- **Given** secure payment input requirements
- **When** implementing payment form
- **Then** create:

```typescript
// components/payments/SecurePaymentForm.tsx
interface SecurePaymentFormProps {
  amount: number
  currency: string
  onSuccess: (paymentIntent: PaymentIntent) => void
  onError: (error: StripeError) => void
  loading?: boolean
  customerDetails?: CustomerDetails
}

export const SecurePaymentForm: React.FC<SecurePaymentFormProps> = ({
  amount,
  currency,
  onSuccess,
  onError,
  loading = false,
  customerDetails
}) => {
  const stripe = useStripe()
  const elements = useElements()
  const [isProcessing, setIsProcessing] = useState(false)
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  
  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    watch
  } = useForm<BillingDetails>({
    resolver: zodResolver(billingDetailsSchema),
    mode: 'onChange',
    defaultValues: {
      name: customerDetails?.name || '',
      email: customerDetails?.email || '',
      phone: customerDetails?.phone || '',
      address: {
        line1: customerDetails?.address?.line1 || '',
        line2: customerDetails?.address?.line2 || '',
        city: customerDetails?.address?.city || '',
        state: customerDetails?.address?.state || '',
        postal_code: customerDetails?.address?.postal_code || '',
        country: customerDetails?.address?.country || 'US'
      }
    }
  })

  // Real-time validation for Stripe Elements
  const [elementErrors, setElementErrors] = useState<{
    card?: string
  }>({})

  const handleCardElementChange = (event: StripeCardElementChangeEvent) => {
    setElementErrors(prev => ({
      ...prev,
      card: event.error ? event.error.message : undefined
    }))
  }

  const processPayment = async (billingDetails: BillingDetails) => {
    if (!stripe || !elements) {
      setPaymentError('Payment system not ready. Please try again.')
      return
    }

    setIsProcessing(true)
    setPaymentError(null)

    try {
      // Create payment intent on the server
      const { clientSecret } = await paymentsApi.createPaymentIntent({
        amount,
        currency,
        customer_details: billingDetails,
        metadata: {
          source: 'business_subscription'
        }
      })

      // Confirm payment with Stripe
      const { error, paymentIntent } = await stripe.confirmCardPayment(
        clientSecret,
        {
          payment_method: {
            card: elements.getElement(CardElement)!,
            billing_details: {
              name: billingDetails.name,
              email: billingDetails.email,
              phone: billingDetails.phone,
              address: {
                line1: billingDetails.address.line1,
                line2: billingDetails.address.line2,
                city: billingDetails.address.city,
                state: billingDetails.address.state,
                postal_code: billingDetails.address.postal_code,
                country: billingDetails.address.country
              }
            }
          }
        }
      )

      if (error) {
        // Handle specific error types
        switch (error.type) {
          case 'card_error':
          case 'validation_error':
            setPaymentError(error.message || 'Your card was declined.')
            break
          case 'authentication_error':
            setPaymentError('Authentication failed. Please try again.')
            break
          case 'rate_limit_error':
            setPaymentError('Too many requests. Please wait a moment and try again.')
            break
          case 'api_connection_error':
          case 'api_error':
            setPaymentError('Network error. Please check your connection and try again.')
            break
          default:
            setPaymentError('An unexpected error occurred. Please try again.')
        }
        
        onError(error)
        
        // Track error for analytics
        analytics.track('Payment Error', {
          error_type: error.type,
          error_code: error.code,
          amount,
          currency
        })
      } else if (paymentIntent) {
        // Payment successful
        toast.success('Payment completed successfully!')
        onSuccess(paymentIntent)
        
        // Track success for analytics
        analytics.track('Payment Success', {
          amount,
          currency,
          payment_intent_id: paymentIntent.id
        })
      }
    } catch (error) {
      console.error('Payment processing error:', error)
      setPaymentError('Something went wrong. Please try again.')
      onError(error as StripeError)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(processPayment)} className="space-y-6">
      {/* Payment Amount Display */}
      <div className="text-center py-6 border-b border-sage/20">
        <div className="text-3xl font-heading font-bold text-cream">
          {new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency.toUpperCase()
          }).format(amount / 100)}
        </div>
        <p className="text-sage/70 mt-1">
          Secure payment processed by Stripe
        </p>
      </div>

      {/* Billing Details */}
      <div className="space-y-4">
        <h3 className="text-lg font-heading font-semibold text-cream">
          Billing Information
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label htmlFor="name" className="block text-sm font-medium text-cream">
              Full Name *
            </label>
            <input
              {...register('name')}
              type="text"
              id="name"
              autoComplete="name"
              className={cn(
                'w-full px-4 py-3 rounded-lg transition-colors',
                'bg-navy-50/20 border text-cream placeholder-sage/50',
                'focus:outline-none focus:ring-2 focus:ring-teal-primary/50',
                errors.name ? 'border-red-error' : 'border-sage/20'
              )}
              placeholder="John Doe"
            />
            {errors.name && (
              <p className="text-sm text-red-error">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <label htmlFor="email" className="block text-sm font-medium text-cream">
              Email Address *
            </label>
            <input
              {...register('email')}
              type="email"
              id="email"
              autoComplete="email"
              className={cn(
                'w-full px-4 py-3 rounded-lg transition-colors',
                'bg-navy-50/20 border text-cream placeholder-sage/50',
                'focus:outline-none focus:ring-2 focus:ring-teal-primary/50',
                errors.email ? 'border-red-error' : 'border-sage/20'
              )}
              placeholder="john@example.com"
            />
            {errors.email && (
              <p className="text-sm text-red-error">{errors.email.message}</p>
            )}
          </div>
        </div>

        {/* Address Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label htmlFor="address.line1" className="block text-sm font-medium text-cream">
              Address Line 1 *
            </label>
            <input
              {...register('address.line1')}
              type="text"
              id="address.line1"
              autoComplete="address-line1"
              className={cn(
                'w-full px-4 py-3 rounded-lg transition-colors',
                'bg-navy-50/20 border text-cream placeholder-sage/50',
                'focus:outline-none focus:ring-2 focus:ring-teal-primary/50',
                errors.address?.line1 ? 'border-red-error' : 'border-sage/20'
              )}
              placeholder="123 Main St"
            />
            {errors.address?.line1 && (
              <p className="text-sm text-red-error">{errors.address.line1.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <label htmlFor="address.line2" className="block text-sm font-medium text-cream">
              Address Line 2
            </label>
            <input
              {...register('address.line2')}
              type="text"
              id="address.line2"
              autoComplete="address-line2"
              className="w-full px-4 py-3 rounded-lg bg-navy-50/20 border border-sage/20 text-cream placeholder-sage/50 focus:outline-none focus:ring-2 focus:ring-teal-primary/50 transition-colors"
              placeholder="Apt, Suite, etc."
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <label htmlFor="address.city" className="block text-sm font-medium text-cream">
              City *
            </label>
            <input
              {...register('address.city')}
              type="text"
              id="address.city"
              autoComplete="address-level2"
              className={cn(
                'w-full px-4 py-3 rounded-lg transition-colors',
                'bg-navy-50/20 border text-cream placeholder-sage/50',
                'focus:outline-none focus:ring-2 focus:ring-teal-primary/50',
                errors.address?.city ? 'border-red-error' : 'border-sage/20'
              )}
              placeholder="New York"
            />
            {errors.address?.city && (
              <p className="text-sm text-red-error">{errors.address.city.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <label htmlFor="address.state" className="block text-sm font-medium text-cream">
              State *
            </label>
            <input
              {...register('address.state')}
              type="text"
              id="address.state"
              autoComplete="address-level1"
              className={cn(
                'w-full px-4 py-3 rounded-lg transition-colors',
                'bg-navy-50/20 border text-cream placeholder-sage/50',
                'focus:outline-none focus:ring-2 focus:ring-teal-primary/50',
                errors.address?.state ? 'border-red-error' : 'border-sage/20'
              )}
              placeholder="NY"
            />
            {errors.address?.state && (
              <p className="text-sm text-red-error">{errors.address.state.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <label htmlFor="address.postal_code" className="block text-sm font-medium text-cream">
              Postal Code *
            </label>
            <input
              {...register('address.postal_code')}
              type="text"
              id="address.postal_code"
              autoComplete="postal-code"
              className={cn(
                'w-full px-4 py-3 rounded-lg transition-colors',
                'bg-navy-50/20 border text-cream placeholder-sage/50',
                'focus:outline-none focus:ring-2 focus:ring-teal-primary/50',
                errors.address?.postal_code ? 'border-red-error' : 'border-sage/20'
              )}
              placeholder="10001"
            />
            {errors.address?.postal_code && (
              <p className="text-sm text-red-error">{errors.address.postal_code.message}</p>
            )}
          </div>
        </div>
      </div>

      {/* Card Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-heading font-semibold text-cream">
          Payment Information
        </h3>
        
        <div className="space-y-2">
          <label className="block text-sm font-medium text-cream">
            Card Information *
          </label>
          <div className={cn(
            'p-4 rounded-lg border transition-colors',
            'bg-navy-50/20',
            elementErrors.card ? 'border-red-error' : 'border-sage/20'
          )}>
            <CardElement
              onChange={handleCardElementChange}
              options={{
                style: {
                  base: {
                    fontSize: '16px',
                    color: '#E9D8A6',
                    '::placeholder': {
                      color: 'rgba(148, 210, 189, 0.5)'
                    }
                  }
                }
              }}
            />
          </div>
          {elementErrors.card && (
            <p className="text-sm text-red-error">{elementErrors.card}</p>
          )}
        </div>
      </div>

      {/* Security Notice */}
      <div className="flex items-center gap-3 p-4 bg-teal-primary/10 border border-teal-primary/20 rounded-lg">
        <Lock className="w-5 h-5 text-teal-primary flex-shrink-0" />
        <div>
          <p className="text-sm text-cream font-medium">
            Your payment information is secure
          </p>
          <p className="text-xs text-sage/70 mt-1">
            We use bank-level encryption and never store your card details.
          </p>
        </div>
      </div>

      {/* Error Display */}
      {paymentError && (
        <div className="p-4 bg-red-error/10 border border-red-error/20 rounded-lg">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-error flex-shrink-0" />
            <p className="text-sm text-red-error font-medium">
              {paymentError}
            </p>
          </div>
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={!stripe || !isValid || isProcessing || loading}
        className={cn(
          'w-full px-6 py-4 rounded-lg font-semibold text-lg transition-all duration-200',
          'focus:outline-none focus:ring-2 focus:ring-teal-primary/50 focus:ring-offset-2 focus:ring-offset-navy-dark',
          (isValid && !isProcessing && !loading)
            ? 'bg-gradient-to-r from-teal-primary to-teal-secondary text-cream hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]'
            : 'bg-navy-50/20 text-sage/50 cursor-not-allowed'
        )}
      >
        {isProcessing ? (
          <div className="flex items-center justify-center gap-3">
            <LoadingSpinner size="sm" />
            <span>Processing Payment...</span>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center gap-3">
            <LoadingSpinner size="sm" />
            <span>Loading...</span>
          </div>
        ) : (
          `Pay ${new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency.toUpperCase()
          }).format(amount / 100)}`
        )}
      </button>

      {/* Trust Indicators */}
      <div className="flex items-center justify-center gap-6 pt-4 border-t border-sage/20">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-sage/70" />
          <span className="text-xs text-sage/70">256-bit SSL</span>
        </div>
        <div className="flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-sage/70" />
          <span className="text-xs text-sage/70">PCI Compliant</span>
        </div>
        <div className="flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-sage/70" />
          <span className="text-xs text-sage/70">Powered by Stripe</span>
        </div>
      </div>
    </form>
  )
}
```

**Payment Method Management:**
- **Given** payment method storage requirements
- **When** implementing payment method management
- **Then** create:

```typescript
// components/payments/PaymentMethodManager.tsx
export const PaymentMethodManager: React.FC = () => {
  const { data: paymentMethods, refetch } = useQuery({
    queryKey: ['payment-methods'],
    queryFn: paymentsApi.getPaymentMethods
  })

  const [showAddMethod, setShowAddMethod] = useState(false)
  const [defaultMethodId, setDefaultMethodId] = useState<string | null>(null)

  const deleteMethodMutation = useMutation({
    mutationFn: paymentsApi.deletePaymentMethod,
    onSuccess: () => {
      refetch()
      toast.success('Payment method removed')
    },
    onError: (error) => {
      toast.error(`Failed to remove payment method: ${error.message}`)
    }
  })

  const setDefaultMethodMutation = useMutation({
    mutationFn: paymentsApi.setDefaultPaymentMethod,
    onSuccess: () => {
      refetch()
      toast.success('Default payment method updated')
    }
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-heading font-semibold text-cream">
          Payment Methods
        </h3>
        <button
          onClick={() => setShowAddMethod(true)}
          className="px-4 py-2 bg-teal-primary hover:bg-teal-secondary text-cream rounded-lg transition-colors"
        >
          Add Payment Method
        </button>
      </div>

      {paymentMethods?.length === 0 ? (
        <EmptyState
          title="No payment methods"
          description="Add a payment method to manage your subscriptions"
          action={{
            label: 'Add Payment Method',
            onClick: () => setShowAddMethod(true)
          }}
        />
      ) : (
        <div className="space-y-4">
          {paymentMethods?.map((method) => (
            <PaymentMethodCard
              key={method.id}
              paymentMethod={method}
              isDefault={method.id === defaultMethodId}
              onSetDefault={() => setDefaultMethodMutation.mutate(method.id)}
              onDelete={() => deleteMethodMutation.mutate(method.id)}
            />
          ))}
        </div>
      )}

      {/* Add Payment Method Modal */}
      <AddPaymentMethodModal
        open={showAddMethod}
        onClose={() => setShowAddMethod(false)}
        onSuccess={() => {
          setShowAddMethod(false)
          refetch()
        }}
      />
    </div>
  )
}
```

### Technical Implementation Requirements

**3D Secure Authentication:**
- Automatic 3DS challenge handling for international payments
- Seamless redirect flow for authentication
- Fallback mechanisms for failed authentication
- Clear user communication during authentication process

**Error Recovery System:**
- Comprehensive error categorization and handling
- Automatic retry mechanisms for transient failures
- Clear error messages with actionable guidance
- Payment failure recovery workflows

### Testing Requirements

**Payment Integration Testing:**
- Stripe test mode integration with all card scenarios
- Error handling validation for all Stripe error types
- 3D Secure authentication flow testing
- Payment method management functionality testing

**Security Testing:**
- PCI compliance validation
- Input sanitization and validation testing
- Secure token handling verification
- Payment data encryption validation

---

## Story F5.2: Subscription Management Interface & Tier Comparison

**User Story:** As a frontend developer, I want to create an elegant subscription management system with clear tier comparisons, upgrade/downgrade flows, and comprehensive billing management that drives conversions while providing excellent user experience.

**Assignee:** Frontend Developer Agent  
**Priority:** P0  
**Story Points:** 23  
**Sprint:** 1

### Detailed Acceptance Criteria

**Subscription Tier Comparison:**
- **Given** subscription tier presentation requirements
- **When** implementing tier comparison interface
- **Then** create:

```typescript
// components/subscriptions/SubscriptionTierComparison.tsx
interface SubscriptionTier {
  id: string
  name: string
  description: string
  price: {
    monthly: number
    annual: number
  }
  features: FeatureItem[]
  popular?: boolean
  recommended?: boolean
  maxBusinesses: number
  maxPhotos: number
  analytics: boolean
  prioritySupport: boolean
  customDomain?: boolean
  apiAccess?: boolean
}

const subscriptionTiers: SubscriptionTier[] = [
  {
    id: 'basic',
    name: 'Basic',
    description: 'Perfect for getting started',
    price: { monthly: 0, annual: 0 },
    maxBusinesses: 1,
    maxPhotos: 5,
    analytics: false,
    prioritySupport: false,
    features: [
      { name: 'Basic business listing', included: true },
      { name: 'Up to 5 photos', included: true },
      { name: 'Customer reviews', included: true },
      { name: 'Basic contact information', included: true },
      { name: 'Analytics dashboard', included: false },
      { name: 'Priority support', included: false }
    ]
  },
  {
    id: 'premium',
    name: 'Premium',
    description: 'Most popular for growing businesses',
    price: { monthly: 2900, annual: 29000 },
    popular: true,
    maxBusinesses: 3,
    maxPhotos: 25,
    analytics: true,
    prioritySupport: true,
    features: [
      { name: 'Everything in Basic', included: true },
      { name: 'Up to 25 photos', included: true },
      { name: 'Advanced analytics', included: true },
      { name: 'Priority support', included: true },
      { name: 'Marketing tools', included: true },
      { name: 'Custom business hours', included: true },
      { name: 'API access', included: false }
    ]
  },
  {
    id: 'elite',
    name: 'Elite',
    description: 'For established businesses and enterprises',
    price: { monthly: 7900, annual: 79000 },
    recommended: true,
    maxBusinesses: 10,
    maxPhotos: 100,
    analytics: true,
    prioritySupport: true,
    customDomain: true,
    apiAccess: true,
    features: [
      { name: 'Everything in Premium', included: true },
      { name: 'Up to 10 business locations', included: true },
      { name: 'Up to 100 photos', included: true },
      { name: 'Custom domain support', included: true },
      { name: 'API access', included: true },
      { name: 'White-label options', included: true },
      { name: 'Dedicated account manager', included: true }
    ]
  }
]

export const SubscriptionTierComparison: React.FC<{
  currentTier?: string
  onSelectTier: (tierId: string, billing: 'monthly' | 'annual') => void
}> = ({ currentTier, onSelectTier }) => {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly')
  const [hoveredTier, setHoveredTier] = useState<string | null>(null)

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(price / 100)
  }

  const calculateSavings = (tier: SubscriptionTier) => {
    if (tier.price.annual === 0) return 0
    const monthlyTotal = tier.price.monthly * 12
    return ((monthlyTotal - tier.price.annual) / monthlyTotal) * 100
  }

  return (
    <div className="space-y-8">
      {/* Billing Toggle */}
      <div className="flex justify-center">
        <div className="flex items-center bg-navy-50/20 rounded-lg p-1">
          <button
            onClick={() => setBillingCycle('monthly')}
            className={cn(
              'px-6 py-2 rounded-md text-sm font-medium transition-all duration-200',
              billingCycle === 'monthly'
                ? 'bg-teal-primary text-cream shadow-sm'
                : 'text-sage/70 hover:text-sage'
            )}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingCycle('annual')}
            className={cn(
              'px-6 py-2 rounded-md text-sm font-medium transition-all duration-200 relative',
              billingCycle === 'annual'
                ? 'bg-teal-primary text-cream shadow-sm'
                : 'text-sage/70 hover:text-sage'
            )}
          >
            Annual
            <span className="absolute -top-2 -right-2 bg-gold-primary text-navy-dark text-xs px-2 py-1 rounded-full font-semibold">
              Save 20%
            </span>
          </button>
        </div>
      </div>

      {/* Tier Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {subscriptionTiers.map((tier) => (
          <motion.div
            key={tier.id}
            onHoverStart={() => setHoveredTier(tier.id)}
            onHoverEnd={() => setHoveredTier(null)}
            whileHover={{ scale: 1.02, y: -4 }}
            transition={{ duration: 0.2 }}
            className="relative"
          >
            <GlassMorphism
              variant={tier.popular ? "premium" : "medium"}
              className={cn(
                'p-8 h-full relative overflow-hidden',
                currentTier === tier.id && 'ring-2 ring-teal-primary',
                tier.popular && 'border-gold-primary/50'
              )}
            >
              {/* Popular Badge */}
              {tier.popular && (
                <div className="absolute -top-1 -right-1 bg-gold-primary text-navy-dark px-4 py-1 text-xs font-bold rounded-bl-lg">
                  MOST POPULAR
                </div>
              )}

              {/* Recommended Badge */}
              {tier.recommended && (
                <div className="absolute -top-1 -left-1 bg-teal-primary text-cream px-4 py-1 text-xs font-bold rounded-br-lg">
                  RECOMMENDED
                </div>
              )}

              <div className="space-y-6">
                {/* Header */}
                <div className="text-center">
                  <h3 className="text-xl font-heading font-bold text-cream">
                    {tier.name}
                  </h3>
                  <p className="text-sage/70 mt-2">{tier.description}</p>
                </div>

                {/* Pricing */}
                <div className="text-center space-y-2">
                  {tier.price[billingCycle] === 0 ? (
                    <div className="text-4xl font-heading font-bold text-cream">
                      Free
                    </div>
                  ) : (
                    <>
                      <div className="text-4xl font-heading font-bold text-cream">
                        {formatPrice(tier.price[billingCycle])}
                        <span className="text-lg text-sage/70 font-normal">
                          /{billingCycle === 'annual' ? 'year' : 'month'}
                        </span>
                      </div>
                      
                      {billingCycle === 'annual' && tier.price.annual > 0 && (
                        <div className="text-sm text-gold-primary">
                          Save {calculateSavings(tier).toFixed(0)}% annually
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Features */}
                <div className="space-y-3">
                  {tier.features.map((feature, index) => (
                    <div key={index} className="flex items-center gap-3">
                      {feature.included ? (
                        <Check className="w-4 h-4 text-sage flex-shrink-0" />
                      ) : (
                        <X className="w-4 h-4 text-sage/30 flex-shrink-0" />
                      )}
                      <span className={cn(
                        'text-sm',
                        feature.included ? 'text-cream' : 'text-sage/50'
                      )}>
                        {feature.name}
                      </span>
                    </div>
                  ))}
                </div>

                {/* CTA Button */}
                <div className="pt-4">
                  {currentTier === tier.id ? (
                    <div className="w-full py-3 text-center border border-teal-primary/30 rounded-lg">
                      <span className="text-teal-primary font-medium">Current Plan</span>
                    </div>
                  ) : (
                    <button
                      onClick={() => onSelectTier(tier.id, billingCycle)}
                      className={cn(
                        'w-full py-3 px-6 rounded-lg font-semibold transition-all duration-200',
                        'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-navy-dark',
                        tier.popular || tier.recommended
                          ? 'bg-gradient-to-r from-teal-primary to-teal-secondary text-cream hover:shadow-xl focus:ring-teal-primary/50'
                          : 'border border-sage/30 text-sage hover:bg-navy-50/20 hover:border-sage/50 focus:ring-sage/50'
                      )}
                    >
                      {tier.price[billingCycle] === 0 ? 'Get Started' : 
                       currentTier === 'basic' ? 'Upgrade' : 
                       tier.price[billingCycle] < (subscriptionTiers.find(t => t.id === currentTier)?.price[billingCycle] || 0) ? 'Downgrade' : 'Upgrade'}
                    </button>
                  )}
                </div>
              </div>
            </GlassMorphism>
          </motion.div>
        ))}
      </div>

      {/* Feature Comparison Table */}
      <div className="mt-16">
        <h3 className="text-xl font-heading font-semibold text-cream text-center mb-8">
          Detailed Feature Comparison
        </h3>
        <FeatureComparisonTable tiers={subscriptionTiers} />
      </div>
    </div>
  )
}

// Feature Comparison Table
const FeatureComparisonTable: React.FC<{ tiers: SubscriptionTier[] }> = ({ tiers }) => {
  const allFeatures = [
    { name: 'Business Listings', key: 'maxBusinesses' },
    { name: 'Photo Uploads', key: 'maxPhotos' },
    { name: 'Analytics Dashboard', key: 'analytics' },
    { name: 'Priority Support', key: 'prioritySupport' },
    { name: 'Custom Domain', key: 'customDomain' },
    { name: 'API Access', key: 'apiAccess' }
  ]

  return (
    <GlassMorphism variant="subtle" className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-navy-50/10 border-b border-sage/20">
            <tr>
              <th className="text-left p-4 text-cream font-medium">Feature</th>
              {tiers.map((tier) => (
                <th key={tier.id} className="text-center p-4 text-cream font-medium min-w-32">
                  {tier.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allFeatures.map((feature, index) => (
              <tr key={feature.key} className="border-b border-sage/10">
                <td className="p-4 text-sage font-medium">{feature.name}</td>
                {tiers.map((tier) => (
                  <td key={tier.id} className="text-center p-4">
                    {feature.key === 'maxBusinesses' || feature.key === 'maxPhotos' ? (
                      <span className="text-cream font-medium">
                        {tier[feature.key as keyof SubscriptionTier]}
                      </span>
                    ) : tier[feature.key as keyof SubscriptionTier] ? (
                      <Check className="w-5 h-5 text-sage mx-auto" />
                    ) : (
                      <X className="w-5 h-5 text-sage/30 mx-auto" />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </GlassMorphism>
  )
}
```

### Testing Requirements

**Subscription Interface Testing:**
- Tier comparison accuracy and feature display
- Billing cycle calculation validation
- Upgrade/downgrade flow testing
- Payment integration during subscription changes

---

## Story F5.3: Checkout Flow & Conversion Optimization

**User Story:** As a frontend developer, I want to create an optimized checkout flow with A/B testing capabilities, conversion tracking, and seamless user experience that maximizes subscription conversions and reduces abandonment.

**Assignee:** Frontend Developer Agent  
**Priority:** P0  
**Story Points:** 22  
**Sprint:** 2

### Detailed Acceptance Criteria

**Optimized Checkout Flow:**
- **Given** conversion optimization requirements
- **When** implementing checkout flow
- **Then** create streamlined checkout with progress tracking, abandoned cart recovery, and conversion optimization

### Testing Requirements

**Checkout Flow Testing:**
- Checkout completion rate validation
- A/B test implementation verification
- Abandoned cart recovery functionality testing
- Payment success and failure scenario testing

---

## Story F5.4: Billing Dashboard & Invoice Management

**User Story:** As a frontend developer, I want to create a comprehensive billing dashboard that allows users to manage their subscriptions, view payment history, download invoices, and handle billing-related tasks efficiently.

**Assignee:** Frontend Developer Agent  
**Priority:** P0  
**Story Points:** 20  
**Sprint:** 2

### Detailed Acceptance Criteria

**Billing Management Interface:**
- **Given** billing management requirements
- **When** implementing billing dashboard
- **Then** create comprehensive billing oversight with invoice handling and payment history

### Testing Requirements

**Billing Dashboard Testing:**
- Invoice generation and download testing
- Payment history accuracy validation
- Subscription management functionality verification
- Tax calculation accuracy testing

---

## Story F5.5: Payment Failure Recovery & Retry Logic

**User Story:** As a frontend developer, I want to implement intelligent payment failure recovery mechanisms with user-friendly retry flows, automatic retry logic, and clear communication to minimize revenue loss from failed payments.

**Assignee:** Frontend Developer Agent  
**Priority:** P0  
**Story Points:** 18  
**Sprint:** 3

### Detailed Acceptance Criteria

**Payment Recovery System:**
- **Given** payment failure handling requirements
- **When** implementing recovery mechanisms
- **Then** create intelligent retry system with user communication and automated recovery

### Testing Requirements

**Payment Recovery Testing:**
- Failed payment scenario handling validation
- Retry logic accuracy and timing verification
- User communication effectiveness testing
- Recovery success rate optimization validation

---

## Story F5.6: International Payment Support & Multi-Currency

**User Story:** As a frontend developer, I want to implement comprehensive international payment support with multi-currency pricing, tax calculation, and localized payment methods to enable global platform expansion.

**Assignee:** Frontend Developer Agent  
**Priority:** P1  
**Story Points:** 21  
**Sprint:** 3

### Detailed Acceptance Criteria

**International Payment System:**
- **Given** global payment requirements
- **When** implementing international support
- **Then** create multi-currency system with localized payment methods and tax handling

### Testing Requirements

**International Payment Testing:**
- Currency conversion accuracy validation
- Tax calculation compliance verification
- Localized payment method integration testing
- International fraud prevention testing

---

## Story F5.7: Enterprise Billing & Custom Pricing

**User Story:** As a frontend developer, I want to create enterprise billing capabilities with custom pricing models, usage-based billing, and advanced invoicing features that support complex business-to-business payment scenarios.

**Assignee:** Frontend Developer Agent  
**Priority:** P1  
**Story Points:** 19  
**Sprint:** 4

### Detailed Acceptance Criteria

**Enterprise Billing Interface:**
- **Given** enterprise billing requirements
- **When** implementing custom billing features
- **Then** create flexible billing system with custom pricing and advanced invoicing

### Testing Requirements

**Enterprise Billing Testing:**
- Custom pricing model accuracy validation
- Usage-based billing calculation testing
- Complex invoicing scenario verification
- Enterprise payment workflow testing

---

## Story F5.8: Payment Analytics & Revenue Tracking

**User Story:** As a frontend developer, I want to implement comprehensive payment analytics and revenue tracking systems that provide business intelligence on payment performance, subscription metrics, and revenue optimization insights.

**Assignee:** Frontend Developer Agent  
**Priority:** P1  
**Story Points:** 16  
**Sprint:** 4

### Detailed Acceptance Criteria

**Payment Analytics Dashboard:**
- **Given** payment analytics requirements
- **When** implementing analytics interface
- **Then** create comprehensive revenue tracking with performance insights and optimization recommendations

### Testing Requirements

**Payment Analytics Testing:**
- Revenue calculation accuracy validation
- Subscription metrics tracking verification
- Analytics data integrity testing
- Performance insight accuracy validation

---

## Epic 5 Summary & Success Metrics

### Completion Criteria

**Technical Deliverables:**
- ✅ Secure Stripe integration with PCI compliance
- ✅ Comprehensive subscription management with tier comparisons
- ✅ Optimized checkout flow with conversion tracking
- ✅ Advanced billing dashboard and invoice management
- ✅ Intelligent payment failure recovery system
- ✅ International payment support with multi-currency
- ✅ Enterprise billing with custom pricing models
- ✅ Payment analytics and revenue tracking system

**Security Standards:**
- PCI DSS compliance with secure card handling
- End-to-end encryption for all payment data
- Secure tokenization of payment methods
- Comprehensive fraud detection and prevention
- Audit logging for all payment operations

**Performance Standards:**
- Payment form load time < 1.5s
- Payment processing feedback < 500ms
- Checkout completion rate > 95%
- Payment success rate > 98%
- Failed payment recovery rate > 60%

**Business Metrics:**
- Monthly Recurring Revenue growth > 25%
- Payment conversion rate > 85%
- Subscription upgrade rate > 15%
- Payment failure rate < 2%
- Customer lifetime value increase > 30%

**User Experience Standards:**
- Intuitive payment flows with minimal friction
- Clear error handling and recovery guidance
- Mobile-optimized payment interfaces
- Accessibility compliance (WCAG 2.1 AA)
- Multi-language and multi-currency support

**Testing Coverage:**
- Unit test coverage > 90% for all payment logic
- Integration testing with Stripe test environment
- End-to-end testing for all payment scenarios
- Security penetration testing for payment flows
- Performance testing under high payment volume

This comprehensive frontend Epic 5 establishes the complete payment and subscription system that drives platform revenue while maintaining the highest security and user experience standards. The payment infrastructure provides the foundation for sustainable business growth and international expansion.

**File Path:** `/Users/michaellawless/Documents/Vibe/Repo/directory_v4/docs/planning/frontend-epic-5-stories.md`