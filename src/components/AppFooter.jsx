import React from 'react';
import { FaBug } from 'react-icons/fa';

/**
 * Application footer component displaying disclaimer and links.
 */
export default function AppFooter() {
  return (
    <footer className="disclaimer-footer">
      <div className="footer-banner">
        <div className="banner-item">
          <a
            href="https://boardgamegeek.com"
            target="_blank"
            rel="noopener noreferrer"
            className="banner-link"
          >
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
          <a
            href="https://github.com/kriegschrei/bgg-kallax-organizer/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="banner-link"
          >
            <span className="banner-link-content banner-link-content--inverted">
              <FaBug aria-hidden="true" className="banner-link-icon banner-link-icon--inverted" />
              <span className="banner-link-text">Report Issues</span>
            </span>
          </a>
        </div>
      </div>
      <div className="footer-content">
        <div className="footer-section">
          <h4>About</h4>
          <p>
            This tool uses the{' '}
            <a
              href="https://boardgamegeek.com/using_the_xml_api"
              target="_blank"
              rel="noopener noreferrer"
            >
              BoardGameGeek XML API2
            </a>{' '}
            to fetch your collection and calculates the optimal arrangement to fit your games into{' '}
            <a
              href="https://www.ikea.com/us/en/cat/kallax-shelving-units-58285/"
              target="_blank"
              rel="noopener noreferrer"
            >
              IKEA Kallax shelving units
            </a>{' '}
            (13" W × 13" H × 15" D).
          </p>
        </div>
        <div className="footer-section">
          <h4>Disclaimer</h4>
          <p>
            BGCube is an independent tool not affiliated with or endorsed by BoardGameGeek or IKEA.
            BoardGameGeek® is a trademark of BoardGameGeek, LLC. KALLAX® and IKEA® are trademarks
            of Inter IKEA Systems B.V.
          </p>
        </div>
      </div>
    </footer>
  );
}

