'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { AdminLoginForm } from '@/components/admin/AdminLoginForm';

export default function AdminLogin() {
  const router = useRouter();

  const handleLoginSuccess = (adminData: any) => {
    // In production, store admin session data
    localStorage.setItem('admin_session', JSON.stringify(adminData));
    
    // Redirect to admin dashboard
    router.push('/admin');
  };

  const handleLoginError = (error: string) => {
    console.error('Admin login error:', error);
  };

  return (
    <div className="min-h-screen bg-navy-dark">
      {/* Animated background */}
      <div className="gradient-bg" />
      
      <AdminLoginForm
        onSuccess={handleLoginSuccess}
        onError={handleLoginError}
        className="relative z-10"
      />
    </div>
  );
}