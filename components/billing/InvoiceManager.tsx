/**
 * EPIC 5 STORY 5.5: Invoice Manager Component
 * Complete billing records with PDF downloads and transaction details
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

// =============================================
// TYPES AND INTERFACES
// =============================================

export interface InvoiceData {
  id: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  status: 'paid' | 'open' | 'void' | 'draft' | 'overdue';
  createdAt: Date;
  dueDate?: Date;
  paidAt?: Date;
  description: string;
  downloadUrl?: string;
  lineItems: Array<{
    description: string;
    amount: number;
    quantity: number;
    period?: {
      start: Date;
      end: Date;
    };
  }>;
  taxAmount?: number;
  subtotal: number;
  paymentMethod?: {
    type: string;
    last4?: string;
    brand?: string;
  };
}

export interface InvoiceManagerProps {
  className?: string;
}

export interface InvoiceFilters {
  status: 'all' | 'paid' | 'open' | 'overdue' | 'void';
  dateRange: 'all' | 'last_30' | 'last_90' | 'last_year';
  searchTerm: string;
}

// =============================================
// INVOICE MANAGER COMPONENT
// =============================================

export function InvoiceManager({ className }: InvoiceManagerProps) {
  const [invoices, setInvoices] = useState<InvoiceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [filters, setFilters] = useState<InvoiceFilters>({
    status: 'all',
    dateRange: 'all',
    searchTerm: '',
  });
  const [expandedInvoice, setExpandedInvoice] = useState<string | null>(null);

  useEffect(() => {
    fetchInvoices();
  }, [filters]);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      setError(null);

      const searchParams = new URLSearchParams();
      if (filters.status !== 'all') searchParams.append('status', filters.status);
      if (filters.dateRange !== 'all') searchParams.append('date_range', filters.dateRange);
      if (filters.searchTerm.trim()) searchParams.append('search', filters.searchTerm.trim());

      const response = await fetch(`/api/billing/invoices?${searchParams.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch invoices');
      }

      const invoicesData = await response.json();
      setInvoices(invoicesData);
    } catch (err: any) {
      console.error('Error fetching invoices:', err);
      setError(err.message || 'Failed to load invoices');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadInvoice = async (invoiceId: string) => {
    setActionLoading(`download-${invoiceId}`);
    
    try {
      const response = await fetch(`/api/billing/invoices/${invoiceId}/download`);
      if (!response.ok) {
        throw new Error('Failed to download invoice');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${invoiceId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

    } catch (err: any) {
      console.error('Error downloading invoice:', err);
      setError(err.message || 'Failed to download invoice');
    } finally {
      setActionLoading(null);
    }
  };

  const handleResendInvoice = async (invoiceId: string) => {
    setActionLoading(`resend-${invoiceId}`);
    
    try {
      const response = await fetch(`/api/billing/invoices/${invoiceId}/resend`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to resend invoice');
      }

      // Show success message or update UI
      console.log('Invoice resent successfully');

    } catch (err: any) {
      console.error('Error resending invoice:', err);
      setError(err.message || 'Failed to resend invoice');
    } finally {
      setActionLoading(null);
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-sage/20 text-sage border-sage/30';
      case 'open':
        return 'bg-gold-primary/20 text-gold-primary border-gold-primary/30';
      case 'overdue':
        return 'bg-red-warning/20 text-red-warning border-red-warning/30';
      case 'void':
        return 'bg-text-secondary/20 text-text-secondary border-border';
      case 'draft':
        return 'bg-teal-secondary/20 text-teal-secondary border-teal-secondary/30';
      default:
        return 'bg-teal-20/20 text-text-secondary border-border';
    }
  };

  const getStatusLabel = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const filteredInvoices = invoices; // Already filtered by API

  if (loading && invoices.length === 0) {
    return (
      <Card className={cn("invoice-manager p-6 bg-glass-light backdrop-blur-md border-glass", className)}>
        <div className="animate-pulse">
          <div className="h-6 bg-teal-20/30 rounded w-48 mb-4"></div>
          <div className="space-y-4">
            <div className="h-12 bg-teal-20/30 rounded"></div>
            <div className="h-16 bg-teal-20/30 rounded"></div>
            <div className="h-16 bg-teal-20/30 rounded"></div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className={cn("invoice-manager space-y-6", className)}>
      {/* Header & Filters */}
      <Card className="p-6 bg-glass-light backdrop-blur-md border-glass">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-6">
          <div className="mb-4 lg:mb-0">
            <h2 className="text-2xl font-bold text-cream mb-1">
              Invoices & Payment History
            </h2>
            <p className="text-text-secondary">
              View, download, and manage your billing history
            </p>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {/* Handle export */}}
              className="text-teal-secondary border-teal-secondary hover:bg-teal-secondary/10"
            >
              <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
              Export All
            </Button>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* Search */}
          <div>
            <Input
              type="text"
              placeholder="Search invoices..."
              value={filters.searchTerm}
              onChange={(e) => setFilters(prev => ({ ...prev, searchTerm: e.target.value }))}
              className="bg-glass-light border-glass text-cream placeholder-text-secondary"
            />
          </div>

          {/* Status Filter */}
          <div>
            <Select
              value={filters.status}
              onValueChange={(value) => setFilters(prev => ({ 
                ...prev, 
                status: value as InvoiceFilters['status'] 
              }))}
            >
              <SelectTrigger className="bg-glass-light border-glass text-cream">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent className="bg-glass-dark border-glass">
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="void">Void</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Date Range Filter */}
          <div>
            <Select
              value={filters.dateRange}
              onValueChange={(value) => setFilters(prev => ({ 
                ...prev, 
                dateRange: value as InvoiceFilters['dateRange'] 
              }))}
            >
              <SelectTrigger className="bg-glass-light border-glass text-cream">
                <SelectValue placeholder="Filter by date" />
              </SelectTrigger>
              <SelectContent className="bg-glass-dark border-glass">
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="last_30">Last 30 Days</SelectItem>
                <SelectItem value="last_90">Last 90 Days</SelectItem>
                <SelectItem value="last_year">Last Year</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-4 p-3 bg-red-warning/20 border border-red-warning/30 rounded-lg text-red-warning text-sm">
            {error}
          </div>
        )}
      </Card>

      {/* Invoices Table */}
      {filteredInvoices.length > 0 ? (
        <Card className="bg-glass-light backdrop-blur-md border-glass overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-glass hover:bg-teal-20/20">
                  <TableHead className="text-cream font-semibold">Invoice #</TableHead>
                  <TableHead className="text-cream font-semibold">Date</TableHead>
                  <TableHead className="text-cream font-semibold">Amount</TableHead>
                  <TableHead className="text-cream font-semibold">Status</TableHead>
                  <TableHead className="text-cream font-semibold">Due Date</TableHead>
                  <TableHead className="text-cream font-semibold text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices.map((invoice) => (
                  <React.Fragment key={invoice.id}>
                    <TableRow 
                      className={cn(
                        "border-glass hover:bg-teal-20/10 transition-colors cursor-pointer",
                        expandedInvoice === invoice.id && "bg-teal-20/20"
                      )}
                      onClick={() => setExpandedInvoice(
                        expandedInvoice === invoice.id ? null : invoice.id
                      )}
                    >
                      <TableCell className="font-medium text-cream">
                        <div className="flex items-center">
                          <span className="mr-2">{invoice.invoiceNumber}</span>
                          <svg 
                            className={cn(
                              "w-4 h-4 transition-transform text-text-secondary",
                              expandedInvoice === invoice.id && "rotate-90"
                            )} 
                            fill="currentColor" 
                            viewBox="0 0 20 20"
                          >
                            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      </TableCell>
                      <TableCell className="text-text-secondary">
                        {formatDate(invoice.createdAt)}
                      </TableCell>
                      <TableCell className="font-semibold text-gold-primary">
                        {formatCurrency(invoice.amount, invoice.currency)}
                      </TableCell>
                      <TableCell>
                        <Badge className={cn("text-xs", getStatusColor(invoice.status))}>
                          {getStatusLabel(invoice.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-text-secondary">
                        {invoice.dueDate ? formatDate(invoice.dueDate) : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end space-x-2">
                          {invoice.downloadUrl && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDownloadInvoice(invoice.id);
                              }}
                              disabled={!!actionLoading}
                              className="text-teal-secondary hover:text-teal-secondary/80"
                            >
                              {actionLoading === `download-${invoice.id}` ? (
                                <svg className="animate-spin w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                                </svg>
                              ) : (
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                              )}
                            </Button>
                          )}
                          
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleResendInvoice(invoice.id);
                            }}
                            disabled={!!actionLoading}
                            className="text-sage hover:text-sage/80"
                          >
                            {actionLoading === `resend-${invoice.id}` ? (
                              <svg className="animate-spin w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                              </svg>
                            ) : (
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2.5a1 1 0 11-2 0V5H5v14h4.5a1 1 0 110 2H4a1 1 0 01-1-1V4z" />
                                <path d="M16.707 10.293a1 1 0 00-1.414 1.414L17.586 14H12a1 1 0 100 2h5.586l-2.293 2.293a1 1 0 001.414 1.414l4-4a1 1 0 000-1.414l-4-4z" />
                              </svg>
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>

                    {/* Expanded Invoice Details */}
                    {expandedInvoice === invoice.id && (
                      <TableRow className="border-glass bg-teal-20/10">
                        <TableCell colSpan={6} className="p-0">
                          <div className="p-6 space-y-4">
                            {/* Invoice Details */}
                            <div className="grid md:grid-cols-2 gap-6">
                              <div>
                                <h4 className="font-semibold text-cream mb-3">Invoice Details</h4>
                                <div className="space-y-2 text-sm">
                                  <div className="flex justify-between">
                                    <span className="text-text-secondary">Description:</span>
                                    <span className="text-cream">{invoice.description}</span>
                                  </div>
                                  
                                  {invoice.paidAt && (
                                    <div className="flex justify-between">
                                      <span className="text-text-secondary">Paid Date:</span>
                                      <span className="text-cream">{formatDate(invoice.paidAt)}</span>
                                    </div>
                                  )}
                                  
                                  {invoice.paymentMethod && (
                                    <div className="flex justify-between">
                                      <span className="text-text-secondary">Payment Method:</span>
                                      <span className="text-cream">
                                        •••• {invoice.paymentMethod.last4} {invoice.paymentMethod.brand?.toUpperCase()}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div>
                                <h4 className="font-semibold text-cream mb-3">Amount Breakdown</h4>
                                <div className="space-y-2 text-sm">
                                  <div className="flex justify-between">
                                    <span className="text-text-secondary">Subtotal:</span>
                                    <span className="text-cream">
                                      {formatCurrency(invoice.subtotal, invoice.currency)}
                                    </span>
                                  </div>
                                  
                                  {invoice.taxAmount && (
                                    <div className="flex justify-between">
                                      <span className="text-text-secondary">Tax:</span>
                                      <span className="text-cream">
                                        {formatCurrency(invoice.taxAmount, invoice.currency)}
                                      </span>
                                    </div>
                                  )}
                                  
                                  <div className="flex justify-between font-semibold pt-2 border-t border-glass">
                                    <span className="text-cream">Total:</span>
                                    <span className="text-gold-primary">
                                      {formatCurrency(invoice.amount, invoice.currency)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Line Items */}
                            {invoice.lineItems.length > 0 && (
                              <div>
                                <h4 className="font-semibold text-cream mb-3">Line Items</h4>
                                <div className="space-y-2">
                                  {invoice.lineItems.map((item, index) => (
                                    <div key={index} className="flex justify-between items-start text-sm">
                                      <div>
                                        <div className="text-cream">{item.description}</div>
                                        {item.period && (
                                          <div className="text-xs text-text-secondary">
                                            {formatDate(item.period.start)} - {formatDate(item.period.end)}
                                          </div>
                                        )}
                                      </div>
                                      <div className="text-right">
                                        <div className="text-cream">
                                          {formatCurrency(item.amount, invoice.currency)}
                                        </div>
                                        {item.quantity > 1 && (
                                          <div className="text-xs text-text-secondary">
                                            Qty: {item.quantity}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      ) : (
        <Card className="p-8 text-center bg-glass-light backdrop-blur-md border-glass">
          <div className="w-16 h-16 mx-auto bg-teal-20 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-text-secondary" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
              <path fillRule="evenodd" d="M4 5a2 2 0 012-2v1a2 2 0 012 2v6.5a.5.5 0 01-.5.5h-3a.5.5 0 01-.5-.5V5zM3.854 15.854A.5.5 0 014 16h8a.5.5 0 00.5-.5v-1a.5.5 0 00-.5-.5H4a.5.5 0 00-.146.146z" clipRule="evenodd" />
            </svg>
          </div>
          
          <h3 className="text-lg font-medium text-cream mb-2">
            No Invoices Found
          </h3>
          <p className="text-text-secondary">
            {filters.status !== 'all' || filters.dateRange !== 'all' || filters.searchTerm.trim()
              ? 'No invoices match your current filters. Try adjusting your search criteria.'
              : 'Your invoices will appear here once you have an active subscription with billing history.'
            }
          </p>
        </Card>
      )}
    </div>
  );
}

export default InvoiceManager;