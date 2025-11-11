import { useCallback } from 'react';

import { fetchPackedCubes } from '../services/bgcubeApi';
import { saveLastResult } from '../services/storage/indexedDb';
import { buildRequestPayload } from '../utils/requestPayload';

const cloneList = (items = []) => (Array.isArray(items) ? items.map((item) => ({ ...item })) : []);

const wasSuccessful = (response) => response && Array.isArray(response.cubes);

const createSubmissionState = ({
  username,
  statusSelections,
  sorting,
  stacking,
  lockRotation,
  optimizeSpace,
  respectSortOrder,
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
      respectSortOrder: Boolean(respectSortOrder),
      fitOversized: Boolean(fitOversized),
      groupExpansions: effectiveGroupExpansions,
      groupSeries: effectiveGroupSeries,
      includeExpansions: Boolean(includeExpansions),
      bypassVersionWarning: Boolean(bypassVersionWarning),
    },
  };
};

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
    respectSortOrder,
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
    setMissingVersionWarning,
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
    setMissingVersionWarning(null);
    setFiltersCollapsed(true);
    setIsFilterDrawerOpen(false);
  }, [
    setLoading,
    setError,
    setCubes,
    setOversizedGames,
    setProgress,
    setMissingVersionWarning,
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

  const handleMissingVersionsResponse = useCallback(
    (response, trimmedUsername) => {
      if (response?.status !== 'missing_versions') {
        return false;
      }

      setLoading(false);
      setProgress('');
      setMissingVersionWarning({ ...response, username: trimmedUsername });
      return true;
    },
    [setLoading, setProgress, setMissingVersionWarning],
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
          respectSortOrder,
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

        if (handleMissingVersionsResponse(response, submissionState.username)) {
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
      respectSortOrder,
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
      handleMissingVersionsResponse,
      handleNoResultsResponse,
      applyResponse,
      handleError,
    ],
  );

  const handleWarningCancel = useCallback(() => {
    setMissingVersionWarning(null);
    setProgress('');
    setError(
      'Processing cancelled. Please select versions for the highlighted games on BoardGameGeek and try again.',
    );
  }, [setError, setMissingVersionWarning, setProgress]);

  const handleWarningContinue = useCallback(async () => {
    if (!lastRequestConfig) {
      return;
    }

    setLoading(true);
    setError(null);
    setProgress('Attempting fallback dimension lookup. This may take a little while...');
    setMissingVersionWarning(null);
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
    setMissingVersionWarning,
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

