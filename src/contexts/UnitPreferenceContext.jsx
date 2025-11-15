import React, { createContext, useContext } from 'react';

/**
 * Context for providing unit preference (Imperial/Metric) throughout the application.
 */
const UnitPreferenceContext = createContext({
  isMetric: false,
});

/**
 * Hook to access unit preference context.
 * @returns {Object} Object containing isMetric boolean
 */
export const useUnitPreference = () => {
  const context = useContext(UnitPreferenceContext);
  if (context === undefined) {
    throw new Error('useUnitPreference must be used within a UnitPreferenceProvider');
  }
  return context;
};

/**
 * Provider component for unit preference context.
 * @param {Object} props - Component props
 * @param {boolean} props.isMetric - Whether metric units are enabled
 * @param {React.ReactNode} props.children - Child components
 */
export const UnitPreferenceProvider = ({ isMetric = false, children }) => {
  return (
    <UnitPreferenceContext.Provider value={{ isMetric }}>
      {children}
    </UnitPreferenceContext.Provider>
  );
};

