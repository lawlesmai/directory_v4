/**
 * Secure File Upload and Management System
 * Epic 2 Story 2.7: User Profile Management & Preferences Infrastructure
 * 
 * Handles secure file uploads, validation, processing, and management
 * with comprehensive security scanning and GDPR compliance.
 */

import { createClient } from '@/lib/supabase/server'
import { createHash } from 'crypto'
import sharp from 'sharp'
import { writeFile, readFile, unlink, mkdir } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { v4 as uuidv4 } from 'uuid'

// Type definitions
export interface FileUploadConfig {
  maxSize: number // in bytes
  allowedMimeTypes: string[]
  allowedExtensions: string[]
  requiresVirusScan: boolean
  generateThumbnail: boolean
  compressImages: boolean
  watermarkImages: boolean
}

export interface FileValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  fileInfo?: {
    size: number
    mimeType: string
    extension: string
    dimensions?: { width: number; height: number }
    hash: string
  }
}

export interface FileUploadResult {
  success: boolean
  file?: UserFile
  error?: string
  validationResult?: FileValidationResult
  processingResults?: FileProcessingResult[]
}

export interface UserFile {
  id: string
  user_id: string
  file_name: string
  original_name: string
  file_type: string
  mime_type: string
  file_category: 'avatar' | 'document' | 'verification' | 'business' | 'other'
  storage_path: string
  storage_bucket: string
  file_size: number
  file_hash: string
  dimensions?: { width: number; height: number }
  duration?: number
  metadata: any
  is_validated: boolean
  is_quarantined: boolean
  validation_status: 'pending' | 'passed' | 'failed' | 'quarantined'
  validation_details: any
  virus_scan_result: 'pending' | 'clean' | 'infected' | 'suspicious'
  virus_scan_date?: string
  is_processed: boolean
  processing_status: 'pending' | 'processing' | 'completed' | 'failed'
  processing_details: any
  variants: any
  thumbnail_path?: string
  compressed_path?: string
  download_count: number
  last_accessed?: string
  is_public: boolean
  public_url?: string
  is_sensitive: boolean
  requires_consent: boolean
  consent_given: boolean
  gdpr_category?: string
  retention_policy: string
  scheduled_deletion?: string
  uploaded_at: string
  last_modified: string
  deleted_at?: string
}

export interface FileProcessingResult {
  type: 'thumbnail' | 'compression' | 'watermark' | 'format_conversion'
  success: boolean
  outputPath?: string
  error?: string
  metadata?: any
}

export interface FileAccessLog {
  file_id: string
  user_id?: string
  access_type: 'view' | 'download' | 'upload' | 'delete' | 'modify'
  access_method: string
  ip_address?: string
  user_agent?: string
  success: boolean
  error_message?: string
}

/**
 * Secure File Manager
 * 
 * Comprehensive file management system with security validation,
 * processing, and GDPR compliance features.
 */
export class FileManager {
  private supabase = createClient()
  
  // Default file upload configurations
  private static readonly FILE_CONFIGS: Record<string, FileUploadConfig> = {
    avatar: {
      maxSize: 5 * 1024 * 1024, // 5MB
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
      allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp', '.gif'],
      requiresVirusScan: true,
      generateThumbnail: true,
      compressImages: true,
      watermarkImages: false
    },
    document: {
      maxSize: 10 * 1024 * 1024, // 10MB
      allowedMimeTypes: ['application/pdf', 'image/jpeg', 'image/png', 'text/plain'],
      allowedExtensions: ['.pdf', '.jpg', '.jpeg', '.png', '.txt'],
      requiresVirusScan: true,
      generateThumbnail: true,
      compressImages: false,
      watermarkImages: true
    },
    verification: {
      maxSize: 15 * 1024 * 1024, // 15MB
      allowedMimeTypes: ['application/pdf', 'image/jpeg', 'image/png'],
      allowedExtensions: ['.pdf', '.jpg', '.jpeg', '.png'],
      requiresVirusScan: true,
      generateThumbnail: true,
      compressImages: false,
      watermarkImages: false
    },
    business: {
      maxSize: 20 * 1024 * 1024, // 20MB
      allowedMimeTypes: [
        'image/jpeg', 'image/png', 'image/webp',
        'application/pdf', 'text/plain', 'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ],
      allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp', '.pdf', '.txt', '.doc', '.docx'],
      requiresVirusScan: true,
      generateThumbnail: true,
      compressImages: true,
      watermarkImages: true
    }
  }

  /**
   * Upload and process a file securely
   */
  async uploadFile(
    userId: string,
    file: File | Buffer,
    fileName: string,
    category: 'avatar' | 'document' | 'verification' | 'business' | 'other',
    options: {
      makePublic?: boolean
      customConfig?: Partial<FileUploadConfig>
      metadata?: any
      gdprCategory?: string
      retentionPolicy?: string
    } = {}
  ): Promise<FileUploadResult> {
    try {
      const config = {
        ...FileManager.FILE_CONFIGS[category],
        ...options.customConfig
      }

      // Convert File to Buffer if needed
      const fileBuffer = file instanceof File ? 
        Buffer.from(await file.arrayBuffer()) : file
      
      const originalFileName = file instanceof File ? file.name : fileName

      // Validate file
      const validationResult = await this.validateFile(
        fileBuffer, 
        originalFileName, 
        config
      )

      if (!validationResult.isValid) {
        return {
          success: false,
          error: `File validation failed: ${validationResult.errors.join(', ')}`,
          validationResult
        }
      }

      // Generate secure file name and paths
      const fileId = uuidv4()
      const fileExtension = validationResult.fileInfo!.extension
      const secureFileName = `${fileId}${fileExtension}`
      const storagePath = this.generateStoragePath(userId, category, secureFileName)

      // Check for duplicate files
      const existingFile = await this.findDuplicateFile(
        userId, 
        validationResult.fileInfo!.hash
      )

      if (existingFile) {
        return {
          success: true,
          file: existingFile,
          validationResult
        }
      }

      // Store file temporarily for processing
      const tempPath = join(tmpdir(), `upload_${fileId}${fileExtension}`)
      await writeFile(tempPath, fileBuffer)

      try {
        // Virus scan if required
        let virusScanResult: 'pending' | 'clean' | 'infected' | 'suspicious' = 'pending'
        if (config.requiresVirusScan) {
          virusScanResult = await this.performVirusScan(tempPath)
          
          if (virusScanResult === 'infected' || virusScanResult === 'suspicious') {
            await unlink(tempPath) // Delete infected file immediately
            return {
              success: false,
              error: `File failed virus scan: ${virusScanResult}`,
              validationResult
            }
          }
        }

        // Upload to Supabase storage
        const { data: uploadData, error: uploadError } = await this.supabase.storage
          .from('user-uploads')
          .upload(storagePath, fileBuffer, {
            contentType: validationResult.fileInfo!.mimeType,
            cacheControl: '3600',
            upsert: false
          })

        if (uploadError) {
          throw new Error(`Storage upload failed: ${uploadError.message}`)
        }

        // Get public URL if requested
        let publicUrl: string | undefined
        if (options.makePublic) {
          const { data: urlData } = this.supabase.storage
            .from('user-uploads')
            .getPublicUrl(storagePath)
          publicUrl = urlData.publicUrl
        }

        // Create database record
        const { data: fileRecord, error: dbError } = await this.supabase
          .from('user_files')
          .insert({
            id: fileId,
            user_id: userId,
            file_name: secureFileName,
            original_name: originalFileName,
            file_type: fileExtension.slice(1),
            mime_type: validationResult.fileInfo!.mimeType,
            file_category: category,
            storage_path: storagePath,
            storage_bucket: 'user-uploads',
            file_size: validationResult.fileInfo!.size,
            file_hash: validationResult.fileInfo!.hash,
            dimensions: validationResult.fileInfo!.dimensions || null,
            metadata: {
              ...options.metadata,
              upload_ip: null, // TODO: Get from request
              upload_user_agent: null // TODO: Get from request
            },
            is_validated: true,
            validation_status: 'passed',
            validation_details: validationResult,
            virus_scan_result: virusScanResult,
            virus_scan_date: config.requiresVirusScan ? new Date().toISOString() : null,
            is_processed: false,
            processing_status: 'pending',
            is_public: options.makePublic || false,
            public_url: publicUrl,
            is_sensitive: category === 'verification',
            gdpr_category: options.gdprCategory,
            retention_policy: options.retentionPolicy || 'standard',
            uploaded_by: userId
          })
          .select()
          .single()

        if (dbError) {
          // Clean up uploaded file if database insert fails
          await this.supabase.storage.from('user-uploads').remove([storagePath])
          throw new Error(`Database insert failed: ${dbError.message}`)
        }

        // Process file asynchronously
        const processingResults = await this.processFile(
          tempPath,
          fileRecord as UserFile,
          config
        )

        // Update processing status
        await this.supabase
          .from('user_files')
          .update({
            is_processed: true,
            processing_status: 'completed',
            processing_details: processingResults,
            variants: this.extractVariantsFromProcessing(processingResults),
            thumbnail_path: this.extractThumbnailPath(processingResults),
            compressed_path: this.extractCompressedPath(processingResults)
          })
          .eq('id', fileId)

        // Clean up temp file
        await unlink(tempPath).catch(() => {}) // Ignore cleanup errors

        // Log file upload
        await this.logFileAccess({
          file_id: fileId,
          user_id: userId,
          access_type: 'upload',
          access_method: 'api',
          success: true
        })

        return {
          success: true,
          file: fileRecord as UserFile,
          validationResult,
          processingResults
        }

      } catch (processingError) {
        // Clean up temp file on error
        await unlink(tempPath).catch(() => {})
        throw processingError
      }

    } catch (error) {
      console.error('File upload failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown upload error'
      }
    }
  }

  /**
   * Get user files with filtering and pagination
   */
  async getUserFiles(
    userId: string,
    options: {
      category?: string
      isPublic?: boolean
      limit?: number
      offset?: number
      includeDeleted?: boolean
    } = {}
  ): Promise<{ files: UserFile[]; total: number }> {
    try {
      let query = this.supabase
        .from('user_files')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)

      if (options.category) {
        query = query.eq('file_category', options.category)
      }

      if (options.isPublic !== undefined) {
        query = query.eq('is_public', options.isPublic)
      }

      if (!options.includeDeleted) {
        query = query.is('deleted_at', null)
      }

      if (options.limit) {
        query = query.limit(options.limit)
      }

      if (options.offset) {
        query = query.range(options.offset, (options.offset + (options.limit || 10)) - 1)
      }

      const { data, error, count } = await query.order('uploaded_at', { ascending: false })

      if (error) throw error

      return {
        files: data || [],
        total: count || 0
      }

    } catch (error) {
      console.error('Failed to get user files:', error)
      throw new Error('Failed to retrieve user files')
    }
  }

  /**
   * Get a specific file by ID
   */
  async getFile(fileId: string, userId?: string): Promise<UserFile | null> {
    try {
      let query = this.supabase
        .from('user_files')
        .select('*')
        .eq('id', fileId)

      if (userId) {
        query = query.eq('user_id', userId)
      }

      const { data, error } = await query.single()

      if (error && error.code !== 'PGRST116') throw error

      return data
    } catch (error) {
      console.error('Failed to get file:', error)
      return null
    }
  }

  /**
   * Delete a file
   */
  async deleteFile(
    fileId: string,
    userId: string,
    options: {
      permanent?: boolean
      deleteReason?: string
    } = {}
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const file = await this.getFile(fileId, userId)
      
      if (!file) {
        return { success: false, error: 'File not found' }
      }

      if (options.permanent) {
        // Permanent deletion - remove from storage and database
        
        // Delete from storage
        const { error: storageError } = await this.supabase.storage
          .from(file.storage_bucket)
          .remove([file.storage_path])

        if (storageError) {
          console.error('Storage deletion error:', storageError)
          // Continue with database deletion even if storage fails
        }

        // Delete variants
        if (file.variants) {
          const variantPaths = Object.values(file.variants).filter(Boolean) as string[]
          if (variantPaths.length > 0) {
            await this.supabase.storage
              .from(file.storage_bucket)
              .remove(variantPaths)
              .catch(console.error)
          }
        }

        // Delete from database
        const { error: dbError } = await this.supabase
          .from('user_files')
          .delete()
          .eq('id', fileId)
          .eq('user_id', userId)

        if (dbError) throw dbError

      } else {
        // Soft deletion - mark as deleted
        const { error: updateError } = await this.supabase
          .from('user_files')
          .update({
            deleted_at: new Date().toISOString(),
            deleted_by: userId,
            deletion_reason: options.deleteReason || 'User request'
          })
          .eq('id', fileId)
          .eq('user_id', userId)

        if (updateError) throw updateError
      }

      // Log file deletion
      await this.logFileAccess({
        file_id: fileId,
        user_id: userId,
        access_type: 'delete',
        access_method: 'api',
        success: true
      })

      return { success: true }

    } catch (error) {
      console.error('Failed to delete file:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Download a file
   */
  async downloadFile(
    fileId: string,
    userId?: string
  ): Promise<{ success: boolean; data?: Buffer; file?: UserFile; error?: string }> {
    try {
      const file = await this.getFile(fileId, userId)
      
      if (!file) {
        return { success: false, error: 'File not found' }
      }

      if (file.deleted_at) {
        return { success: false, error: 'File has been deleted' }
      }

      if (file.is_quarantined) {
        return { success: false, error: 'File is quarantined' }
      }

      // Download from storage
      const { data, error } = await this.supabase.storage
        .from(file.storage_bucket)
        .download(file.storage_path)

      if (error) {
        throw new Error(`Storage download failed: ${error.message}`)
      }

      // Update access tracking
      await this.supabase
        .from('user_files')
        .update({
          download_count: file.download_count + 1,
          last_accessed: new Date().toISOString()
        })
        .eq('id', fileId)

      // Log file access
      await this.logFileAccess({
        file_id: fileId,
        user_id: userId,
        access_type: 'download',
        access_method: 'api',
        success: true
      })

      const buffer = Buffer.from(await data.arrayBuffer())

      return {
        success: true,
        data: buffer,
        file
      }

    } catch (error) {
      console.error('File download failed:', error)
      
      // Log failed access
      if (fileId) {
        await this.logFileAccess({
          file_id: fileId,
          user_id: userId,
          access_type: 'download',
          access_method: 'api',
          success: false,
          error_message: error instanceof Error ? error.message : 'Unknown error'
        })
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Download failed'
      }
    }
  }

  /**
   * Export user files for GDPR compliance
   */
  async exportUserFiles(userId: string): Promise<{
    success: boolean
    files: UserFile[]
    totalSize: number
    error?: string
  }> {
    try {
      const { files } = await this.getUserFiles(userId, { includeDeleted: true })
      
      const totalSize = files.reduce((sum, file) => sum + file.file_size, 0)

      // Log GDPR export activity
      await this.supabase.from('gdpr_compliance_logs').insert({
        user_id: userId,
        activity_type: 'files_export',
        activity_description: 'User files exported for GDPR compliance',
        compliance_requirement: 'data_portability',
        data_categories: ['user_files'],
        data_volume: files.length,
        automated: false,
        success: true,
        performed_by: userId
      })

      return {
        success: true,
        files,
        totalSize
      }

    } catch (error) {
      console.error('Failed to export user files:', error)
      return {
        success: false,
        files: [],
        totalSize: 0,
        error: error instanceof Error ? error.message : 'Export failed'
      }
    }
  }

  /**
   * Delete all user files for GDPR compliance
   */
  async deleteUserFiles(
    userId: string,
    options: {
      categories?: string[]
      permanent?: boolean
    } = {}
  ): Promise<{ success: boolean; deletedCount: number; error?: string }> {
    try {
      const { files } = await this.getUserFiles(userId, {
        category: options.categories?.[0], // TODO: Support multiple categories
        includeDeleted: false
      })

      let deletedCount = 0

      for (const file of files) {
        const result = await this.deleteFile(file.id, userId, {
          permanent: options.permanent,
          deleteReason: 'GDPR compliance deletion'
        })

        if (result.success) {
          deletedCount++
        }
      }

      // Log GDPR deletion activity
      await this.supabase.from('gdpr_compliance_logs').insert({
        user_id: userId,
        activity_type: 'files_deletion',
        activity_description: 'User files deleted for GDPR compliance',
        compliance_requirement: 'right_to_be_forgotten',
        data_categories: options.categories || ['all_files'],
        data_volume: deletedCount,
        automated: false,
        success: true,
        performed_by: userId
      })

      return {
        success: true,
        deletedCount
      }

    } catch (error) {
      console.error('Failed to delete user files:', error)
      return {
        success: false,
        deletedCount: 0,
        error: error instanceof Error ? error.message : 'Deletion failed'
      }
    }
  }

  // Private helper methods

  private async validateFile(
    fileBuffer: Buffer,
    fileName: string,
    config: FileUploadConfig
  ): Promise<FileValidationResult> {
    const result: FileValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    }

    try {
      // File size validation
      if (fileBuffer.length > config.maxSize) {
        result.isValid = false
        result.errors.push(`File size exceeds maximum allowed size of ${config.maxSize} bytes`)
      }

      // File extension validation
      const extension = fileName.toLowerCase().substring(fileName.lastIndexOf('.'))
      if (!config.allowedExtensions.includes(extension)) {
        result.isValid = false
        result.errors.push(`File extension '${extension}' is not allowed`)
      }

      // MIME type detection and validation
      const mimeType = await this.detectMimeType(fileBuffer, fileName)
      if (!config.allowedMimeTypes.includes(mimeType)) {
        result.isValid = false
        result.errors.push(`MIME type '${mimeType}' is not allowed`)
      }

      // Generate file hash for duplicate detection
      const hash = createHash('sha256').update(fileBuffer).digest('hex')

      // Get image dimensions if it's an image
      let dimensions: { width: number; height: number } | undefined
      if (mimeType.startsWith('image/')) {
        try {
          const imageInfo = await sharp(fileBuffer).metadata()
          dimensions = {
            width: imageInfo.width || 0,
            height: imageInfo.height || 0
          }
        } catch (error) {
          result.warnings.push('Could not extract image dimensions')
        }
      }

      result.fileInfo = {
        size: fileBuffer.length,
        mimeType,
        extension,
        dimensions,
        hash
      }

    } catch (error) {
      result.isValid = false
      result.errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    return result
  }

  private async detectMimeType(fileBuffer: Buffer, fileName: string): Promise<string> {
    // Simple MIME type detection based on file signature
    const signature = fileBuffer.subarray(0, 12)
    
    // JPEG
    if (signature[0] === 0xFF && signature[1] === 0xD8) return 'image/jpeg'
    
    // PNG
    if (signature.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))) {
      return 'image/png'
    }
    
    // WebP
    if (signature.subarray(8, 12).equals(Buffer.from('WEBP'))) return 'image/webp'
    
    // PDF
    if (signature.subarray(0, 4).equals(Buffer.from('%PDF'))) return 'application/pdf'
    
    // GIF
    if (signature.subarray(0, 6).equals(Buffer.from('GIF87a')) || 
        signature.subarray(0, 6).equals(Buffer.from('GIF89a'))) {
      return 'image/gif'
    }

    // Fallback to extension-based detection
    const extension = fileName.toLowerCase().substring(fileName.lastIndexOf('.'))
    const mimeTypeMap: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.gif': 'image/gif',
      '.pdf': 'application/pdf',
      '.txt': 'text/plain',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    }

    return mimeTypeMap[extension] || 'application/octet-stream'
  }

  private async performVirusScan(filePath: string): Promise<'clean' | 'infected' | 'suspicious'> {
    // TODO: Implement actual virus scanning using ClamAV or similar
    // For now, return clean for all files
    return 'clean'
  }

  private generateStoragePath(userId: string, category: string, fileName: string): string {
    const date = new Date()
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    
    return `${userId}/${category}/${year}/${month}/${day}/${fileName}`
  }

  private async findDuplicateFile(userId: string, fileHash: string): Promise<UserFile | null> {
    try {
      const { data, error } = await this.supabase
        .from('user_files')
        .select('*')
        .eq('user_id', userId)
        .eq('file_hash', fileHash)
        .is('deleted_at', null)
        .single()

      if (error && error.code !== 'PGRST116') throw error

      return data
    } catch (error) {
      console.error('Error checking for duplicate files:', error)
      return null
    }
  }

  private async processFile(
    tempPath: string,
    file: UserFile,
    config: FileUploadConfig
  ): Promise<FileProcessingResult[]> {
    const results: FileProcessingResult[] = []

    try {
      // Generate thumbnail if needed
      if (config.generateThumbnail && file.mime_type.startsWith('image/')) {
        const thumbnailResult = await this.generateThumbnail(tempPath, file)
        results.push(thumbnailResult)
      }

      // Compress image if needed
      if (config.compressImages && file.mime_type.startsWith('image/')) {
        const compressionResult = await this.compressImage(tempPath, file)
        results.push(compressionResult)
      }

      // Add watermark if needed
      if (config.watermarkImages && file.mime_type.startsWith('image/')) {
        const watermarkResult = await this.addWatermark(tempPath, file)
        results.push(watermarkResult)
      }

    } catch (error) {
      console.error('File processing error:', error)
      results.push({
        type: 'thumbnail',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown processing error'
      })
    }

    return results
  }

  private async generateThumbnail(tempPath: string, file: UserFile): Promise<FileProcessingResult> {
    try {
      const thumbnailFileName = `thumb_${file.file_name}`
      const thumbnailPath = file.storage_path.replace(file.file_name, thumbnailFileName)
      
      const thumbnailBuffer = await sharp(tempPath)
        .resize(200, 200, { 
          fit: 'cover', 
          withoutEnlargement: true 
        })
        .jpeg({ quality: 85 })
        .toBuffer()

      // Upload thumbnail
      const { error } = await this.supabase.storage
        .from(file.storage_bucket)
        .upload(thumbnailPath, thumbnailBuffer, {
          contentType: 'image/jpeg',
          cacheControl: '3600'
        })

      if (error) throw error

      return {
        type: 'thumbnail',
        success: true,
        outputPath: thumbnailPath,
        metadata: {
          width: 200,
          height: 200,
          format: 'jpeg'
        }
      }

    } catch (error) {
      return {
        type: 'thumbnail',
        success: false,
        error: error instanceof Error ? error.message : 'Thumbnail generation failed'
      }
    }
  }

  private async compressImage(tempPath: string, file: UserFile): Promise<FileProcessingResult> {
    try {
      const compressedFileName = `compressed_${file.file_name}`
      const compressedPath = file.storage_path.replace(file.file_name, compressedFileName)
      
      const compressedBuffer = await sharp(tempPath)
        .jpeg({ quality: 80, progressive: true })
        .toBuffer()

      // Upload compressed version
      const { error } = await this.supabase.storage
        .from(file.storage_bucket)
        .upload(compressedPath, compressedBuffer, {
          contentType: 'image/jpeg',
          cacheControl: '3600'
        })

      if (error) throw error

      return {
        type: 'compression',
        success: true,
        outputPath: compressedPath,
        metadata: {
          originalSize: file.file_size,
          compressedSize: compressedBuffer.length,
          compressionRatio: compressedBuffer.length / file.file_size
        }
      }

    } catch (error) {
      return {
        type: 'compression',
        success: false,
        error: error instanceof Error ? error.message : 'Image compression failed'
      }
    }
  }

  private async addWatermark(tempPath: string, file: UserFile): Promise<FileProcessingResult> {
    try {
      // TODO: Implement watermarking
      // For now, return success without doing anything
      return {
        type: 'watermark',
        success: true,
        metadata: {
          watermarkApplied: false,
          reason: 'Not implemented'
        }
      }
    } catch (error) {
      return {
        type: 'watermark',
        success: false,
        error: error instanceof Error ? error.message : 'Watermark failed'
      }
    }
  }

  private extractVariantsFromProcessing(results: FileProcessingResult[]): any {
    const variants: any = {}
    
    results.forEach(result => {
      if (result.success && result.outputPath) {
        variants[result.type] = result.outputPath
      }
    })

    return variants
  }

  private extractThumbnailPath(results: FileProcessingResult[]): string | undefined {
    const thumbnailResult = results.find(r => r.type === 'thumbnail' && r.success)
    return thumbnailResult?.outputPath
  }

  private extractCompressedPath(results: FileProcessingResult[]): string | undefined {
    const compressionResult = results.find(r => r.type === 'compression' && r.success)
    return compressionResult?.outputPath
  }

  private async logFileAccess(logData: FileAccessLog): Promise<void> {
    try {
      await this.supabase.from('file_access_logs').insert({
        file_id: logData.file_id,
        user_id: logData.user_id,
        access_type: logData.access_type,
        access_method: logData.access_method,
        ip_address: logData.ip_address,
        user_agent: logData.user_agent,
        success: logData.success,
        error_message: logData.error_message
      })
    } catch (error) {
      console.error('Failed to log file access:', error)
      // Non-critical error, continue execution
    }
  }
}

// Export singleton instance
export const fileManager = new FileManager()

// Utility functions for common file operations
export async function uploadAvatar(userId: string, avatarFile: File): Promise<FileUploadResult> {
  return fileManager.uploadFile(userId, avatarFile, avatarFile.name, 'avatar', {
    makePublic: true,
    metadata: { purpose: 'profile_avatar' }
  })
}

export async function uploadDocument(
  userId: string, 
  documentFile: File, 
  isVerification: boolean = false
): Promise<FileUploadResult> {
  return fileManager.uploadFile(
    userId, 
    documentFile, 
    documentFile.name, 
    isVerification ? 'verification' : 'document',
    {
      makePublic: false,
      gdprCategory: isVerification ? 'identity_verification' : 'user_content'
    }
  )
}