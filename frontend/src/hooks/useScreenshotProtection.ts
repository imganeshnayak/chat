import { useEffect } from 'react';

/**
 * Hook to prevent users from taking screenshots or screen recordings of sensitive chat content
 * Implements multiple layers of protection:
 * 1. Keyboard event detection for common screenshot shortcuts
 * 2. Screen Capture API blocking
 * 3. Focus/visibility change detection
 * 4. Context menu prevention
 * 5. Print screen blocking
 */
export const useScreenshotProtection = (
  onScreenshotAttempt?: () => void,
  enabled: boolean = true
) => {
  useEffect(() => {
    if (!enabled) return;

    // List of keys that trigger screenshot attempts
    const screenshotKeys = [
      'PrintScreen',
      'F12', // DevTools
    ];

    const screenshotKeyCombos = [
      { ctrl: true, key: 'p' }, // Ctrl+P (Print)
      { ctrl: true, key: 's' }, // Ctrl+S (Save)
      { shift: true, meta: true, key: 's' }, // Cmd+Shift+S
      { shift: true, ctrl: true, key: 's' }, // Ctrl+Shift+S (Windows screenshot)
      { shift: true, meta: true, key: '3' }, // Cmd+Shift+3 (Mac)
      { shift: true, meta: true, key: '4' }, // Cmd+Shift+4 (Mac)
      { shift: true, meta: true, key: '5' }, // Cmd+Shift+5 (Mac)
      { alt: true, key: 'printscreen' }, // Alt+PrintScreen
      { shift: true, key: 'printscreen' }, // Shift+PrintScreen
    ];

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      
      // Check for direct screenshot keys
      if (screenshotKeys.includes(e.key)) {
        e.preventDefault();
        onScreenshotAttempt?.();
        return;
      }

      // Check for key combinations
      for (const combo of screenshotKeyCombos) {
        const matches =
          (combo.ctrl === undefined || combo.ctrl === e.ctrlKey) &&
          (combo.shift === undefined || combo.shift === e.shiftKey) &&
          (combo.meta === undefined || combo.meta === e.metaKey) &&
          (combo.alt === undefined || combo.alt === e.altKey) &&
          (combo.key === key || combo.key === e.key);

        if (matches) {
          console.warn('Screenshot attempt detected and blocked');
          e.preventDefault();
          e.stopPropagation();
          onScreenshotAttempt?.();
          
          // Blur chat for 3 seconds as warning
          document.documentElement.classList.add('screenshot-attempted');
          setTimeout(() => {
            document.documentElement.classList.remove('screenshot-attempted');
          }, 3000);
          
          return;
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'PrintScreen') {
        e.preventDefault();
        onScreenshotAttempt?.();
      }
    };

    // Block Screen Capture API
    const handleScreenCaptureRequest = async (
      _: DisplayMediaStreamOptions | undefined
    ): Promise<MediaStream> => {
      console.warn('Screen capture API blocked');
      onScreenshotAttempt?.();
      throw new DOMException(
        'Screen capture not allowed in this context',
        'NotAllowedError'
      );
    };

    // Handle visibility change (screenshot/recording in progress)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        console.warn('Page visibility hidden - possible screenshot');
        // You could add additional logic here (log event, notify server, etc.)
      }
    };

    // Prevent right-click context menu on chat elements
    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-nocontext], .chat-message, .privacy-protected')) {
        e.preventDefault();
        console.warn('Right-click blocked on protected content');
      }
    };

    // Prevent DevTools opening in some browsers
    const handleKeyDownForDevTools = (e: KeyboardEvent) => {
      // F12, Ctrl+Shift+I, Ctrl+Shift+C, Ctrl+Shift+J
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && (e.key === 'i' || e.key === 'I')) ||
        (e.ctrlKey && e.shiftKey && (e.key === 'c' || e.key === 'C')) ||
        (e.ctrlKey && e.shiftKey && (e.key === 'j' || e.key === 'J'))
      ) {
        e.preventDefault();
        console.warn('DevTools access attempted and blocked');
      }
    };

    // Add event listeners
    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('keyup', handleKeyUp, true);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDownForDevTools);

    // Override getDisplayMedia if supported
    if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
      const originalGetDisplayMedia = navigator.mediaDevices.getDisplayMedia.bind(
        navigator.mediaDevices
      );
      navigator.mediaDevices.getDisplayMedia = handleScreenCaptureRequest;
    }

    // Disable copy/paste on sensitive content
    const handleCopy = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('.privacy-protected, .chat-message')) {
        e.preventDefault();
        console.warn('Copy action blocked on protected content');
      }
    };

    const handlePaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-nopaste]')) {
        e.preventDefault();
        console.warn('Paste action blocked');
      }
    };

    document.addEventListener('copy', handleCopy);
    document.addEventListener('paste', handlePaste);

    // Cleanup
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('keyup', handleKeyUp, true);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDownForDevTools);
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('paste', handlePaste);
    };
  }, [enabled, onScreenshotAttempt]);
};
