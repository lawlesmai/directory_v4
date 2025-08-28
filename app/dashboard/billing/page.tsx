/**
 * EPIC 5 STORY 5.5: Billing Dashboard & Payment Management
 * Main billing dashboard page providing comprehensive billing interface for business owners
 */

'use client';

import React, { Suspense } from 'react';
import { BillingOverview } from '@/components/billing/BillingOverview';
import { PaymentMethodManager } from '@/components/billing/PaymentMethodManager';
import { InvoiceManager } from '@/components/billing/InvoiceManager';
import { SubscriptionControls } from '@/components/billing/SubscriptionControls';
import { UsageAnalytics } from '@/components/billing/UsageAnalytics';
import { BillingNotifications } from '@/components/billing/BillingNotifications';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export default function BillingDashboardPage() {
  return (
    <div className="billing-dashboard-page min-h-screen bg-gradient-to-br from-teal-primary via-teal-secondary to-sage">
      {/* Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-gold-primary/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-cream/5 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-teal-secondary/5 rounded-full blur-2xl"></div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 container mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-4xl font-bold text-cream mb-2">
                Billing & Subscription Management
              </h1>
              <p className="text-text-secondary text-lg">
                Manage your subscription, payment methods, and billing history with complete control and transparency.
              </p>
            </div>
            
            {/* Quick Stats Cards */}
            <div className="hidden lg:flex items-center space-x-4">
              <Suspense fallback={<div className="w-32 h-16 bg-teal-20/30 rounded-lg animate-pulse" />}>
                <Card className="p-4 bg-glass-light backdrop-blur-md border-glass min-w-0">
                  <div className="text-sm text-text-secondary">Next Billing</div>
                  <div className="font-semibold text-cream">Dec 28, 2025</div>
                </Card>
              </Suspense>
              
              <Suspense fallback={<div className="w-32 h-16 bg-teal-20/30 rounded-lg animate-pulse" />}>
                <Card className="p-4 bg-glass-light backdrop-blur-md border-glass min-w-0">
                  <div className="text-sm text-text-secondary">Current Plan</div>
                  <div className="font-semibold text-gold-primary">Premium</div>
                </Card>
              </Suspense>
            </div>
          </div>

          {/* Billing Notifications */}
          <Suspense fallback={<div className="h-16 bg-teal-20/30 rounded-lg animate-pulse mb-6" />}>
            <BillingNotifications className="mb-6" />
          </Suspense>
        </div>

        {/* Main Billing Dashboard */}
        <div className="billing-dashboard-content">
          <Tabs defaultValue="overview" className="w-full">
            {/* Tab Navigation */}
            <TabsList className="grid w-full grid-cols-2 lg:grid-cols-5 mb-8 bg-glass-light/50 backdrop-blur-md border border-glass">
              <TabsTrigger 
                value="overview" 
                className="data-[state=active]:bg-gold-primary/20 data-[state=active]:text-gold-primary"
              >
                <span className="hidden sm:inline">Overview</span>
                <span className="sm:hidden">Overview</span>
              </TabsTrigger>
              <TabsTrigger 
                value="subscription" 
                className="data-[state=active]:bg-gold-primary/20 data-[state=active]:text-gold-primary"
              >
                <span className="hidden sm:inline">Subscription</span>
                <span className="sm:hidden">Plan</span>
              </TabsTrigger>
              <TabsTrigger 
                value="payment-methods" 
                className="data-[state=active]:bg-gold-primary/20 data-[state=active]:text-gold-primary"
              >
                <span className="hidden sm:inline">Payment Methods</span>
                <span className="sm:hidden">Payment</span>
              </TabsTrigger>
              <TabsTrigger 
                value="invoices" 
                className="data-[state=active]:bg-gold-primary/20 data-[state=active]:text-gold-primary"
              >
                <span className="hidden sm:inline">Invoices</span>
                <span className="sm:hidden">Invoices</span>
              </TabsTrigger>
              <TabsTrigger 
                value="analytics" 
                className="data-[state=active]:bg-gold-primary/20 data-[state=active]:text-gold-primary"
              >
                <span className="hidden sm:inline">Analytics</span>
                <span className="sm:hidden">Stats</span>
              </TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="mt-6">
              <div className="grid gap-6 lg:grid-cols-3">
                {/* Main Billing Overview */}
                <div className="lg:col-span-2 space-y-6">
                  <Suspense fallback={
                    <Card className="p-6 bg-glass-light backdrop-blur-md border-glass">
                      <div className="animate-pulse">
                        <div className="h-8 bg-teal-20/30 rounded mb-4"></div>
                        <div className="h-24 bg-teal-20/30 rounded"></div>
                      </div>
                    </Card>
                  }>
                    <BillingOverview />
                  </Suspense>

                  {/* Subscription Controls Preview */}
                  <Suspense fallback={
                    <Card className="p-6 bg-glass-light backdrop-blur-md border-glass">
                      <div className="animate-pulse">
                        <div className="h-6 bg-teal-20/30 rounded mb-4"></div>
                        <div className="h-32 bg-teal-20/30 rounded"></div>
                      </div>
                    </Card>
                  }>
                    <SubscriptionControls showPreviewOnly={true} />
                  </Suspense>
                </div>

                {/* Usage Analytics Sidebar */}
                <div className="space-y-6">
                  <Suspense fallback={
                    <Card className="p-6 bg-glass-light backdrop-blur-md border-glass">
                      <div className="animate-pulse">
                        <div className="h-6 bg-teal-20/30 rounded mb-4"></div>
                        <div className="space-y-3">
                          <div className="h-4 bg-teal-20/30 rounded"></div>
                          <div className="h-4 bg-teal-20/30 rounded"></div>
                          <div className="h-4 bg-teal-20/30 rounded"></div>
                        </div>
                      </div>
                    </Card>
                  }>
                    <UsageAnalytics compact={true} />
                  </Suspense>

                  {/* Payment Methods Preview */}
                  <Suspense fallback={
                    <Card className="p-6 bg-glass-light backdrop-blur-md border-glass">
                      <div className="animate-pulse">
                        <div className="h-6 bg-teal-20/30 rounded mb-4"></div>
                        <div className="h-20 bg-teal-20/30 rounded"></div>
                      </div>
                    </Card>
                  }>
                    <PaymentMethodManager showPreviewOnly={true} />
                  </Suspense>
                </div>
              </div>
            </TabsContent>

            {/* Subscription Management Tab */}
            <TabsContent value="subscription" className="mt-6">
              <div className="grid gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <Suspense fallback={
                    <Card className="p-6 bg-glass-light backdrop-blur-md border-glass">
                      <div className="animate-pulse">
                        <div className="h-8 bg-teal-20/30 rounded mb-6"></div>
                        <div className="space-y-4">
                          <div className="h-6 bg-teal-20/30 rounded"></div>
                          <div className="h-6 bg-teal-20/30 rounded"></div>
                          <div className="h-6 bg-teal-20/30 rounded"></div>
                        </div>
                      </div>
                    </Card>
                  }>
                    <SubscriptionControls />
                  </Suspense>
                </div>
                
                <div>
                  <Suspense fallback={
                    <Card className="p-6 bg-glass-light backdrop-blur-md border-glass">
                      <div className="animate-pulse">
                        <div className="h-6 bg-teal-20/30 rounded mb-4"></div>
                        <div className="h-40 bg-teal-20/30 rounded"></div>
                      </div>
                    </Card>
                  }>
                    <UsageAnalytics showUpgradeRecommendations={true} />
                  </Suspense>
                </div>
              </div>
            </TabsContent>

            {/* Payment Methods Tab */}
            <TabsContent value="payment-methods" className="mt-6">
              <Suspense fallback={
                <Card className="p-6 bg-glass-light backdrop-blur-md border-glass">
                  <div className="animate-pulse">
                    <div className="h-8 bg-teal-20/30 rounded mb-6"></div>
                    <div className="space-y-4">
                      <div className="h-20 bg-teal-20/30 rounded"></div>
                      <div className="h-20 bg-teal-20/30 rounded"></div>
                    </div>
                  </div>
                </Card>
              }>
                <PaymentMethodManager />
              </Suspense>
            </TabsContent>

            {/* Invoices & History Tab */}
            <TabsContent value="invoices" className="mt-6">
              <Suspense fallback={
                <Card className="p-6 bg-glass-light backdrop-blur-md border-glass">
                  <div className="animate-pulse">
                    <div className="h-8 bg-teal-20/30 rounded mb-6"></div>
                    <div className="space-y-4">
                      <div className="h-16 bg-teal-20/30 rounded"></div>
                      <div className="h-16 bg-teal-20/30 rounded"></div>
                      <div className="h-16 bg-teal-20/30 rounded"></div>
                    </div>
                  </div>
                </Card>
              }>
                <InvoiceManager />
              </Suspense>
            </TabsContent>

            {/* Usage Analytics Tab */}
            <TabsContent value="analytics" className="mt-6">
              <Suspense fallback={
                <div className="grid gap-6 lg:grid-cols-2">
                  <Card className="p-6 bg-glass-light backdrop-blur-md border-glass">
                    <div className="animate-pulse">
                      <div className="h-6 bg-teal-20/30 rounded mb-4"></div>
                      <div className="h-48 bg-teal-20/30 rounded"></div>
                    </div>
                  </Card>
                  <Card className="p-6 bg-glass-light backdrop-blur-md border-glass">
                    <div className="animate-pulse">
                      <div className="h-6 bg-teal-20/30 rounded mb-4"></div>
                      <div className="h-48 bg-teal-20/30 rounded"></div>
                    </div>
                  </Card>
                </div>
              }>
                <UsageAnalytics detailed={true} />
              </Suspense>
            </TabsContent>
          </Tabs>
        </div>

        {/* Mobile-Specific Quick Actions */}
        <div className="lg:hidden mt-8">
          <Card className="p-4 bg-glass-light backdrop-blur-md border-glass">
            <h3 className="text-lg font-semibold text-cream mb-4">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-3">
              <button className="flex items-center justify-center p-3 bg-gold-primary/20 rounded-lg text-gold-primary hover:bg-gold-primary/30 transition-colors">
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm0 2h12v2H4V6zm0 4h12v4H4v-4z" />
                </svg>
                Add Card
              </button>
              
              <button className="flex items-center justify-center p-3 bg-teal-secondary/20 rounded-lg text-teal-secondary hover:bg-teal-secondary/30 transition-colors">
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
                Download
              </button>
              
              <button className="flex items-center justify-center p-3 bg-sage/20 rounded-lg text-sage hover:bg-sage/30 transition-colors">
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z" />
                </svg>
                Support
              </button>
              
              <button className="flex items-center justify-center p-3 bg-cream/20 rounded-lg text-cream hover:bg-cream/30 transition-colors">
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 2a4 4 0 00-4 4v1H5a1 1 0 00-.994.89l-1 9A1 1 0 004 18h12a1 1 0 00.994-1.11l-1-9A1 1 0 0015 7h-1V6a4 4 0 00-4-4zm2 5V6a2 2 0 10-4 0v1h4zm-6 3a1 1 0 112 0 1 1 0 01-2 0zm7-1a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd" />
                </svg>
                Settings
              </button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}