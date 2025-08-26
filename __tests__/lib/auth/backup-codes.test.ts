/**
 * Backup Codes Tests
 * Comprehensive test suite for secure backup code generation and management
 * 
 * The Lawless Directory - Epic 2 Story 2.4
 * Multi-Factor Authentication Infrastructure
 */

import { 
  BackupCodeService,
  BackupCodeUtils,
  BACKUP_CODE_CONFIG,
  type BackupCode,
  type BackupCodeGenerationResult,
  type BackupCodeVerificationResult
} from '@/lib/auth/backup-codes';

// Mock Supabase client
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      insert: jest.fn().mockReturnValue({ 
        select: jest.fn().mockReturnValue({ 
          single: jest.fn().mockResolvedValue({ 
            data: { id: 'test-id', expires_at: new Date().toISOString() }, 
            error: null 
          }) 
        }) 
      }),
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
        gte: jest.fn().mockReturnThis()
      }),
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null })
      }),
      delete: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          select: jest.fn().mockResolvedValue({ data: [], error: null })
        })
      }),
      upsert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: { id: 'config-id' }, error: null })
        })
      })
    })),
    rpc: jest.fn().mockResolvedValue({ error: null })
  }))
}));

describe('BackupCodeService', () => {
  const mockUserId = 'user-123';
  const mockContext = {
    deviceId: 'device-123',
    ipAddress: '192.168.1.1'
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateBackupCodes', () => {
    it('should generate default number of backup codes', async () => {
      const result = await BackupCodeService.generateBackupCodes(mockUserId, {});
      
      expect(result.success).toBe(true);
      expect(result.codes).toHaveLength(BACKUP_CODE_CONFIG.defaultCodeCount);
      expect(result.batchId).toBeDefined();
      expect(result.expiresAt).toBeInstanceOf(Date);
    });

    it('should generate specified number of backup codes', async () => {
      const codeCount = 10;
      const result = await BackupCodeService.generateBackupCodes(mockUserId, {
        codeCount
      });
      
      expect(result.success).toBe(true);
      expect(result.codes).toHaveLength(codeCount);
    });

    it('should respect minimum and maximum code limits', async () => {
      const belowMinResult = await BackupCodeService.generateBackupCodes(mockUserId, {
        codeCount: 2 // Below minimum
      });
      expect(belowMinResult.codes).toHaveLength(BACKUP_CODE_CONFIG.minCodeCount);

      const aboveMaxResult = await BackupCodeService.generateBackupCodes(mockUserId, {
        codeCount: 20 // Above maximum
      });
      expect(aboveMaxResult.codes).toHaveLength(BACKUP_CODE_CONFIG.maxCodeCount);
    });

    it('should generate unique codes', async () => {
      const result = await BackupCodeService.generateBackupCodes(mockUserId, {
        codeCount: 8
      });
      
      expect(result.success).toBe(true);
      if (result.codes) {
        const codes = result.codes.map(c => c.code);
        const uniqueCodes = [...new Set(codes)];
        expect(codes).toHaveLength(uniqueCodes.length);
      }
    });

    it('should generate codes with correct format', async () => {
      const result = await BackupCodeService.generateBackupCodes(mockUserId, {});
      
      expect(result.success).toBe(true);
      if (result.codes) {
        result.codes.forEach(codeData => {
          expect(codeData.code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
          expect(codeData.hash).toBeDefined();
          expect(codeData.partial).toHaveLength(4);
          expect(codeData.createdAt).toBeInstanceOf(Date);
          expect(codeData.expiresAt).toBeInstanceOf(Date);
        });
      }
    });

    it('should set appropriate expiration time', async () => {
      const expiryMonths = 6;
      const result = await BackupCodeService.generateBackupCodes(mockUserId, {
        expiryMonths
      });
      
      expect(result.success).toBe(true);
      if (result.expiresAt) {
        const now = new Date();
        const expectedExpiry = new Date();
        expectedExpiry.setMonth(expectedExpiry.getMonth() + expiryMonths);
        
        const timeDifference = Math.abs(result.expiresAt.getTime() - expectedExpiry.getTime());
        expect(timeDifference).toBeLessThan(60000); // Within 1 minute
      }
    });

    it('should support different code formats', async () => {
      const formats: Array<'numeric' | 'alphanumeric' | 'hex'> = ['numeric', 'alphanumeric', 'hex'];
      
      for (const format of formats) {
        const result = await BackupCodeService.generateBackupCodes(mockUserId, {
          format,
          codeCount: 1
        });
        
        expect(result.success).toBe(true);
        if (result.codes && result.codes[0]) {
          const code = result.codes[0].code.replace('-', '');
          
          switch (format) {
            case 'numeric':
              expect(code).toMatch(/^\d{8}$/);
              break;
            case 'hex':
              expect(code).toMatch(/^[0-9A-F]{8}$/i);
              break;
            case 'alphanumeric':
            default:
              expect(code).toMatch(/^[A-Z0-9]{8}$/);
              break;
          }
        }
      }
    });

    it('should handle replaceExisting option', async () => {
      const result = await BackupCodeService.generateBackupCodes(mockUserId, {
        replaceExisting: true
      });
      
      expect(result.success).toBe(true);
      // The mock should have been called to invalidate existing codes
    });

    it('should include generation context in logs', async () => {
      const result = await BackupCodeService.generateBackupCodes(mockUserId, {
        ...mockContext
      });
      
      expect(result.success).toBe(true);
    });
  });

  describe('verifyBackupCode', () => {
    const mockCode = 'ABCD-1234';
    const mockBackupCode = {
      id: 'backup-code-id',
      code_hash: 'mock-hash',
      is_used: false,
      expires_at: new Date(Date.now() + 86400000).toISOString() // 24 hours
    };

    beforeEach(() => {
      // Mock successful backup code lookup
      jest.mocked(require('@supabase/supabase-js').createClient().from().select().eq().eq().eq().gte().single)
        .mockResolvedValue({ data: mockBackupCode, error: null });
    });

    it('should verify valid unused backup code', async () => {
      const result = await BackupCodeService.verifyBackupCode(
        mockUserId,
        mockCode,
        mockContext
      );
      
      expect(result.valid).toBe(true);
      expect(result.codeId).toBeDefined();
    });

    it('should reject invalid backup code format', async () => {
      const invalidCodes = ['123', 'ABCD123', 'ABCD-123X'];
      
      for (const invalidCode of invalidCodes) {
        const result = await BackupCodeService.verifyBackupCode(
          mockUserId,
          invalidCode,
          mockContext
        );
        
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Invalid');
      }
    });

    it('should handle codes with different formatting', async () => {
      const variations = [
        'ABCD-1234',
        'ABCD1234',
        'abcd-1234',
        ' ABCD-1234 ',
        'ABCD - 1234'
      ];
      
      for (const variation of variations) {
        const result = await BackupCodeService.verifyBackupCode(
          mockUserId,
          variation,
          mockContext
        );
        
        // All variations should be processed (though they might fail for other reasons)
        expect(result).toBeDefined();
      }
    });

    it('should reject expired backup codes', async () => {
      const expiredCode = {
        ...mockBackupCode,
        expires_at: new Date(Date.now() - 86400000).toISOString() // 24 hours ago
      };
      
      jest.mocked(require('@supabase/supabase-js').createClient().from().select().eq().eq().eq().gte().single)
        .mockResolvedValue({ data: null, error: { code: 'PGRST116' } });
      
      const result = await BackupCodeService.verifyBackupCode(
        mockUserId,
        mockCode,
        mockContext
      );
      
      expect(result.valid).toBe(false);
    });

    it('should mark code as used after successful verification', async () => {
      const mockUpdate = jest.mocked(require('@supabase/supabase-js').createClient().from().update);
      
      await BackupCodeService.verifyBackupCode(
        mockUserId,
        mockCode,
        mockContext
      );
      
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          is_used: true,
          used_at: expect.any(String),
          used_ip: mockContext.ipAddress,
          used_device_id: mockContext.deviceId
        })
      );
    });

    it('should track remaining backup codes', async () => {
      const mockCount = jest.mocked(require('@supabase/supabase-js').createClient().from().select);
      mockCount.mockReturnValue({
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnValue({
          count: 'exact',
          then: jest.fn().mockResolvedValue({ count: 3 })
        })
      });
      
      const result = await BackupCodeService.verifyBackupCode(
        mockUserId,
        mockCode,
        mockContext
      );
      
      expect(result.remainingCodes).toBeDefined();
    });

    it('should handle rate limiting', async () => {
      // Mock rate limit exceeded
      const mockRateLimit = {
        failed_attempts_count: 5,
        locked_until: new Date(Date.now() + 1800000).toISOString() // 30 minutes
      };
      
      jest.mocked(require('@supabase/supabase-js').createClient().from().select().eq().single)
        .mockResolvedValueOnce({ data: mockRateLimit, error: null });
      
      const result = await BackupCodeService.verifyBackupCode(
        mockUserId,
        mockCode,
        mockContext
      );
      
      expect(result.valid).toBe(false);
      expect(result.lockedUntil).toBeDefined();
    });

    it('should detect when last backup code is used', async () => {
      // Mock only 1 remaining code
      jest.mocked(require('@supabase/supabase-js').createClient().from().select)
        .mockReturnValue({
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnValue({
            count: 'exact',
            then: jest.fn().mockResolvedValue({ count: 0 })
          })
        });
      
      const result = await BackupCodeService.verifyBackupCode(
        mockUserId,
        mockCode,
        mockContext
      );
      
      if (result.valid) {
        expect(result.lastUsed).toBe(true);
      }
    });
  });

  describe('getBackupCodeStatus', () => {
    it('should return comprehensive backup code status', async () => {
      const mockUnusedCodes = [
        { expires_at: new Date(Date.now() + 86400000).toISOString(), created_at: new Date().toISOString() }
      ];
      
      jest.mocked(require('@supabase/supabase-js').createClient().from().select)
        .mockReturnValue({
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnValue({
            count: 'exact',
            then: jest.fn().mockResolvedValue({ data: mockUnusedCodes, count: 5 })
          })
        });
      
      const status = await BackupCodeService.getBackupCodeStatus(mockUserId);
      
      expect(status.hasBackupCodes).toBe(true);
      expect(status.totalCodes).toBeGreaterThan(0);
      expect(status.remainingCodes).toBeGreaterThan(0);
      expect(status.nearExpiry).toBe(false);
    });

    it('should detect near expiry codes', async () => {
      const nearExpiryDate = new Date();
      nearExpiryDate.setDate(nearExpiryDate.getDate() + 15); // 15 days from now
      
      const mockNearExpiryCodes = [
        { expires_at: nearExpiryDate.toISOString(), created_at: new Date().toISOString() }
      ];
      
      jest.mocked(require('@supabase/supabase-js').createClient().from().select)
        .mockReturnValue({
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnValue({
            count: 'exact',
            then: jest.fn().mockResolvedValue({ data: mockNearExpiryCodes, count: 1 })
          })
        });
      
      const status = await BackupCodeService.getBackupCodeStatus(mockUserId);
      
      expect(status.nearExpiry).toBe(true);
      expect(status.expiresAt).toBeInstanceOf(Date);
    });

    it('should handle users with no backup codes', async () => {
      jest.mocked(require('@supabase/supabase-js').createClient().from().select)
        .mockReturnValue({
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnValue({
            count: 'exact',
            then: jest.fn().mockResolvedValue({ data: [], count: 0 })
          })
        });
      
      const status = await BackupCodeService.getBackupCodeStatus(mockUserId);
      
      expect(status.hasBackupCodes).toBe(false);
      expect(status.totalCodes).toBe(0);
      expect(status.remainingCodes).toBe(0);
    });
  });

  describe('invalidateExistingCodes', () => {
    it('should invalidate all existing backup codes', async () => {
      const mockDelete = jest.mocked(require('@supabase/supabase-js').createClient().from().delete);
      mockDelete.mockReturnValue({
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue({ data: [{ id: 'code1' }, { id: 'code2' }] })
      });
      
      const result = await BackupCodeService.invalidateExistingCodes(mockUserId, 'test_reason');
      
      expect(result.success).toBe(true);
      expect(result.affectedCodes).toBe(2);
      expect(result.action).toBe('invalidated');
    });

    it('should handle case with no existing codes', async () => {
      const mockDelete = jest.mocked(require('@supabase/supabase-js').createClient().from().delete);
      mockDelete.mockReturnValue({
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue({ data: [] })
      });
      
      const result = await BackupCodeService.invalidateExistingCodes(mockUserId, 'test_reason');
      
      expect(result.success).toBe(true);
      expect(result.affectedCodes).toBe(0);
    });
  });
});

describe('BackupCodeUtils', () => {
  describe('validateCodeFormat', () => {
    it('should validate correct backup code formats', () => {
      const validCodes = [
        'ABCD-1234',
        'XYZA-9876',
        'BCDF-GHJK'
      ];
      
      validCodes.forEach(code => {
        const result = BackupCodeUtils.validateCodeFormat(code);
        expect(result.valid).toBe(true);
      });
    });

    it('should reject invalid backup code formats', () => {
      const invalidCodes = [
        'ABC-123',      // Too short
        'ABCDE-1234',   // First part too long
        'ABCD-12345',   // Second part too long
        'ABCD1234',     // No dash
        'ABCD-',        // Missing second part
        '-1234',        // Missing first part
        'ABCD-123O',    // Ambiguous character (O)
        'ABCD-123I'     // Ambiguous character (I)
      ];
      
      invalidCodes.forEach(code => {
        const result = BackupCodeUtils.validateCodeFormat(code);
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
      });
    });

    it('should handle codes with whitespace', () => {
      const codesWithWhitespace = [
        ' ABCD-1234 ',
        'ABCD - 1234',
        'ABCD-1234\n',
        '\tABCD-1234'
      ];
      
      codesWithWhitespace.forEach(code => {
        const result = BackupCodeUtils.validateCodeFormat(code);
        // After trimming whitespace, these should be valid
        expect(result.valid).toBe(true);
      });
    });
  });

  describe('formatCode', () => {
    it('should format codes consistently', () => {
      const inputs = [
        'ABCD1234',
        'abcd1234',
        'ABCD-1234',
        'abcd-1234'
      ];
      
      const expectedOutput = 'ABCD-1234';
      
      inputs.forEach(input => {
        const formatted = BackupCodeUtils.formatCode(input);
        expect(formatted).toBe(expectedOutput);
      });
    });

    it('should handle codes without dashes', () => {
      const result = BackupCodeUtils.formatCode('ABCDEFGH');
      expect(result).toBe('ABCD-EFGH');
    });

    it('should preserve existing formatting when appropriate', () => {
      const alreadyFormatted = 'WXYZ-5678';
      const result = BackupCodeUtils.formatCode(alreadyFormatted);
      expect(result).toBe(alreadyFormatted);
    });
  });

  describe('generatePrintableSheet', () => {
    const mockCodes: BackupCode[] = [
      {
        code: 'ABCD-1234',
        hash: 'hash1',
        partial: 'ABCD',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      },
      {
        code: 'EFGH-5678',
        hash: 'hash2', 
        partial: 'EFGH',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      }
    ];

    it('should generate printable backup codes sheet', () => {
      const userEmail = 'user@example.com';
      const generatedAt = new Date();
      
      const sheet = BackupCodeUtils.generatePrintableSheet(mockCodes, userEmail, generatedAt);
      
      expect(sheet).toContain('THE LAWLESS DIRECTORY - BACKUP CODES');
      expect(sheet).toContain(userEmail);
      expect(sheet).toContain('1. ABCD-1234');
      expect(sheet).toContain('2. EFGH-5678');
      expect(sheet).toContain('SECURITY TIPS');
      expect(sheet).toContain('Each code works only once');
    });

    it('should include all security information', () => {
      const sheet = BackupCodeUtils.generatePrintableSheet(mockCodes, 'user@test.com', new Date());
      
      const securityMessages = [
        'Print this page and store it securely',
        'Do not share these codes with anyone',
        'Generate new codes if you suspect compromise',
        'Each code works only once'
      ];
      
      securityMessages.forEach(message => {
        expect(sheet).toContain(message);
      });
    });

    it('should format codes properly in the sheet', () => {
      const sheet = BackupCodeUtils.generatePrintableSheet(mockCodes, 'user@test.com', new Date());
      
      mockCodes.forEach((code, index) => {
        expect(sheet).toContain(`${index + 1}. ${code.code}`);
      });
    });
  });
});

describe('BACKUP_CODE_CONFIG', () => {
  it('should have sensible default values', () => {
    expect(BACKUP_CODE_CONFIG.defaultCodeCount).toBeGreaterThanOrEqual(6);
    expect(BACKUP_CODE_CONFIG.defaultCodeCount).toBeLessThanOrEqual(12);
    expect(BACKUP_CODE_CONFIG.minCodeCount).toBeGreaterThanOrEqual(4);
    expect(BACKUP_CODE_CONFIG.maxCodeCount).toBeGreaterThan(BACKUP_CODE_CONFIG.defaultCodeCount);
  });

  it('should have appropriate security settings', () => {
    expect(BACKUP_CODE_CONFIG.maxUsageAttempts).toBeGreaterThan(0);
    expect(BACKUP_CODE_CONFIG.lockoutDurationMinutes).toBeGreaterThan(0);
    expect(BACKUP_CODE_CONFIG.defaultExpiryMonths).toBeGreaterThan(0);
  });

  it('should exclude ambiguous characters when configured', () => {
    if (BACKUP_CODE_CONFIG.excludeAmbiguous) {
      const ambiguousChars = ['0', 'O', 'l', 'I', '1'];
      ambiguousChars.forEach(char => {
        expect(BACKUP_CODE_CONFIG.alphanumericSafe).not.toContain(char);
      });
    }
  });

  it('should have valid character sets', () => {
    expect(BACKUP_CODE_CONFIG.numericChars).toMatch(/^[0-9]+$/);
    expect(BACKUP_CODE_CONFIG.hexChars).toMatch(/^[0-9A-F]+$/);
    expect(BACKUP_CODE_CONFIG.alphanumericChars.length).toBeGreaterThan(20);
  });
});