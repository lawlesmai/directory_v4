'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload,
  Camera,
  FileText,
  Image as ImageIcon,
  CheckCircle,
  AlertCircle,
  X,
  RefreshCw,
  Eye,
  Download,
  Trash2,
  HelpCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { GlassMorphism } from '../GlassMorphism';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useMediaDevices } from '@/hooks/useMediaDevices';
import { formatFileSize } from '@/lib/auth/business-verification';

export interface DocumentUploaderProps {
  workflowId?: string;
  businessId?: string;
  stepData?: DocumentUploadData;
  onComplete?: (data: DocumentUploadData) => void;
  onError?: (errors: string[]) => void;
  isLoading?: boolean;
}

export interface DocumentUploadData {
  documents: UploadedDocument[];
  requiredDocumentsMet: Record<string, boolean>;
  completionPercentage: number;
}

export interface UploadedDocument {
  id: string;
  type: DocumentType;
  fileName: string;
  fileSize: number;
  uploadedAt: string;
  status: 'uploading' | 'processing' | 'verified' | 'rejected' | 'requires_review';
  confidence?: number;
  extractedData?: Record<string, any>;
  rejectionReason?: string;
  preview?: string;
}

export type DocumentType = 
  | 'business_license'
  | 'tax_id'
  | 'registration_certificate'
  | 'incorporation_docs'
  | 'operating_agreement'
  | 'insurance'
  | 'other';

interface RequiredDocument {
  type: DocumentType;
  label: string;
  description: string;
  required: boolean;
  acceptedFormats: string[];
  examples: string[];
}

const REQUIRED_DOCUMENTS: RequiredDocument[] = [
  {
    type: 'business_license',
    label: 'Business License',
    description: 'Valid business license or permit to operate',
    required: true,
    acceptedFormats: ['PDF', 'JPG', 'PNG'],
    examples: ['City business license', 'State operating permit', 'Professional license']
  },
  {
    type: 'tax_id',
    label: 'Tax ID Document',
    description: 'EIN letter or tax registration document',
    required: true,
    acceptedFormats: ['PDF', 'JPG', 'PNG'],
    examples: ['IRS EIN letter', 'State tax registration', 'Sales tax permit']
  },
  {
    type: 'registration_certificate',
    label: 'Business Registration',
    description: 'Certificate of formation or registration',
    required: true,
    acceptedFormats: ['PDF', 'JPG', 'PNG'],
    examples: ['Articles of incorporation', 'Certificate of formation', 'DBA filing']
  },
  {
    type: 'incorporation_docs',
    label: 'Incorporation Documents',
    description: 'Legal formation documents (if applicable)',
    required: false,
    acceptedFormats: ['PDF', 'DOC', 'DOCX'],
    examples: ['Bylaws', 'Operating agreement', 'Partnership agreement']
  }
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

export const DocumentUploader: React.FC<DocumentUploaderProps> = ({
  workflowId,
  businessId,
  stepData,
  onComplete,
  onError,
  isLoading = false
}) => {
  const [documents, setDocuments] = useState<UploadedDocument[]>(stepData?.documents || []);
  const [dragActive, setDragActive] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [selectedDocumentType, setSelectedDocumentType] = useState<DocumentType>('business_license');
  const [uploadingFiles, setUploadingFiles] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<string[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const isMobile = useIsMobile();
  const { hasCamera, requestCameraPermission } = useMediaDevices();

  // Check completion status
  const requiredDocumentsMet = REQUIRED_DOCUMENTS.reduce((acc, doc) => {
    const hasDocument = documents.some(d => 
      d.type === doc.type && 
      ['verified', 'processing', 'requires_review'].includes(d.status)
    );
    acc[doc.type] = doc.required ? hasDocument : true;
    return acc;
  }, {} as Record<string, boolean>);

  const completionPercentage = Math.round(
    (Object.values(requiredDocumentsMet).filter(Boolean).length / 
     REQUIRED_DOCUMENTS.filter(d => d.required).length) * 100
  );

  const isComplete = Object.values(requiredDocumentsMet).every(Boolean);

  // Update parent component when data changes
  useEffect(() => {
    const uploadData: DocumentUploadData = {
      documents,
      requiredDocumentsMet,
      completionPercentage
    };

    if (isComplete) {
      onComplete?.(uploadData);
    }
  }, [documents, requiredDocumentsMet, completionPercentage, isComplete, onComplete]);

  const validateFile = useCallback((file: File): { valid: boolean; error?: string } => {
    if (file.size > MAX_FILE_SIZE) {
      return { valid: false, error: `File size must be less than ${formatFileSize(MAX_FILE_SIZE)}` };
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return { valid: false, error: 'File type not supported. Please use PDF, JPG, PNG, or DOC files.' };
    }

    return { valid: true };
  }, []);

  const uploadDocument = useCallback(async (file: File, documentType: DocumentType): Promise<void> => {
    const validation = validateFile(file);
    if (!validation.valid) {
      setErrors(prev => [...prev, validation.error!]);
      return;
    }

    const tempId = Math.random().toString(36).substr(2, 9);
    const newDocument: UploadedDocument = {
      id: tempId,
      type: documentType,
      fileName: file.name,
      fileSize: file.size,
      uploadedAt: new Date().toISOString(),
      status: 'uploading',
      preview: URL.createObjectURL(file)
    };

    setDocuments(prev => [...prev, newDocument]);
    setUploadingFiles(prev => new Set([...prev, tempId]));

    try {
      // Create form data
      const formData = new FormData();
      formData.append('file', file);
      formData.append('documentType', documentType);
      formData.append('workflowId', workflowId || '');
      formData.append('businessId', businessId || '');

      // Upload to backend
      const response = await fetch('/api/onboarding/business-verification', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (result.success) {
        // Update document with server response
        setDocuments(prev => prev.map(doc => 
          doc.id === tempId 
            ? {
                ...doc,
                id: result.documentId,
                status: 'processing',
                confidence: result.confidence || 0
              }
            : doc
        ));

        // Clear any previous errors
        setErrors(prev => prev.filter(e => !e.includes('upload')));
      } else {
        // Remove failed upload and show error
        setDocuments(prev => prev.filter(doc => doc.id !== tempId));
        setErrors(prev => [...prev, result.error || 'Upload failed']);
      }
    } catch (error) {
      // Remove failed upload and show error
      setDocuments(prev => prev.filter(doc => doc.id !== tempId));
      setErrors(prev => [...prev, 'Network error. Please try again.']);
    } finally {
      setUploadingFiles(prev => {
        const newSet = new Set(prev);
        newSet.delete(tempId);
        return newSet;
      });
    }
  }, [validateFile, workflowId, businessId]);

  const handleFileSelect = useCallback((files: FileList | null, documentType: DocumentType) => {
    if (!files || files.length === 0) return;

    Array.from(files).forEach(file => {
      uploadDocument(file, documentType);
    });
  }, [uploadDocument]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = e.dataTransfer.files;
    handleFileSelect(files, selectedDocumentType);
  }, [handleFileSelect, selectedDocumentType]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Only set dragActive to false if leaving the drop zone entirely
    if (!dropZoneRef.current?.contains(e.relatedTarget as Node)) {
      setDragActive(false);
    }
  }, []);

  const startCamera = useCallback(async () => {
    if (!hasCamera) return;

    try {
      await requestCameraPermission();
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          facingMode: 'environment' // Use back camera on mobile
        }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setShowCamera(true);
      }
    } catch (error) {
      console.error('Camera access denied:', error);
      setErrors(prev => [...prev, 'Camera access is required for photo capture.']);
    }
  }, [hasCamera, requestCameraPermission]);

  const stopCamera = useCallback(() => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setShowCamera(false);
  }, []);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0);

    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `document_${Date.now()}.jpg`, { type: 'image/jpeg' });
        uploadDocument(file, selectedDocumentType);
        stopCamera();
      }
    }, 'image/jpeg', 0.8);
  }, [selectedDocumentType, uploadDocument, stopCamera]);

  const removeDocument = useCallback((documentId: string) => {
    setDocuments(prev => prev.filter(doc => doc.id !== documentId));
  }, []);

  const retryDocument = useCallback((document: UploadedDocument) => {
    // Remove the failed document and trigger file selector
    removeDocument(document.id);
    setSelectedDocumentType(document.type);
    fileInputRef.current?.click();
  }, [removeDocument]);

  const renderDocumentTypeSelector = () => (
    <div className="mb-6">
      <h3 className="text-lg font-semibold text-cream mb-4">Required Documents</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {REQUIRED_DOCUMENTS.map((docType) => {
          const hasDocument = documents.some(d => d.type === docType.type);
          const isSelected = selectedDocumentType === docType.type;

          return (
            <motion.button
              key={docType.type}
              onClick={() => setSelectedDocumentType(docType.type)}
              className={cn(
                'p-4 rounded-lg border-2 transition-all duration-200 text-left',
                isSelected && 'border-teal-primary bg-teal-primary/10',
                !isSelected && hasDocument && 'border-green-500/50 bg-green-500/10',
                !isSelected && !hasDocument && 'border-sage/20 hover:border-sage/40',
                docType.required && !hasDocument && 'border-orange-500/30'
              )}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <FileText className="w-5 h-5 text-sage" />
                    <span className="font-medium text-cream">{docType.label}</span>
                    {docType.required && (
                      <span className="text-xs text-orange-400">Required</span>
                    )}
                  </div>
                  <p className="text-sm text-sage/70 mt-1">{docType.description}</p>
                  <p className="text-xs text-sage/50 mt-2">
                    Accepts: {docType.acceptedFormats.join(', ')}
                  </p>
                </div>
                {hasDocument && (
                  <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 ml-2" />
                )}
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );

  const renderUploadZone = () => (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-medium text-cream">
          Upload {REQUIRED_DOCUMENTS.find(d => d.type === selectedDocumentType)?.label}
        </h4>
        <div className="flex items-center space-x-2 text-sm text-sage/70">
          <span>Max size: {formatFileSize(MAX_FILE_SIZE)}</span>
        </div>
      </div>

      <GlassMorphism variant="light" className="p-6">
        <div
          ref={dropZoneRef}
          className={cn(
            'border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200',
            dragActive ? 'border-teal-primary bg-teal-primary/10' : 'border-sage/30',
            'hover:border-sage/50 hover:bg-sage/5'
          )}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <Upload className="w-12 h-12 text-sage/50 mx-auto mb-4" />
          <p className="text-cream mb-2">
            {dragActive ? 'Drop your document here' : 'Drag and drop your document here'}
          </p>
          <p className="text-sage/70 text-sm mb-4">or</p>
          
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <motion.button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'px-6 py-3 bg-teal-primary hover:bg-teal-secondary',
                'text-cream font-medium rounded-lg transition-colors duration-200',
                'focus:outline-none focus:ring-2 focus:ring-teal-primary/50'
              )}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Browse Files
            </motion.button>

            {isMobile && hasCamera && (
              <motion.button
                type="button"
                onClick={startCamera}
                className={cn(
                  'px-6 py-3 bg-sage/20 hover:bg-sage/30',
                  'text-sage hover:text-cream font-medium rounded-lg transition-colors duration-200',
                  'focus:outline-none focus:ring-2 focus:ring-sage/50'
                )}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Camera className="w-4 h-4 mr-2" />
                Take Photo
              </motion.button>
            )}
          </div>
        </div>
      </GlassMorphism>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={ALLOWED_MIME_TYPES.join(',')}
        onChange={(e) => handleFileSelect(e.target.files, selectedDocumentType)}
        className="hidden"
      />
    </div>
  );

  const renderUploadedDocuments = () => {
    if (documents.length === 0) return null;

    return (
      <div className="mb-6">
        <h4 className="font-medium text-cream mb-4">Uploaded Documents</h4>
        <div className="space-y-3">
          {documents.map((document) => (
            <motion.div
              key={document.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 border border-sage/20 rounded-lg"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {document.status === 'uploading' ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      className="w-5 h-5 border-2 border-teal-primary border-t-transparent rounded-full"
                    />
                  ) : document.status === 'verified' ? (
                    <CheckCircle className="w-5 h-5 text-green-400" />
                  ) : document.status === 'rejected' ? (
                    <AlertCircle className="w-5 h-5 text-red-400" />
                  ) : (
                    <RefreshCw className="w-5 h-5 text-orange-400" />
                  )}
                  
                  <div>
                    <p className="text-cream font-medium">{document.fileName}</p>
                    <div className="flex items-center space-x-4 text-sm text-sage/70">
                      <span>{formatFileSize(document.fileSize)}</span>
                      <span className="capitalize">{document.type.replace('_', ' ')}</span>
                      {document.confidence && (
                        <span>Confidence: {Math.round(document.confidence * 100)}%</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {document.preview && (
                    <button
                      onClick={() => window.open(document.preview, '_blank')}
                      className="p-2 text-sage/70 hover:text-cream transition-colors"
                      title="View document"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  )}
                  
                  {document.status === 'rejected' && (
                    <button
                      onClick={() => retryDocument(document)}
                      className="p-2 text-orange-400 hover:text-orange-300 transition-colors"
                      title="Retry upload"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  )}
                  
                  <button
                    onClick={() => removeDocument(document.id)}
                    className="p-2 text-red-400 hover:text-red-300 transition-colors"
                    title="Remove document"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {document.status === 'rejected' && document.rejectionReason && (
                <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded text-sm text-red-300">
                  <strong>Rejected:</strong> {document.rejectionReason}
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    );
  };

  const renderCameraModal = () => (
    <AnimatePresence>
      {showCamera && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black flex flex-col"
        >
          {/* Camera Header */}
          <div className="flex items-center justify-between p-4 bg-navy-dark/80">
            <h3 className="text-cream font-medium">
              Capture {REQUIRED_DOCUMENTS.find(d => d.type === selectedDocumentType)?.label}
            </h3>
            <button
              onClick={stopCamera}
              className="p-2 text-cream hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Camera View */}
          <div className="flex-1 relative flex items-center justify-center">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="max-w-full max-h-full object-contain"
            />
            
            {/* Document outline guide */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-80 h-60 border-2 border-white/50 border-dashed rounded-lg">
                <div className="absolute -top-6 left-0 right-0 text-center">
                  <span className="text-white text-sm bg-black/50 px-2 py-1 rounded">
                    Position document within frame
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Camera Controls */}
          <div className="p-6 bg-navy-dark/80">
            <div className="flex items-center justify-center space-x-6">
              <button
                onClick={stopCamera}
                className="px-6 py-3 text-cream hover:bg-white/10 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <motion.button
                onClick={capturePhoto}
                className="w-16 h-16 bg-teal-primary hover:bg-teal-secondary rounded-full flex items-center justify-center transition-colors"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Camera className="w-6 h-6 text-cream" />
              </motion.button>
            </div>
            <p className="text-center text-sage/70 text-sm mt-3">
              Ensure document is clear and well-lit
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const renderErrors = () => {
    if (errors.length === 0) return null;

    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-red-300 font-medium mb-2">Upload Errors</p>
              <ul className="text-red-200 text-sm space-y-1">
                {errors.map((error, index) => (
                  <li key={index}>• {error}</li>
                ))}
              </ul>
              <button
                onClick={() => setErrors([])}
                className="text-red-300 hover:text-red-200 text-sm mt-2 underline"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  const renderProgress = () => (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <span className="text-cream font-medium">Upload Progress</span>
        <span className="text-sage/70 text-sm">{completionPercentage}% Complete</span>
      </div>
      <div className="w-full bg-navy-dark/30 rounded-full h-2">
        <motion.div
          className="h-2 bg-gradient-to-r from-teal-primary to-teal-secondary rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${completionPercentage}%` }}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
        />
      </div>
      <div className="flex justify-between text-xs text-sage/70 mt-1">
        <span>{documents.filter(d => d.status === 'verified').length} verified</span>
        <span>{documents.filter(d => d.status === 'processing').length} processing</span>
        <span>{documents.filter(d => d.status === 'rejected').length} rejected</span>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {renderProgress()}
      {renderErrors()}
      {renderDocumentTypeSelector()}
      {renderUploadZone()}
      {renderUploadedDocuments()}
      
      {/* Continue Button */}
      {isComplete && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-end"
        >
          <motion.button
            onClick={() => onComplete?.({
              documents,
              requiredDocumentsMet,
              completionPercentage
            })}
            className={cn(
              'px-8 py-3 bg-teal-primary hover:bg-teal-secondary',
              'text-cream font-medium rounded-lg transition-colors duration-200',
              'focus:outline-none focus:ring-2 focus:ring-teal-primary/50'
            )}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            disabled={isLoading}
          >
            {isLoading ? 'Processing...' : 'Continue to Identity Verification'}
          </motion.button>
        </motion.div>
      )}

      {/* Hidden canvas for photo capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Camera Modal */}
      {renderCameraModal()}
    </div>
  );
};

export default DocumentUploader;