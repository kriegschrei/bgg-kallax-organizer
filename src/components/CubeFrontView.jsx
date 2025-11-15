import React from 'react';
import { getGameColor } from '../utils/cubeVisualization';

function CubeFrontView({ cube, canvasWidth, canvasHeight, scale }) {
  const games = Array.isArray(cube.games) ? cube.games : [];

  return (
    <div className="front-view">
      <svg width={canvasWidth} height={canvasHeight} className="cube-svg">
        {games.map((game, index) => {
          // Use position and packedDims directly from API response
          const positionX = game.position?.x ?? 0;
          const positionY = game.position?.y ?? 0;
          const packedDims = game.packedDims ?? { x: 0, y: 0, z: 0 };
          
          const rectX = positionX * scale;
          const rectY = canvasHeight - (positionY + packedDims.y) * scale;

          if (packedDims.x <= 0 || packedDims.y <= 0) {
            return null;
          }

          const rectWidth = packedDims.x * scale;
          const rectHeight = packedDims.y * scale;
          const isOversized = game.oversized?.x || game.oversized?.y;

          return (
            <g key={game.versionKey || game.id || index}>
              <rect
                x={rectX}
                y={rectY}
                width={rectWidth}
                height={rectHeight}
                fill={getGameColor(index, games.length)}
                stroke={isOversized ? '#e74c3c' : '#2c3e50'}
                strokeWidth={isOversized ? '2' : '1'}
                strokeDasharray={isOversized ? '4,2' : 'none'}
              />
              <text
                x={rectX + rectWidth / 2}
                y={rectY + rectHeight / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="12"
                fontWeight="bold"
                fill="#2c3e50"
                className="game-label"
              >
                {index + 1}
              </text>
            </g>
          );
        })}
        <rect x="0" y="0" width={canvasWidth} height={canvasHeight} fill="none" stroke="#34495e" strokeWidth="2" />
      </svg>
    </div>
  );
}

export default CubeFrontView;

