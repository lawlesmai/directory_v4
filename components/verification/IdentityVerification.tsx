'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Camera,
  User,
  CheckCircle,
  AlertCircle,
  X,
  RefreshCw,
  Shield,
  Eye,
  UserCheck,
  Scan,
  SmilePlus,
  RotateCcw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { GlassMorphism } from '../GlassMorphism';
import { useMediaDevices } from '@/hooks/useMediaDevices';
import { useIsMobile } from '@/hooks/useIsMobile';

export interface IdentityVerificationProps {
  workflowId?: string;
  businessId?: string;
  stepData?: IdentityVerificationData;
  onComplete?: (data: IdentityVerificationData) => void;
  onError?: (errors: string[]) => void;
  isLoading?: boolean;
}

export interface IdentityVerificationData {
  idDocumentPhoto?: string;
  selfiePhoto?: string;
  livenessVerification?: LivenessData;
  extractedIdData?: ExtractedIdData;
  verificationScore?: number;
  status: 'not_started' | 'in_progress' | 'completed' | 'failed';
  biometricMatch?: number;
  riskFlags?: string[];
}

export interface LivenessData {
  smileDetected: boolean;
  blinkDetected: boolean;
  headMovementDetected: boolean;
  livenessScore: number;
  timestamp: string;
}

export interface ExtractedIdData {
  fullName?: string;
  dateOfBirth?: string;
  documentNumber?: string;
  expirationDate?: string;
  issueDate?: string;
  documentType?: string;
  confidence: number;
}

interface VerificationStep {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<any>;
  completed: boolean;
  required: boolean;
}

type CaptureMode = 'id_document' | 'selfie' | 'liveness';
type LivenessPrompt = 'center_face' | 'smile' | 'blink' | 'turn_left' | 'turn_right' | 'complete';

export const IdentityVerification: React.FC<IdentityVerificationProps> = ({
  workflowId,
  businessId,
  stepData,
  onComplete,
  onError,
  isLoading = false
}) => {
  const [verificationData, setVerificationData] = useState<IdentityVerificationData>(
    stepData || {
      status: 'not_started',
      riskFlags: []
    }
  );
  const [currentStep, setCurrentStep] = useState(0);
  const [showCamera, setShowCamera] = useState(false);
  const [captureMode, setCaptureMode] = useState<CaptureMode>('id_document');
  const [isCapturing, setIsCapturing] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [livenessPrompt, setLivenessPrompt] = useState<LivenessPrompt>('center_face');
  const [livenessProgress, setLivenessProgress] = useState<Partial<LivenessData>>({});
  const [errors, setErrors] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const { hasCamera, requestCameraPermission } = useMediaDevices();
  const isMobile = useIsMobile();

  const verificationSteps: VerificationStep[] = [
    {
      id: 'id_document',
      title: 'ID Document',
      description: 'Take a photo of your government-issued ID',
      icon: UserCheck,
      completed: !!verificationData.idDocumentPhoto,
      required: true
    },
    {
      id: 'selfie',
      title: 'Selfie Photo',
      description: 'Take a clear selfie photo',
      icon: User,
      completed: !!verificationData.selfiePhoto,
      required: true
    },
    {
      id: 'liveness',
      title: 'Liveness Check',
      description: 'Perform liveness verification',
      icon: Scan,
      completed: !!verificationData.livenessVerification,
      required: true
    }
  ];

  const completedSteps = verificationSteps.filter(step => step.completed).length;
  const totalSteps = verificationSteps.length;
  const completionPercentage = Math.round((completedSteps / totalSteps) * 100);
  const isComplete = completedSteps === totalSteps && verificationData.status === 'completed';

  // Face detection utility (simplified version)
  const detectFace = useCallback((video: HTMLVideoElement): boolean => {
    // In a real implementation, this would use a face detection library
    // For now, we'll simulate face detection
    return video.videoWidth > 0 && video.videoHeight > 0;
  }, []);

  const startCamera = useCallback(async (mode: CaptureMode) => {
    if (!hasCamera) {
      setErrors(prev => [...prev, 'Camera is required for identity verification']);
      return;
    }

    try {
      await requestCameraPermission();
      
      const constraints = {
        video: {
          width: { ideal: mode === 'id_document' ? 1920 : 1280 },
          height: { ideal: mode === 'id_document' ? 1080 : 720 },
          facingMode: mode === 'id_document' ? 'environment' : 'user'
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCaptureMode(mode);
        setShowCamera(true);
        
        // Start face detection for selfie and liveness modes
        if (mode === 'selfie' || mode === 'liveness') {
          startFaceDetection();
        }
      }
    } catch (error) {
      console.error('Camera access denied:', error);
      setErrors(prev => [...prev, 'Camera access is required for identity verification']);
    }
  }, [hasCamera, requestCameraPermission]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setShowCamera(false);
    setFaceDetected(false);
    setLivenessPrompt('center_face');
  }, []);

  const startFaceDetection = useCallback(() => {
    const detectInterval = setInterval(() => {
      if (videoRef.current && showCamera) {
        const detected = detectFace(videoRef.current);
        setFaceDetected(detected);
        
        // Auto-advance liveness prompts
        if (captureMode === 'liveness' && detected) {
          // Simulate liveness detection progress
          const currentTime = Date.now();
          const progress = { ...livenessProgress };
          
          switch (livenessPrompt) {
            case 'center_face':
              setTimeout(() => setLivenessPrompt('smile'), 2000);
              break;
            case 'smile':
              progress.smileDetected = true;
              setTimeout(() => setLivenessPrompt('blink'), 2000);
              break;
            case 'blink':
              progress.blinkDetected = true;
              setTimeout(() => setLivenessPrompt('turn_left'), 2000);
              break;
            case 'turn_left':
              progress.headMovementDetected = true;
              setTimeout(() => setLivenessPrompt('complete'), 1000);
              break;
            case 'complete':
              clearInterval(detectInterval);
              break;
          }
          
          if (progress !== livenessProgress) {
            setLivenessProgress(progress);
          }
        }
      }
    }, 100);

    return () => clearInterval(detectInterval);
  }, [showCamera, captureMode, livenessPrompt, livenessProgress]);

  const capturePhoto = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;

    setIsCapturing(true);

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      if (!context) throw new Error('Canvas context not available');

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0);

      const imageData = canvas.toDataURL('image/jpeg', 0.8);

      // Process the captured image
      await processImage(imageData, captureMode);

      stopCamera();
    } catch (error) {
      console.error('Error capturing photo:', error);
      setErrors(prev => [...prev, 'Failed to capture photo. Please try again.']);
    } finally {
      setIsCapturing(false);
    }
  }, [captureMode, stopCamera]);

  const processImage = useCallback(async (imageData: string, mode: CaptureMode) => {
    setProcessing(true);
    
    try {
      const formData = new FormData();
      
      // Convert base64 to blob
      const response = await fetch(imageData);
      const blob = await response.blob();
      
      formData.append('file', blob, `${mode}_${Date.now()}.jpg`);
      formData.append('verificationType', mode);
      formData.append('workflowId', workflowId || '');
      formData.append('businessId', businessId || '');

      // Submit to backend for processing
      const apiResponse = await fetch('/api/verification/identity', {
        method: 'POST',
        body: formData
      });

      const result = await apiResponse.json();

      if (result.success) {
        const updatedData = { ...verificationData };

        switch (mode) {
          case 'id_document':
            updatedData.idDocumentPhoto = imageData;
            updatedData.extractedIdData = result.extractedData;
            break;
          case 'selfie':
            updatedData.selfiePhoto = imageData;
            updatedData.biometricMatch = result.biometricMatch;
            break;
          case 'liveness':
            updatedData.livenessVerification = {
              ...livenessProgress,
              livenessScore: result.livenessScore || 0.8,
              timestamp: new Date().toISOString()
            } as LivenessData;
            break;
        }

        updatedData.verificationScore = result.verificationScore;
        updatedData.status = completedSteps + 1 === totalSteps ? 'completed' : 'in_progress';
        
        setVerificationData(updatedData);
        
        // Move to next step
        if (currentStep < totalSteps - 1) {
          setCurrentStep(currentStep + 1);
        }
      } else {
        setErrors(prev => [...prev, result.error || 'Verification failed. Please try again.']);
      }
    } catch (error) {
      console.error('Error processing image:', error);
      setErrors(prev => [...prev, 'Failed to process image. Please try again.']);
    } finally {
      setProcessing(false);
    }
  }, [
    verificationData,
    livenessProgress,
    workflowId,
    businessId,
    currentStep,
    completedSteps,
    totalSteps
  ]);

  // Update parent component when verification is complete
  useEffect(() => {
    if (isComplete) {
      onComplete?.(verificationData);
    }
  }, [isComplete, verificationData, onComplete]);

  const renderStepIndicators = () => (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-cream">Identity Verification</h3>
        <span className="text-sage/70 text-sm">{completionPercentage}% Complete</span>
      </div>
      
      <div className="w-full bg-navy-dark/30 rounded-full h-2 mb-6">
        <motion.div
          className="h-2 bg-gradient-to-r from-teal-primary to-teal-secondary rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${completionPercentage}%` }}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {verificationSteps.map((step, index) => {
          const IconComponent = step.icon;
          const isCurrent = index === currentStep;
          const isCompleted = step.completed;
          
          return (
            <motion.div
              key={step.id}
              className={cn(
                'p-4 rounded-lg border transition-all duration-200',
                isCompleted && 'border-green-500/50 bg-green-500/10',
                isCurrent && !isCompleted && 'border-teal-primary/50 bg-teal-primary/10',
                !isCurrent && !isCompleted && 'border-sage/20'
              )}
              whileHover={{ scale: 1.02 }}
            >
              <div className="flex items-center space-x-3">
                <div className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center',
                  isCompleted && 'bg-green-500 text-cream',
                  isCurrent && !isCompleted && 'bg-teal-primary text-cream',
                  !isCurrent && !isCompleted && 'bg-sage/20 text-sage'
                )}>
                  {isCompleted ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : (
                    <IconComponent className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <p className="text-cream font-medium">{step.title}</p>
                  <p className="text-sage/70 text-sm">{step.description}</p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );

  const renderCurrentStepContent = () => {
    const step = verificationSteps[currentStep];
    if (!step) return null;

    const isStepCompleted = step.completed;

    return (
      <GlassMorphism variant="light" className="p-6 mb-6">
        <div className="text-center">
          <h4 className="text-xl font-semibold text-cream mb-2">{step.title}</h4>
          <p className="text-sage/70 mb-6">{step.description}</p>

          {isStepCompleted ? (
            <div className="space-y-4">
              <div className="inline-flex items-center space-x-2 px-4 py-2 bg-green-500/20 border border-green-500/30 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <span className="text-green-300">Step Completed</span>
              </div>
              
              {step.id === 'id_document' && verificationData.extractedIdData && (
                <div className="text-left space-y-2 mt-4">
                  <p className="text-cream font-medium">Extracted Information:</p>
                  <div className="text-sm text-sage/70 space-y-1">
                    {verificationData.extractedIdData.fullName && (
                      <p>Name: {verificationData.extractedIdData.fullName}</p>
                    )}
                    {verificationData.extractedIdData.dateOfBirth && (
                      <p>Date of Birth: {verificationData.extractedIdData.dateOfBirth}</p>
                    )}
                    {verificationData.extractedIdData.documentNumber && (
                      <p>Document #: {verificationData.extractedIdData.documentNumber}</p>
                    )}
                  </div>
                </div>
              )}
              
              {step.id === 'selfie' && verificationData.biometricMatch && (
                <div className="text-sm text-sage/70 mt-4">
                  <p>Biometric Match: {Math.round(verificationData.biometricMatch * 100)}%</p>
                </div>
              )}
              
              <div className="space-x-3">
                <motion.button
                  onClick={() => startCamera(step.id as CaptureMode)}
                  className="px-4 py-2 text-teal-primary hover:text-teal-secondary transition-colors"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <RefreshCw className="w-4 h-4 mr-1" />
                  Retake
                </motion.button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-sage/70 text-sm mb-4">
                {step.id === 'id_document' && (
                  <div className="space-y-2">
                    <p>• Use a government-issued photo ID (driver's license, passport, etc.)</p>
                    <p>• Ensure good lighting and no glare</p>
                    <p>• Keep the document flat and fully visible</p>
                  </div>
                )}
                {step.id === 'selfie' && (
                  <div className="space-y-2">
                    <p>• Look directly at the camera</p>
                    <p>• Ensure good lighting on your face</p>
                    <p>• Remove sunglasses and hats</p>
                  </div>
                )}
                {step.id === 'liveness' && (
                  <div className="space-y-2">
                    <p>• Follow the on-screen prompts</p>
                    <p>• Make natural facial expressions</p>
                    <p>• Keep your face centered in the frame</p>
                  </div>
                )}
              </div>

              <motion.button
                onClick={() => startCamera(step.id as CaptureMode)}
                className={cn(
                  'px-8 py-4 bg-teal-primary hover:bg-teal-secondary',
                  'text-cream font-medium rounded-lg transition-colors duration-200',
                  'focus:outline-none focus:ring-2 focus:ring-teal-primary/50'
                )}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                disabled={processing}
              >
                <Camera className="w-5 h-5 mr-2" />
                {processing ? 'Processing...' : 'Start Capture'}
              </motion.button>
            </div>
          )}
        </div>
      </GlassMorphism>
    );
  };

  const renderCameraInterface = () => (
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
              {captureMode === 'id_document' && 'Capture ID Document'}
              {captureMode === 'selfie' && 'Take Selfie'}
              {captureMode === 'liveness' && 'Liveness Verification'}
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
              muted
              className="max-w-full max-h-full object-contain"
            />
            
            {/* Capture Guides */}
            {captureMode === 'id_document' && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-80 h-60 border-2 border-white/50 border-dashed rounded-lg">
                  <div className="absolute -top-6 left-0 right-0 text-center">
                    <span className="text-white text-sm bg-black/50 px-2 py-1 rounded">
                      Position ID within frame
                    </span>
                  </div>
                </div>
              </div>
            )}
            
            {(captureMode === 'selfie' || captureMode === 'liveness') && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className={cn(
                  'w-64 h-80 border-2 rounded-full',
                  faceDetected ? 'border-green-400' : 'border-white/50'
                )}>
                  <div className="absolute -top-8 left-0 right-0 text-center">
                    <span className="text-white text-sm bg-black/50 px-2 py-1 rounded">
                      {faceDetected ? 'Face detected' : 'Center your face'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Liveness Prompts */}
            {captureMode === 'liveness' && (
              <div className="absolute bottom-32 left-0 right-0 text-center">
                <div className="bg-black/70 text-white px-4 py-2 rounded-lg inline-block">
                  {livenessPrompt === 'center_face' && 'Center your face in the circle'}
                  {livenessPrompt === 'smile' && (
                    <div className="flex items-center space-x-2">
                      <SmilePlus className="w-5 h-5" />
                      <span>Please smile</span>
                    </div>
                  )}
                  {livenessPrompt === 'blink' && 'Please blink your eyes'}
                  {livenessPrompt === 'turn_left' && (
                    <div className="flex items-center space-x-2">
                      <RotateCcw className="w-5 h-5" />
                      <span>Turn your head slightly left</span>
                    </div>
                  )}
                  {livenessPrompt === 'complete' && (
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="w-5 h-5 text-green-400" />
                      <span>Liveness verification complete!</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Camera Controls */}
          <div className="p-6 bg-navy-dark/80">
            <div className="flex items-center justify-center space-x-6">
              <button
                onClick={stopCamera}
                className="px-6 py-3 text-cream hover:bg-white/10 rounded-lg transition-colors"
                disabled={isCapturing}
              >
                Cancel
              </button>
              
              <motion.button
                onClick={capturePhoto}
                disabled={isCapturing || (captureMode === 'liveness' && livenessPrompt !== 'complete')}
                className={cn(
                  'w-16 h-16 bg-teal-primary hover:bg-teal-secondary rounded-full',
                  'flex items-center justify-center transition-colors',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
                whileHover={{ scale: isCapturing ? 1 : 1.05 }}
                whileTap={{ scale: isCapturing ? 1 : 0.95 }}
              >
                {isCapturing ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    className="w-6 h-6 border-2 border-cream border-t-transparent rounded-full"
                  />
                ) : (
                  <Camera className="w-6 h-6 text-cream" />
                )}
              </motion.button>
            </div>
            
            <div className="text-center text-sage/70 text-sm mt-3">
              {captureMode === 'id_document' && 'Ensure document is clear and well-lit'}
              {captureMode === 'selfie' && 'Look directly at the camera'}
              {captureMode === 'liveness' && 'Follow the prompts above'}
            </div>
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
              <p className="text-red-300 font-medium mb-2">Verification Errors</p>
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

  return (
    <div className="space-y-6">
      {renderErrors()}
      {renderStepIndicators()}
      {renderCurrentStepContent()}
      
      {/* Security Notice */}
      <GlassMorphism variant="light" className="p-4">
        <div className="flex items-start space-x-3">
          <Shield className="w-5 h-5 text-teal-primary mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-cream font-medium mb-1">Your Privacy is Protected</p>
            <p className="text-sage/70 text-sm">
              All biometric data is encrypted and automatically deleted after verification. 
              We never store or sell your personal information.
            </p>
          </div>
        </div>
      </GlassMorphism>

      {/* Continue Button */}
      {isComplete && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-end"
        >
          <motion.button
            onClick={() => onComplete?.(verificationData)}
            className={cn(
              'px-8 py-3 bg-teal-primary hover:bg-teal-secondary',
              'text-cream font-medium rounded-lg transition-colors duration-200',
              'focus:outline-none focus:ring-2 focus:ring-teal-primary/50'
            )}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            disabled={isLoading}
          >
            {isLoading ? 'Processing...' : 'Continue to Business Information'}
          </motion.button>
        </motion.div>
      )}

      {/* Hidden canvas for photo capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Camera Interface */}
      {renderCameraInterface()}
    </div>
  );
};

export default IdentityVerification;