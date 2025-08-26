/**
 * Comprehensive Test Suite for File Manager
 * Epic 2 Story 2.7: User Profile Management & Preferences Infrastructure
 * 
 * Tests for secure file upload, validation, processing, and management
 * with comprehensive security scanning and GDPR compliance.
 */

import { describe, it, expect, beforeEach, afterEach, jest, beforeAll, afterAll } from '@jest/globals'
import { FileManager } from '@/lib/profile/file-manager'
import { readFile, writeFile, unlink } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'

// Mock dependencies
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn()
}))

jest.mock('fs/promises', () => ({
  writeFile: jest.fn(),
  readFile: jest.fn(),
  unlink: jest.fn(),
  mkdir: jest.fn()
}))

jest.mock('sharp', () => {
  return jest.fn().mockImplementation(() => ({
    metadata: jest.fn().mockResolvedValue({ width: 100, height: 100 }),
    resize: jest.fn().mockReturnThis(),
    jpeg: jest.fn().mockReturnThis(),
    toBuffer: jest.fn().mockResolvedValue(Buffer.from('processed-image'))
  }))
})

describe('FileManager', () => {
  let fileManager: FileManager
  let mockSupabase: any
  let mockUserId: string

  beforeAll(() => {
    // Mock Supabase client and methods
    mockSupabase = {
      from: jest.fn(),
      storage: {
        from: jest.fn().mockReturnValue({
          upload: jest.fn(),
          download: jest.fn(),
          remove: jest.fn(),
          getPublicUrl: jest.fn(),
          createSignedUrl: jest.fn()
        })
      }
    }

    // Mock query builder
    const mockQuery = {
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      neq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      range: jest.fn().mockReturnThis(),
      single: jest.fn(),
      count: 'exact'
    }

    mockSupabase.from.mockReturnValue(mockQuery)
    ;(require('@/lib/supabase/server').createClient as jest.Mock).mockReturnValue(mockSupabase)

    fileManager = new FileManager()
    mockUserId = 'test-user-id-123'
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('File Upload', () => {
    let mockFile: File
    let mockBuffer: Buffer

    beforeEach(() => {
      mockBuffer = Buffer.from('test file content')
      mockFile = {
        name: 'test-image.jpg',
        size: 1024,
        type: 'image/jpeg',
        arrayBuffer: jest.fn().mockResolvedValue(mockBuffer.buffer)
      } as any
    })

    it('should upload file successfully', async () => {
      // Mock successful validation
      const validationResult = {
        isValid: true,
        errors: [],
        warnings: [],
        fileInfo: {
          size: 1024,
          mimeType: 'image/jpeg',
          extension: '.jpg',
          dimensions: { width: 100, height: 100 },
          hash: 'test-hash-123'
        }
      }

      // Mock no duplicate file
      const mockQuery = mockSupabase.from('user_files')
      mockQuery.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' } // No rows found
      })

      // Mock successful storage upload
      mockSupabase.storage.from().upload.mockResolvedValue({
        data: { path: 'test-path/test-file.jpg' },
        error: null
      })

      // Mock successful database insert
      const mockFileRecord = {
        id: 'file-1',
        user_id: mockUserId,
        file_name: 'secure-filename.jpg',
        original_name: 'test-image.jpg',
        file_type: 'jpg',
        mime_type: 'image/jpeg',
        file_category: 'avatar',
        storage_path: 'test-path/test-file.jpg',
        file_size: 1024,
        validation_status: 'passed',
        uploaded_at: '2025-01-01T00:00:00Z'
      }

      mockQuery.select.mockReturnValue(mockQuery)
      mockQuery.single.mockResolvedValue({
        data: mockFileRecord,
        error: null
      })

      // Mock file processing
      ;(writeFile as jest.Mock).mockResolvedValue(undefined)
      ;(unlink as jest.Mock).mockResolvedValue(undefined)

      const result = await fileManager.uploadFile(
        mockUserId,
        mockFile,
        'test-image.jpg',
        'avatar',
        { makePublic: true }
      )

      expect(result.success).toBe(true)
      expect(result.file).toBeDefined()
      expect(result.file?.file_category).toBe('avatar')
      expect(mockSupabase.storage.from).toHaveBeenCalledWith('user-uploads')
      expect(mockSupabase.from).toHaveBeenCalledWith('user_files')
    })

    it('should reject file that fails validation', async () => {
      const mockFileInstance = fileManager as any

      // Test file size validation
      const oversizedBuffer = Buffer.alloc(10 * 1024 * 1024) // 10MB
      const oversizedFile = {
        name: 'large-file.jpg',
        size: 10 * 1024 * 1024,
        type: 'image/jpeg',
        arrayBuffer: jest.fn().mockResolvedValue(oversizedBuffer.buffer)
      } as any

      const result = await fileManager.uploadFile(
        mockUserId,
        oversizedFile,
        'large-file.jpg',
        'avatar'
      )

      expect(result.success).toBe(false)
      expect(result.error).toContain('validation failed')
    })

    it('should detect duplicate files by hash', async () => {
      const existingFile = {
        id: 'existing-file-1',
        user_id: mockUserId,
        file_name: 'existing.jpg',
        file_hash: 'test-hash-123'
      }

      // Mock finding existing file
      const mockQuery = mockSupabase.from('user_files')
      mockQuery.single.mockResolvedValue({
        data: existingFile,
        error: null
      })

      const result = await fileManager.uploadFile(
        mockUserId,
        mockFile,
        'duplicate.jpg',
        'avatar'
      )

      expect(result.success).toBe(true)
      expect(result.file).toEqual(existingFile)
    })

    it('should handle virus scan failures', async () => {
      // Mock virus scan returning infected
      const fileManagerInstance = fileManager as any
      jest.spyOn(fileManagerInstance, 'performVirusScan')
        .mockResolvedValue('infected')

      ;(writeFile as jest.Mock).mockResolvedValue(undefined)
      ;(unlink as jest.Mock).mockResolvedValue(undefined)

      const result = await fileManager.uploadFile(
        mockUserId,
        mockFile,
        'infected-file.jpg',
        'avatar'
      )

      expect(result.success).toBe(false)
      expect(result.error).toContain('virus scan')
      expect(unlink).toHaveBeenCalled()
    })

    it('should handle storage upload failures', async () => {
      const mockQuery = mockSupabase.from('user_files')
      mockQuery.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' }
      })

      // Mock storage upload failure
      mockSupabase.storage.from().upload.mockResolvedValue({
        data: null,
        error: { message: 'Storage full' }
      })

      ;(writeFile as jest.Mock).mockResolvedValue(undefined)
      ;(unlink as jest.Mock).mockResolvedValue(undefined)

      const result = await fileManager.uploadFile(
        mockUserId,
        mockFile,
        'test-file.jpg',
        'avatar'
      )

      expect(result.success).toBe(false)
      expect(result.error).toContain('Storage upload failed')
    })
  })

  describe('File Validation', () => {
    let fileManagerInstance: any

    beforeEach(() => {
      fileManagerInstance = fileManager as any
    })

    it('should validate file size correctly', async () => {
      const config = {
        maxSize: 1024,
        allowedMimeTypes: ['image/jpeg'],
        allowedExtensions: ['.jpg'],
        requiresVirusScan: false,
        generateThumbnail: false,
        compressImages: false,
        watermarkImages: false
      }

      const smallBuffer = Buffer.from('small file')
      const result = await fileManagerInstance.validateFile(
        smallBuffer,
        'test.jpg',
        config
      )

      expect(result.isValid).toBe(true)
      expect(result.fileInfo?.size).toBe(smallBuffer.length)
    })

    it('should reject oversized files', async () => {
      const config = {
        maxSize: 100,
        allowedMimeTypes: ['image/jpeg'],
        allowedExtensions: ['.jpg'],
        requiresVirusScan: false,
        generateThumbnail: false,
        compressImages: false,
        watermarkImages: false
      }

      const largeBuffer = Buffer.alloc(200)
      const result = await fileManagerInstance.validateFile(
        largeBuffer,
        'large.jpg',
        config
      )

      expect(result.isValid).toBe(false)
      expect(result.errors[0]).toContain('exceeds maximum allowed size')
    })

    it('should reject invalid file extensions', async () => {
      const config = {
        maxSize: 1024,
        allowedMimeTypes: ['image/jpeg'],
        allowedExtensions: ['.jpg'],
        requiresVirusScan: false,
        generateThumbnail: false,
        compressImages: false,
        watermarkImages: false
      }

      const buffer = Buffer.from('test')
      const result = await fileManagerInstance.validateFile(
        buffer,
        'test.exe',
        config
      )

      expect(result.isValid).toBe(false)
      expect(result.errors[0]).toContain('extension \'.exe\' is not allowed')
    })

    it('should detect MIME types correctly', async () => {
      // Test JPEG detection
      const jpegHeader = Buffer.from([0xFF, 0xD8, 0xFF])
      const mimeType = await fileManagerInstance.detectMimeType(jpegHeader, 'test.jpg')
      expect(mimeType).toBe('image/jpeg')

      // Test PNG detection
      const pngHeader = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])
      const pngMimeType = await fileManagerInstance.detectMimeType(pngHeader, 'test.png')
      expect(pngMimeType).toBe('image/png')
    })

    it('should extract image dimensions', async () => {
      const mockSharp = require('sharp')
      mockSharp().metadata.mockResolvedValue({
        width: 800,
        height: 600
      })

      const config = {
        maxSize: 1024,
        allowedMimeTypes: ['image/jpeg'],
        allowedExtensions: ['.jpg'],
        requiresVirusScan: false,
        generateThumbnail: false,
        compressImages: false,
        watermarkImages: false
      }

      const buffer = Buffer.from('fake image data')
      const result = await fileManagerInstance.validateFile(
        buffer,
        'test.jpg',
        config
      )

      expect(result.isValid).toBe(true)
      expect(result.fileInfo?.dimensions).toEqual({ width: 800, height: 600 })
    })
  })

  describe('File Processing', () => {
    let fileManagerInstance: any
    let mockFile: any

    beforeEach(() => {
      fileManagerInstance = fileManager as any
      mockFile = {
        id: 'file-1',
        file_name: 'test.jpg',
        mime_type: 'image/jpeg',
        storage_path: 'path/to/test.jpg',
        storage_bucket: 'user-uploads'
      }
    })

    it('should generate thumbnails for images', async () => {
      const config = {
        generateThumbnail: true,
        compressImages: false,
        watermarkImages: false
      }

      const mockSharp = require('sharp')
      mockSharp().resize.mockReturnThis()
      mockSharp().jpeg.mockReturnThis()
      mockSharp().toBuffer.mockResolvedValue(Buffer.from('thumbnail'))

      mockSupabase.storage.from().upload.mockResolvedValue({
        data: { path: 'thumbnail-path' },
        error: null
      })

      const results = await fileManagerInstance.processFile(
        '/tmp/test.jpg',
        mockFile,
        config
      )

      expect(results).toHaveLength(1)
      expect(results[0].type).toBe('thumbnail')
      expect(results[0].success).toBe(true)
      expect(mockSharp).toHaveBeenCalled()
    })

    it('should compress images when configured', async () => {
      const config = {
        generateThumbnail: false,
        compressImages: true,
        watermarkImages: false
      }

      const mockSharp = require('sharp')
      mockSharp().jpeg.mockReturnThis()
      mockSharp().toBuffer.mockResolvedValue(Buffer.from('compressed'))

      mockSupabase.storage.from().upload.mockResolvedValue({
        data: { path: 'compressed-path' },
        error: null
      })

      const results = await fileManagerInstance.processFile(
        '/tmp/test.jpg',
        mockFile,
        config
      )

      expect(results).toHaveLength(1)
      expect(results[0].type).toBe('compression')
      expect(results[0].success).toBe(true)
    })

    it('should handle processing failures gracefully', async () => {
      const config = {
        generateThumbnail: true,
        compressImages: false,
        watermarkImages: false
      }

      const mockSharp = require('sharp')
      mockSharp().resize.mockImplementation(() => {
        throw new Error('Processing failed')
      })

      const results = await fileManagerInstance.processFile(
        '/tmp/test.jpg',
        mockFile,
        config
      )

      expect(results).toHaveLength(1)
      expect(results[0].type).toBe('thumbnail')
      expect(results[0].success).toBe(false)
      expect(results[0].error).toContain('Processing failed')
    })
  })

  describe('File Retrieval', () => {
    it('should get user files with filtering', async () => {
      const mockFiles = [
        {
          id: 'file-1',
          user_id: mockUserId,
          original_name: 'avatar.jpg',
          file_category: 'avatar',
          file_size: 1024,
          is_public: true,
          uploaded_at: '2025-01-01T00:00:00Z'
        },
        {
          id: 'file-2',
          user_id: mockUserId,
          original_name: 'document.pdf',
          file_category: 'document',
          file_size: 2048,
          is_public: false,
          uploaded_at: '2025-01-01T00:00:00Z'
        }
      ]

      const mockQuery = mockSupabase.from('user_files')
      mockQuery.mockResolvedValue({
        data: mockFiles,
        error: null,
        count: 2
      })

      const result = await fileManager.getUserFiles(mockUserId, {
        category: 'avatar',
        limit: 10,
        offset: 0
      })

      expect(result.files).toHaveLength(2)
      expect(result.total).toBe(2)
      expect(mockQuery.eq).toHaveBeenCalledWith('user_id', mockUserId)
      expect(mockQuery.eq).toHaveBeenCalledWith('file_category', 'avatar')
    })

    it('should get specific file by ID', async () => {
      const mockFile = {
        id: 'file-1',
        user_id: mockUserId,
        original_name: 'test.jpg',
        file_category: 'avatar'
      }

      const mockQuery = mockSupabase.from('user_files')
      mockQuery.single.mockResolvedValue({
        data: mockFile,
        error: null
      })

      const result = await fileManager.getFile('file-1', mockUserId)

      expect(result).toEqual(mockFile)
      expect(mockQuery.eq).toHaveBeenCalledWith('id', 'file-1')
      expect(mockQuery.eq).toHaveBeenCalledWith('user_id', mockUserId)
    })

    it('should return null for non-existent files', async () => {
      const mockQuery = mockSupabase.from('user_files')
      mockQuery.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' }
      })

      const result = await fileManager.getFile('non-existent', mockUserId)

      expect(result).toBeNull()
    })
  })

  describe('File Deletion', () => {
    let mockFile: any

    beforeEach(() => {
      mockFile = {
        id: 'file-1',
        user_id: mockUserId,
        storage_path: 'path/to/file.jpg',
        storage_bucket: 'user-uploads',
        variants: {
          thumbnail: 'path/to/thumb.jpg',
          compressed: 'path/to/compressed.jpg'
        }
      }

      // Mock getFile to return our test file
      jest.spyOn(fileManager, 'getFile').mockResolvedValue(mockFile)
    })

    it('should perform soft deletion by default', async () => {
      const mockQuery = mockSupabase.from('user_files')
      mockQuery.mockResolvedValue({ error: null })

      const result = await fileManager.deleteFile('file-1', mockUserId)

      expect(result.success).toBe(true)
      expect(mockQuery.update).toHaveBeenCalled()
      expect(mockQuery.delete).not.toHaveBeenCalled()
    })

    it('should perform permanent deletion when requested', async () => {
      const mockQuery = mockSupabase.from('user_files')
      mockQuery.mockResolvedValue({ error: null })

      mockSupabase.storage.from().remove.mockResolvedValue({
        data: null,
        error: null
      })

      const result = await fileManager.deleteFile('file-1', mockUserId, {
        permanent: true
      })

      expect(result.success).toBe(true)
      expect(mockSupabase.storage.from().remove).toHaveBeenCalled()
      expect(mockQuery.delete).toHaveBeenCalled()
    })

    it('should delete file variants during permanent deletion', async () => {
      const mockQuery = mockSupabase.from('user_files')
      mockQuery.mockResolvedValue({ error: null })

      mockSupabase.storage.from().remove
        .mockResolvedValueOnce({ data: null, error: null }) // Main file
        .mockResolvedValueOnce({ data: null, error: null }) // Variants

      const result = await fileManager.deleteFile('file-1', mockUserId, {
        permanent: true
      })

      expect(result.success).toBe(true)
      expect(mockSupabase.storage.from().remove).toHaveBeenCalledTimes(2)
    })

    it('should handle file not found', async () => {
      jest.spyOn(fileManager, 'getFile').mockResolvedValue(null)

      const result = await fileManager.deleteFile('non-existent', mockUserId)

      expect(result.success).toBe(false)
      expect(result.error).toBe('File not found')
    })

    it('should handle storage deletion errors gracefully', async () => {
      const mockQuery = mockSupabase.from('user_files')
      mockQuery.mockResolvedValue({ error: null })

      mockSupabase.storage.from().remove.mockResolvedValue({
        data: null,
        error: { message: 'Storage error' }
      })

      const result = await fileManager.deleteFile('file-1', mockUserId, {
        permanent: true
      })

      expect(result.success).toBe(true) // Should continue even if storage deletion fails
    })
  })

  describe('File Download', () => {
    let mockFile: any

    beforeEach(() => {
      mockFile = {
        id: 'file-1',
        user_id: mockUserId,
        storage_path: 'path/to/file.jpg',
        storage_bucket: 'user-uploads',
        download_count: 5,
        is_quarantined: false,
        deleted_at: null
      }

      jest.spyOn(fileManager, 'getFile').mockResolvedValue(mockFile)
    })

    it('should download file successfully', async () => {
      const mockFileContent = Buffer.from('file content')
      const mockBlob = {
        arrayBuffer: jest.fn().mockResolvedValue(mockFileContent.buffer)
      }

      mockSupabase.storage.from().download.mockResolvedValue({
        data: mockBlob,
        error: null
      })

      const mockQuery = mockSupabase.from('user_files')
      mockQuery.mockResolvedValue({ error: null })

      const result = await fileManager.downloadFile('file-1', mockUserId)

      expect(result.success).toBe(true)
      expect(result.data).toEqual(mockFileContent)
      expect(result.file).toEqual(mockFile)
      expect(mockQuery.update).toHaveBeenCalledWith(
        expect.objectContaining({
          download_count: 6
        })
      )
    })

    it('should reject download of quarantined files', async () => {
      const quarantinedFile = { ...mockFile, is_quarantined: true }
      jest.spyOn(fileManager, 'getFile').mockResolvedValue(quarantinedFile)

      const result = await fileManager.downloadFile('file-1', mockUserId)

      expect(result.success).toBe(false)
      expect(result.error).toBe('File is quarantined')
    })

    it('should reject download of deleted files', async () => {
      const deletedFile = { ...mockFile, deleted_at: '2025-01-01T00:00:00Z' }
      jest.spyOn(fileManager, 'getFile').mockResolvedValue(deletedFile)

      const result = await fileManager.downloadFile('file-1', mockUserId)

      expect(result.success).toBe(false)
      expect(result.error).toBe('File has been deleted')
    })

    it('should handle storage download errors', async () => {
      mockSupabase.storage.from().download.mockResolvedValue({
        data: null,
        error: { message: 'Download failed' }
      })

      const result = await fileManager.downloadFile('file-1', mockUserId)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Storage download failed')
    })
  })

  describe('GDPR Compliance', () => {
    it('should export user files for GDPR', async () => {
      const mockFiles = [
        {
          id: 'file-1',
          user_id: mockUserId,
          original_name: 'avatar.jpg',
          file_size: 1024
        },
        {
          id: 'file-2',
          user_id: mockUserId,
          original_name: 'document.pdf',
          file_size: 2048
        }
      ]

      jest.spyOn(fileManager, 'getUserFiles').mockResolvedValue({
        files: mockFiles as any,
        total: 2
      })

      const mockQuery = mockSupabase.from('gdpr_compliance_logs')
      mockQuery.insert.mockResolvedValue({ error: null })

      const result = await fileManager.exportUserFiles(mockUserId)

      expect(result.success).toBe(true)
      expect(result.files).toHaveLength(2)
      expect(result.totalSize).toBe(3072)
    })

    it('should delete all user files for GDPR', async () => {
      const mockFiles = [
        { id: 'file-1', file_category: 'avatar' },
        { id: 'file-2', file_category: 'document' }
      ]

      jest.spyOn(fileManager, 'getUserFiles').mockResolvedValue({
        files: mockFiles as any,
        total: 2
      })

      jest.spyOn(fileManager, 'deleteFile').mockResolvedValue({
        success: true
      })

      const result = await fileManager.deleteUserFiles(mockUserId, {
        permanent: true
      })

      expect(result.success).toBe(true)
      expect(result.deletedCount).toBe(2)
      expect(fileManager.deleteFile).toHaveBeenCalledTimes(2)
    })
  })

  describe('Access Logging', () => {
    it('should log file access events', async () => {
      const fileManagerInstance = fileManager as any
      const mockQuery = mockSupabase.from('file_access_logs')
      mockQuery.insert.mockResolvedValue({ error: null })

      await fileManagerInstance.logFileAccess({
        file_id: 'file-1',
        user_id: mockUserId,
        access_type: 'download',
        access_method: 'api',
        success: true
      })

      expect(mockQuery.insert).toHaveBeenCalledWith({
        file_id: 'file-1',
        user_id: mockUserId,
        access_type: 'download',
        access_method: 'api',
        success: true,
        ip_address: undefined,
        user_agent: undefined,
        error_message: undefined
      })
    })

    it('should handle logging errors gracefully', async () => {
      const fileManagerInstance = fileManager as any
      const mockQuery = mockSupabase.from('file_access_logs')
      mockQuery.insert.mockRejectedValue(new Error('Logging failed'))

      // Should not throw error even if logging fails
      await expect(fileManagerInstance.logFileAccess({
        file_id: 'file-1',
        user_id: mockUserId,
        access_type: 'download',
        access_method: 'api',
        success: true
      })).resolves.toBeUndefined()
    })
  })
})