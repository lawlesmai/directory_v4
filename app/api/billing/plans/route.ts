/**
 * EPIC 5 STORY 5.5: Billing Plans API Route
 * Provides available subscription plans for plan change functionality
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// =============================================
// TYPES AND INTERFACES
// =============================================

interface PlanOption {
  id: string;
  name: string;
  description: string;
  price: {
    monthly: number;
    yearly: number;
  };
  currency: string;
  features: string[];
  popular?: boolean;
  currentPlan?: boolean;
  metadata?: {
    listings_limit?: number;
    photos_limit?: number;
    pageviews_limit?: number;
    inquiries_limit?: number;
    api_calls_limit?: number;
  };
}

// =============================================
// API HANDLER
// =============================================

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' }, 
        { status: 401 }
      );
    }

    // Get user's current subscription to mark current plan
    const { data: currentSubscription } = await supabase
      .from('subscriptions')
      .select(`
        *,
        plan:subscription_plans(*)
      `)
      .eq('user_id', user.id)
      .single();

    // Get all available plans
    const { data: plans, error: plansError } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('active', true)
      .order('amount', { ascending: true });

    if (plansError) {
      console.error('Plans fetch error:', plansError);
      return NextResponse.json(
        { error: 'Failed to fetch plans' },
        { status: 500 }
      );
    }

    // Transform plans to include pricing structure
    const planOptions: PlanOption[] = (plans || []).map(plan => {
      // Calculate monthly and yearly pricing
      const monthlyPrice = plan.interval === 'month' ? plan.amount : Math.round(plan.amount / 12);
      const yearlyPrice = plan.interval === 'year' ? plan.amount : plan.amount * 12;
      
      // Apply yearly discount (17% off)
      const discountedYearlyPrice = Math.round(monthlyPrice * 12 * 0.83);

      return {
        id: plan.id,
        name: plan.name,
        description: plan.description || `${plan.name} subscription plan`,
        price: {
          monthly: monthlyPrice,
          yearly: discountedYearlyPrice,
        },
        currency: plan.currency || 'usd',
        features: plan.features || [],
        popular: plan.metadata?.popular === true,
        currentPlan: currentSubscription?.plan_id === plan.id,
        metadata: plan.metadata,
      };
    });

    // Mock data for comprehensive plans if no plans in database
    if (planOptions.length === 0) {
      return NextResponse.json([
        {
          id: 'starter',
          name: 'Starter',
          description: 'Perfect for small businesses getting started',
          price: {
            monthly: 1900, // $19.00
            yearly: 18900, // $189.00 (17% off)
          },
          currency: 'usd',
          features: [
            '5 Business Listings',
            '50 Photo Uploads',
            '2,500 Monthly Page Views',
            '50 Customer Inquiries',
            '1,000 API Calls',
            'Email Support',
          ],
          popular: false,
          currentPlan: currentSubscription?.plan?.name === 'Starter',
          metadata: {
            listings_limit: 5,
            photos_limit: 50,
            pageviews_limit: 2500,
            inquiries_limit: 50,
            api_calls_limit: 1000,
          },
        },
        {
          id: 'premium',
          name: 'Premium',
          description: 'Most popular choice for growing businesses',
          price: {
            monthly: 4900, // $49.00
            yearly: 48900, // $489.00 (17% off)
          },
          currency: 'usd',
          features: [
            '25 Business Listings',
            '250 Photo Uploads',
            '12,500 Monthly Page Views',
            '250 Customer Inquiries',
            '5,000 API Calls',
            'Priority Email Support',
            'Basic Analytics',
            'Custom Branding',
          ],
          popular: true,
          currentPlan: currentSubscription?.plan?.name === 'Premium',
          metadata: {
            listings_limit: 25,
            photos_limit: 250,
            pageviews_limit: 12500,
            inquiries_limit: 250,
            api_calls_limit: 5000,
          },
        },
        {
          id: 'professional',
          name: 'Professional',
          description: 'Advanced features for established businesses',
          price: {
            monthly: 9900, // $99.00
            yearly: 99000, // $990.00 (17% off)
          },
          currency: 'usd',
          features: [
            '100 Business Listings',
            '1,000 Photo Uploads',
            '50,000 Monthly Page Views',
            '1,000 Customer Inquiries',
            '25,000 API Calls',
            'Phone & Email Support',
            'Advanced Analytics',
            'White-label Options',
            'API Access',
            'Custom Integrations',
          ],
          popular: false,
          currentPlan: currentSubscription?.plan?.name === 'Professional',
          metadata: {
            listings_limit: 100,
            photos_limit: 1000,
            pageviews_limit: 50000,
            inquiries_limit: 1000,
            api_calls_limit: 25000,
          },
        },
        {
          id: 'enterprise',
          name: 'Enterprise',
          description: 'Custom solutions for large organizations',
          price: {
            monthly: 29900, // $299.00
            yearly: 299000, // $2,990.00 (17% off)
          },
          currency: 'usd',
          features: [
            'Unlimited Business Listings',
            'Unlimited Photo Uploads',
            'Unlimited Monthly Page Views',
            'Unlimited Customer Inquiries',
            'Unlimited API Calls',
            'Dedicated Support Manager',
            'Custom Analytics Dashboard',
            'Full White-label Solution',
            'Priority API Access',
            'Custom Development',
            'SLA Guarantee',
            'Training & Onboarding',
          ],
          popular: false,
          currentPlan: currentSubscription?.plan?.name === 'Enterprise',
          metadata: {
            listings_limit: -1, // Unlimited
            photos_limit: -1,
            pageviews_limit: -1,
            inquiries_limit: -1,
            api_calls_limit: -1,
          },
        },
      ]);
    }

    return NextResponse.json(planOptions);

  } catch (error) {
    console.error('Billing plans error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}