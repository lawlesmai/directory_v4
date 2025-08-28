'use client';

import React from 'react';
import { AdminDashboardLayout } from '@/components/admin/AdminDashboardLayout';
import { SecuritySettings } from '@/components/admin/SecuritySettings';

export default function AdminSecurityPage() {
  return (
    <AdminDashboardLayout>
      <SecuritySettings />
    </AdminDashboardLayout>
  );
}