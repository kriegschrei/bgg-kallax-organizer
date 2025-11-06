import React from 'react';
import './CubeVisualization.css';

const KALLAX_WIDTH = 13;
const KALLAX_HEIGHT = 13;
const SCALE = 20; // pixels per inch for visualization

// Helper function to get consistent color for a game
function getGameColor(index, total) {
  return `hsl(${(index * 360) / total}, 70%, 80%)`;
}

export default function CubeVisualization({ cube, verticalStacking }) {
  const canvasWidth = KALLAX_WIDTH * SCALE;
  const canvasHeight = KALLAX_HEIGHT * SCALE;

  return (
    <div className="cube-visualization">
      <h3>Cube #{cube.id}</h3>
      <div className="visualization-container">
        <div className="front-view">
          <h4>Front View</h4>
          <svg
            width={canvasWidth}
            height={canvasHeight}
            className="cube-svg"
          >
            {/* Kallax border */}
            <rect
              x="0"
              y="0"
              width={canvasWidth}
              height={canvasHeight}
              fill="none"
              stroke="#34495e"
              strokeWidth="2"
            />
            
            {/* Games - render using 2D positioning when available, otherwise row layout */}
            {cube.games && cube.games.map((game, index) => {
              // Use actual dimensions for display
              const actualDims = game.actualOrientedDims || game.orientedDims;
              // Use clamped dimensions for positioning calculations
              const clampedDims = game.orientedDims;
              
              let rectX, rectY;
              
              if (game.position) {
                // Use actual 2D bin packing position
                // Use clamped height for Y calculation since that's what packing used
                rectX = game.position.x * SCALE;
                rectY = canvasHeight - (game.position.y + clampedDims.y) * SCALE;
                
                // Debug first game
                if (index === 0) {
                  console.log('First game positioning:', {
                    name: game.name,
                    position: game.position,
                    clampedDims,
                    actualDims,
                    rectX,
                    rectY,
                    canvasHeight
                  });
                }
              } else {
                // Fallback to row-based positioning
                const rowIndex = cube.rows?.findIndex(r => r.games.includes(game)) ?? -1;
                
                if (rowIndex >= 0 && cube.rows[rowIndex]) {
                  const row = cube.rows[rowIndex];
                  const rowBottomOffset = cube.rows
                    .slice(0, rowIndex)
                    .reduce((sum, r) => sum + r.heightUsed, 0);
                  const xOffsetInRow = row.games
                    .slice(0, row.games.indexOf(game))
                    .reduce((sum, g) => sum + g.orientedDims.x, 0);
                  
                  rectX = xOffsetInRow * SCALE;
                  rectY = canvasHeight - (rowBottomOffset + clampedDims.y) * SCALE;
                } else {
                  // Default positioning if row structure is missing
                  console.warn('Game missing row data:', game.name, game);
                  rectX = 0;
                  rectY = 0;
                }
              }
              
              // Display actual dimensions (may extend beyond cube boundaries)
              const rectWidth = actualDims.x * SCALE;
              const rectHeight = actualDims.y * SCALE;
                
              return (
                <g key={game.id}>
                  <rect
                    x={rectX}
                    y={rectY}
                    width={rectWidth}
                    height={rectHeight}
                    fill={getGameColor(index, cube.games.length)}
                    stroke={(game.oversizedX || game.oversizedY) ? "#e74c3c" : "#2c3e50"}
                    strokeWidth={(game.oversizedX || game.oversizedY) ? "2" : "1"}
                    strokeDasharray={(game.oversizedX || game.oversizedY) ? "4,2" : "none"}
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
          <p className="dimension-label">13" W × 13" H</p>
        </div>
        
        <div className="list-view">
          <h4>Game List (In Order)</h4>
          <ol>
            {cube.games.map((game, index) => (
              <li 
                key={game.id}
                style={{ 
                  backgroundColor: getGameColor(index, cube.games.length),
                  borderLeft: `4px solid ${getGameColor(index, cube.games.length).replace('80%', '60%')}`
                }}
              >
                <strong>{game.name}</strong>
                <div className="game-details">
                  <span className="dimension-info">
                    {(game.actualOrientedDims || game.orientedDims).x.toFixed(1)}" × {(game.actualOrientedDims || game.orientedDims).y.toFixed(1)}" × {(game.actualOrientedDims || game.orientedDims).z.toFixed(1)}"
                    {game.dimensions.missingDimensions && 
                      <span className="warning" title="Dimensions not available in BGG"> ⚠️</span>
                    }
                    {(game.oversizedX || game.oversizedY) && 
                      <span className="warning" title={`This game may be too large for the cube (${game.oversizedX ? 'width' : ''}${game.oversizedX && game.oversizedY ? ' and ' : ''}${game.oversizedY ? 'height' : ''} > 13")`}> 📦</span>
                    }
                  </span>
                  {game.categories && game.categories.length > 0 && (
                    <span className="category">{game.categories[0]}</span>
                  )}
                  {game.bggRank && (
                    <span className="rank">Rank: #{game.bggRank}</span>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}

