import { NextRequest } from 'next/server';

interface FileUploadOptions {
  maxSize?: number; // Max file size in bytes
  allowedTypes?: string[]; // Allowed MIME types
  sanitizeFilename?: boolean;
}

interface UploadResult {
  success: boolean;
  filename?: string;
  path?: string;
  size?: number;
  type?: string;
  message?: string;
}

interface StorageProvider {
  upload(file: File, path: string): Promise<UploadResult>;
  delete(path: string): Promise<boolean>;
  getUrl(path: string): string;
}

class LocalStorageProvider implements StorageProvider {
  private basePath: string;
  private baseUrl: string;

  constructor(basePath = './public/uploads', baseUrl = '/uploads') {
    this.basePath = basePath;
    this.baseUrl = baseUrl;
  }

  async upload(file: File, path: string): Promise<UploadResult> {
    try {
      // In a real implementation, you would:
      // 1. Create directory if it doesn't exist
      // 2. Write file to disk
      // 3. Return file information

      return {
        success: true,
        filename: file.name,
        path: `${this.basePath}/${path}`,
        size: file.size,
        type: file.type,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to upload file to local storage',
      };
    }
  }

  async delete(path: string): Promise<boolean> {
    try {
      // In a real implementation, delete the file from disk
      return true;
    } catch {
      return false;
    }
  }

  getUrl(path: string): string {
    return `${this.baseUrl}/${path}`;
  }
}

class FileUploadService {
  private provider: StorageProvider;
  private options: Required<FileUploadOptions>;

  constructor(
    provider: StorageProvider = new LocalStorageProvider(),
    options: FileUploadOptions = {}
  ) {
    this.provider = provider;
    this.options = {
      maxSize: 10 * 1024 * 1024, // 10MB default
      allowedTypes: [
        'image/jpeg',
        'image/png',
        'image/webp',
        'application/pdf',
        'text/plain',
      ],
      sanitizeFilename: true,
      ...options,
    };
  }

  sanitizeFilename(filename: string): string {
    if (!this.options.sanitizeFilename) return filename;
    
    return filename
      .replace(/[^a-zA-Z0-9.-]/g, '_') // Replace special chars with underscore
      .replace(/_{2,}/g, '_') // Replace multiple underscores with single
      .toLowerCase();
  }

  validateFile(file: File): { valid: boolean; message?: string } {
    // Check file size
    if (file.size > this.options.maxSize) {
      return {
        valid: false,
        message: `File size exceeds maximum allowed size of ${this.options.maxSize} bytes`,
      };
    }

    // Check file type
    if (!this.options.allowedTypes.includes(file.type)) {
      return {
        valid: false,
        message: `File type ${file.type} is not allowed`,
      };
    }

    return { valid: true };
  }

  async uploadFile(file: File, directory = ''): Promise<UploadResult> {
    // Validate file
    const validation = this.validateFile(file);
    if (!validation.valid) {
      return {
        success: false,
        message: validation.message,
      };
    }

    // Sanitize filename
    const sanitizedName = this.sanitizeFilename(file.name);
    const timestamp = Date.now();
    const filename = `${timestamp}-${sanitizedName}`;
    const path = directory ? `${directory}/${filename}` : filename;

    // Upload using provider
    return this.provider.upload(file, path);
  }

  async deleteFile(path: string): Promise<boolean> {
    return this.provider.delete(path);
  }

  getFileUrl(path: string): string {
    return this.provider.getUrl(path);
  }
}

// Parse multipart/form-data from request
export async function parseMultipartForm(req: NextRequest): Promise<{
  fields: Record<string, string>;
  files: Record<string, File>;
}> {
  const formData = await req.formData();
  const fields: Record<string, string> = {};
  const files: Record<string, File> = {};

  for (const [key, value] of formData.entries()) {
    if (value instanceof File) {
      files[key] = value;
    } else {
      fields[key] = value.toString();
    }
  }

  return { fields, files };
}

// Default file upload service
export const fileUploadService = new FileUploadService();

// Helper functions
export async function uploadFile(file: File, directory?: string): Promise<UploadResult> {
  return fileUploadService.uploadFile(file, directory);
}

export async function deleteFile(path: string): Promise<boolean> {
  return fileUploadService.deleteFile(path);
}

export function getFileUrl(path: string): string {
  return fileUploadService.getFileUrl(path);
}

export function validateFileUpload(file: File, options?: FileUploadOptions): { valid: boolean; message?: string } {
  const service = new FileUploadService(undefined, options);
  return service.validateFile(file);
}

export { FileUploadService, LocalStorageProvider };
export type { FileUploadOptions, UploadResult, StorageProvider };
