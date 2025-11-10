import { useCallback } from 'react';

import { fetchPackedCubes } from '../services/bgcubeApi';
import { saveLastResult } from '../services/storage/indexedDb';

const buildOverridesPayload = ({
  excludedGamesList,
  orientationOverridesList,
  dimensionOverridesList,
}) => ({
  excludedGames: excludedGamesList.map((game) => ({ ...game })),
  orientationOverrides: orientationOverridesList.map((entry) => ({ ...entry })),
  dimensionOverrides: dimensionOverridesList.map((entry) => ({ ...entry })),
});

const buildRequestBase = ({
  username,
  includeStatusList,
  excludeStatusList,
  includeExpansions,
  priorities,
  verticalStacking,
  lockRotation,
  optimizeSpace,
  respectSortOrder,
  fitOversized,
  groupExpansions,
  groupSeries,
  bypassVersionWarning,
  overridesPayload,
}) => {
  const effectiveGroupExpansions = groupExpansions && !optimizeSpace;
  const effectiveGroupSeries = groupSeries && !optimizeSpace;

  const requestConfig = {
    username,
    includeStatuses: includeStatusList,
    excludeStatuses: excludeStatusList,
    includeExpansions,
    priorities,
    verticalStacking,
    lockRotation,
    optimizeSpace,
    respectSortOrder,
    fitOversized,
    groupExpansions: effectiveGroupExpansions,
    groupSeries: effectiveGroupSeries,
    bypassVersionWarning,
    skipVersionCheck: bypassVersionWarning,
    overrides: overridesPayload,
  };

  const fetchParams = {
    includeStatuses: includeStatusList,
    excludeStatuses: excludeStatusList,
    includeExpansions,
    priorities,
    verticalStacking,
    lockRotation,
    optimizeSpace,
    respectSortOrder,
    fitOversized,
    groupExpansions: effectiveGroupExpansions,
    groupSeries: effectiveGroupSeries,
  };

  const fetchOptions = {
    overrides: overridesPayload,
    skipVersionCheck: bypassVersionWarning,
    bypassVersionWarning,
  };

  return { requestConfig, fetchParams, fetchOptions };
};

const createSubmitContext = (state) => {
  const trimmedUsername = state.username.trim();
  const overridesPayload = buildOverridesPayload(state);
  const { requestConfig, fetchParams, fetchOptions } = buildRequestBase({
    ...state,
    username: trimmedUsername,
    overridesPayload,
  });

  return {
    trimmedUsername,
    overridesPayload,
    requestConfig,
    fetchParams,
    fetchOptions,
  };
};

const wasSuccessful = (response) => response && Array.isArray(response.cubes);

const useCollectionRequestHandlers = (options) => {
  const {
    username,
    hasIncludeStatuses,
    includeStatusList,
    excludeStatusList,
    includeExpansions,
    priorities,
    verticalStacking,
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
    (response, requestConfig) => {
      setProgress('Rendering results...');
      setCubes(response.cubes);
      setStats(response.stats || null);
      setOversizedGames(response.oversizedGames || []);
      setProgress('');
      setLoading(false);

      saveLastResult({
        requestConfig,
        response: {
          cubes: response.cubes,
          stats: response.stats || null,
          oversizedGames: response.oversizedGames || [],
          fitOversized,
          verticalStacking,
          lockRotation,
        },
      }).catch((storageError) => {
        console.error('Unable to persist last result', storageError);
      });
    },
    [
      setProgress,
      setCubes,
      setStats,
      setOversizedGames,
      setLoading,
      fitOversized,
      verticalStacking,
      lockRotation,
    ]
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
    [setLoading, setProgress, setMissingVersionWarning]
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
    [setError, setLoading]
  );

  const handleError = useCallback(
    (error) => {
      console.error('Error:', error);
      setError(
        error?.message ||
          'An error occurred while fetching data from BoardGameGeek. Please try again.'
      );
      setLoading(false);
      setProgress('');
    },
    [setError, setLoading, setProgress]
  );

  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault();

      if (!validateSubmission()) {
        return;
      }

      beginSubmission();

      try {
        const context = createSubmitContext({
          username,
          includeStatusList,
          excludeStatusList,
          includeExpansions,
          priorities,
          verticalStacking,
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
        });

        setLastRequestConfig(context.requestConfig);

        const response = await fetchPackedCubes(
          context.trimmedUsername,
          context.fetchParams,
          (progress) => {
            if (progress?.message) {
              setProgress(progress.message);
            }
          },
          context.fetchOptions
        );

        if (handleMissingVersionsResponse(response, context.trimmedUsername)) {
          return;
        }

        if (handleNoResultsResponse(response)) {
          return;
        }

        applyResponse(response, context.requestConfig);
      } catch (error) {
        handleError(error);
      }
    },
    [
      validateSubmission,
      beginSubmission,
      includeStatusList,
      excludeStatusList,
      includeExpansions,
      priorities,
      verticalStacking,
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
      setLastRequestConfig,
      setProgress,
      handleMissingVersionsResponse,
      handleNoResultsResponse,
      applyResponse,
      handleError,
      username,
    ]
  );

  const handleWarningCancel = useCallback(() => {
    setMissingVersionWarning(null);
    setProgress('');
    setError(
      'Processing cancelled. Please select versions for the highlighted games on BoardGameGeek and try again.'
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
      const effectiveBypassVersionWarning =
        lastRequestConfig.bypassVersionWarning ?? bypassVersionWarning;

      const overridesPayload = lastRequestConfig.overrides
        ? {
            excludedGames: (lastRequestConfig.overrides.excludedGames || []).map((item) => ({
              ...item,
            })),
            orientationOverrides: (lastRequestConfig.overrides.orientationOverrides || []).map(
              (item) => ({ ...item })
            ),
            dimensionOverrides: (lastRequestConfig.overrides.dimensionOverrides || []).map(
              (item) => ({ ...item })
            ),
          }
        : buildOverridesPayload({
            excludedGamesList,
            orientationOverridesList,
            dimensionOverridesList,
          });

      const fallbackLockRotation =
        typeof lastRequestConfig.lockRotation === 'boolean'
          ? lastRequestConfig.lockRotation
          : lockRotation;

      const fallbackIncludeStatuses = Array.isArray(lastRequestConfig.includeStatuses)
        ? lastRequestConfig.includeStatuses
        : includeStatusList;
      const fallbackExcludeStatuses = Array.isArray(lastRequestConfig.excludeStatuses)
        ? lastRequestConfig.excludeStatuses
        : excludeStatusList;

      const fetchParams = {
        includeStatuses: fallbackIncludeStatuses,
        excludeStatuses: fallbackExcludeStatuses,
        includeExpansions: lastRequestConfig.includeExpansions,
        priorities: lastRequestConfig.priorities,
        verticalStacking: lastRequestConfig.verticalStacking,
        lockRotation: fallbackLockRotation,
        optimizeSpace: lastRequestConfig.optimizeSpace,
        respectSortOrder: lastRequestConfig.respectSortOrder,
        fitOversized: lastRequestConfig.fitOversized,
        groupExpansions: lastRequestConfig.groupExpansions,
        groupSeries: lastRequestConfig.groupSeries,
      };

      const response = await fetchPackedCubes(
        lastRequestConfig.username,
        fetchParams,
        (progress) => {
          if (progress?.message) {
            setProgress(progress.message);
          }
        },
        {
          skipVersionCheck: true,
          overrides: overridesPayload,
          bypassVersionWarning: effectiveBypassVersionWarning,
        }
      );

      if (handleNoResultsResponse(response)) {
        return;
      }

      const normalizedRequestConfig = {
        ...lastRequestConfig,
        lockRotation: fallbackLockRotation,
        includeStatuses: fallbackIncludeStatuses,
        excludeStatuses: fallbackExcludeStatuses,
      };

      setLastRequestConfig(normalizedRequestConfig);

      setProgress('Rendering results...');
      setCubes(response.cubes);
      setStats(response.stats || null);
      setOversizedGames(response.oversizedGames || []);
      setProgress('');
      setLoading(false);

      saveLastResult({
        requestConfig: normalizedRequestConfig,
        response: {
          cubes: response.cubes,
          stats: response.stats || null,
          oversizedGames: response.oversizedGames || [],
          fitOversized: normalizedRequestConfig.fitOversized,
          verticalStacking: normalizedRequestConfig.verticalStacking,
          lockRotation: fallbackLockRotation,
        },
      }).catch((storageError) => {
        console.error('Unable to persist last result', storageError);
      });
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
    bypassVersionWarning,
    excludedGamesList,
    orientationOverridesList,
    dimensionOverridesList,
    lockRotation,
    includeStatusList,
    excludeStatusList,
    handleError,
    setLastRequestConfig,
    setCubes,
    handleNoResultsResponse,
  ]);

  return {
    handleSubmit,
    handleWarningCancel,
    handleWarningContinue,
  };
};

export default useCollectionRequestHandlers;

