import React, { useState } from 'react';
import CubeVisualization from './CubeVisualization';
import { calculateStats } from '../services/packing';
import './Results.css';

export default function Results({ cubes, verticalStacking, oversizedGames = [], fitOversized = false }) {
  const stats = calculateStats(cubes, verticalStacking);
  const [missingDimsExpanded, setMissingDimsExpanded] = useState(false);
  const [exceedingCapacityExpanded, setExceedingCapacityExpanded] = useState(false);
  const [guessedVersionsExpanded, setGuessedVersionsExpanded] = useState(false);
  const [selectedVersionFallbackExpanded, setSelectedVersionFallbackExpanded] = useState(false);

  // Collect games with missing dimensions, exceeding cube capacity, and those using alternate versions
  const gamesWithMissingDimensions = [];
  const gamesWithGuessedVersions = [];
  const gamesUsingFallbackForSelectedVersion = [];
  
  cubes.forEach(cube => {
    cube.games.forEach(game => {
      const baseGameData = { ...game, cubeId: cube.id };

      if (game.dimensions?.missingDimensions && !game.missingVersion) {
        gamesWithMissingDimensions.push(baseGameData);
      }
      if (game.missingVersion) {
        gamesWithGuessedVersions.push({ ...baseGameData, versionsUrl: game.versionsUrl });
      }
      if (game.usedAlternateVersionDims) {
        gamesUsingFallbackForSelectedVersion.push({
          ...baseGameData,
          versionsUrl: game.versionsUrl,
          correctionUrl: game.correctionUrl,
        });
      }
    });
  });

  // Sort games alphabetically by name
  const sortByName = (a, b) => a.name.localeCompare(b.name);
  gamesWithMissingDimensions.sort(sortByName);
  gamesWithGuessedVersions.sort(sortByName);
  gamesUsingFallbackForSelectedVersion.sort(sortByName);

  const oversizedWarningGames = oversizedGames
    ? oversizedGames.map((game) => ({
        ...game,
        cubeId: game.cubeId ?? null,
        correctionUrl: game.correctionUrl ?? null,
        versionsUrl: game.versionsUrl ?? null,
      }))
    : [];
  oversizedWarningGames.sort(sortByName);

  const showGuessedVersionInfo = gamesWithGuessedVersions.length > 0;
  const showSelectedVersionFallback = gamesUsingFallbackForSelectedVersion.length > 0;
  const showMissingDimensions = gamesWithMissingDimensions.length > 0;
  const showOversizedWarning = oversizedWarningGames.length > 0;
  const totalWarningPanels = [
    showGuessedVersionInfo,
    showSelectedVersionFallback,
    showMissingDimensions,
    showOversizedWarning
  ].filter(Boolean).length;

  return (
    <div className="results">
      <h2>Packing Results</h2>
      
      <div className="stats-summary card">
        <div className="stat">
          <span className="stat-value">{stats.totalGames}</span>
          <span className="stat-label">Total Games</span>
        </div>
        <div className="stat">
          <span className="stat-value">{stats.totalCubes}</span>
          <span className="stat-label">Kallax Cubes Needed</span>
        </div>
        <div className="stat">
          <span className="stat-value">{stats.avgGamesPerCube}</span>
          <span className="stat-label">Avg Games/Cube</span>
        </div>
        <div className="stat">
          <span className="stat-value">{stats.avgUtilization}%</span>
          <span className="stat-label">Avg Space Utilization</span>
        </div>
      </div>

      {(showGuessedVersionInfo || showSelectedVersionFallback || showMissingDimensions || showOversizedWarning) && (
        <div className={`results-warnings warnings-count-${totalWarningPanels}`}>
          {showGuessedVersionInfo && (
            <div className="warning-box info-box">
              <button
                className="warning-header"
                onClick={() => setGuessedVersionsExpanded(!guessedVersionsExpanded)}
                aria-expanded={guessedVersionsExpanded}
              >
                <span className="warning-arrow">{guessedVersionsExpanded ? '▼' : '▶'}</span>
                <strong>ℹ️ No Version Selected ({gamesWithGuessedVersions.length})</strong>
              </button>
              {guessedVersionsExpanded && (
                <div className="warning-content">
                  <div className="warning-description">
                    No specific BoardGameGeek version was selected for these game{gamesWithGuessedVersions.length !== 1 ? 's' : ''}. We guessed an alternate version to estimate dimensions. Selecting the right version keeps future calculations accurate and avoids guesswork.
                  </div>
                  <ul className={`warning-game-list ${gamesWithGuessedVersions.length > 8 ? 'scrollable' : ''}`}>
                    {gamesWithGuessedVersions.map((game) => (
                      <li key={game.id}>
                        {game.versionsUrl ? (
                          <a href={game.versionsUrl} target="_blank" rel="noopener noreferrer">
                            {game.name}
                          </a>
                        ) : (
                          game.name
                        )}
                        {` (Cube #${game.cubeId})`}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          {showSelectedVersionFallback && (
            <div className="warning-box selected-version-box">
              <button
                className="warning-header"
                onClick={() => setSelectedVersionFallbackExpanded(!selectedVersionFallbackExpanded)}
                aria-expanded={selectedVersionFallbackExpanded}
              >
                <span className="warning-arrow">{selectedVersionFallbackExpanded ? '▼' : '▶'}</span>
                <strong>🛠️ Selected Version Missing Dimensions ({gamesUsingFallbackForSelectedVersion.length})</strong>
              </button>
              {selectedVersionFallbackExpanded && (
                <div className="warning-content">
                  <div className="warning-description">
                    The version you selected on BoardGameGeek does not list its measurements. We substituted dimensions from a different version so packing could continue. Updating your chosen version with accurate measurements will make future runs exact.
                  </div>
                  <ul className={`warning-game-list ${gamesUsingFallbackForSelectedVersion.length > 8 ? 'scrollable' : ''}`}>
                    {gamesUsingFallbackForSelectedVersion.map((game) => (
                      <li key={game.id}>
                        {game.versionsUrl ? (
                          <a href={game.versionsUrl} target="_blank" rel="noopener noreferrer">
                            {game.name}
                          </a>
                        ) : (
                          game.name
                        )}
                        {` (Cube #${game.cubeId})`}
                        {game.correctionUrl && (
                          <>
                            {` — `}
                            <a href={game.correctionUrl} target="_blank" rel="noopener noreferrer" className="correction-link">
                              Submit dimensions
                            </a>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          {gamesWithMissingDimensions.length > 0 && (
            <div className="warning-box">
              <button 
                className="warning-header"
                onClick={() => setMissingDimsExpanded(!missingDimsExpanded)}
                aria-expanded={missingDimsExpanded}
              >
                <span className="warning-arrow">{missingDimsExpanded ? '▼' : '▶'}</span>
                <strong>⚠️ All Versions Missing Dimensions ({gamesWithMissingDimensions.length})</strong>
              </button>
              {missingDimsExpanded && (
                <div className="warning-content">
                  <div className="warning-description">
                    {gamesWithMissingDimensions.length} game{gamesWithMissingDimensions.length !== 1 ? 's' : ''} {gamesWithMissingDimensions.length !== 1 ? 'have' : 'has'} a selected BoardGameGeek version without dimensions. 
                    Default dimensions of 12.8" × 12.8" × 1.8" were assumed and marked with a warning icon (⚠️).
                  </div>
                  <ul className={`warning-game-list ${gamesWithMissingDimensions.length > 8 ? 'scrollable' : ''}`}>
                    {gamesWithMissingDimensions.map((game) => (
                      <li key={game.id}>
                        {game.correctionUrl ? (
                          <a href={game.correctionUrl} target="_blank" rel="noopener noreferrer" className="correction-link">
                            {game.name}
                          </a>
                        ) : (
                          game.name
                        )}
                        {` (Cube #${game.cubeId})`}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          {showOversizedWarning && (
            <div className="warning-box">
              <button 
                className="warning-header"
                onClick={() => setExceedingCapacityExpanded(!exceedingCapacityExpanded)}
                aria-expanded={exceedingCapacityExpanded}
              >
                <span className="warning-arrow">{exceedingCapacityExpanded ? '▼' : '▶'}</span>
                <strong>📦 Games Exceeding Cube Capacity ({oversizedWarningGames.length})</strong>
              </button>
              {exceedingCapacityExpanded && (
                <div className="warning-content">
                  <div className="warning-description">
                    {fitOversized
                      ? 'The following games have dimensions too large to fit in the Kallax. They have been treated as having dimensions of 12.8 to fit, but may not actually fit.'
                      : 'The following games have dimensions too large to fit in the Kallax. They have not been included in the list below.'}
                    {' '}
                    If you believe the dimensions are incorrect, please click the game name below to submit a dimension correction in BoardGameGeek.
                  </div>
                  <ul className={`warning-game-list ${oversizedWarningGames.length > 8 ? 'scrollable' : ''}`}>
                    {oversizedWarningGames.map((game) => {
                      const link = game.correctionUrl || game.versionsUrl;
                      return (
                        <li key={game.id}>
                          {link ? (
                            <a href={link} target="_blank" rel="noopener noreferrer" className="correction-link">
                              {game.name}
                            </a>
                          ) : (
                            game.name
                          )}
                          {fitOversized && game.cubeId ? ` (Cube #${game.cubeId})` : null}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="cubes-container">
        {cubes.map((cube) => (
          <CubeVisualization
            key={cube.id}
            cube={cube}
            verticalStacking={verticalStacking}
          />
        ))}
      </div>
    </div>
  );
}

