import React, { useState } from 'react';
import CubeVisualization from './CubeVisualization';
import { calculateStats } from '../services/packing';
import './Results.css';

export default function Results({ cubes, verticalStacking }) {
  const stats = calculateStats(cubes, verticalStacking);
  const [missingDimsExpanded, setMissingDimsExpanded] = useState(false);
  const [exceedingCapacityExpanded, setExceedingCapacityExpanded] = useState(false);

  // Collect games with missing dimensions and their cube IDs
  const gamesWithMissingDimensions = [];
  const gamesExceedingCapacity = [];
  
  cubes.forEach(cube => {
    cube.games.forEach(game => {
      if (game.dimensions?.missingDimensions) {
        gamesWithMissingDimensions.push({ ...game, cubeId: cube.id });
      }
      if (game.oversizedX || game.oversizedY) {
        gamesExceedingCapacity.push({ ...game, cubeId: cube.id });
      }
    });
  });

  // Sort games alphabetically by name
  gamesWithMissingDimensions.sort((a, b) => a.name.localeCompare(b.name));
  gamesExceedingCapacity.sort((a, b) => a.name.localeCompare(b.name));

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

      {(gamesWithMissingDimensions.length > 0 || gamesExceedingCapacity.length > 0) && (
        <div className="results-warnings">
          {gamesWithMissingDimensions.length > 0 && (
            <div className="warning-box">
              <button 
                className="warning-header"
                onClick={() => setMissingDimsExpanded(!missingDimsExpanded)}
                aria-expanded={missingDimsExpanded}
              >
                <span className="warning-arrow">{missingDimsExpanded ? '▼' : '▶'}</span>
                <strong>⚠️ Missing Dimensions ({gamesWithMissingDimensions.length})</strong>
              </button>
              {missingDimsExpanded && (
                <div className="warning-content">
                  <div className="warning-description">
                    {gamesWithMissingDimensions.length} game{gamesWithMissingDimensions.length !== 1 ? 's' : ''} {gamesWithMissingDimensions.length !== 1 ? 'do' : 'does'} not have dimensions listed on BGG. 
                    Default dimensions of 13"×13"×2" were assumed and marked with a warning icon (⚠️).
                  </div>
                  <ul className={`warning-game-list ${gamesWithMissingDimensions.length > 8 ? 'scrollable' : ''}`}>
                    {gamesWithMissingDimensions.map((game) => (
                      <li key={game.id}>
                        {game.name} (Cube #{game.cubeId})
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          {gamesExceedingCapacity.length > 0 && (
            <div className="warning-box">
              <button 
                className="warning-header"
                onClick={() => setExceedingCapacityExpanded(!exceedingCapacityExpanded)}
                aria-expanded={exceedingCapacityExpanded}
              >
                <span className="warning-arrow">{exceedingCapacityExpanded ? '▼' : '▶'}</span>
                <strong>📦 Games Exceeding Cube Capacity ({gamesExceedingCapacity.length})</strong>
              </button>
              {exceedingCapacityExpanded && (
                <div className="warning-content">
                  <div className="warning-description">
                    {gamesExceedingCapacity.length} game{gamesExceedingCapacity.length !== 1 ? 's' : ''} {gamesExceedingCapacity.length !== 1 ? 'have' : 'has'} physical dimensions that exceed the capacity of a Kallax cube (13" × 13" × 15"). 
                    Pseudo-dimensions were used to fit these games, and they are marked with a box icon (📦).
                  </div>
                  <ul className={`warning-game-list ${gamesExceedingCapacity.length > 8 ? 'scrollable' : ''}`}>
                    {gamesExceedingCapacity.map((game) => (
                      <li key={game.id}>
                        {game.name} (Cube #{game.cubeId})
                      </li>
                    ))}
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

