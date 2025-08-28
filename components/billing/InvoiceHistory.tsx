/**
 * EPIC 5 STORY 5.4: Invoice History Component
 * Display and download invoice history with filtering and pagination
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

export interface Invoice {
  id: string;
  number: string;
  amount: number;
  currency: string;
  status: 'paid' | 'open' | 'void' | 'draft' | 'uncollectible';
  created: Date;
  dueDate?: Date;
  paidAt?: Date;
  description: string;
  downloadUrl?: string;
  lineItems: {
    description: string;
    amount: number;
    quantity: number;
  }[];
}

export interface InvoiceHistoryProps {
  limit?: number;
  showSearch?: boolean;
  showFilters?: boolean;
  className?: string;
}

export function InvoiceHistory({
  limit,
  showSearch = true,
  showFilters = true,
  className,
}: InvoiceHistoryProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'status'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [downloadingInvoice, setDownloadingInvoice] = useState<string | null>(null);

  const ITEMS_PER_PAGE = limit || 10;

  useEffect(() => {
    fetchInvoices();
  }, [currentPage, statusFilter, sortBy, sortOrder, searchTerm]);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: ITEMS_PER_PAGE.toString(),
        sortBy,
        sortOrder,
      });

      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      if (searchTerm.trim()) {
        params.append('search', searchTerm.trim());
      }

      const response = await fetch(`/api/billing/invoices?${params}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch invoices');
      }

      const data = await response.json();
      setInvoices(data.invoices);
      setTotalPages(Math.ceil(data.total / ITEMS_PER_PAGE));

    } catch (err: any) {
      console.error('Error fetching invoices:', err);
      setError(err.message || 'Failed to load invoices');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadInvoice = async (invoiceId: string, downloadUrl?: string) => {
    setDownloadingInvoice(invoiceId);
    
    try {
      const url = downloadUrl || `/api/billing/invoices/${invoiceId}/download`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/pdf',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to download invoice');
      }

      const blob = await response.blob();
      const downloadUrl2 = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl2;
      a.download = `invoice-${invoiceId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl2);
      document.body.removeChild(a);

    } catch (err: any) {
      console.error('Error downloading invoice:', err);
      setError(err.message || 'Failed to download invoice');
    } finally {
      setDownloadingInvoice(null);
    }
  };

  const formatAmount = (amount: number, currency: string) => {
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
        return 'text-sage bg-sage/20 border-sage/30';
      case 'open':
        return 'text-gold-primary bg-gold-primary/20 border-gold-primary/30';
      case 'void':
      case 'uncollectible':
        return 'text-red-warning bg-red-warning/20 border-red-warning/30';
      case 'draft':
        return 'text-text-secondary bg-teal-20/50 border-border';
      default:
        return 'text-text-secondary bg-teal-20/50 border-border';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'uncollectible':
        return 'Uncollectible';
      default:
        return status.charAt(0).toUpperCase() + status.slice(1);
    }
  };

  const filteredInvoices = invoices.filter((invoice) => {
    const matchesSearch = !searchTerm || 
      invoice.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.description.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  if (loading && invoices.length === 0) {
    return (
      <div className={cn("invoice-history", className)}>
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto bg-teal-20 rounded-full flex items-center justify-center mb-4">
            <svg className="animate-spin w-8 h-8 text-teal-secondary" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <p className="text-text-secondary">Loading invoices...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("invoice-history space-y-6", className)}>
      {/* Header */}
      <div className="invoice-history-header">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-cream">
            Invoice History
          </h2>
          
          {invoices.length > 0 && (
            <div className="text-sm text-text-secondary">
              {filteredInvoices.length} of {invoices.length} invoices
            </div>
          )}
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="filters-section grid md:grid-cols-4 gap-4 mb-6">
            {showSearch && (
              <div className="search-input">
                <Input
                  placeholder="Search invoices..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-teal-20 border-border text-cream placeholder:text-text-muted"
                />
              </div>
            )}
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="bg-teal-20 border-border text-cream">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="void">Void</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="uncollectible">Uncollectible</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
              <SelectTrigger className="bg-teal-20 border-border text-cream">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">Date</SelectItem>
                <SelectItem value="amount">Amount</SelectItem>
                <SelectItem value="status">Status</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={sortOrder} onValueChange={(value: any) => setSortOrder(value)}>
              <SelectTrigger className="bg-teal-20 border-border text-cream">
                <SelectValue placeholder="Order" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="desc">Newest First</SelectItem>
                <SelectItem value="asc">Oldest First</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span>{error}</span>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setError(null)}
            className="ml-auto"
          >
            ×
          </Button>
        </Alert>
      )}

      {/* Invoices List */}
      {filteredInvoices.length > 0 ? (
        <div className="invoices-container space-y-4">
          {filteredInvoices.map((invoice) => (
            <Card key={invoice.id} className="invoice-card p-6">
              <div className="invoice-content">
                <div className="invoice-header flex items-start justify-between mb-4">
                  <div className="invoice-info flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-cream">
                        Invoice #{invoice.number}
                      </h3>
                      <Badge className={cn("text-xs", getStatusColor(invoice.status))}>
                        {getStatusLabel(invoice.status)}
                      </Badge>
                    </div>
                    
                    <div className="invoice-meta text-sm text-text-secondary space-y-1">
                      <div>Created: {formatDate(invoice.created)}</div>
                      {invoice.dueDate && (
                        <div>Due: {formatDate(invoice.dueDate)}</div>
                      )}
                      {invoice.paidAt && (
                        <div>Paid: {formatDate(invoice.paidAt)}</div>
                      )}
                    </div>
                  </div>
                  
                  <div className="invoice-amount text-right">
                    <div className="text-2xl font-bold text-gold-primary mb-1">
                      {formatAmount(invoice.amount, invoice.currency)}
                    </div>
                    
                    <div className="invoice-actions space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDownloadInvoice(invoice.id, invoice.downloadUrl)}
                        disabled={downloadingInvoice === invoice.id}
                        className="text-xs"
                      >
                        {downloadingInvoice === invoice.id ? (
                          <div className="flex items-center gap-1">
                            <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span>Downloading...</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                            <span>PDF</span>
                          </div>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Description */}
                {invoice.description && (
                  <div className="invoice-description mb-4">
                    <p className="text-sm text-text-secondary">
                      {invoice.description}
                    </p>
                  </div>
                )}

                {/* Line Items */}
                {invoice.lineItems.length > 0 && (
                  <div className="line-items">
                    <h4 className="text-sm font-medium text-cream mb-2">Items</h4>
                    <div className="line-items-list space-y-2">
                      {invoice.lineItems.map((item, index) => (
                        <div key={index} className="line-item flex justify-between items-center text-sm">
                          <div className="item-description text-text-secondary">
                            {item.description}
                            {item.quantity > 1 && (
                              <span className="text-text-muted"> × {item.quantity}</span>
                            )}
                          </div>
                          <div className="item-amount font-medium text-cream">
                            {formatAmount(item.amount, invoice.currency)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-8 text-center">
          <div className="w-16 h-16 mx-auto bg-teal-20 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-text-secondary" fill="currentColor" viewBox="0 0 24 24">
              <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
            </svg>
          </div>
          
          <h3 className="text-lg font-medium text-cream mb-2">
            {searchTerm || statusFilter !== 'all' ? 'No Matching Invoices' : 'No Invoices Found'}
          </h3>
          <p className="text-text-secondary mb-4">
            {searchTerm || statusFilter !== 'all' 
              ? 'Try adjusting your search terms or filters.'
              : 'Your invoices will appear here once you have an active subscription.'
            }
          </p>
          
          {(searchTerm || statusFilter !== 'all') && (
            <Button 
              variant="outline" 
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('all');
              }}
            >
              Clear Filters
            </Button>
          )}
        </Card>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pagination flex items-center justify-between">
          <div className="pagination-info text-sm text-text-secondary">
            Page {currentPage} of {totalPages}
          </div>
          
          <div className="pagination-controls flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1 || loading}
            >
              Previous
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages || loading}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default InvoiceHistory;