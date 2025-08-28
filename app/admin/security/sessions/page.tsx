'use client';

import React from 'react';
import { AdminDashboardLayout } from '@/components/admin/AdminDashboardLayout';
import { SessionManagement } from '@/components/admin/SessionManagement';

export default function AdminSessionsPage() {
  return (
    <AdminDashboardLayout>
      <SessionManagement />
    </AdminDashboardLayout>
  );
}