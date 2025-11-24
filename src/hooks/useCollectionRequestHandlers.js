import { useCallback } from 'react';

import { fetchPackedCubes } from '../services/bgcubeApi';
import { saveLastResult } from '../services/storage/indexedDb';
import { buildRequestPayload } from '../utils/requestPayload';

/**
 * Clones an array of items, creating shallow copies of each item.
 * @param {Array} items - Array of items to clone
 * @returns {Array} Cloned array with shallow copies of items
 */
const cloneList = (items = []) => (Array.isArray(items) ? items.map((item) => ({ ...item })) : []);

/**
 * Checks if a response was successful (has cubes array).
 * @param {Object} response - The response object
 * @returns {boolean} True if response has cubes array
 */
const wasSuccessful = (response) => response && Array.isArray(response.cubes);

/**
 * Creates submission state object from options.
 * @param {Object} options - Configuration options
 * @returns {Object} Submission state object
 */
const createSubmissionState = ({
  username,
  statusSelections,
  sorting,
  stacking,
  lockRotation,
  optimizeSpace,
  backfillPercentage,
  fitOversized,
  groupExpansions,
  groupSeries,
  includeExpansions,
  bypassVersionWarning,
  excludedGamesList,
  orientationOverridesList,
  dimensionOverridesList,
}) => {
  const trimmedUsername = username.trim();
  const effectiveGroupExpansions = Boolean(groupExpansions) && !optimizeSpace;
  const effectiveGroupSeries = Boolean(groupSeries) && !optimizeSpace;

  return {
    username: trimmedUsername,
    stacking,
    statusSelections: { ...statusSelections },
    sorting: cloneList(sorting),
    overrides: {
      excludedVersions: cloneList(excludedGamesList),
      stackingOverrides: cloneList(orientationOverridesList),
      dimensionOverrides: cloneList(dimensionOverridesList),
    },
    flags: {
      lockRotation: Boolean(lockRotation),
      optimizeSpace: Boolean(optimizeSpace),
      backfillPercentage: typeof backfillPercentage === 'number' ? backfillPercentage : 20,
      fitOversized: Boolean(fitOversized),
      groupExpansions: effectiveGroupExpansions,
      groupSeries: effectiveGroupSeries,
      includeExpansions: Boolean(includeExpansions),
      bypassVersionWarning: Boolean(bypassVersionWarning),
    },
  };
};

/**
 * Hook to manage collection request handlers (submit, cancel, continue).
 * @param {Object} options - Configuration object with all required handlers and state
 * @returns {Object} Object containing handleSubmit, handleWarningCancel, and handleWarningContinue
 */
const useCollectionRequestHandlers = (options) => {
  const {
    username,
    hasIncludeStatuses,
    statusSelections,
    includeExpansions,
    sorting,
    stacking,
    lockRotation,
    optimizeSpace,
    backfillPercentage,
    fitOversized,
    groupExpansions,
    groupSeries,
    bypassVersionWarning,
    excludedGamesList,
    orientationOverridesList,
    dimensionOverridesList,
    setError,
    setLoading,
    setCubes,
    setOversizedGames,
    setProgress,
    setnoSelectedVersionWarning,
    setFiltersCollapsed,
    setIsFilterDrawerOpen,
    setStats,
    setLastRequestConfig,
    lastRequestConfig,
  } = options;

  const beginSubmission = useCallback(() => {
    setLoading(true);
    setError(null);
    setCubes(null);
    setOversizedGames([]);
    setProgress('Fetching your collection from BoardGameGeek...');
    setnoSelectedVersionWarning(null);
    setFiltersCollapsed(true);
    setIsFilterDrawerOpen(false);
  }, [
    setLoading,
    setError,
    setCubes,
    setOversizedGames,
    setProgress,
    setnoSelectedVersionWarning,
    setFiltersCollapsed,
    setIsFilterDrawerOpen,
  ]);

  const applyResponse = useCallback(
    (response, submissionState) => {
      setProgress('Rendering results...');
      setCubes(response.cubes);
      setStats(response.stats || null);
      setOversizedGames(response.oversizedGames || []);
      setProgress('');
      setLoading(false);

      saveLastResult({
        requestConfig: submissionState,
        response: {
          cubes: response.cubes,
          stats: response.stats || null,
          oversizedGames: response.oversizedGames || [],
          fitOversized: submissionState.flags.fitOversized,
          stacking: submissionState.stacking,
          lockRotation: submissionState.flags.lockRotation,
        },
      }).catch((storageError) => {
        console.error('Unable to persist last result', storageError);
      });
    },
    [setProgress, setCubes, setStats, setOversizedGames, setLoading],
  );

  const validateSubmission = useCallback(() => {
    if (!username.trim()) {
      setError('Please enter a BoardGameGeek username');
      return false;
    }

    if (!hasIncludeStatuses) {
      return false;
    }

    return true;
  }, [username, hasIncludeStatuses, setError]);

  const handlenoSelectedVersionsResponse = useCallback(
    (response, trimmedUsername) => {
      if (response?.status !== 'missing_versions') {
        return false;
      }

      setLoading(false);
      setProgress('');
      setnoSelectedVersionWarning({ ...response, username: trimmedUsername });
      return true;
    },
    [setLoading, setProgress, setnoSelectedVersionWarning],
  );

  const handleNoResultsResponse = useCallback(
    (response) => {
      if (wasSuccessful(response) && response.cubes.length > 0) {
        return false;
      }

      setError(response?.message || 'No games matched your selected collections.');
      setLoading(false);
      return true;
    },
    [setError, setLoading],
  );

  const handleError = useCallback(
    (error) => {
      console.error('Error:', error);
      setError(
        error?.message ||
          'An error occurred while fetching data from BoardGameGeek. Please try again.',
      );
      setLoading(false);
      setProgress('');
    },
    [setError, setLoading, setProgress],
  );

  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault();

      if (!validateSubmission()) {
        return;
      }

      beginSubmission();

      try {
        const submissionState = createSubmissionState({
          username,
          statusSelections,
          sorting,
          stacking,
          lockRotation,
          optimizeSpace,
          backfillPercentage,
          fitOversized,
          groupExpansions,
          groupSeries,
          includeExpansions,
          bypassVersionWarning,
          excludedGamesList,
          orientationOverridesList,
          dimensionOverridesList,
        });

        const requestPayload = buildRequestPayload(submissionState);
        setLastRequestConfig(submissionState);

        const { data: response } = await fetchPackedCubes(requestPayload, {
          onProgress: (progress) => {
            if (progress?.message) {
              setProgress(progress.message);
            }
          },
        });

        if (handlenoSelectedVersionsResponse(response, submissionState.username)) {
          return;
        }

        if (handleNoResultsResponse(response)) {
          return;
        }

        applyResponse(response, submissionState);
      } catch (error) {
        handleError(error);
      }
    },
    [
      validateSubmission,
      beginSubmission,
      username,
      statusSelections,
      sorting,
      stacking,
      lockRotation,
      optimizeSpace,
      backfillPercentage,
      fitOversized,
      groupExpansions,
      groupSeries,
      includeExpansions,
      bypassVersionWarning,
      excludedGamesList,
      orientationOverridesList,
      dimensionOverridesList,
      setLastRequestConfig,
      setProgress,
      handlenoSelectedVersionsResponse,
      handleNoResultsResponse,
      applyResponse,
      handleError,
    ],
  );

  const handleWarningCancel = useCallback(() => {
    setnoSelectedVersionWarning(null);
    setProgress('');
    setError(
      'Processing cancelled. Please select versions for the highlighted games on BoardGameGeek and try again.',
    );
  }, [setError, setnoSelectedVersionWarning, setProgress]);

  const handleWarningContinue = useCallback(async () => {
    if (!lastRequestConfig) {
      return;
    }

    setLoading(true);
    setError(null);
    // Set initial message, but server progress will override it quickly
    setProgress('Starting fallback dimension lookup...');
    setnoSelectedVersionWarning(null);
    setOversizedGames([]);
    setStats(null);
    setFiltersCollapsed(true);
    setIsFilterDrawerOpen(false);

    try {
      const fallbackState = {
        ...lastRequestConfig,
        flags: {
          ...lastRequestConfig.flags,
          bypassVersionWarning: true,
        },
      };

      const requestPayload = buildRequestPayload(fallbackState);

      const { data: response } = await fetchPackedCubes(requestPayload, {
        onProgress: (progress) => {
          if (progress?.message) {
            setProgress(progress.message);
          }
        },
      });

      if (handleNoResultsResponse(response)) {
        return;
      }

      setLastRequestConfig(fallbackState);
      applyResponse(response, fallbackState);
    } catch (error) {
      handleError(error);
    }
  }, [
    lastRequestConfig,
    setLoading,
    setError,
    setProgress,
    setnoSelectedVersionWarning,
    setOversizedGames,
    setStats,
    setFiltersCollapsed,
    setIsFilterDrawerOpen,
    handleNoResultsResponse,
    applyResponse,
    handleError,
  ]);

  return {
    handleSubmit,
    handleWarningCancel,
    handleWarningContinue,
  };
};

export default useCollectionRequestHandlers;

