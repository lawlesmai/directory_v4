'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Camera,
  Upload,
  X,
  Check,
  AlertCircle,
  Crop,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Download,
  Link as LinkIcon,
  User,
  RefreshCw,
  Trash2
} from 'lucide-react';

import { GlassMorphism } from '@/components/GlassMorphism';
import { cn } from '@/lib/utils';

// Types
interface AvatarUploadProps {
  currentAvatar?: string;
  onUpload: (file: File, croppedImageData: string) => Promise<void>;
  onRemove?: () => Promise<void>;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
}

interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
  rotation: number;
}

interface ImagePreview {
  file: File;
  url: string;
  naturalWidth: number;
  naturalHeight: number;
}

// Constants
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ASPECT_RATIO = 1; // Square aspect ratio for avatars

// Utility functions
const createImageFromFile = (file: File): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
};

const cropImageToCanvas = (
  image: HTMLImageElement,
  cropArea: CropArea,
  outputSize: number = 300
): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  
  canvas.width = outputSize;
  canvas.height = outputSize;
  
  // Calculate the crop dimensions
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  
  const sourceX = cropArea.x * scaleX;
  const sourceY = cropArea.y * scaleY;
  const sourceWidth = cropArea.width * scaleX;
  const sourceHeight = cropArea.height * scaleY;
  
  // Draw the cropped image
  ctx.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    outputSize,
    outputSize
  );
  
  return canvas;
};

const compressImage = (canvas: HTMLCanvasElement, quality: number = 0.8): string => {
  return canvas.toDataURL('image/jpeg', quality);
};

// File validation
const validateFile = (file: File): string | null => {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return 'Please upload a JPG, PNG, or WebP image';
  }
  
  if (file.size > MAX_FILE_SIZE) {
    return 'File size must be less than 5MB';
  }
  
  return null;
};

// Drag and drop hook
const useDragAndDrop = (onFileDrop: (files: FileList) => void) => {
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);
  
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }, []);
  
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current <= 0) {
      setIsDragging(false);
      dragCounter.current = 0;
    }
  }, []);
  
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);
  
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    dragCounter.current = 0;
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFileDrop(e.dataTransfer.files);
    }
  }, [onFileDrop]);
  
  return {
    isDragging,
    dragHandlers: {
      onDragEnter: handleDragEnter,
      onDragLeave: handleDragLeave,
      onDragOver: handleDragOver,
      onDrop: handleDrop,
    },
  };
};

// URL upload component
const URLUploadDialog: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onUpload: (url: string) => void;
}> = ({ isOpen, onClose, onUpload }) => {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Validate URL format
      new URL(url);
      
      // Check if it's an image URL (basic check)
      if (!/\.(jpg|jpeg|png|webp|gif)(\?.*)?$/i.test(url)) {
        throw new Error('URL must point to an image file');
      }
      
      onUpload(url);
      setUrl('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid URL');
    } finally {
      setIsLoading(false);
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-navy-dark/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="w-full max-w-md"
      >
        <GlassMorphism variant="medium" className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-heading text-cream">Upload from URL</h3>
            <button
              onClick={onClose}
              className="p-1 text-sage/70 hover:text-cream transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-cream mb-2">
                Image URL
              </label>
              <div className="relative">
                <LinkIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-sage/50" />
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com/image.jpg"
                  className="w-full pl-12 pr-4 py-3 bg-navy-50/20 border border-sage/20 rounded-lg text-cream placeholder:text-sage/40 focus:outline-none focus:ring-2 focus:ring-teal-primary/50"
                  disabled={isLoading}
                />
              </div>
              {error && (
                <p className="text-red-error text-sm mt-1 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </p>
              )}
            </div>
            
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                className="flex-1 px-4 py-2 text-sage/70 hover:text-cream transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!url.trim() || isLoading}
                className="flex-1 px-4 py-2 bg-teal-primary hover:bg-teal-secondary text-cream rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  'Upload'
                )}
              </button>
            </div>
          </form>
        </GlassMorphism>
      </motion.div>
    </div>
  );
};

// Image cropper component
const ImageCropper: React.FC<{
  preview: ImagePreview;
  onCropComplete: (croppedData: string) => void;
  onCancel: () => void;
}> = ({ preview, onCropComplete, onCancel }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [cropArea, setCropArea] = useState<CropArea>({
    x: 0,
    y: 0,
    width: 200,
    height: 200,
    scale: 1,
    rotation: 0,
  });
  
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  // Initialize crop area when image loads
  useEffect(() => {
    if (imageRef.current) {
      const img = imageRef.current;
      const containerSize = Math.min(img.clientWidth, img.clientHeight);
      const size = Math.min(containerSize * 0.8, 300);
      
      setCropArea({
        x: (img.clientWidth - size) / 2,
        y: (img.clientHeight - size) / 2,
        width: size,
        height: size,
        scale: 1,
        rotation: 0,
      });
    }
  }, [preview]);
  
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - cropArea.x, y: e.clientY - cropArea.y });
  };
  
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !imageRef.current) return;
    
    const rect = imageRef.current.getBoundingClientRect();
    const newX = Math.max(0, Math.min(e.clientX - dragStart.x, rect.width - cropArea.width));
    const newY = Math.max(0, Math.min(e.clientY - dragStart.y, rect.height - cropArea.height));
    
    setCropArea(prev => ({ ...prev, x: newX, y: newY }));
  };
  
  const handleMouseUp = () => {
    setIsDragging(false);
  };
  
  const handleScaleChange = (scale: number) => {
    setCropArea(prev => ({ ...prev, scale }));
  };
  
  const handleCropConfirm = async () => {
    if (!imageRef.current) return;
    
    try {
      const canvas = cropImageToCanvas(imageRef.current, cropArea);
      const croppedData = compressImage(canvas);
      onCropComplete(croppedData);
    } catch (error) {
      console.error('Cropping failed:', error);
    }
  };
  
  return (
    <div className="fixed inset-0 bg-navy-dark/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-4xl"
      >
        <GlassMorphism variant="medium" className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-heading text-cream">Crop Your Photo</h3>
            <button
              onClick={onCancel}
              className="p-2 text-sage/70 hover:text-cream transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          {/* Cropping area */}
          <div className="relative bg-navy-dark/50 rounded-lg overflow-hidden mb-6">
            <img
              ref={imageRef}
              src={preview.url}
              alt="Preview"
              className="w-full h-96 object-contain"
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            />
            
            {/* Crop overlay */}
            <div
              className="absolute border-2 border-teal-primary bg-teal-primary/10 cursor-move"
              style={{
                left: cropArea.x,
                top: cropArea.y,
                width: cropArea.width,
                height: cropArea.height,
              }}
              onMouseDown={handleMouseDown}
            >
              <div className="absolute inset-0 border border-cream/50" />
              {/* Corner handles */}
              <div className="absolute -top-1 -left-1 w-3 h-3 bg-teal-primary border border-cream" />
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-teal-primary border border-cream" />
              <div className="absolute -bottom-1 -left-1 w-3 h-3 bg-teal-primary border border-cream" />
              <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-teal-primary border border-cream" />
            </div>
          </div>
          
          {/* Controls */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <ZoomOut className="w-4 h-4 text-sage/70" />
                <input
                  type="range"
                  min="0.5"
                  max="3"
                  step="0.1"
                  value={cropArea.scale}
                  onChange={(e) => handleScaleChange(parseFloat(e.target.value))}
                  className="w-24"
                />
                <ZoomIn className="w-4 h-4 text-sage/70" />
                <span className="text-sm text-sage/70 min-w-[3rem]">
                  {Math.round(cropArea.scale * 100)}%
                </span>
              </div>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={onCancel}
                className="px-4 py-2 text-sage/70 hover:text-cream transition-colors"
              >
                Cancel
              </button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleCropConfirm}
                className="flex items-center gap-2 px-6 py-2 bg-teal-primary hover:bg-teal-secondary text-cream rounded-lg transition-colors"
              >
                <Crop className="w-4 h-4" />
                Apply Crop
              </motion.button>
            </div>
          </div>
        </GlassMorphism>
      </motion.div>
    </div>
  );
};

// Main AvatarUpload component
export const AvatarUpload: React.FC<AvatarUploadProps> = ({
  currentAvatar,
  onUpload,
  onRemove,
  className,
  size = 'lg',
  disabled = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<ImagePreview | null>(null);
  const [showCropper, setShowCropper] = useState(false);
  const [showUrlDialog, setShowUrlDialog] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const sizeClasses = {
    sm: 'w-16 h-16',
    md: 'w-24 h-24',
    lg: 'w-32 h-32',
  };
  
  const handleFileSelection = useCallback(async (files: FileList) => {
    const file = files[0];
    if (!file) return;
    
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    
    setError(null);
    
    try {
      const img = await createImageFromFile(file);
      const previewData: ImagePreview = {
        file,
        url: URL.createObjectURL(file),
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
      };
      
      setPreview(previewData);
      setShowCropper(true);
    } catch (err) {
      setError('Failed to load image');
    }
  }, []);
  
  const handleUrlUpload = useCallback(async (url: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const file = new File([blob], 'avatar.jpg', { type: blob.type });
      
      const files = new DataTransfer();
      files.items.add(file);
      handleFileSelection(files.files);
    } catch (err) {
      setError('Failed to load image from URL');
    }
  }, [handleFileSelection]);
  
  const handleCropComplete = useCallback(async (croppedData: string) => {
    if (!preview) return;
    
    setIsUploading(true);
    setShowCropper(false);
    
    try {
      await onUpload(preview.file, croppedData);
      setPreview(null);
    } catch (err) {
      setError('Upload failed. Please try again.');
    } finally {
      setIsUploading(false);
    }
  }, [preview, onUpload]);
  
  const handleRemove = useCallback(async () => {
    if (!onRemove || !currentAvatar) return;
    
    setIsUploading(true);
    try {
      await onRemove();
    } catch (err) {
      setError('Failed to remove avatar');
    } finally {
      setIsUploading(false);
    }
  }, [onRemove, currentAvatar]);
  
  const { isDragging, dragHandlers } = useDragAndDrop(handleFileSelection);
  
  // Cleanup preview URL on unmount
  useEffect(() => {
    return () => {
      if (preview?.url) {
        URL.revokeObjectURL(preview.url);
      }
    };
  }, [preview?.url]);
  
  return (
    <>
      <div className={cn('space-y-4', className)}>
        {/* Current Avatar Display */}
        <div className="flex items-center gap-6">
          <div className={cn('relative rounded-full overflow-hidden bg-navy-50/20 border-2 border-sage/20', sizeClasses[size])}>
            {currentAvatar ? (
              <img
                src={currentAvatar}
                alt="Profile"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <User className={cn('text-sage/50', {
                  'w-6 h-6': size === 'sm',
                  'w-8 h-8': size === 'md',
                  'w-12 h-12': size === 'lg',
                })} />
              </div>
            )}
            
            {isUploading && (
              <div className="absolute inset-0 bg-navy-dark/80 flex items-center justify-center">
                <RefreshCw className="w-6 h-6 text-cream animate-spin" />
              </div>
            )}
          </div>
          
          <div className="flex-1">
            <h3 className="text-lg font-medium text-cream mb-1">Profile Photo</h3>
            <p className="text-sm text-sage/70 mb-3">
              Upload a photo to personalize your profile
            </p>
            
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 text-sm text-red-error mb-3"
              >
                <AlertCircle className="w-4 h-4" />
                {error}
              </motion.div>
            )}
            
            {/* Upload Actions */}
            <div className="flex flex-wrap gap-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled || isUploading}
                className="flex items-center gap-2 px-4 py-2 bg-teal-primary hover:bg-teal-secondary text-cream rounded-lg transition-colors disabled:opacity-50"
              >
                <Upload className="w-4 h-4" />
                Choose File
              </motion.button>
              
              <button
                onClick={() => setShowUrlDialog(true)}
                disabled={disabled || isUploading}
                className="flex items-center gap-2 px-4 py-2 text-sage/70 hover:text-cream transition-colors disabled:opacity-50"
              >
                <LinkIcon className="w-4 h-4" />
                From URL
              </button>
              
              {currentAvatar && onRemove && (
                <button
                  onClick={handleRemove}
                  disabled={disabled || isUploading}
                  className="flex items-center gap-2 px-4 py-2 text-red-error hover:bg-red-error/10 transition-colors disabled:opacity-50 rounded-lg"
                >
                  <Trash2 className="w-4 h-4" />
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>
        
        {/* Drag and Drop Area */}
        <motion.div
          animate={{ 
            borderColor: isDragging ? 'rgb(0, 95, 115)' : 'rgba(148, 210, 189, 0.2)',
            backgroundColor: isDragging ? 'rgba(0, 95, 115, 0.1)' : 'rgba(148, 210, 189, 0.05)'
          }}
          {...dragHandlers}
          className={cn(
            'border-2 border-dashed rounded-lg p-8 text-center transition-colors',
            disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
          )}
          onClick={() => !disabled && fileInputRef.current?.click()}
        >
          <Camera className="w-12 h-12 text-sage/50 mx-auto mb-4" />
          <p className="text-lg font-medium text-cream mb-2">
            {isDragging ? 'Drop your photo here' : 'Drag & drop your photo here'}
          </p>
          <p className="text-sm text-sage/70">
            or click to browse • JPG, PNG, WebP • Max 5MB
          </p>
        </motion.div>
        
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(',')}
          onChange={(e) => e.target.files && handleFileSelection(e.target.files)}
          className="hidden"
          disabled={disabled}
        />
      </div>
      
      {/* URL Upload Dialog */}
      <AnimatePresence>
        {showUrlDialog && (
          <URLUploadDialog
            isOpen={showUrlDialog}
            onClose={() => setShowUrlDialog(false)}
            onUpload={handleUrlUpload}
          />
        )}
      </AnimatePresence>
      
      {/* Image Cropper */}
      <AnimatePresence>
        {showCropper && preview && (
          <ImageCropper
            preview={preview}
            onCropComplete={handleCropComplete}
            onCancel={() => {
              setShowCropper(false);
              setPreview(null);
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
};