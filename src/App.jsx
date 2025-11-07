import React, { useState, useMemo } from 'react';
import SortablePriorities from './components/SortablePriorities';
import Results from './components/Results';
import MissingVersionsWarning from './components/MissingVersionsWarning';
import { fetchPackedCubes } from './services/bggApi';
import './App.css';

const DEFAULT_PRIORITIES = [
  { field: 'name', enabled: true, order: 'asc' },
  { field: 'categories', enabled: false, order: 'asc' },
  { field: 'families', enabled: false, order: 'asc' },
  { field: 'bggRank', enabled: false, order: 'asc' }, // Lower rank # is better
  { field: 'minPlayers', enabled: false, order: 'asc' },
  { field: 'maxPlayers', enabled: false, order: 'asc' },
  { field: 'bestPlayerCount', enabled: false, order: 'asc' },
  { field: 'minPlaytime', enabled: false, order: 'asc' },
  { field: 'maxPlaytime', enabled: false, order: 'asc' },
  { field: 'age', enabled: false, order: 'asc' },
  { field: 'communityAge', enabled: false, order: 'asc' },
  { field: 'weight', enabled: false, order: 'asc' },
  { field: 'bggRating', enabled: false, order: 'desc' }, // Higher rating is better
];

const DEFAULT_ENABLED_PRIORITY_FIELDS = DEFAULT_PRIORITIES
  .filter((priority) => priority.enabled)
  .map((priority) => priority.field);

const DEFAULT_PRIORITIES_BY_FIELD = DEFAULT_PRIORITIES.reduce((accumulator, priority) => {
  accumulator[priority.field] = priority;
  return accumulator;
}, {});

const PRIORITY_LABELS = {
  name: 'Name',
  categories: 'Categories',
  families: 'Families',
  bggRank: 'BGG Rank',
  minPlayers: 'Min Players',
  maxPlayers: 'Max Players',
  bestPlayerCount: 'Best Player Count',
  minPlaytime: 'Min Playtime',
  maxPlaytime: 'Max Playtime',
  age: 'Age',
  communityAge: 'Community Age',
  weight: 'Weight',
  bggRating: 'BGG Rating',
};

function App() {
  const [username, setUsername] = useState('');
  const [includePreordered, setIncludePreordered] = useState(false);
  const [includeExpansions, setIncludeExpansions] = useState(false);
  const [groupExpansions, setGroupExpansions] = useState(false);
  const [groupSeries, setGroupSeries] = useState(false);
  const [verticalStacking, setVerticalStacking] = useState(true);
  const [allowAlternateRotation, setAllowAlternateRotation] = useState(true);
  const [optimizeSpace, setOptimizeSpace] = useState(false);
  const [respectSortOrder, setRespectSortOrder] = useState(false);
  const [fitOversized, setFitOversized] = useState(false);
  const [priorities, setPriorities] = useState(DEFAULT_PRIORITIES);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState('');
  const [cubes, setCubes] = useState(null);
  const [oversizedGames, setOversizedGames] = useState([]);
  const [missingVersionWarning, setMissingVersionWarning] = useState(null);
  const [lastRequestConfig, setLastRequestConfig] = useState(null);
  const [filtersCollapsed, setFiltersCollapsed] = useState(false);

  const handleOptimizeSpaceChange = (checked) => {
    setOptimizeSpace(checked);
    if (checked) {
      // Disable all manual sorting controls when optimize space is enabled
      setPriorities((prev) => prev.map((p) => ({ ...p, enabled: false })));
      setRespectSortOrder(false);
    }
  };

  const activeFilterLabels = useMemo(() => {
    const labels = [];
    const pushLabel = (condition, label) => {
      if (condition) {
        labels.push(label);
      }
    };

    pushLabel(includePreordered, 'Pre-ordered games');
    pushLabel(includeExpansions, 'Include expansions');
    pushLabel(groupExpansions, 'Group expansions');
    pushLabel(groupSeries, 'Group series');
    pushLabel(respectSortOrder, 'Respect priority order');
    pushLabel(optimizeSpace, 'Optimize for space');
    pushLabel(fitOversized, 'Fit oversized games');
    pushLabel(!verticalStacking, 'Horizontal stacking');
    pushLabel(!allowAlternateRotation, 'Lock rotation');

    priorities.forEach((priority) => {
      const defaultConfig = DEFAULT_PRIORITIES_BY_FIELD[priority.field];
      const baseLabel = PRIORITY_LABELS[priority.field] || priority.field;
      const orderLabel = priority.order === 'desc' ? ' (desc)' : '';

      if (!defaultConfig) {
        if (priority.enabled) {
          labels.push(`Priority: ${baseLabel}${orderLabel}`);
        }
        return;
      }

      if (!defaultConfig.enabled && priority.enabled) {
        labels.push(`Priority: ${baseLabel}${orderLabel}`);
      }

      if (defaultConfig.enabled && !priority.enabled) {
        labels.push(`Priority disabled: ${baseLabel}`);
      }

      if (
        priority.enabled &&
        defaultConfig.enabled &&
        priority.order !== defaultConfig.order
      ) {
        labels.push(`Priority order: ${baseLabel}${orderLabel}`);
      }
    });

    return labels;
  }, [
    allowAlternateRotation,
    fitOversized,
    groupExpansions,
    groupSeries,
    includeExpansions,
    includePreordered,
    optimizeSpace,
    priorities,
    respectSortOrder,
    verticalStacking,
  ]);

  const activeFilterCount = activeFilterLabels.length;

  const toggleFiltersCollapsed = () => {
    if (loading) {
      return;
    }
    setFiltersCollapsed((prev) => !prev);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!username.trim()) {
      setError('Please enter a BoardGameGeek username');
      return;
    }

    setLoading(true);
    setError(null);
    setCubes(null);
    setOversizedGames([]);
    setProgress('Fetching your collection from BoardGameGeek...');
    setMissingVersionWarning(null);
    setFiltersCollapsed(true);

    try {
      const trimmedUsername = username.trim();
      const effectiveGroupExpansions = groupExpansions && !optimizeSpace;
      const effectiveGroupSeries = groupSeries && !optimizeSpace;

      const requestConfig = {
        username: trimmedUsername,
        includePreordered,
        includeExpansions,
        priorities,
        verticalStacking,
        allowAlternateRotation,
        optimizeSpace,
        respectSortOrder,
        fitOversized,
        groupExpansions: effectiveGroupExpansions,
        groupSeries: effectiveGroupSeries,
      };

      setLastRequestConfig(requestConfig);

      // Get fully processed and packed cubes from server with progress updates
      const response = await fetchPackedCubes(
        trimmedUsername,
        includePreordered,
        includeExpansions,
        priorities,
        verticalStacking,
        allowAlternateRotation,
        optimizeSpace,
        respectSortOrder,
        fitOversized,
        effectiveGroupExpansions,
        effectiveGroupSeries,
        (progress) => {
          // Update progress message from SSE updates
          if (progress && progress.message) {
            setProgress(progress.message);
          }
        }
      );
      
      if (response?.status === 'missing_versions') {
        setLoading(false);
        setProgress('');
        setMissingVersionWarning({ ...response, username: trimmedUsername });
        return;
      }
      
      if (!response || !response.cubes || response.cubes.length === 0) {
        setError('No owned games found for this user');
        setLoading(false);
        return;
      }

      setProgress('Rendering results...');

      setCubes(response.cubes);
      setOversizedGames(response.oversizedGames || []);
      setProgress('');
      setLoading(false);

    } catch (err) {
      console.error('Error:', err);
      setError(err.message || 'An error occurred while fetching data from BoardGameGeek. Please try again.');
      setLoading(false);
      setProgress('');
    }
  };

  const handleWarningCancel = () => {
    setMissingVersionWarning(null);
    setProgress('');
    setError('Processing cancelled. Please select versions for the highlighted games on BoardGameGeek and try again.');
  };

  const handleWarningContinue = async () => {
    if (!lastRequestConfig) {
      return;
    }

    setLoading(true);
    setError(null);
    setProgress('Attempting fallback dimension lookup. This may take a little while...');
    setMissingVersionWarning(null);
    setOversizedGames([]);
    setFiltersCollapsed(true);

    try {
      const response = await fetchPackedCubes(
        lastRequestConfig.username,
        lastRequestConfig.includePreordered,
        lastRequestConfig.includeExpansions,
        lastRequestConfig.priorities,
        lastRequestConfig.verticalStacking,
        lastRequestConfig.allowAlternateRotation,
        lastRequestConfig.optimizeSpace,
        lastRequestConfig.respectSortOrder,
        lastRequestConfig.fitOversized,
        lastRequestConfig.groupExpansions,
        lastRequestConfig.groupSeries,
        (progress) => {
          if (progress && progress.message) {
            setProgress(progress.message);
          }
        },
        { skipVersionCheck: true }
      );

      if (!response || !response.cubes || response.cubes.length === 0) {
        setError('No owned games found for this user');
        setLoading(false);
        return;
      }

      setProgress('Rendering results...');
      setCubes(response.cubes);
      setOversizedGames(response.oversizedGames || []);
      setProgress('');
      setLoading(false);
    } catch (err) {
      console.error('Error:', err);
      setError(err.message || 'An error occurred while fetching data from BoardGameGeek. Please try again.');
      setLoading(false);
      setProgress('');
    }
  };

  return (
    <div className="app">
      <header>
        <div className="header-content">
          <h1>BGCube</h1>
          <p className="subtitle">
            Organize your <a href="https://boardgamegeek.com" target="_blank" rel="noopener noreferrer" className="subtitle-link">BoardGameGeek</a> collection into <a href="https://www.ikea.com/us/en/cat/kallax-shelving-units-58285/" target="_blank" rel="noopener noreferrer" className="subtitle-link">IKEA Kallax shelving units</a>
          </p>
        </div>
        <div className="header-banner">
          <div className="banner-item">
            <a href="https://boardgamegeek.com" target="_blank" rel="noopener noreferrer" className="banner-link">
              <img 
                src="/powered_by_bgg.png" 
                alt="Powered by BoardGameGeek" 
                className="banner-logo"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'block';
                }}
              />
              <span className="banner-fallback" style={{ display: 'none' }}>
                Powered by BoardGameGeek
              </span>
            </a>
          </div>
          <div className="banner-item">
            <a href="https://ko-fi.com/kriegschrei" target="_blank" rel="noopener noreferrer" className="banner-link">
              ☕ Support on Ko-Fi
            </a>
          </div>
          <div className="banner-item">
            <a href="https://github.com/kriegschrei/bgg-kallax-organizer/issues" target="_blank" rel="noopener noreferrer" className="banner-link">
              🐛 Report Issues
            </a>
          </div>
        </div>
      </header>

      {error && (
        <div className="error">
          <strong>Error:</strong> {error}
        </div>
      )}

      <section className={`card search-panel ${filtersCollapsed ? 'collapsed' : ''}`}>
        <div className="search-panel-header">
          <button
            type="button"
            className="search-panel-toggle"
            onClick={toggleFiltersCollapsed}
            aria-expanded={!filtersCollapsed}
            aria-controls="search-panel-content"
            disabled={loading}
            title={filtersCollapsed ? 'Show search options' : 'Hide search options'}
          >
            <div className="search-panel-title-row">
              <span className="search-panel-title">Search Options</span>
              <div className="search-panel-controls">
                {activeFilterCount > 0 && (
                  <span className="search-panel-badge" aria-label={`${activeFilterCount} active filters`}>
                    {activeFilterCount}
                  </span>
                )}
                <span className="search-panel-icon" aria-hidden>
                  ▾
                </span>
              </div>
            </div>
            {filtersCollapsed && activeFilterCount > 0 && (
              <div className="search-panel-tags" aria-label="Active filters">
                {activeFilterLabels.map((label) => (
                  <span key={label} className="search-panel-tag">
                    {label}
                  </span>
                ))}
              </div>
            )}
          </button>
        </div>
        <div className="search-panel-body" id="search-panel-content">
          <form onSubmit={handleSubmit} className="search-panel-form">
            <div className="form-layout">
              <div className="form-left">
                <div className="form-group">
                  <label htmlFor="username">BoardGameGeek Username</label>
                  <input
                    type="text"
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter your BGG username"
                    disabled={loading}
                  />
                </div>

                <div className="checkbox-grid">
                  <div className="checkbox-group">
                    <label>
                      <input
                        type="checkbox"
                        checked={includePreordered}
                        onChange={(e) => setIncludePreordered(e.target.checked)}
                        disabled={loading}
                      />
                      Include Pre-ordered Games
                    </label>
                  </div>

                  <div className="checkbox-group">
                    <label>
                      <input
                        type="checkbox"
                        checked={respectSortOrder}
                        onChange={(e) => setRespectSortOrder(e.target.checked)}
                        disabled={loading || optimizeSpace}
                      />
                      Respect ordering priority
                      <span className="tooltip-trigger" data-tooltip="Games will not be backfilled to earlier cubes for better fit, may use more space">ℹ️</span>
                    </label>
                  </div>

                  <div className="checkbox-group">
                    <label>
                      <input
                        type="checkbox"
                        checked={includeExpansions}
                        onChange={(e) => {
                          setIncludeExpansions(e.target.checked);
                          if (!e.target.checked) {
                            setGroupExpansions(false); // Disable grouping when expansions are disabled
                          }
                        }}
                        disabled={loading}
                      />
                      Include expansions
                    </label>
                  </div>

                  <div className="checkbox-group">
                    <label>
                      <input
                        type="checkbox"
                        checked={groupExpansions}
                        onChange={(e) => setGroupExpansions(e.target.checked)}
                        disabled={loading || !includeExpansions || optimizeSpace}
                      />
                      Group expansions with base game
                      <span className="tooltip-trigger" data-tooltip="Keep expansions with their base game in the same cube when possible">ℹ️</span>
                    </label>
                  </div>

                  <div className="checkbox-group">
                    <label>
                      <input
                        type="checkbox"
                        checked={groupSeries}
                        onChange={(e) => setGroupSeries(e.target.checked)}
                        disabled={loading || optimizeSpace}
                      />
                      Group series
                      <span className="tooltip-trigger" data-tooltip="Keep games from the same series/family together in the same cube when possible">ℹ️</span>
                    </label>
                  </div>

                  <div className="checkbox-group">
                    <label>
                      <input
                        type="checkbox"
                        checked={fitOversized}
                        onChange={(e) => setFitOversized(e.target.checked)}
                        disabled={loading}
                      />
                      Fit oversized games
                      <span className="tooltip-trigger" data-tooltip="Force games up to 13 inches deep into the cube and optionally stuff even larger boxes at 12.8 inches.">ℹ️</span>
                    </label>
                  </div>

                  <div className="checkbox-group">
                    <label>
                      <input
                        type="checkbox"
                        checked={allowAlternateRotation}
                        onChange={(e) => setAllowAlternateRotation(e.target.checked)}
                        disabled={loading}
                      />
                      Allow alternate rotation
                      <span className="tooltip-trigger" data-tooltip="Prefer vertical or horizontal, but may rotate games for better fit">ℹ️</span>
                    </label>
                  </div>

                  <div className="checkbox-group">
                    <label>
                      <input
                        type="checkbox"
                        checked={optimizeSpace}
                        onChange={(e) => handleOptimizeSpaceChange(e.target.checked)}
                        disabled={loading}
                      />
                      Optimize for space
                      <span className="tooltip-trigger" data-tooltip="Ignore all sorting priorities, allow rotation, and pack games in as few cubes as possible">ℹ️</span>
                    </label>
                  </div>
                </div>

                <div className="form-group">
                  <label>Stacking Preference</label>
                  <div className="toggle-button-group">
                    <button
                      type="button"
                      className={`toggle-button ${!verticalStacking ? 'active' : ''}`}
                      onClick={() => setVerticalStacking(false)}
                      disabled={loading}
                    >
                      Horizontal
                    </button>
                    <button
                      type="button"
                      className={`toggle-button ${verticalStacking ? 'active' : ''}`}
                      onClick={() => setVerticalStacking(true)}
                      disabled={loading}
                    >
                      Vertical
                    </button>
                  </div>
                </div>

                <button type="submit" disabled={loading}>
                  {loading ? 'Processing...' : 'Organize Collection'}
                </button>
              </div>

              <div className="form-right">
                <SortablePriorities 
                  priorities={priorities} 
                  onChange={setPriorities}
                  disabled={optimizeSpace}
                />
              </div>
            </div>
          </form>
        </div>
      </section>

      {loading && (
        <div className="loading">
          <div className="spinner"></div>
          <p>{progress}</p>
        </div>
      )}

      {missingVersionWarning && (
        <MissingVersionsWarning
          warning={missingVersionWarning}
          onContinue={handleWarningContinue}
          onCancel={handleWarningCancel}
          isProcessing={loading}
        />
      )}

      {cubes && (
        <Results
          cubes={cubes}
          verticalStacking={verticalStacking}
          oversizedGames={oversizedGames}
          fitOversized={fitOversized}
        />
      )}

      <footer className="disclaimer-footer">
        <div className="footer-content">
          <div className="footer-section">
            <h4>About</h4>
            <p>
              This tool uses the <a href="https://boardgamegeek.com/using_the_xml_api" target="_blank" rel="noopener noreferrer">BoardGameGeek XML API2</a> to fetch your collection
              and calculates the optimal arrangement to fit your games into <a href="https://www.ikea.com/us/en/cat/kallax-shelving-units-58285/" target="_blank" rel="noopener noreferrer">IKEA Kallax shelving units</a>
              (13" W × 13" H × 15" D).
            </p>
          </div>
          <div className="footer-section">
            <h4>Disclaimer</h4>
            <p>
              BGCube is an independent tool not affiliated with or endorsed by BoardGameGeek or IKEA. 
              BoardGameGeek® is a trademark of BoardGameGeek, LLC. KALLAX® and IKEA® are trademarks of Inter IKEA Systems B.V.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;

