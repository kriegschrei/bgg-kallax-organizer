import { useEffect, useRef } from 'react';

/**
 * Hook to manage body overflow when filter drawer is open on mobile.
 * Prevents body scrolling when drawer is open.
 * @param {boolean} isFilterDrawerOpen - Whether the filter drawer is open
 * @param {boolean} isMobileLayout - Whether the current layout is mobile
 */
export const useBodyOverflow = (isFilterDrawerOpen, isMobileLayout) => {
  const previousBodyOverflowRef = useRef(null);

  useEffect(() => {
    if (!isMobileLayout || !isFilterDrawerOpen) {
      if (previousBodyOverflowRef.current !== null) {
        document.body.style.overflow = previousBodyOverflowRef.current || '';
        previousBodyOverflowRef.current = null;
      }
      return;
    }

    previousBodyOverflowRef.current = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousBodyOverflowRef.current || '';
      previousBodyOverflowRef.current = null;
    };
  }, [isFilterDrawerOpen, isMobileLayout]);
};

