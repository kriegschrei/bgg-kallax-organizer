import React from 'react';
import CubeVisualization from './CubeVisualization';
import { calculateStats } from '../services/packing';
import './Results.css';

export default function Results({ cubes, verticalStacking }) {
  const stats = calculateStats(cubes, verticalStacking);

  // Collect games with missing dimensions
  const gamesWithMissingDimensions = [];
  const gamesExceedingCapacity = [];
  
  cubes.forEach(cube => {
    cube.games.forEach(game => {
      if (game.dimensions?.missingDimensions) {
        gamesWithMissingDimensions.push(game);
      }
      if (game.oversizedX || game.oversizedY) {
        gamesExceedingCapacity.push(game);
      }
    });
  });

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
              <strong>⚠️ Missing Dimensions:</strong> {gamesWithMissingDimensions.length} game{gamesWithMissingDimensions.length !== 1 ? 's' : ''} {gamesWithMissingDimensions.length !== 1 ? 'do' : 'does'} not have dimensions listed on BGG. 
              Default dimensions of 13"×13"×2" were assumed and marked with a warning icon (⚠️).
            </div>
          )}
          {gamesExceedingCapacity.length > 0 && (
            <div className="warning-box">
              <strong>📦 Games Exceeding Cube Capacity:</strong> {gamesExceedingCapacity.length} game{gamesExceedingCapacity.length !== 1 ? 's' : ''} {gamesExceedingCapacity.length !== 1 ? 'have' : 'has'} physical dimensions that exceed the capacity of a Kallax cube (13" × 13" × 15"). 
              Pseudo-dimensions were used to fit these games, and they are marked with a box icon (📦).
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

