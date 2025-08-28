'use client';

import React from 'react';
import { AdminDashboardLayout } from '@/components/admin/AdminDashboardLayout';
import { AuditLogViewer } from '@/components/admin/AuditLogViewer';

export default function AdminAuditLogsPage() {
  return (
    <AdminDashboardLayout>
      <AuditLogViewer realTime />
    </AdminDashboardLayout>
  );
}