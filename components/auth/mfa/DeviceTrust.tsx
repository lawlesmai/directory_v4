'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Monitor, 
  Smartphone, 
  Tablet,
  Globe,
  MapPin,
  Calendar,
  Trash2,
  Shield,
  AlertTriangle,
  CheckCircle,
  Chrome,
  Safari,
  Firefox,
  Edge,
  MoreVertical
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { GlassMorphism } from '@/components/GlassMorphism';
import { DeviceTrustProps, TrustedDevice } from './types';

// Browser icon mapping
const BrowserIcon: React.FC<{ browser: string; className?: string }> = ({ browser, className }) => {
  const browserLower = browser.toLowerCase();
  
  if (browserLower.includes('chrome')) return <Chrome className={className} />;
  if (browserLower.includes('safari')) return <Safari className={className} />;
  if (browserLower.includes('firefox')) return <Firefox className={className} />;
  if (browserLower.includes('edge')) return <Edge className={className} />;
  
  return <Globe className={className} />;
};

// Device icon mapping
const DeviceIcon: React.FC<{ 
  deviceType: TrustedDevice['deviceType']; 
  className?: string 
}> = ({ deviceType, className }) => {
  switch (deviceType) {
    case 'mobile':
      return <Smartphone className={className} />;
    case 'tablet':
      return <Tablet className={className} />;
    case 'desktop':
    default:
      return <Monitor className={className} />;
  }
};

// Individual device card
const DeviceCard: React.FC<{
  device: TrustedDevice;
  onRevoke: (deviceId: string) => void;
  isRevoking?: boolean;
}> = ({ device, onRevoke, isRevoking = false }) => {
  const [showMenu, setShowMenu] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  const handleRevoke = () => {
    if (!confirmRevoke) {
      setConfirmRevoke(true);
      setTimeout(() => setConfirmRevoke(false), 3000); // Reset after 3 seconds
    } else {
      onRevoke(device.id);
      setConfirmRevoke(false);
    }
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const getDeviceStatus = () => {
    const now = new Date();
    const lastUsed = new Date(device.lastUsed);
    const hoursSinceLastUse = (now.getTime() - lastUsed.getTime()) / (1000 * 60 * 60);
    
    if (device.isCurrentDevice) return 'current';
    if (hoursSinceLastUse < 24) return 'active';
    if (hoursSinceLastUse < 168) return 'recent'; // 7 days
    return 'inactive';
  };

  const status = getDeviceStatus();

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className={cn(
        'relative p-4 rounded-lg transition-all duration-200',
        'bg-navy-dark/30 hover:bg-navy-dark/40',
        'border border-sage/10 hover:border-sage/20',
        {
          'ring-2 ring-teal-primary/30': device.isCurrentDevice,
          'opacity-50': isRevoking
        }
      )}
    >
      {/* Current Device Badge */}
      {device.isCurrentDevice && (
        <div className="absolute -top-2 -right-2 px-2 py-0.5 bg-teal-primary rounded-full">
          <span className="text-xs font-medium text-navy-dark">Current</span>
        </div>
      )}

      <div className="flex items-start justify-between gap-4">
        {/* Device Info */}
        <div className="flex gap-3 flex-1">
          <div className={cn(
            'p-2.5 rounded-lg',
            status === 'current' ? 'bg-teal-primary/10' : 'bg-navy-dark/50'
          )}>
            <DeviceIcon 
              deviceType={device.deviceType} 
              className={cn(
                'w-5 h-5',
                status === 'current' ? 'text-teal-primary' : 'text-sage/50'
              )}
            />
          </div>
          
          <div className="flex-1 space-y-2">
            <div>
              <h4 className="font-medium text-cream">
                {device.name}
              </h4>
              <div className="flex items-center gap-2 mt-1">
                <BrowserIcon browser={device.browser} className="w-3.5 h-3.5 text-sage/50" />
                <span className="text-xs text-sage/60">
                  {device.browser} • {device.os}
                </span>
              </div>
            </div>
            
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs text-sage/50">
                <MapPin className="w-3 h-3" />
                <span>{device.ipAddress}</span>
              </div>
              
              <div className="flex items-center gap-2 text-xs text-sage/50">
                <Calendar className="w-3 h-3" />
                <span>
                  Last used: {formatDate(device.lastUsed)}
                </span>
              </div>
              
              <div className="flex items-center gap-2 text-xs text-sage/50">
                <Shield className="w-3 h-3" />
                <span>
                  Trusted: {formatDate(device.trustedAt)}
                </span>
              </div>
            </div>

            {/* Status Indicator */}
            <div className="flex items-center gap-2">
              {status === 'current' && (
                <span className="flex items-center gap-1 text-xs text-teal-primary">
                  <CheckCircle className="w-3 h-3" />
                  Active now
                </span>
              )}
              {status === 'active' && (
                <span className="flex items-center gap-1 text-xs text-green-400">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  Recently active
                </span>
              )}
              {status === 'inactive' && (
                <span className="text-xs text-sage/40">
                  Inactive
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        {!device.isCurrentDevice && (
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 hover:bg-navy-dark/50 rounded-lg transition-colors"
              aria-label="Device options"
            >
              <MoreVertical className="w-4 h-4 text-sage/50" />
            </button>
            
            <AnimatePresence>
              {showMenu && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="absolute top-full right-0 mt-1 w-40 py-1 bg-navy-dark border border-sage/20 rounded-lg shadow-xl z-10"
                >
                  <button
                    onClick={handleRevoke}
                    disabled={isRevoking}
                    className={cn(
                      'w-full px-3 py-2 text-left text-sm transition-colors',
                      confirmRevoke 
                        ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20' 
                        : 'text-sage/70 hover:text-cream hover:bg-navy-dark/50'
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <Trash2 className="w-3.5 h-3.5" />
                      {confirmRevoke ? 'Confirm Revoke' : 'Revoke Access'}
                    </span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export const DeviceTrust: React.FC<DeviceTrustProps> = ({
  devices,
  onRevoke,
  onRevokeAll,
  currentDeviceId,
  className = ''
}) => {
  const [isRevokingAll, setIsRevokingAll] = useState(false);
  const [confirmRevokeAll, setConfirmRevokeAll] = useState(false);
  const [revokingDevices, setRevokingDevices] = useState<Set<string>>(new Set());

  // Sort devices: current first, then by last used
  const sortedDevices = [...devices].sort((a, b) => {
    if (a.isCurrentDevice) return -1;
    if (b.isCurrentDevice) return 1;
    return new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime();
  });

  const handleRevoke = async (deviceId: string) => {
    setRevokingDevices(prev => new Set(prev).add(deviceId));
    
    try {
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      onRevoke(deviceId);
    } finally {
      setRevokingDevices(prev => {
        const next = new Set(prev);
        next.delete(deviceId);
        return next;
      });
    }
  };

  const handleRevokeAll = async () => {
    if (!confirmRevokeAll) {
      setConfirmRevokeAll(true);
      setTimeout(() => setConfirmRevokeAll(false), 3000);
      return;
    }

    setIsRevokingAll(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate API call
      onRevokeAll?.();
      setConfirmRevokeAll(false);
    } finally {
      setIsRevokingAll(false);
    }
  };

  const otherDevicesCount = devices.filter(d => !d.isCurrentDevice).length;

  return (
    <GlassMorphism
      variant="medium"
      className={cn('p-6 sm:p-8 max-w-2xl mx-auto', className)}
      animated
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-cream">
              Trusted Devices
            </h2>
            <p className="text-sm text-sage/70">
              Manage devices that can access your account without MFA
            </p>
          </div>
          
          {onRevokeAll && otherDevicesCount > 0 && (
            <button
              onClick={handleRevokeAll}
              disabled={isRevokingAll}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200',
                confirmRevokeAll
                  ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                  : 'text-sage/70 hover:text-cream border border-sage/20 hover:border-sage/40'
              )}
            >
              {confirmRevokeAll ? 'Confirm' : 'Revoke All'}
            </button>
          )}
        </div>

        {/* Security Notice */}
        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
          <div className="flex gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm text-amber-200">
                Security Recommendation
              </p>
              <p className="text-xs text-amber-200/70">
                Regularly review and remove devices you no longer use. 
                Trusted devices bypass MFA for 30 days.
              </p>
            </div>
          </div>
        </div>

        {/* Device List */}
        {devices.length === 0 ? (
          <div className="text-center py-12">
            <div className="inline-flex p-3 bg-navy-dark/30 rounded-full mb-4">
              <Shield className="w-8 h-8 text-sage/30" />
            </div>
            <p className="text-sage/70">No trusted devices</p>
            <p className="text-sm text-sage/50 mt-1">
              Devices you trust will appear here
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {sortedDevices.map(device => (
                <DeviceCard
                  key={device.id}
                  device={device}
                  onRevoke={handleRevoke}
                  isRevoking={revokingDevices.has(device.id)}
                />
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Summary */}
        {devices.length > 0 && (
          <div className="pt-4 border-t border-sage/10">
            <div className="flex items-center justify-between text-sm">
              <span className="text-sage/60">
                Total trusted devices
              </span>
              <span className="font-medium text-cream">
                {devices.length} {devices.length === 1 ? 'device' : 'devices'}
              </span>
            </div>
            {otherDevicesCount > 0 && (
              <div className="flex items-center justify-between text-sm mt-2">
                <span className="text-sage/60">
                  Other devices
                </span>
                <span className="text-sage/70">
                  {otherDevicesCount}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </GlassMorphism>
  );
};

export default DeviceTrust;