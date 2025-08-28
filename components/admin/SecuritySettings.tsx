'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  Globe,
  Lock,
  Key,
  Clock,
  AlertTriangle,
  CheckCircle,
  Plus,
  X,
  Save,
  RefreshCw,
  Eye,
  EyeOff,
  Settings,
  Zap,
  Ban,
  UserCheck,
  Wifi,
  Server,
  Monitor
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { GlassMorphism } from '@/components/GlassMorphism';

interface IPWhitelistEntry {
  id: string;
  ipAddress: string;
  description: string;
  addedBy: string;
  addedAt: Date;
  isActive: boolean;
  lastUsed?: Date;
  usageCount: number;
}

interface SecuritySettingsProps {
  className?: string;
}

interface SecurityConfig {
  mfaRequired: boolean;
  sessionTimeout: number; // in minutes
  maxFailedAttempts: number;
  lockoutDuration: number; // in minutes
  requireTrustedDevices: boolean;
  ipWhitelistEnabled: boolean;
  vpnRequired: boolean;
  businessHoursOnly: boolean;
  businessHoursStart: string;
  businessHoursEnd: string;
  passwordMinLength: number;
  passwordRequireSpecialChars: boolean;
  passwordRequireNumbers: boolean;
  passwordRequireUppercase: boolean;
  auditLogRetentionDays: number;
  realTimeMonitoring: boolean;
  suspiciousActivityThreshold: number;
}

// Mock data
const mockIPWhitelist: IPWhitelistEntry[] = [
  {
    id: '1',
    ipAddress: '192.168.1.100',
    description: 'Main Office - San Francisco',
    addedBy: 'admin@lawlessdirectory.com',
    addedAt: new Date('2024-01-15'),
    isActive: true,
    lastUsed: new Date(Date.now() - 2 * 60 * 60 * 1000),
    usageCount: 1245
  },
  {
    id: '2',
    ipAddress: '203.0.113.45',
    description: 'Remote Office - New York',
    addedBy: 'admin@lawlessdirectory.com',
    addedAt: new Date('2024-02-10'),
    isActive: true,
    lastUsed: new Date(Date.now() - 45 * 60 * 1000),
    usageCount: 456
  },
  {
    id: '3',
    ipAddress: '198.51.100.23',
    description: 'Development Server',
    addedBy: 'platform@lawlessdirectory.com',
    addedAt: new Date('2024-03-05'),
    isActive: false,
    lastUsed: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    usageCount: 89
  }
];

const mockSecurityConfig: SecurityConfig = {
  mfaRequired: true,
  sessionTimeout: 30,
  maxFailedAttempts: 3,
  lockoutDuration: 15,
  requireTrustedDevices: false,
  ipWhitelistEnabled: true,
  vpnRequired: false,
  businessHoursOnly: false,
  businessHoursStart: '09:00',
  businessHoursEnd: '17:00',
  passwordMinLength: 12,
  passwordRequireSpecialChars: true,
  passwordRequireNumbers: true,
  passwordRequireUppercase: true,
  auditLogRetentionDays: 90,
  realTimeMonitoring: true,
  suspiciousActivityThreshold: 5
};

const formatTimeAgo = (date: Date): string => {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / (1000 * 60));
  
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
  return `${Math.floor(minutes / 1440)}d ago`;
};

const IPWhitelistCard: React.FC<{
  entry: IPWhitelistEntry;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (entry: IPWhitelistEntry) => void;
}> = ({ entry, onToggle, onDelete, onEdit }) => {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className={cn(
        'p-4 rounded-lg border transition-all duration-200',
        entry.isActive
          ? 'bg-teal-primary/5 border-teal-primary/20'
          : 'bg-navy-dark/30 border-sage/20 opacity-60'
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className={cn(
              'p-2 rounded-lg',
              entry.isActive ? 'bg-teal-primary/10' : 'bg-sage/10'
            )}>
              <Globe className={cn(
                'w-4 h-4',
                entry.isActive ? 'text-teal-primary' : 'text-sage/50'
              )} />
            </div>
            
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-cream font-mono">{entry.ipAddress}</h3>
                <span className={cn(
                  'px-2 py-1 rounded text-xs font-medium',
                  entry.isActive
                    ? 'bg-green-500/10 text-green-400'
                    : 'bg-sage/10 text-sage/60'
                )}>
                  {entry.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              <p className="text-sm text-sage/60 mt-1">{entry.description}</p>
              
              <div className="flex items-center gap-4 mt-2 text-xs text-sage/50">
                <span>Added by {entry.addedBy}</span>
                <span>•</span>
                <span>{formatTimeAgo(entry.addedAt)}</span>
                {entry.lastUsed && (
                  <>
                    <span>•</span>
                    <span>Last used {formatTimeAgo(entry.lastUsed)}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 ml-4">
          <div className="text-right text-sm">
            <p className="text-cream font-semibold">{entry.usageCount}</p>
            <p className="text-sage/50 text-xs">uses</p>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => onEdit(entry)}
              className="p-2 hover:bg-teal-primary/10 rounded-lg transition-colors"
              title="Edit"
            >
              <Settings className="w-4 h-4 text-sage/70 hover:text-teal-primary" />
            </button>
            
            <button
              onClick={() => onToggle(entry.id)}
              className={cn(
                'p-2 rounded-lg transition-colors',
                entry.isActive 
                  ? 'hover:bg-red-500/10 text-sage/70 hover:text-red-400'
                  : 'hover:bg-green-500/10 text-sage/70 hover:text-green-400'
              )}
              title={entry.isActive ? 'Deactivate' : 'Activate'}
            >
              {entry.isActive ? (
                <Ban className="w-4 h-4" />
              ) : (
                <CheckCircle className="w-4 h-4" />
              )}
            </button>
            
            <button
              onClick={() => onDelete(entry.id)}
              className="p-2 hover:bg-red-500/10 rounded-lg transition-colors"
              title="Delete"
            >
              <X className="w-4 h-4 text-sage/70 hover:text-red-400" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const AddIPModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onAdd: (entry: Omit<IPWhitelistEntry, 'id' | 'addedAt' | 'usageCount'>) => void;
}> = ({ isOpen, onClose, onAdd }) => {
  const [ipAddress, setIpAddress] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateIP = (ip: string): boolean => {
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipRegex.test(ip);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateIP(ipAddress) || !description.trim()) return;

    setIsSubmitting(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      onAdd({
        ipAddress: ipAddress.trim(),
        description: description.trim(),
        addedBy: 'admin@lawlessdirectory.com',
        isActive: true
      });
      
      setIpAddress('');
      setDescription('');
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-navy-dark/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="w-full max-w-md"
          onClick={(e) => e.stopPropagation()}
        >
          <GlassMorphism variant="medium" className="p-6">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-cream">Add IP to Whitelist</h2>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-sage/10 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-sage/70" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="ipAddress" className="block text-sm font-medium text-cream mb-2">
                    IP Address
                  </label>
                  <input
                    type="text"
                    id="ipAddress"
                    value={ipAddress}
                    onChange={(e) => setIpAddress(e.target.value)}
                    placeholder="192.168.1.100"
                    className="w-full px-4 py-3 bg-navy-dark/30 border border-sage/20 rounded-lg text-cream placeholder-sage/50 focus:outline-none focus:ring-2 focus:ring-teal-primary focus:border-transparent font-mono"
                    required
                  />
                  {ipAddress && !validateIP(ipAddress) && (
                    <p className="text-red-400 text-sm mt-1">Please enter a valid IP address</p>
                  )}
                </div>

                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-cream mb-2">
                    Description
                  </label>
                  <input
                    type="text"
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Main office, VPN endpoint, etc."
                    className="w-full px-4 py-3 bg-navy-dark/30 border border-sage/20 rounded-lg text-cream placeholder-sage/50 focus:outline-none focus:ring-2 focus:ring-teal-primary focus:border-transparent"
                    required
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 px-4 py-2 border border-sage/20 text-sage/70 rounded-lg hover:bg-sage/10 hover:text-cream transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!validateIP(ipAddress) || !description.trim() || isSubmitting}
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-teal-primary to-teal-secondary text-cream rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <div className="flex items-center justify-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Adding...
                      </div>
                    ) : (
                      'Add IP'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </GlassMorphism>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export const SecuritySettings: React.FC<SecuritySettingsProps> = ({
  className = ''
}) => {
  const [config, setConfig] = useState<SecurityConfig>(mockSecurityConfig);
  const [ipWhitelist, setIpWhitelist] = useState<IPWhitelistEntry[]>(mockIPWhitelist);
  const [showAddModal, setShowAddModal] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);

  const handleConfigChange = (key: keyof SecurityConfig, value: any) => {
    setConfig(prev => ({
      ...prev,
      [key]: value
    }));
    setHasChanges(true);
  };

  const handleSaveConfig = async () => {
    setIsSaving(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      setHasChanges(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleIP = (id: string) => {
    setIpWhitelist(prev => 
      prev.map(entry => 
        entry.id === id 
          ? { ...entry, isActive: !entry.isActive }
          : entry
      )
    );
  };

  const handleDeleteIP = (id: string) => {
    setIpWhitelist(prev => prev.filter(entry => entry.id !== id));
  };

  const handleEditIP = (entry: IPWhitelistEntry) => {
    // Implementation for editing IP entries
    console.log('Edit IP:', entry);
  };

  const handleAddIP = (newEntry: Omit<IPWhitelistEntry, 'id' | 'addedAt' | 'usageCount'>) => {
    const entry: IPWhitelistEntry = {
      ...newEntry,
      id: Date.now().toString(),
      addedAt: new Date(),
      usageCount: 0
    };
    
    setIpWhitelist(prev => [...prev, entry]);
  };

  const stats = {
    activeIPs: ipWhitelist.filter(ip => ip.isActive).length,
    totalIPs: ipWhitelist.length,
    totalUsage: ipWhitelist.reduce((sum, ip) => sum + ip.usageCount, 0)
  };

  return (
    <div className={cn('space-y-8', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-cream">Security Settings</h1>
          <p className="text-sage/70 mt-1">
            Configure admin portal security policies and IP whitelisting
          </p>
        </div>
        
        {hasChanges && (
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={handleSaveConfig}
            disabled={isSaving}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-teal-primary to-teal-secondary text-cream rounded-lg hover:shadow-lg transition-all disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Changes
              </>
            )}
          </motion.button>
        )}
      </div>

      {/* Authentication Settings */}
      <GlassMorphism variant="medium" className="p-6">
        <div className="space-y-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-red-500/10 rounded-lg">
              <Shield className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-cream">Authentication Settings</h2>
              <p className="text-sage/60">Configure MFA and session security</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* MFA Settings */}
            <div className="space-y-4">
              <label className="flex items-center justify-between">
                <div>
                  <span className="text-cream font-medium">Require MFA</span>
                  <p className="text-sm text-sage/60">Mandatory two-factor authentication</p>
                </div>
                <input
                  type="checkbox"
                  checked={config.mfaRequired}
                  onChange={(e) => handleConfigChange('mfaRequired', e.target.checked)}
                  className="w-5 h-5 text-teal-primary bg-navy-dark/30 border-sage/30 rounded focus:ring-teal-primary focus:ring-2"
                />
              </label>

              <div>
                <label className="block text-sm font-medium text-cream mb-2">
                  Session Timeout (minutes)
                </label>
                <select
                  value={config.sessionTimeout}
                  onChange={(e) => handleConfigChange('sessionTimeout', parseInt(e.target.value))}
                  className="w-full px-4 py-2 bg-navy-dark/30 border border-sage/20 rounded-lg text-cream focus:outline-none focus:ring-2 focus:ring-teal-primary"
                >
                  <option value={15}>15 minutes</option>
                  <option value={30}>30 minutes</option>
                  <option value={60}>1 hour</option>
                  <option value={120}>2 hours</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-cream mb-2">
                  Max Failed Attempts
                </label>
                <select
                  value={config.maxFailedAttempts}
                  onChange={(e) => handleConfigChange('maxFailedAttempts', parseInt(e.target.value))}
                  className="w-full px-4 py-2 bg-navy-dark/30 border border-sage/20 rounded-lg text-cream focus:outline-none focus:ring-2 focus:ring-teal-primary"
                >
                  <option value={3}>3 attempts</option>
                  <option value={5}>5 attempts</option>
                  <option value={10}>10 attempts</option>
                </select>
              </div>
            </div>

            {/* Access Control */}
            <div className="space-y-4">
              <label className="flex items-center justify-between">
                <div>
                  <span className="text-cream font-medium">Require Trusted Devices</span>
                  <p className="text-sm text-sage/60">Only allow previously trusted devices</p>
                </div>
                <input
                  type="checkbox"
                  checked={config.requireTrustedDevices}
                  onChange={(e) => handleConfigChange('requireTrustedDevices', e.target.checked)}
                  className="w-5 h-5 text-teal-primary bg-navy-dark/30 border-sage/30 rounded focus:ring-teal-primary focus:ring-2"
                />
              </label>

              <label className="flex items-center justify-between">
                <div>
                  <span className="text-cream font-medium">VPN Required</span>
                  <p className="text-sm text-sage/60">Require VPN connection for access</p>
                </div>
                <input
                  type="checkbox"
                  checked={config.vpnRequired}
                  onChange={(e) => handleConfigChange('vpnRequired', e.target.checked)}
                  className="w-5 h-5 text-teal-primary bg-navy-dark/30 border-sage/30 rounded focus:ring-teal-primary focus:ring-2"
                />
              </label>

              <label className="flex items-center justify-between">
                <div>
                  <span className="text-cream font-medium">Business Hours Only</span>
                  <p className="text-sm text-sage/60">Restrict access to business hours</p>
                </div>
                <input
                  type="checkbox"
                  checked={config.businessHoursOnly}
                  onChange={(e) => handleConfigChange('businessHoursOnly', e.target.checked)}
                  className="w-5 h-5 text-teal-primary bg-navy-dark/30 border-sage/30 rounded focus:ring-teal-primary focus:ring-2"
                />
              </label>

              {config.businessHoursOnly && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-cream mb-2">
                      Start Time
                    </label>
                    <input
                      type="time"
                      value={config.businessHoursStart}
                      onChange={(e) => handleConfigChange('businessHoursStart', e.target.value)}
                      className="w-full px-4 py-2 bg-navy-dark/30 border border-sage/20 rounded-lg text-cream focus:outline-none focus:ring-2 focus:ring-teal-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-cream mb-2">
                      End Time
                    </label>
                    <input
                      type="time"
                      value={config.businessHoursEnd}
                      onChange={(e) => handleConfigChange('businessHoursEnd', e.target.value)}
                      className="w-full px-4 py-2 bg-navy-dark/30 border border-sage/20 rounded-lg text-cream focus:outline-none focus:ring-2 focus:ring-teal-primary"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </GlassMorphism>

      {/* Password Policy */}
      <GlassMorphism variant="medium" className="p-6">
        <div className="space-y-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-500/10 rounded-lg">
                <Lock className="w-6 h-6 text-yellow-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-cream">Password Policy</h2>
                <p className="text-sage/60">Configure password requirements</p>
              </div>
            </div>
            
            <button
              onClick={() => setShowPasswords(!showPasswords)}
              className="flex items-center gap-2 px-3 py-2 text-sage/70 hover:text-cream transition-colors"
            >
              {showPasswords ? (
                <>
                  <EyeOff className="w-4 h-4" />
                  Hide Policy
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4" />
                  Show Policy
                </>
              )}
            </button>
          </div>

          <AnimatePresence>
            {showPasswords && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-cream mb-2">
                      Minimum Length
                    </label>
                    <select
                      value={config.passwordMinLength}
                      onChange={(e) => handleConfigChange('passwordMinLength', parseInt(e.target.value))}
                      className="w-full px-4 py-2 bg-navy-dark/30 border border-sage/20 rounded-lg text-cream focus:outline-none focus:ring-2 focus:ring-teal-primary"
                    >
                      <option value={8}>8 characters</option>
                      <option value={10}>10 characters</option>
                      <option value={12}>12 characters</option>
                      <option value={16}>16 characters</option>
                    </select>
                  </div>

                  <div className="space-y-3">
                    <label className="flex items-center justify-between">
                      <span className="text-cream">Require Special Characters</span>
                      <input
                        type="checkbox"
                        checked={config.passwordRequireSpecialChars}
                        onChange={(e) => handleConfigChange('passwordRequireSpecialChars', e.target.checked)}
                        className="w-4 h-4 text-teal-primary bg-navy-dark/30 border-sage/30 rounded focus:ring-teal-primary focus:ring-2"
                      />
                    </label>

                    <label className="flex items-center justify-between">
                      <span className="text-cream">Require Numbers</span>
                      <input
                        type="checkbox"
                        checked={config.passwordRequireNumbers}
                        onChange={(e) => handleConfigChange('passwordRequireNumbers', e.target.checked)}
                        className="w-4 h-4 text-teal-primary bg-navy-dark/30 border-sage/30 rounded focus:ring-teal-primary focus:ring-2"
                      />
                    </label>

                    <label className="flex items-center justify-between">
                      <span className="text-cream">Require Uppercase</span>
                      <input
                        type="checkbox"
                        checked={config.passwordRequireUppercase}
                        onChange={(e) => handleConfigChange('passwordRequireUppercase', e.target.checked)}
                        className="w-4 h-4 text-teal-primary bg-navy-dark/30 border-sage/30 rounded focus:ring-teal-primary focus:ring-2"
                      />
                    </label>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </GlassMorphism>

      {/* IP Whitelist */}
      <GlassMorphism variant="medium" className="p-6">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-teal-primary/10 rounded-lg">
                <Globe className="w-6 h-6 text-teal-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-cream">IP Whitelist</h2>
                <p className="text-sage/60">Manage allowed IP addresses for admin access</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={config.ipWhitelistEnabled}
                  onChange={(e) => handleConfigChange('ipWhitelistEnabled', e.target.checked)}
                  className="w-4 h-4 text-teal-primary bg-navy-dark/30 border-sage/30 rounded focus:ring-teal-primary focus:ring-2"
                />
                <span className="text-cream">Enable IP Whitelist</span>
              </label>
              
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-teal-primary to-teal-secondary text-cream rounded-lg hover:shadow-lg transition-all"
              >
                <Plus className="w-4 h-4" />
                Add IP
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-navy-dark/30 rounded-lg">
              <p className="text-2xl font-bold text-cream">{stats.activeIPs}</p>
              <p className="text-sm text-sage/60">Active IPs</p>
            </div>
            <div className="text-center p-4 bg-navy-dark/30 rounded-lg">
              <p className="text-2xl font-bold text-cream">{stats.totalIPs}</p>
              <p className="text-sm text-sage/60">Total IPs</p>
            </div>
            <div className="text-center p-4 bg-navy-dark/30 rounded-lg">
              <p className="text-2xl font-bold text-cream">{stats.totalUsage.toLocaleString()}</p>
              <p className="text-sm text-sage/60">Total Uses</p>
            </div>
          </div>

          {/* IP List */}
          <div className="space-y-3">
            <AnimatePresence>
              {ipWhitelist.length > 0 ? (
                ipWhitelist.map((entry) => (
                  <IPWhitelistCard
                    key={entry.id}
                    entry={entry}
                    onToggle={handleToggleIP}
                    onDelete={handleDeleteIP}
                    onEdit={handleEditIP}
                  />
                ))
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-8"
                >
                  <Globe className="w-12 h-12 text-sage/30 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-sage/70">No IPs whitelisted</h3>
                  <p className="text-sage/50 mt-1">
                    Add IP addresses to restrict admin access
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </GlassMorphism>

      {/* Monitoring Settings */}
      <GlassMorphism variant="medium" className="p-6">
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <Monitor className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-cream">Monitoring & Auditing</h2>
              <p className="text-sage/60">Configure security monitoring and audit settings</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <label className="flex items-center justify-between">
                <div>
                  <span className="text-cream font-medium">Real-time Monitoring</span>
                  <p className="text-sm text-sage/60">Monitor admin actions in real-time</p>
                </div>
                <input
                  type="checkbox"
                  checked={config.realTimeMonitoring}
                  onChange={(e) => handleConfigChange('realTimeMonitoring', e.target.checked)}
                  className="w-5 h-5 text-teal-primary bg-navy-dark/30 border-sage/30 rounded focus:ring-teal-primary focus:ring-2"
                />
              </label>

              <div>
                <label className="block text-sm font-medium text-cream mb-2">
                  Audit Log Retention (days)
                </label>
                <select
                  value={config.auditLogRetentionDays}
                  onChange={(e) => handleConfigChange('auditLogRetentionDays', parseInt(e.target.value))}
                  className="w-full px-4 py-2 bg-navy-dark/30 border border-sage/20 rounded-lg text-cream focus:outline-none focus:ring-2 focus:ring-teal-primary"
                >
                  <option value={30}>30 days</option>
                  <option value={90}>90 days</option>
                  <option value={180}>180 days</option>
                  <option value={365}>1 year</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-cream mb-2">
                Suspicious Activity Threshold
              </label>
              <select
                value={config.suspiciousActivityThreshold}
                onChange={(e) => handleConfigChange('suspiciousActivityThreshold', parseInt(e.target.value))}
                className="w-full px-4 py-2 bg-navy-dark/30 border border-sage/20 rounded-lg text-cream focus:outline-none focus:ring-2 focus:ring-teal-primary"
              >
                <option value={3}>3 actions/minute</option>
                <option value={5}>5 actions/minute</option>
                <option value={10}>10 actions/minute</option>
                <option value={20}>20 actions/minute</option>
              </select>
            </div>
          </div>
        </div>
      </GlassMorphism>

      <AddIPModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAddIP}
      />
    </div>
  );
};

export default SecuritySettings;