/**
 * Mobile platform detection and protection service
 * Detects the device type and applies platform-specific screenshot protections
 */

export interface DeviceInfo {
  isAndroid: boolean;
  isIOS: boolean;
  isMobile: boolean;
  isTablet: boolean;
  osVersion?: string;
  browserName?: string;
  isWebView?: boolean;
}

/**
 * Detect device information from User-Agent
 */
export const detectDevice = (): DeviceInfo => {
  const ua = navigator.userAgent.toLowerCase();
  
  const isAndroid = /android/.test(ua);
  const isIOS = /iphone|ipad|ipod/.test(ua);
  const isMobile = /mobile/.test(ua) || isAndroid || isIOS;
  const isTablet = /ipad|android/.test(ua) && /mobile/.test(ua) === false;
  
  let osVersion: string | undefined;
  let browserName: string | undefined;
  let isWebView = false;

  // Detect OS version
  if (isAndroid) {
    const match = ua.match(/android\s([0-9.]*)/);
    osVersion = match?.[1];
  } else if (isIOS) {
    const match = ua.match(/os\s([0-9_]*)/);
    osVersion = match?.[1]?.replace(/_/g, '.');
  }

  // Detect browser
  if (ua.includes('chrome')) browserName = 'Chrome';
  else if (ua.includes('safari')) browserName = 'Safari';
  else if (ua.includes('firefox')) browserName = 'Firefox';
  else if (ua.includes('edge')) browserName = 'Edge';

  // Detect WebView
  isWebView = /webview|wv|;/.test(ua);

  return {
    isAndroid,
    isIOS,
    isMobile,
    isTablet,
    osVersion,
    browserName,
    isWebView
  };
};

/**
 * Apply platform-specific screenshot protections
 */
export const applyPlatformSpecificProtections = (device: DeviceInfo) => {
  if (device.isAndroid) {
    applyAndroidProtections();
  } else if (device.isIOS) {
    applyIOSProtections();
  }
};

/**
 * Android-specific protections
 */
const applyAndroidProtections = () => {
  // Disable status bar when in chat
  if ((window as any).StatusBar) {
    try {
      (window as any).StatusBar.hide();
    } catch (e) {
      console.log('StatusBar control not available');
    }
  }

  // Listen for recent app switching (common before screenshot)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      // App is being put in background - apply blur
      document.documentElement.classList.add('mobile-screen-blur');
    }
  });

  // Prevent screen recording on Android
  if (navigator.permissions) {
    navigator.permissions.query({ name: 'screen-capture' } as any)
      .then((result: any) => {
        if (result.state === 'granted') {
          console.warn('Screen capture permission detected');
          document.documentElement.classList.add('mobile-screen-blur');
        }
      })
      .catch(() => {
        // Permission query not supported
      });
  }
};

/**
 * iOS-specific protections
 */
const applyIOSProtections = () => {
  // Detect when Control Center is opened (swipe from top)
  let touchStartY = 0;
  const handleTouchStart = (e: TouchEvent) => {
    const touch = e.touches[0];
    touchStartY = touch.clientY;
  };

  const handleTouchEnd = (e: TouchEvent) => {
    const touch = e.changedTouches[0];
    // If swiped from very top of screen
    if (touchStartY < 50 && touch.clientY > 100) {
      console.warn('Control Center swipe detected');
      document.documentElement.classList.add('mobile-screen-blur');
      setTimeout(() => {
        document.documentElement.classList.remove('mobile-screen-blur');
      }, 2000);
    }
  };

  document.addEventListener('touchstart', handleTouchStart, false);
  document.addEventListener('touchend', handleTouchEnd, false);

  // Detect when screen recording starts
  if ((window as any).navigator?.mediaDevices?.getDisplayMedia) {
    const originalGetDisplayMedia = navigator.mediaDevices!.getDisplayMedia.bind(navigator.mediaDevices);
    (navigator.mediaDevices as any).getDisplayMedia = async function(...args: any[]) {
      console.warn('Screen recording attempt detected on iOS');
      document.documentElement.classList.add('mobile-screen-blur');
      
      try {
        const stream = await originalGetDisplayMedia(...args);
        // If stream is obtained, blur for entire duration
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          videoTrack.onended = () => {
            document.documentElement.classList.remove('mobile-screen-blur');
          };
        }
        return stream;
      } catch (error) {
        document.documentElement.classList.remove('mobile-screen-blur');
        throw error;
      }
    };
  }
};

/**
 * Check if device has secure screen capture capability
 */
export const hasSecureScreenCapture = (): boolean => {
  const device = detectDevice();
  
  if (device.isAndroid) {
    // Android can use FLAG_SECURE
    return true;
  } else if (device.isIOS) {
    // iOS has limited secure capture (requires native app)
    return false;
  }
  
  return false;
};

/**
 * Get recommended protection level based on device
 */
export const getRecommendedProtectionLevel = (device?: DeviceInfo): 'low' | 'medium' | 'high' => {
  const d = device || detectDevice();
  
  if (d.isWebView) {
    // WebView in app has more control
    return 'high';
  } else if (d.isAndroid) {
    // Android browser has medium protection
    return 'medium';
  } else if (d.isIOS) {
    // iOS browser has limited protection
    return 'medium';
  }
  
  return 'low';
};
