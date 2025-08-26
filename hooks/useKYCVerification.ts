'use client';

import { useState, useCallback, useRef } from 'react';
import { businessVerificationService, VerificationWorkflowStatus } from '@/lib/auth/business-verification';

export interface UseKYCVerificationReturn {
  workflowId: string | null;
  verificationStatus: VerificationWorkflowStatus | null;
  isLoading: boolean;
  error: string | null;
  initializeVerification: () => Promise<void>;
  submitStepData: (stepId: string, data: any) => Promise<void>;
  uploadDocument: (file: File, documentType: string) => Promise<void>;
  submitForReview: (finalData: any) => Promise<any>;
  refreshStatus: () => Promise<void>;
}

export const useKYCVerification = (businessId?: string): UseKYCVerificationReturn => {
  const [workflowId, setWorkflowId] = useState<string | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<VerificationWorkflowStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Keep track of the current user ID (you might get this from auth context)
  const userIdRef = useRef<string>('current-user-id'); // Replace with actual user ID

  const handleError = useCallback((error: unknown, defaultMessage: string) => {
    console.error('KYC Verification Error:', error);
    const errorMessage = error instanceof Error ? error.message : defaultMessage;
    setError(errorMessage);
    throw new Error(errorMessage);
  }, []);

  const initializeVerification = useCallback(async () => {
    if (workflowId) return; // Already initialized

    setIsLoading(true);
    setError(null);

    try {
      const result = await businessVerificationService.initializeVerificationWorkflow(
        userIdRef.current,
        businessId
      );

      if (result.success && result.workflowId) {
        setWorkflowId(result.workflowId);
        if (result.status) {
          setVerificationStatus(result.status);
        }
      } else {
        throw new Error(result.error || 'Failed to initialize verification workflow');
      }
    } catch (error) {
      handleError(error, 'Failed to initialize verification');
    } finally {
      setIsLoading(false);
    }
  }, [workflowId, businessId, handleError]);

  const refreshStatus = useCallback(async () => {
    if (!workflowId) return;

    setIsLoading(true);
    setError(null);

    try {
      const status = await businessVerificationService.getVerificationStatus(workflowId);
      setVerificationStatus(status);
    } catch (error) {
      handleError(error, 'Failed to refresh verification status');
    } finally {
      setIsLoading(false);
    }
  }, [workflowId, handleError]);

  const submitStepData = useCallback(async (stepId: string, data: any) => {
    if (!workflowId) {
      throw new Error('Workflow not initialized');
    }

    setIsLoading(true);
    setError(null);

    try {
      // For now, we'll just store the step data locally
      // In a real implementation, you might want to submit to backend
      console.log('Submitting step data:', { stepId, data, workflowId });
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Refresh status after submission
      await refreshStatus();
    } catch (error) {
      handleError(error, 'Failed to submit step data');
    } finally {
      setIsLoading(false);
    }
  }, [workflowId, refreshStatus, handleError]);

  const uploadDocument = useCallback(async (file: File, documentType: string) => {
    if (!workflowId) {
      throw new Error('Workflow not initialized');
    }

    setIsLoading(true);
    setError(null);

    try {
      const fileData = {
        name: file.name,
        type: file.type,
        size: file.size,
        buffer: Buffer.from(await file.arrayBuffer())
      };

      const result = await businessVerificationService.uploadVerificationDocument(
        userIdRef.current,
        workflowId,
        documentType as any,
        fileData,
        businessId
      );

      if (!result.success) {
        throw new Error(result.error || 'Failed to upload document');
      }

      // Refresh status after upload
      await refreshStatus();

      return result;
    } catch (error) {
      handleError(error, 'Failed to upload document');
    } finally {
      setIsLoading(false);
    }
  }, [workflowId, businessId, refreshStatus, handleError]);

  const submitForReview = useCallback(async (finalData: any) => {
    if (!workflowId) {
      throw new Error('Workflow not initialized');
    }

    setIsLoading(true);
    setError(null);

    try {
      // Submit KYC information for review
      const result = await businessVerificationService.submitKYCInformation(
        userIdRef.current,
        workflowId,
        finalData
      );

      if (!result.success) {
        throw new Error(result.error || 'Failed to submit for review');
      }

      // Refresh status to get the latest state
      await refreshStatus();

      return {
        success: true,
        workflowId,
        status: verificationStatus?.status || 'under_review',
        completionPercentage: verificationStatus?.completionPercentage || 100,
        nextSteps: verificationStatus?.nextSteps || ['Wait for review completion']
      };
    } catch (error) {
      handleError(error, 'Failed to submit for review');
    } finally {
      setIsLoading(false);
    }
  }, [workflowId, verificationStatus, refreshStatus, handleError]);

  return {
    workflowId,
    verificationStatus,
    isLoading,
    error,
    initializeVerification,
    submitStepData,
    uploadDocument,
    submitForReview,
    refreshStatus
  };
};