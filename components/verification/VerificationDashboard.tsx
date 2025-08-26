'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle,
  Clock,
  AlertCircle,
  RefreshCw,
  Eye,
  MessageSquare,
  Phone,
  Mail,
  ExternalLink,
  Download,
  Calendar,
  User,
  Building,
  FileText,
  Shield,
  Award,
  AlertTriangle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { GlassMorphism } from '../GlassMorphism';

export interface VerificationDashboardProps {
  workflowId?: string;
  businessId?: string;
  stepData?: VerificationDashboardData;
  onComplete?: (data: VerificationDashboardData) => void;
  onError?: (errors: string[]) => void;
  isLoading?: boolean;
}

export interface VerificationDashboardData {
  status: VerificationStatus;
  completionPercentage: number;
  submissionDate: string;
  estimatedProcessingTime: string;
  reviewNotes?: string;
  nextSteps: string[];
  documentsSubmitted: SubmittedDocument[];
  timeline: TimelineEvent[];
  canAppeal?: boolean;
  appealDeadline?: string;
}

export type VerificationStatus = 
  | 'submitted'
  | 'under_review'
  | 'additional_info_required'
  | 'approved'
  | 'rejected'
  | 'expired';

export interface SubmittedDocument {
  id: string;
  type: string;
  name: string;
  status: 'verified' | 'pending' | 'rejected' | 'requires_attention';
  uploadDate: string;
  reviewNotes?: string;
}

export interface TimelineEvent {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  type: 'info' | 'success' | 'warning' | 'error';
  icon: React.ComponentType<any>;
}

const STATUS_CONFIG = {
  submitted: {
    label: 'Submitted',
    description: 'Your verification has been submitted and is awaiting review',
    color: 'blue',
    icon: Clock,
    showProgress: true
  },
  under_review: {
    label: 'Under Review',
    description: 'Our team is currently reviewing your verification documents',
    color: 'yellow',
    icon: Eye,
    showProgress: true
  },
  additional_info_required: {
    label: 'Additional Information Required',
    description: 'We need some additional information to complete your verification',
    color: 'orange',
    icon: AlertTriangle,
    showProgress: false
  },
  approved: {
    label: 'Approved',
    description: 'Congratulations! Your business verification has been approved',
    color: 'green',
    icon: CheckCircle,
    showProgress: false
  },
  rejected: {
    label: 'Rejected',
    description: 'Your verification was not approved. You can appeal this decision',
    color: 'red',
    icon: AlertCircle,
    showProgress: false
  },
  expired: {
    label: 'Expired',
    description: 'Your verification has expired and needs to be resubmitted',
    color: 'gray',
    icon: Clock,
    showProgress: false
  }
};

export const VerificationDashboard: React.FC<VerificationDashboardProps> = ({
  workflowId,
  businessId,
  stepData,
  onComplete,
  onError,
  isLoading = false
}) => {
  const [dashboardData, setDashboardData] = useState<VerificationDashboardData>(
    stepData || {
      status: 'submitted',
      completionPercentage: 100,
      submissionDate: new Date().toISOString(),
      estimatedProcessingTime: '2-3 business days',
      nextSteps: ['Wait for review completion', 'Check email for updates'],
      documentsSubmitted: [],
      timeline: []
    }
  );
  
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showDocumentDetails, setShowDocumentDetails] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<SubmittedDocument | null>(null);

  const statusConfig = STATUS_CONFIG[dashboardData.status];

  // Mock data - in a real implementation, this would come from the backend
  const mockTimelineEvents: TimelineEvent[] = [
    {
      id: '1',
      title: 'Verification Submitted',
      description: 'All required documents and information have been submitted',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
      type: 'success',
      icon: CheckCircle
    },
    {
      id: '2',
      title: 'Document Review Started',
      description: 'Our compliance team has started reviewing your documents',
      timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(), // 1 hour ago
      type: 'info',
      icon: Eye
    },
    {
      id: '3',
      title: 'Identity Verification Complete',
      description: 'Your identity has been successfully verified',
      timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 minutes ago
      type: 'success',
      icon: User
    }
  ];

  const mockDocuments: SubmittedDocument[] = [
    {
      id: '1',
      type: 'Business License',
      name: 'business-license.pdf',
      status: 'verified',
      uploadDate: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()
    },
    {
      id: '2',
      type: 'Tax ID Document',
      name: 'ein-letter.pdf',
      status: 'verified',
      uploadDate: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()
    },
    {
      id: '3',
      type: 'ID Document',
      name: 'drivers-license.jpg',
      status: 'pending',
      uploadDate: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
    }
  ];

  useEffect(() => {
    // Initialize with mock data
    setDashboardData(prev => ({
      ...prev,
      timeline: mockTimelineEvents,
      documentsSubmitted: mockDocuments
    }));
  }, []);

  const refreshStatus = async () => {
    setIsRefreshing(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // In a real implementation, you would fetch updated status from the backend
      // For now, we'll just update the timestamp of the last timeline event
      setDashboardData(prev => ({
        ...prev,
        timeline: [
          ...prev.timeline,
          {
            id: Date.now().toString(),
            title: 'Status Updated',
            description: 'Verification status has been refreshed',
            timestamp: new Date().toISOString(),
            type: 'info',
            icon: RefreshCw
          }
        ]
      }));
    } catch (error) {
      onError?.(['Failed to refresh status']);
    } finally {
      setIsRefreshing(false);
    }
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
    
    return date.toLocaleDateString();
  };

  const renderStatusCard = () => {
    const IconComponent = statusConfig.icon;
    
    return (
      <GlassMorphism variant="medium" className="p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            <div className={cn(
              'w-16 h-16 rounded-full flex items-center justify-center',
              statusConfig.color === 'green' && 'bg-green-500/20 text-green-400',
              statusConfig.color === 'blue' && 'bg-blue-500/20 text-blue-400',
              statusConfig.color === 'yellow' && 'bg-yellow-500/20 text-yellow-400',
              statusConfig.color === 'orange' && 'bg-orange-500/20 text-orange-400',
              statusConfig.color === 'red' && 'bg-red-500/20 text-red-400',
              statusConfig.color === 'gray' && 'bg-gray-500/20 text-gray-400'
            )}>
              <IconComponent className="w-8 h-8" />
            </div>
            
            <div>
              <h2 className="text-2xl font-bold text-cream">{statusConfig.label}</h2>
              <p className="text-sage/70">{statusConfig.description}</p>
            </div>
          </div>

          <motion.button
            onClick={refreshStatus}
            disabled={isRefreshing}
            className="p-3 text-sage/70 hover:text-cream hover:bg-sage/10 rounded-lg transition-all duration-200"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <RefreshCw className={cn(
              'w-5 h-5',
              isRefreshing && 'animate-spin'
            )} />
          </motion.button>
        </div>

        {statusConfig.showProgress && (
          <div className="mb-4">
            <div className="flex items-center justify-between text-sm text-sage/70 mb-2">
              <span>Verification Progress</span>
              <span>{dashboardData.completionPercentage}%</span>
            </div>
            <div className="w-full bg-navy-dark/30 rounded-full h-2">
              <motion.div
                className={cn(
                  'h-2 rounded-full',
                  statusConfig.color === 'green' && 'bg-green-500',
                  statusConfig.color === 'blue' && 'bg-blue-500',
                  statusConfig.color === 'yellow' && 'bg-yellow-500',
                  statusConfig.color === 'orange' && 'bg-orange-500'
                )}
                initial={{ width: 0 }}
                animate={{ width: `${dashboardData.completionPercentage}%` }}
                transition={{ duration: 1, ease: 'easeInOut' }}
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-sage/70">Submitted:</span>
            <span className="text-cream ml-2">{formatDate(dashboardData.submissionDate)}</span>
          </div>
          <div>
            <span className="text-sage/70">Est. Processing:</span>
            <span className="text-cream ml-2">{dashboardData.estimatedProcessingTime}</span>
          </div>
        </div>

        {dashboardData.reviewNotes && (
          <div className="mt-4 p-4 bg-orange-500/10 border border-orange-500/20 rounded-lg">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-orange-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-orange-300 font-medium mb-1">Review Notes</p>
                <p className="text-orange-200 text-sm">{dashboardData.reviewNotes}</p>
              </div>
            </div>
          </div>
        )}
      </GlassMorphism>
    );
  };

  const renderNextSteps = () => {
    if (dashboardData.nextSteps.length === 0) return null;

    return (
      <GlassMorphism variant="light" className="p-6 mb-6">
        <h3 className="text-lg font-semibold text-cream mb-4">Next Steps</h3>
        <div className="space-y-3">
          {dashboardData.nextSteps.map((step, index) => (
            <div key={index} className="flex items-start space-x-3">
              <div className="w-6 h-6 rounded-full bg-teal-primary/20 text-teal-primary flex items-center justify-center text-sm font-medium mt-0.5">
                {index + 1}
              </div>
              <p className="text-sage/90">{step}</p>
            </div>
          ))}
        </div>
      </GlassMorphism>
    );
  };

  const renderDocumentStatus = () => (
    <GlassMorphism variant="light" className="p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-cream">Documents Submitted</h3>
        <button
          onClick={() => setShowDocumentDetails(!showDocumentDetails)}
          className="text-teal-primary hover:text-teal-secondary transition-colors"
        >
          {showDocumentDetails ? 'Hide Details' : 'View Details'}
        </button>
      </div>

      <div className="space-y-3">
        {dashboardData.documentsSubmitted.map((document) => (
          <motion.div
            key={document.id}
            className="flex items-center justify-between p-3 border border-sage/20 rounded-lg"
            whileHover={{ backgroundColor: 'rgba(118, 169, 250, 0.05)' }}
          >
            <div className="flex items-center space-x-3">
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center',
                document.status === 'verified' && 'bg-green-500/20 text-green-400',
                document.status === 'pending' && 'bg-yellow-500/20 text-yellow-400',
                document.status === 'rejected' && 'bg-red-500/20 text-red-400',
                document.status === 'requires_attention' && 'bg-orange-500/20 text-orange-400'
              )}>
                {document.status === 'verified' && <CheckCircle className="w-4 h-4" />}
                {document.status === 'pending' && <Clock className="w-4 h-4" />}
                {document.status === 'rejected' && <AlertCircle className="w-4 h-4" />}
                {document.status === 'requires_attention' && <AlertTriangle className="w-4 h-4" />}
              </div>
              
              <div>
                <p className="text-cream font-medium">{document.type}</p>
                <p className="text-sage/70 text-sm">{document.name}</p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <span className={cn(
                'px-2 py-1 text-xs rounded capitalize',
                document.status === 'verified' && 'bg-green-500/20 text-green-300',
                document.status === 'pending' && 'bg-yellow-500/20 text-yellow-300',
                document.status === 'rejected' && 'bg-red-500/20 text-red-300',
                document.status === 'requires_attention' && 'bg-orange-500/20 text-orange-300'
              )}>
                {document.status.replace('_', ' ')}
              </span>
              
              {showDocumentDetails && (
                <button
                  onClick={() => setSelectedDocument(document)}
                  className="p-1 text-sage/70 hover:text-cream transition-colors"
                >
                  <Eye className="w-4 h-4" />
                </button>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </GlassMorphism>
  );

  const renderTimeline = () => (
    <GlassMorphism variant="light" className="p-6">
      <h3 className="text-lg font-semibold text-cream mb-6">Verification Timeline</h3>
      
      <div className="relative">
        {dashboardData.timeline.map((event, index) => {
          const IconComponent = event.icon;
          const isLast = index === dashboardData.timeline.length - 1;
          
          return (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="relative flex items-start space-x-4 pb-6"
            >
              {/* Timeline line */}
              {!isLast && (
                <div className="absolute left-6 top-12 w-0.5 h-full bg-sage/20" />
              )}
              
              {/* Icon */}
              <div className={cn(
                'w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 border-2',
                event.type === 'success' && 'bg-green-500/20 border-green-500/30 text-green-400',
                event.type === 'info' && 'bg-blue-500/20 border-blue-500/30 text-blue-400',
                event.type === 'warning' && 'bg-yellow-500/20 border-yellow-500/30 text-yellow-400',
                event.type === 'error' && 'bg-red-500/20 border-red-500/30 text-red-400'
              )}>
                <IconComponent className="w-5 h-5" />
              </div>
              
              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-cream font-medium">{event.title}</p>
                    <p className="text-sage/70 text-sm mt-1">{event.description}</p>
                  </div>
                  <span className="text-sage/50 text-xs whitespace-nowrap ml-4">
                    {formatDate(event.timestamp)}
                  </span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </GlassMorphism>
  );

  const renderSupportSection = () => (
    <GlassMorphism variant="light" className="p-6 mt-6">
      <h3 className="text-lg font-semibold text-cream mb-4">Need Help?</h3>
      <p className="text-sage/70 text-sm mb-4">
        If you have questions about your verification or need assistance, our support team is here to help.
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.a
          href="mailto:support@example.com"
          className="flex items-center space-x-3 p-3 border border-sage/20 rounded-lg hover:border-teal-primary/30 hover:bg-teal-primary/5 transition-all duration-200"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <Mail className="w-5 h-5 text-teal-primary" />
          <div>
            <p className="text-cream font-medium text-sm">Email Support</p>
            <p className="text-sage/70 text-xs">Get help via email</p>
          </div>
        </motion.a>
        
        <motion.a
          href="tel:+1-555-123-4567"
          className="flex items-center space-x-3 p-3 border border-sage/20 rounded-lg hover:border-teal-primary/30 hover:bg-teal-primary/5 transition-all duration-200"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <Phone className="w-5 h-5 text-teal-primary" />
          <div>
            <p className="text-cream font-medium text-sm">Phone Support</p>
            <p className="text-sage/70 text-xs">Call us directly</p>
          </div>
        </motion.a>
        
        <motion.button
          className="flex items-center space-x-3 p-3 border border-sage/20 rounded-lg hover:border-teal-primary/30 hover:bg-teal-primary/5 transition-all duration-200"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <MessageSquare className="w-5 h-5 text-teal-primary" />
          <div>
            <p className="text-cream font-medium text-sm">Live Chat</p>
            <p className="text-sage/70 text-xs">Chat with support</p>
          </div>
        </motion.button>
      </div>
    </GlassMorphism>
  );

  // Auto-complete when status is approved
  useEffect(() => {
    if (dashboardData.status === 'approved') {
      onComplete?.(dashboardData);
    }
  }, [dashboardData.status, onComplete, dashboardData]);

  return (
    <div className="space-y-6">
      {renderStatusCard()}
      {renderNextSteps()}
      {renderDocumentStatus()}
      {renderTimeline()}
      {renderSupportSection()}

      {/* Document Details Modal */}
      <AnimatePresence>
        {selectedDocument && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-navy-dark/80 backdrop-blur-sm p-4"
            onClick={() => setSelectedDocument(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md"
            >
              <GlassMorphism variant="medium" className="p-6">
                <h3 className="text-lg font-semibold text-cream mb-4">
                  Document Details
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <p className="text-sage/70 text-sm">Document Type</p>
                    <p className="text-cream">{selectedDocument.type}</p>
                  </div>
                  
                  <div>
                    <p className="text-sage/70 text-sm">File Name</p>
                    <p className="text-cream">{selectedDocument.name}</p>
                  </div>
                  
                  <div>
                    <p className="text-sage/70 text-sm">Upload Date</p>
                    <p className="text-cream">{formatDate(selectedDocument.uploadDate)}</p>
                  </div>
                  
                  <div>
                    <p className="text-sage/70 text-sm">Status</p>
                    <span className={cn(
                      'inline-block px-2 py-1 text-xs rounded capitalize mt-1',
                      selectedDocument.status === 'verified' && 'bg-green-500/20 text-green-300',
                      selectedDocument.status === 'pending' && 'bg-yellow-500/20 text-yellow-300',
                      selectedDocument.status === 'rejected' && 'bg-red-500/20 text-red-300',
                      selectedDocument.status === 'requires_attention' && 'bg-orange-500/20 text-orange-300'
                    )}>
                      {selectedDocument.status.replace('_', ' ')}
                    </span>
                  </div>

                  {selectedDocument.reviewNotes && (
                    <div>
                      <p className="text-sage/70 text-sm">Review Notes</p>
                      <p className="text-cream text-sm">{selectedDocument.reviewNotes}</p>
                    </div>
                  )}
                </div>
                
                <div className="flex justify-end mt-6">
                  <button
                    onClick={() => setSelectedDocument(null)}
                    className="px-4 py-2 text-teal-primary hover:text-teal-secondary transition-colors"
                  >
                    Close
                  </button>
                </div>
              </GlassMorphism>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default VerificationDashboard;