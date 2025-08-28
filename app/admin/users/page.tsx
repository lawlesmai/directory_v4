'use client';

import React from 'react';
import { AdminDashboardLayout } from '@/components/admin/AdminDashboardLayout';
import { AdminUserManagement } from '@/components/admin/AdminUserManagement';

export default function AdminUsersPage() {
  return (
    <AdminDashboardLayout>
      <AdminUserManagement />
    </AdminDashboardLayout>
  );
}