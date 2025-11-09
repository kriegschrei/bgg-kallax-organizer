import React from 'react';
import { getGameColor } from '../utils/cubeVisualization';

function CubeFrontView({ cube, canvasWidth, canvasHeight, scale }) {
  const games = Array.isArray(cube.games) ? cube.games : [];

  return (
    <div className="front-view">
      <svg width={canvasWidth} height={canvasHeight} className="cube-svg">
        <rect x="0" y="0" width={canvasWidth} height={canvasHeight} fill="none" stroke="#34495e" strokeWidth="2" />

        {games.map((game, index) => {
          const actualDims = game.actualOrientedDims || game.orientedDims;
          const clampedDims = game.orientedDims;

          let rectX = 0;
          let rectY = 0;

          if (game.position) {
            rectX = game.position.x * scale;
            rectY = canvasHeight - (game.position.y + clampedDims.y) * scale;
          } else {
            const rowIndex = cube.rows?.findIndex((row) => row.games.includes(game)) ?? -1;
            if (rowIndex >= 0 && cube.rows[rowIndex]) {
              const row = cube.rows[rowIndex];
              const rowBottomOffset = cube.rows
                .slice(0, rowIndex)
                .reduce((sum, r) => sum + r.heightUsed, 0);

              const xOffsetInRow = row.games
                .slice(0, row.games.indexOf(game))
                .reduce((sum, g) => sum + g.orientedDims.x, 0);

              rectX = xOffsetInRow * scale;
              rectY = canvasHeight - (rowBottomOffset + clampedDims.y) * scale;
            } else {
              console.warn('Game missing row data:', game.name, game);
            }
          }

          const rectWidth = actualDims.x * scale;
          const rectHeight = actualDims.y * scale;
          const isOversized = game.oversizedX || game.oversizedY;

          return (
            <g key={game.id}>
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
      </svg>
    </div>
  );
}

export default CubeFrontView;

