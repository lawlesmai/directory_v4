'use client';

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Shield, 
  Download, 
  Printer, 
  Copy, 
  Check, 
  AlertTriangle,
  Lock,
  Eye,
  EyeOff,
  RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { GlassMorphism } from '@/components/GlassMorphism';
import { BackupCodesProps, BackupCodesData } from './types';

// Individual backup code display
const BackupCode: React.FC<{
  code: string;
  index: number;
  isRevealed: boolean;
  isUsed?: boolean;
}> = ({ code, index, isRevealed, isUsed = false }) => {
  const [copied, setCopied] = useState(false);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={cn(
        'group relative flex items-center justify-between',
        'px-4 py-3 rounded-lg transition-all duration-200',
        'bg-navy-dark/30 hover:bg-navy-dark/40',
        {
          'opacity-50 line-through': isUsed,
          'border border-sage/10 hover:border-sage/20': !isUsed
        }
      )}
    >
      <div className="flex items-center gap-3">
        <span className="text-xs text-sage/50 font-medium">
          #{String(index + 1).padStart(2, '0')}
        </span>
        <code className={cn(
          'font-mono text-sm tracking-wider',
          isRevealed ? 'text-cream' : 'text-sage/30',
          isUsed && 'text-sage/30'
        )}>
          {isRevealed ? code : '••••-••••-••••'}
        </code>
      </div>
      
      {!isUsed && isRevealed && (
        <button
          onClick={copyCode}
          className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-navy-dark/50 rounded transition-all"
          aria-label={`Copy code ${index + 1}`}
        >
          {copied ? (
            <Check className="w-3.5 h-3.5 text-teal-primary" />
          ) : (
            <Copy className="w-3.5 h-3.5 text-sage/50" />
          )}
        </button>
      )}
      
      {isUsed && (
        <span className="text-xs text-red-400">Used</span>
      )}
    </motion.div>
  );
};

export const BackupCodes: React.FC<BackupCodesProps> = ({
  codes,
  onConfirm,
  onDownload,
  onPrint,
  className = ''
}) => {
  const [isRevealed, setIsRevealed] = useState(false);
  const [hasDownloaded, setHasDownloaded] = useState(false);
  const [hasCopied, setHasCopied] = useState(false);
  const [allCopied, setAllCopied] = useState(false);
  const codesRef = useRef<HTMLDivElement>(null);

  // Copy all codes to clipboard
  const copyAllCodes = async () => {
    try {
      const codesText = codes.join('\n');
      await navigator.clipboard.writeText(codesText);
      setAllCopied(true);
      setHasCopied(true);
      setTimeout(() => setAllCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy codes:', err);
    }
  };

  // Download codes as text file
  const handleDownload = () => {
    const content = `Backup Recovery Codes - Lawless Directory
Generated: ${new Date().toLocaleString()}

IMPORTANT: Keep these codes in a safe place. Each code can only be used once.

${codes.map((code, i) => `${String(i + 1).padStart(2, '0')}. ${code}`).join('\n')}

Security Notice:
- Store these codes securely offline
- Do not share these codes with anyone
- Each code can only be used once
- Generate new codes if these are compromised`;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup-codes-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    setHasDownloaded(true);
    onDownload?.();
  };

  // Print codes
  const handlePrint = () => {
    if (!codesRef.current) return;
    
    const printContent = `
      <html>
        <head>
          <title>Backup Recovery Codes</title>
          <style>
            body { font-family: monospace; padding: 20px; }
            h1 { font-size: 18px; }
            .warning { color: red; margin: 20px 0; }
            .codes { margin: 20px 0; }
            .code { padding: 5px 0; }
          </style>
        </head>
        <body>
          <h1>Backup Recovery Codes - Lawless Directory</h1>
          <p>Generated: ${new Date().toLocaleString()}</p>
          <div class="warning">
            <strong>IMPORTANT:</strong> Keep these codes in a safe place. Each code can only be used once.
          </div>
          <div class="codes">
            ${codes.map((code, i) => 
              `<div class="code">${String(i + 1).padStart(2, '0')}. ${code}</div>`
            ).join('')}
          </div>
        </body>
      </html>
    `;
    
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();
    }
    
    onPrint?.();
  };

  // Check if user can confirm (has saved codes somehow)
  const canConfirm = hasDownloaded || hasCopied;

  return (
    <GlassMorphism
      variant="medium"
      className={cn('p-6 sm:p-8 max-w-lg mx-auto', className)}
      animated
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 bg-teal-primary/10 rounded-full mb-2">
            <Shield className="w-8 h-8 text-teal-primary" />
          </div>
          <h2 className="text-2xl font-bold text-cream">
            Backup Recovery Codes
          </h2>
          <p className="text-sage/70 text-sm">
            Save these codes in a secure place. You can use them to access your account if you lose your device.
          </p>
        </div>

        {/* Security Warning */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg"
        >
          <div className="flex gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-amber-200">
                Important Security Information
              </p>
              <ul className="text-xs text-amber-200/70 space-y-1 list-disc list-inside">
                <li>Each code can only be used once</li>
                <li>Store these codes offline in a secure location</li>
                <li>Never share these codes with anyone</li>
                <li>Generate new codes if these are compromised</li>
              </ul>
            </div>
          </div>
        </motion.div>

        {/* Codes Display */}
        <div ref={codesRef} className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-cream">
              Your Recovery Codes ({codes.length})
            </h3>
            <button
              onClick={() => setIsRevealed(!isRevealed)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-navy-dark/30 hover:bg-navy-dark/40 transition-colors"
              aria-label={isRevealed ? 'Hide codes' : 'Reveal codes'}
            >
              {isRevealed ? (
                <>
                  <EyeOff className="w-4 h-4 text-sage/50" />
                  <span className="text-xs text-sage/70">Hide</span>
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4 text-sage/50" />
                  <span className="text-xs text-sage/70">Reveal</span>
                </>
              )}
            </button>
          </div>

          <div className="grid gap-2 max-h-64 overflow-y-auto custom-scrollbar">
            {codes.map((code, index) => (
              <BackupCode
                key={`${code}-${index}`}
                code={code}
                index={index}
                isRevealed={isRevealed}
              />
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <div className="flex gap-3">
            <button
              onClick={copyAllCodes}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-sage/20 text-sage/70 hover:text-cream hover:border-sage/40 transition-colors"
            >
              {allCopied ? (
                <>
                  <Check className="w-4 h-4 text-teal-primary" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copy All</span>
                </>
              )}
            </button>
            
            <button
              onClick={handleDownload}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-sage/20 text-sage/70 hover:text-cream hover:border-sage/40 transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Download</span>
            </button>
            
            {onPrint && (
              <button
                onClick={handlePrint}
                className="flex items-center justify-center px-4 py-3 rounded-lg border border-sage/20 text-sage/70 hover:text-cream hover:border-sage/40 transition-colors"
                aria-label="Print codes"
              >
                <Printer className="w-4 h-4" />
              </button>
            )}
          </div>

          <button
            onClick={onConfirm}
            disabled={!canConfirm}
            className={cn(
              'w-full px-6 py-3 rounded-lg font-medium transition-all duration-200',
              'bg-gradient-to-r from-teal-primary to-teal-secondary text-cream',
              'hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]',
              'focus:outline-none focus:ring-2 focus:ring-teal-primary/50',
              'focus:ring-offset-2 focus:ring-offset-navy-dark',
              'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100'
            )}
          >
            <span className="flex items-center justify-center gap-2">
              <Lock className="w-4 h-4" />
              I've Saved My Codes
            </span>
          </button>
        </div>

        {/* Confirmation Status */}
        {!canConfirm && (
          <p className="text-center text-xs text-sage/50">
            Please save your codes before continuing
          </p>
        )}
      </div>
    </GlassMorphism>
  );
};

// Component for displaying remaining backup codes count
export const BackupCodesStatus: React.FC<{
  remaining: number;
  total: number;
  onGenerate?: () => void;
  className?: string;
}> = ({ remaining, total, onGenerate, className }) => {
  const percentage = (remaining / total) * 100;
  const isLow = remaining <= 3;
  const isEmpty = remaining === 0;

  return (
    <div className={cn('p-4 rounded-lg bg-navy-dark/30', className)}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-sage/50" />
          <span className="text-sm font-medium text-cream">Backup Codes</span>
        </div>
        {onGenerate && (
          <button
            onClick={onGenerate}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs text-teal-primary hover:text-teal-secondary transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            Generate New
          </button>
        )}
      </div>
      
      <div className="space-y-2">
        <div className="flex justify-between text-xs">
          <span className="text-sage/70">Remaining</span>
          <span className={cn(
            'font-medium',
            isEmpty ? 'text-red-400' : isLow ? 'text-amber-400' : 'text-cream'
          )}>
            {remaining} of {total}
          </span>
        </div>
        
        <div className="w-full h-2 bg-navy-dark/50 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            className={cn(
              'h-full rounded-full',
              isEmpty ? 'bg-red-500' : isLow ? 'bg-amber-500' : 'bg-teal-primary'
            )}
          />
        </div>
        
        {isLow && !isEmpty && (
          <p className="text-xs text-amber-400/70 mt-2">
            Running low on backup codes. Consider generating new ones.
          </p>
        )}
        
        {isEmpty && (
          <p className="text-xs text-red-400/70 mt-2">
            No backup codes remaining. Generate new codes immediately.
          </p>
        )}
      </div>
    </div>
  );
};

export default BackupCodes;