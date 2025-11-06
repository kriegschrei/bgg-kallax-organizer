import React, { useState } from 'react';
import SortablePriorities from './components/SortablePriorities';
import Results from './components/Results';
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

function App() {
  const [username, setUsername] = useState('');
  const [includePreordered, setIncludePreordered] = useState(false);
  const [includeExpansions, setIncludeExpansions] = useState(false);
  const [verticalStacking, setVerticalStacking] = useState(true);
  const [allowAlternateRotation, setAllowAlternateRotation] = useState(true);
  const [optimizeSpace, setOptimizeSpace] = useState(false);
  const [respectSortOrder, setRespectSortOrder] = useState(false);
  const [priorities, setPriorities] = useState(DEFAULT_PRIORITIES);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState('');
  const [cubes, setCubes] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!username.trim()) {
      setError('Please enter a BoardGameGeek username');
      return;
    }

    setLoading(true);
    setError(null);
    setCubes(null);
    setProgress('Fetching your collection from BoardGameGeek...');

    try {
      // Get fully processed and packed cubes from server
      const packedCubes = await fetchPackedCubes(
        username.trim(), 
        includePreordered, 
        includeExpansions,
        priorities,
        verticalStacking,
        allowAlternateRotation,
        optimizeSpace,
        respectSortOrder
      );
      
      if (!packedCubes || packedCubes.length === 0) {
        setError('No owned games found for this user');
        setLoading(false);
        return;
      }

      setProgress('Rendering results...');

      setCubes(packedCubes);
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
          <h1>BGG Kallax Organizer</h1>
          <p className="subtitle">
            Organize your BoardGameGeek collection into IKEA Kallax cubes
          </p>
        </div>
      </header>

      {error && (
        <div className="error">
          <strong>Error:</strong> {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="card">
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

            <div className="form-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={includePreordered}
                  onChange={(e) => setIncludePreordered(e.target.checked)}
                  disabled={loading}
                />
                Include pre-ordered games
              </label>
            </div>

            <div className="form-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={includeExpansions}
                  onChange={(e) => setIncludeExpansions(e.target.checked)}
                  disabled={loading}
                />
                Include expansions
              </label>
            </div>

            <div className="form-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={allowAlternateRotation}
                  onChange={(e) => setAllowAlternateRotation(e.target.checked)}
                  disabled={loading}
                />
                Allow alternate rotation for best fit
              </label>
            </div>

            <div className="form-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={optimizeSpace}
                  onChange={(e) => setOptimizeSpace(e.target.checked)}
                  disabled={loading}
                />
                Optimize for space (ignore alphabetical order, pack largest games first)
              </label>
            </div>

            <div className="form-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={respectSortOrder}
                  onChange={(e) => setRespectSortOrder(e.target.checked)}
                  disabled={loading || optimizeSpace}
                />
                Strictly respect sorting order (prevents backfilling earlier cubes)
              </label>
            </div>

            <div className="form-group">
              <label>Stacking Preference</label>
              <div className="radio-group">
                <label>
                  <input
                    type="radio"
                    name="stacking"
                    checked={verticalStacking}
                    onChange={() => setVerticalStacking(true)}
                    disabled={loading}
                  />
                  Vertical (standing upright)
                </label>
                <label>
                  <input
                    type="radio"
                    name="stacking"
                    checked={!verticalStacking}
                    onChange={() => setVerticalStacking(false)}
                    disabled={loading}
                  />
                  Horizontal (laying flat)
                </label>
              </div>
            </div>

            <button type="submit" disabled={loading}>
              {loading ? 'Processing...' : 'Organize Collection'}
            </button>
          </div>

          <div className="form-right">
            <SortablePriorities priorities={priorities} onChange={setPriorities} />
          </div>
        </div>
      </form>

      {loading && (
        <div className="loading">
          <div className="spinner"></div>
          <p>{progress}</p>
        </div>
      )}

      {cubes && <Results cubes={cubes} verticalStacking={verticalStacking} />}

      <footer>
        <p>
          <strong>About:</strong> This tool uses the BoardGameGeek XML API2 to fetch your collection
          and calculates the optimal arrangement to fit your games into IKEA Kallax cube organizers
          (13" W × 13" H × 15" D).
        </p>
        <p className="disclaimer">
          ⚠️ Some games may not have dimensions listed on BGG. For these games, default dimensions
          of 13"×13"×2" are assumed and marked with a warning icon.
        </p>
        <div className="bgg-attribution">
          <img 
            src="/powered_by_bgg.png" 
            alt="Powered by BoardGameGeek" 
            className="bgg-logo"
            onError={(e) => {
              e.target.style.display = 'none';
              e.target.nextSibling.style.display = 'block';
            }}
          />
          <p className="bgg-fallback" style={{ display: 'none' }}>
            Data provided by <a href="https://boardgamegeek.com" target="_blank" rel="noopener noreferrer">BoardGameGeek</a>
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;

