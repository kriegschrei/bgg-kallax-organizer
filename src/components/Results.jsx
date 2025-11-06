import React from 'react';
import CubeVisualization from './CubeVisualization';
import { calculateStats } from '../services/packing';
import './Results.css';

export default function Results({ cubes, verticalStacking }) {
  const stats = calculateStats(cubes, verticalStacking);

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

