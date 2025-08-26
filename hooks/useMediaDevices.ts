'use client';

import { useState, useEffect, useCallback } from 'react';

export interface UseMediaDevicesReturn {
  hasCamera: boolean;
  hasMicrophone: boolean;
  isCheckingDevices: boolean;
  devices: MediaDeviceInfo[];
  permissionStatus: {
    camera: PermissionState | null;
    microphone: PermissionState | null;
  };
  requestCameraPermission: () => Promise<boolean>;
  requestMicrophonePermission: () => Promise<boolean>;
  checkDevicePermissions: () => Promise<void>;
}

export const useMediaDevices = (): UseMediaDevicesReturn => {
  const [hasCamera, setHasCamera] = useState(false);
  const [hasMicrophone, setHasMicrophone] = useState(false);
  const [isCheckingDevices, setIsCheckingDevices] = useState(true);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [permissionStatus, setPermissionStatus] = useState<{
    camera: PermissionState | null;
    microphone: PermissionState | null;
  }>({
    camera: null,
    microphone: null
  });

  const checkDevices = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) {
        console.warn('MediaDevices API not supported');
        return;
      }

      const deviceList = await navigator.mediaDevices.enumerateDevices();
      setDevices(deviceList);

      const videoDevices = deviceList.filter(device => device.kind === 'videoinput');
      const audioDevices = deviceList.filter(device => device.kind === 'audioinput');

      setHasCamera(videoDevices.length > 0);
      setHasMicrophone(audioDevices.length > 0);
    } catch (error) {
      console.error('Error checking media devices:', error);
    }
  }, []);

  const checkPermissions = useCallback(async () => {
    if (!navigator.permissions?.query) {
      console.warn('Permissions API not supported');
      return;
    }

    try {
      const [cameraPermission, microphonePermission] = await Promise.allSettled([
        navigator.permissions.query({ name: 'camera' as PermissionName }),
        navigator.permissions.query({ name: 'microphone' as PermissionName })
      ]);

      setPermissionStatus({
        camera: cameraPermission.status === 'fulfilled' ? cameraPermission.value.state : null,
        microphone: microphonePermission.status === 'fulfilled' ? microphonePermission.value.state : null
      });

      // Set up permission change listeners
      if (cameraPermission.status === 'fulfilled') {
        cameraPermission.value.addEventListener('change', () => {
          setPermissionStatus(prev => ({
            ...prev,
            camera: cameraPermission.value.state
          }));
        });
      }

      if (microphonePermission.status === 'fulfilled') {
        microphonePermission.value.addEventListener('change', () => {
          setPermissionStatus(prev => ({
            ...prev,
            microphone: microphonePermission.value.state
          }));
        });
      }
    } catch (error) {
      console.error('Error checking permissions:', error);
    }
  }, []);

  const checkDevicePermissions = useCallback(async () => {
    setIsCheckingDevices(true);
    await Promise.all([checkDevices(), checkPermissions()]);
    setIsCheckingDevices(false);
  }, [checkDevices, checkPermissions]);

  const requestCameraPermission = useCallback(async (): Promise<boolean> => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('getUserMedia not supported');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false
      });

      // Stop the stream immediately - we just wanted to request permission
      stream.getTracks().forEach(track => track.stop());

      // Update permission status
      await checkPermissions();
      
      return true;
    } catch (error) {
      console.error('Camera permission denied:', error);
      await checkPermissions();
      return false;
    }
  }, [checkPermissions]);

  const requestMicrophonePermission = useCallback(async (): Promise<boolean> => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('getUserMedia not supported');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: false,
        audio: true
      });

      // Stop the stream immediately - we just wanted to request permission
      stream.getTracks().forEach(track => track.stop());

      // Update permission status
      await checkPermissions();
      
      return true;
    } catch (error) {
      console.error('Microphone permission denied:', error);
      await checkPermissions();
      return false;
    }
  }, [checkPermissions]);

  // Initial device and permission check
  useEffect(() => {
    checkDevicePermissions();
  }, [checkDevicePermissions]);

  // Listen for device changes
  useEffect(() => {
    if (!navigator.mediaDevices?.addEventListener) {
      return;
    }

    const handleDeviceChange = () => {
      checkDevices();
    };

    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);

    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
    };
  }, [checkDevices]);

  return {
    hasCamera,
    hasMicrophone,
    isCheckingDevices,
    devices,
    permissionStatus,
    requestCameraPermission,
    requestMicrophonePermission,
    checkDevicePermissions
  };
};