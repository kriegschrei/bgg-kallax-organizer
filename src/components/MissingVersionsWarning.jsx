import React from 'react';
import './MissingVersionsWarning.css';

export default function MissingVersionsWarning({
  warning = { message: '', details: '', games: [] },
  onContinue = () => {},
  onCancel = () => {},
  isProcessing = false,
}) {
  const { message, details, games } = warning || {};

  return (
    <div className="missing-versions-backdrop" role="dialog" aria-modal="true" aria-labelledby="missing-versions-title">
      <div className="missing-versions-modal">
        <div className="missing-versions-header">
          <h2 id="missing-versions-title">Version Selection Needed</h2>
        </div>
        <div className="missing-versions-body">
          {message && <p className="missing-versions-message">{message}</p>}
          {details && <p className="missing-versions-details">{details}</p>}
          {Array.isArray(games) && games.length > 0 && (
            <div className="missing-versions-list">
              <h3>Games without a selected version</h3>
              <ul>
                {games.map((game, index) => (
                  <li key={game.versionKey || game.id || index}>
                    <a href={game.versionsUrl} target="_blank" rel="noopener noreferrer">
                      {game.displayName || game.gameName || 'Unknown Game'}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="missing-versions-footer">
          <button type="button" className="btn-secondary" onClick={onCancel} disabled={isProcessing}>
            Cancel
          </button>
          <button type="button" className="btn-primary" onClick={onContinue} disabled={isProcessing}>
            Continue Anyway
          </button>
        </div>
      </div>
    </div>
  );
}

