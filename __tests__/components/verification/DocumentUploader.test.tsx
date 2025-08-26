import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DocumentUploader } from '@/components/verification/DocumentUploader';

// Mock the hooks
jest.mock('@/hooks/useIsMobile', () => ({
  useIsMobile: () => false
}));

jest.mock('@/hooks/useMediaDevices', () => ({
  useMediaDevices: () => ({
    hasCamera: true,
    requestCameraPermission: jest.fn().mockResolvedValue(true)
  })
}));

// Mock file size formatting utility
jest.mock('@/lib/auth/business-verification', () => ({
  formatFileSize: (bytes: number) => `${Math.round(bytes / 1024)} KB`
}));

// Mock fetch for API calls
global.fetch = jest.fn();

describe('DocumentUploader', () => {
  const mockOnComplete = jest.fn();
  const mockOnError = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, documentId: 'test-doc-id' })
    });
    
    // Mock URL.createObjectURL
    global.URL.createObjectURL = jest.fn(() => 'blob:test-url');
    global.URL.revokeObjectURL = jest.fn();
  });

  describe('Initial Render', () => {
    it('renders document type selector', () => {
      render(<DocumentUploader onComplete={mockOnComplete} onError={mockOnError} />);
      
      expect(screen.getByText('Required Documents')).toBeInTheDocument();
      expect(screen.getByText('Business License')).toBeInTheDocument();
      expect(screen.getByText('Tax ID Document')).toBeInTheDocument();
    });

    it('shows upload progress initially at 0%', () => {
      render(<DocumentUploader onComplete={mockOnComplete} onError={mockOnError} />);
      
      expect(screen.getByText('0% Complete')).toBeInTheDocument();
    });

    it('displays max file size information', () => {
      render(<DocumentUploader onComplete={mockOnComplete} onError={mockOnError} />);
      
      expect(screen.getByText(/Max size: 10 MB/)).toBeInTheDocument();
    });
  });

  describe('Document Type Selection', () => {
    it('allows selecting document types', async () => {
      const user = userEvent.setup();
      render(<DocumentUploader onComplete={mockOnComplete} onError={mockOnError} />);
      
      const taxIdButton = screen.getByText('Tax ID Document');
      await user.click(taxIdButton);

      expect(taxIdButton).toHaveClass('border-teal-primary');
    });

    it('shows required badge for mandatory documents', () => {
      render(<DocumentUploader onComplete={mockOnComplete} onError={mockOnError} />);
      
      const requiredBadges = screen.getAllByText('Required');
      expect(requiredBadges.length).toBeGreaterThan(0);
    });

    it('displays document descriptions and accepted formats', () => {
      render(<DocumentUploader onComplete={mockOnComplete} onError={mockOnError} />);
      
      expect(screen.getByText('Valid business license or permit to operate')).toBeInTheDocument();
      expect(screen.getByText('Accepts: PDF, JPG, PNG')).toBeInTheDocument();
    });
  });

  describe('File Upload - Drag and Drop', () => {
    it('handles drag over events', async () => {
      render(<DocumentUploader onComplete={mockOnComplete} onError={mockOnError} />);
      
      const dropzone = screen.getByText('Drag and drop your document here').parentElement!;
      
      fireEvent.dragOver(dropzone, {
        dataTransfer: {
          files: [new File(['test'], 'test.pdf', { type: 'application/pdf' })]
        }
      });

      expect(dropzone).toHaveClass('border-teal-primary');
    });

    it('handles file drop', async () => {
      render(<DocumentUploader onComplete={mockOnComplete} onError={mockOnError} />);
      
      const dropzone = screen.getByText('Drag and drop your document here').parentElement!;
      const file = new File(['test content'], 'business-license.pdf', { type: 'application/pdf' });
      
      await act(async () => {
        fireEvent.drop(dropzone, {
          dataTransfer: { files: [file] }
        });
      });

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/onboarding/business-verification', {
          method: 'POST',
          body: expect.any(FormData)
        });
      });
    });

    it('rejects files that are too large', async () => {
      render(<DocumentUploader onComplete={mockOnComplete} onError={mockOnError} />);
      
      const dropzone = screen.getByText('Drag and drop your document here').parentElement!;
      const largeFile = new File(['x'.repeat(11 * 1024 * 1024)], 'large.pdf', { 
        type: 'application/pdf' 
      });
      
      await act(async () => {
        fireEvent.drop(dropzone, {
          dataTransfer: { files: [largeFile] }
        });
      });

      await waitFor(() => {
        expect(screen.getByText(/file size must be less than/i)).toBeInTheDocument();
      });
    });

    it('rejects unsupported file types', async () => {
      render(<DocumentUploader onComplete={mockOnComplete} onError={mockOnError} />);
      
      const dropzone = screen.getByText('Drag and drop your document here').parentElement!;
      const invalidFile = new File(['test'], 'test.exe', { type: 'application/exe' });
      
      await act(async () => {
        fireEvent.drop(dropzone, {
          dataTransfer: { files: [invalidFile] }
        });
      });

      await waitFor(() => {
        expect(screen.getByText(/file type not supported/i)).toBeInTheDocument();
      });
    });
  });

  describe('File Upload - Browse Files', () => {
    it('opens file browser when browse button is clicked', async () => {
      const user = userEvent.setup();
      render(<DocumentUploader onComplete={mockOnComplete} onError={mockOnError} />);
      
      // Mock input click
      const mockClick = jest.fn();
      const mockInput = { click: mockClick } as any;
      jest.spyOn(document, 'createElement').mockReturnValue(mockInput);
      
      const browseButton = screen.getByText('Browse Files');
      await user.click(browseButton);

      expect(mockClick).toHaveBeenCalled();
    });
  });

  describe('Mobile Camera Integration', () => {
    beforeEach(() => {
      jest.mocked(require('@/hooks/useIsMobile').useIsMobile).mockReturnValue(true);
    });

    it('shows camera button on mobile devices', () => {
      render(<DocumentUploader onComplete={mockOnComplete} onError={mockOnError} />);
      
      expect(screen.getByText('Take Photo')).toBeInTheDocument();
    });

    it('opens camera interface when camera button is clicked', async () => {
      const user = userEvent.setup();
      
      // Mock getUserMedia
      const mockStream = {
        getTracks: () => [{ stop: jest.fn() }]
      };
      Object.defineProperty(navigator, 'mediaDevices', {
        value: {
          getUserMedia: jest.fn().mockResolvedValue(mockStream)
        },
        configurable: true
      });

      render(<DocumentUploader onComplete={mockOnComplete} onError={mockOnError} />);
      
      const cameraButton = screen.getByText('Take Photo');
      await user.click(cameraButton);

      await waitFor(() => {
        expect(screen.getByText('Capture')).toBeInTheDocument();
      });
    });

    it('handles camera permission denial', async () => {
      const user = userEvent.setup();
      
      // Mock getUserMedia rejection
      Object.defineProperty(navigator, 'mediaDevices', {
        value: {
          getUserMedia: jest.fn().mockRejectedValue(new Error('Permission denied'))
        },
        configurable: true
      });

      render(<DocumentUploader onComplete={mockOnError} onError={mockOnError} />);
      
      const cameraButton = screen.getByText('Take Photo');
      await user.click(cameraButton);

      await waitFor(() => {
        expect(mockOnError).toHaveBeenCalledWith(['Camera access is required for photo capture.']);
      });
    });
  });

  describe('Document Management', () => {
    it('displays uploaded documents with status', async () => {
      const stepData = {
        documents: [
          {
            id: '1',
            type: 'business_license' as const,
            fileName: 'license.pdf',
            fileSize: 1024 * 500,
            uploadedAt: new Date().toISOString(),
            status: 'verified' as const
          }
        ],
        requiredDocumentsMet: {},
        completionPercentage: 25
      };

      render(<DocumentUploader stepData={stepData} onComplete={mockOnComplete} onError={mockOnError} />);
      
      expect(screen.getByText('license.pdf')).toBeInTheDocument();
      expect(screen.getByText('500 KB')).toBeInTheDocument();
      expect(screen.getByText('Business License')).toBeInTheDocument();
    });

    it('allows removing uploaded documents', async () => {
      const user = userEvent.setup();
      const stepData = {
        documents: [
          {
            id: '1',
            type: 'business_license' as const,
            fileName: 'license.pdf',
            fileSize: 1024 * 500,
            uploadedAt: new Date().toISOString(),
            status: 'verified' as const
          }
        ],
        requiredDocumentsMet: {},
        completionPercentage: 25
      };

      render(<DocumentUploader stepData={stepData} onComplete={mockOnComplete} onError={mockOnError} />);
      
      const removeButton = screen.getByRole('button', { name: /remove document/i });
      await user.click(removeButton);

      expect(screen.queryByText('license.pdf')).not.toBeInTheDocument();
    });

    it('shows retry option for rejected documents', async () => {
      const user = userEvent.setup();
      const stepData = {
        documents: [
          {
            id: '1',
            type: 'business_license' as const,
            fileName: 'license.pdf',
            fileSize: 1024 * 500,
            uploadedAt: new Date().toISOString(),
            status: 'rejected' as const,
            rejectionReason: 'Document quality insufficient'
          }
        ],
        requiredDocumentsMet: {},
        completionPercentage: 0
      };

      render(<DocumentUploader stepData={stepData} onComplete={mockOnComplete} onError={mockOnError} />);
      
      expect(screen.getByText('Document quality insufficient')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /retry upload/i })).toBeInTheDocument();
    });
  });

  describe('Progress Tracking', () => {
    it('updates completion percentage as documents are uploaded', () => {
      const stepData = {
        documents: [
          {
            id: '1',
            type: 'business_license' as const,
            fileName: 'license.pdf',
            fileSize: 1024,
            uploadedAt: new Date().toISOString(),
            status: 'verified' as const
          }
        ],
        requiredDocumentsMet: { business_license: true },
        completionPercentage: 33
      };

      render(<DocumentUploader stepData={stepData} onComplete={mockOnComplete} onError={mockOnError} />);
      
      expect(screen.getByText('33% Complete')).toBeInTheDocument();
    });

    it('shows verification status counts', () => {
      const stepData = {
        documents: [
          {
            id: '1',
            type: 'business_license' as const,
            fileName: 'license.pdf',
            fileSize: 1024,
            uploadedAt: new Date().toISOString(),
            status: 'verified' as const
          },
          {
            id: '2',
            type: 'tax_id' as const,
            fileName: 'tax.pdf',
            fileSize: 1024,
            uploadedAt: new Date().toISOString(),
            status: 'processing' as const
          }
        ],
        requiredDocumentsMet: {},
        completionPercentage: 50
      };

      render(<DocumentUploader stepData={stepData} onComplete={mockOnComplete} onError={mockOnError} />);
      
      expect(screen.getByText('1 verified')).toBeInTheDocument();
      expect(screen.getByText('1 processing')).toBeInTheDocument();
    });

    it('enables continue button when all required documents are uploaded', () => {
      const stepData = {
        documents: [
          {
            id: '1',
            type: 'business_license' as const,
            fileName: 'license.pdf',
            fileSize: 1024,
            uploadedAt: new Date().toISOString(),
            status: 'verified' as const
          },
          {
            id: '2',
            type: 'tax_id' as const,
            fileName: 'tax.pdf',
            fileSize: 1024,
            uploadedAt: new Date().toISOString(),
            status: 'verified' as const
          },
          {
            id: '3',
            type: 'registration_certificate' as const,
            fileName: 'reg.pdf',
            fileSize: 1024,
            uploadedAt: new Date().toISOString(),
            status: 'verified' as const
          }
        ],
        requiredDocumentsMet: { 
          business_license: true,
          tax_id: true,
          registration_certificate: true
        },
        completionPercentage: 100
      };

      render(<DocumentUploader stepData={stepData} onComplete={mockOnComplete} onError={mockOnError} />);
      
      expect(screen.getByText('Continue to Identity Verification')).toBeInTheDocument();
    });
  });

  describe('API Integration', () => {
    it('sends correct form data to upload endpoint', async () => {
      render(<DocumentUploader workflowId="test-workflow" businessId="test-business" onComplete={mockOnComplete} onError={mockOnError} />);
      
      const dropzone = screen.getByText('Drag and drop your document here').parentElement!;
      const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
      
      await act(async () => {
        fireEvent.drop(dropzone, {
          dataTransfer: { files: [file] }
        });
      });

      await waitFor(() => {
        const [url, options] = (fetch as jest.Mock).mock.calls[0];
        expect(url).toBe('/api/onboarding/business-verification');
        expect(options.method).toBe('POST');
        
        const formData = options.body as FormData;
        expect(formData.get('workflowId')).toBe('test-workflow');
        expect(formData.get('businessId')).toBe('test-business');
        expect(formData.get('documentType')).toBe('business_license');
      });
    });

    it('handles upload errors gracefully', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ success: false, error: 'Upload failed' })
      });

      render(<DocumentUploader onComplete={mockOnComplete} onError={mockOnError} />);
      
      const dropzone = screen.getByText('Drag and drop your document here').parentElement!;
      const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
      
      await act(async () => {
        fireEvent.drop(dropzone, {
          dataTransfer: { files: [file] }
        });
      });

      await waitFor(() => {
        expect(screen.getByText('Upload failed')).toBeInTheDocument();
      });
    });

    it('handles network errors', async () => {
      (fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      render(<DocumentUploader onComplete={mockOnComplete} onError={mockOnError} />);
      
      const dropzone = screen.getByText('Drag and drop your document here').parentElement!;
      const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
      
      await act(async () => {
        fireEvent.drop(dropzone, {
          dataTransfer: { files: [file] }
        });
      });

      await waitFor(() => {
        expect(screen.getByText('Network error. Please try again.')).toBeInTheDocument();
      });
    });
  });

  describe('Loading States', () => {
    it('shows uploading state during file upload', async () => {
      // Mock a slow response
      (fetch as jest.Mock).mockReturnValue(
        new Promise(resolve => setTimeout(() => resolve({
          ok: true,
          json: async () => ({ success: true, documentId: 'test-id' })
        }), 1000))
      );

      render(<DocumentUploader onComplete={mockOnComplete} onError={mockOnError} />);
      
      const dropzone = screen.getByText('Drag and drop your document here').parentElement!;
      const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
      
      await act(async () => {
        fireEvent.drop(dropzone, {
          dataTransfer: { files: [file] }
        });
      });

      // Should show loading state
      expect(screen.getByText('test.pdf')).toBeInTheDocument();
      // Loading spinner should be visible
    });

    it('disables continue button while uploading', async () => {
      render(<DocumentUploader isLoading={true} onComplete={mockOnComplete} onError={mockOnError} />);
      
      const continueButton = screen.queryByText('Continue to Identity Verification');
      expect(continueButton).toBeInTheDocument();
      expect(continueButton).toBeDisabled();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels', () => {
      render(<DocumentUploader onComplete={mockOnComplete} onError={mockOnError} />);
      
      const dropzone = screen.getByText('Drag and drop your document here').closest('div');
      expect(dropzone).toHaveAttribute('role', 'button');
    });

    it('supports keyboard navigation for document type selection', async () => {
      const user = userEvent.setup();
      render(<DocumentUploader onComplete={mockOnComplete} onError={mockOnError} />);
      
      await user.tab();
      
      const firstDocumentType = screen.getByText('Business License').closest('button');
      expect(firstDocumentType).toHaveFocus();
    });

    it('provides screen reader friendly status updates', () => {
      render(<DocumentUploader onComplete={mockOnComplete} onError={mockOnError} />);
      
      expect(screen.getByText('Upload Progress')).toBeInTheDocument();
      expect(screen.getByText('0% Complete')).toBeInTheDocument();
    });
  });
});