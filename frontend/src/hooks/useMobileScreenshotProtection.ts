import { useEffect } from 'react';

/**
 * Enhanced mobile-specific screenshot protection
 * Implements multiple layers of protection for Android and iOS
 */
export const useMobileScreenshotProtection = (
  onScreenshotAttempt?: () => void,
  enabled: boolean = true
) => {
  useEffect(() => {
    if (!enabled) return;

    // Detect if running in Cordova/Capacitor environment
    const isCordovaApp = !!(window as any).cordova;
    
    // Set FLAG_SECURE on Android (requires Cordova plugin)
    if (isCordovaApp && (window as any).cordova?.plugins?.screenFlag) {
      try {
        (window as any).cordova.plugins.screenFlag.setSecure();
        console.log('FLAG_SECURE enabled for Android');
      } catch (e) {
        console.log('Cordova screen flag not available');
      }
    }

    // Disable screenshots by preventing canvas access
    const blockCanvasAccess = () => {
      const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
      const originalToBlob = HTMLCanvasElement.prototype.toBlob;
      
      HTMLCanvasElement.prototype.toDataURL = function() {
        if ((this as any).screenCaptureBlocked) {
          throw new DOMException('Canvas blocked for privacy', 'NotAllowedError');
        }
        return originalToDataURL.call(this);
      } as any;
      
      HTMLCanvasElement.prototype.toBlob = function(callback: BlobCallback) {
        if ((this as any).screenCaptureBlocked) {
          const error = new DOMException('Canvas blocked for privacy', 'NotAllowedError');
          throw error;
        }
        return originalToBlob.call(this, callback);
      } as any;
    };

    try {
      blockCanvasAccess();
    } catch (e) {
      console.log('Canvas access blocking initiated');
    }

    // Detect if device is in accessibility mode or has zoom enabled (common screenshot technique)
    const detectAccessibilityMode = () => {
      // Check for zoom level changes
      const checkZoom = () => {
        const zoomLevel = window.devicePixelRatio;
        if (zoomLevel > 1.2) {
          onScreenshotAttempt?.();
          setMobileBlur();
        }
      };
      
      window.addEventListener('devicepixelratiochange', checkZoom);
      return () => window.removeEventListener('devicepixelratiochange', checkZoom);
    };

    detectAccessibilityMode();

    // Detect accelerometer/gyroscope changes that might indicate screenshot gesture
    let lastAcceleration = { x: 0, y: 0, z: 0 };
    const handleDeviceMotion = (event: DeviceMotionEvent) => {
      if (!event.acceleration) return;
      
      const accel = event.acceleration;
      const threshold = 2.5;
      
      // Detect rapid combination of volume and home button press (various Android patterns)
      const deltaX = Math.abs((accel.x || 0) - lastAcceleration.x);
      const deltaY = Math.abs((accel.y || 0) - lastAcceleration.y);
      const deltaZ = Math.abs((accel.z || 0) - lastAcceleration.z);
      
      if ((deltaX > threshold && deltaY > threshold) || (deltaY > threshold && deltaZ > threshold)) {
        onScreenshotAttempt?.();
        setMobileBlur();
      }
      
      lastAcceleration = { x: accel.x || 0, y: accel.y || 0, z: accel.z || 0 };
    };

    // Request permission for accelerometer on iOS 13+
    if ((window as any).DeviceMotionEvent?.requestPermission) {
      (window as any).DeviceMotionEvent.requestPermission()
        .then((state: string) => {
          if (state === 'granted') {
            window.addEventListener('devicemotion', handleDeviceMotion);
          }
        })
        .catch((err: Error) => console.log('Accelerometer permission denied:', err));
    } else {
      // For older devices and Android
      window.addEventListener('devicemotion', handleDeviceMotion);
    }

    // Detect orientation changes (common screenshot moment)
    const handleOrientationChange = () => {
      setMobileBlur();
      // Blur for 2 seconds during orientation change
      setTimeout(() => {
        if (document.documentElement.classList.contains('mobile-screen-blur')) {
          document.documentElement.classList.remove('mobile-screen-blur');
        }
      }, 2000);
    };
    
    window.addEventListener('orientationchange', handleOrientationChange);
    window.addEventListener('deviceorientation', (event: any) => {
      // Detect if device is flat (common screenshot position)
      if (Math.abs(event.beta) < 30 && Math.abs(event.gamma) < 30) {
        // Device is nearly flat - potential screenshot position
        onScreenshotAttempt?.();
        setMobileBlur();
      }
    });

    // Detect if volume buttons are pressed (Android screenshot trigger)
    const volumeButtonDetected = (e: KeyboardEvent) => {
      if (e.key === 'AudioVolumeUp' || e.key === 'AudioVolumeDown') {
        console.warn('Volume button detected - potential screenshot');
        onScreenshotAttempt?.();
        setMobileBlur();
      }
    };
    document.addEventListener('keydown', volumeButtonDetected);

    // Detect screenshot via visual registration (canvas fingerprint)
    const setupCanvasProtection = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Create a unique blend mode detection
      ctx.fillStyle = 'rgb(102, 204, 0)';
      ctx.fillRect(0, 0, 10, 10);
      ctx.fillStyle = 'rgb(255, 0, 255)';
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillRect(5, 5, 10, 10);

      try {
        // If canvas is being rendered to an external screen recorder, this will fail
        const data = canvas.toDataURL();
        if (!data || data.length === 0) {
          console.warn('Canvas access blocked - possible screen recording');
          onScreenshotAttempt?.();
          setMobileBlur();
        }
      } catch (e) {
        console.warn('Canvas access failed - possible screen recording');
        onScreenshotAttempt?.();
        setMobileBlur();
      }
    };

    try {
      setupCanvasProtection();
    } catch (e) {
      console.log('Canvas protection setup skipped');
    }

    // Detect if using accessibility zoom (common screenshot technique)
    const handleZoom = () => {
      if (window.innerHeight < document.documentElement.clientHeight) {
        console.warn('Zoom detected - possible screenshot');
        onScreenshotAttempt?.();
        setMobileBlur();
      }
    };
    window.addEventListener('resize', handleZoom, { passive: true });

    // Disable double-tap to zoom which can enable screenshot
    let lastTouchEnd = 0;
    let touchCount = 0;
    const handleTouchEnd = (e: TouchEvent) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) {
        touchCount++;
        if (touchCount >= 2) {
          // Double tap detected
          e.preventDefault();
          console.warn('Double-tap detected - preventing zoom');
          onScreenshotAttempt?.();
          setMobileBlur();
          touchCount = 0;
        }
      } else {
        touchCount = 1;
      }
      lastTouchEnd = now;
    };
    
    document.addEventListener('touchend', handleTouchEnd, { passive: false });

    // Prevent gesture-based screenshot on iOS
    const handleGesture = (e: TouchEvent) => {
      if (e.touches.length >= 3) {
        // Three-finger gesture detected (iOS screenshot shortcut)
        e.preventDefault();
        console.warn('Three-finger gesture detected');
        onScreenshotAttempt?.();
        setMobileBlur();
      }
    };
    document.addEventListener('touchstart', handleGesture, { passive: false });

    // Monitor for iOS screen recording start (when control center is opened)
    const detectScreenRecording = () => {
      const originalError = console.error;
      console.error = function(...args: any[]) {
        if (args[0]?.includes?.('screen')) {
          onScreenshotAttempt?.();
          setMobileBlur();
        }
        originalError.apply(console, args);
      };
    };

    detectScreenRecording();

    // Cleanup
    return () => {
      window.removeEventListener('devicemotion', handleDeviceMotion);
      window.removeEventListener('orientationchange', handleOrientationChange);
      window.removeEventListener('keydown', volumeButtonDetected);
      document.removeEventListener('touchend', handleTouchEnd);
      document.removeEventListener('touchstart', handleGesture);
      window.removeEventListener('resize', handleZoom);
      
      document.documentElement.classList.remove('mobile-screen-blur');
    };
  }, [enabled, onScreenshotAttempt]);
};

/**
 * Helper function to apply blur to mobile
 */
export const setMobileBlur = (duration: number = 3000) => {
  // Mobile blur suppressed to avoid layout/keyboard issues on modern mobile browsers.
  // Previously this added a 'mobile-screen-blur' class to the root element which
  // caused viewport reflows and input focus loss on many devices. Keep as a no-op
  // to preserve screenshot detection logic without forcing a visual blur.
  return;
};
