import React, { useEffect, useState } from 'react';
import { FaPrint } from 'react-icons/fa';
import IconButton from './IconButton';
import { MOBILE_BREAKPOINT } from '../constants/appDefaults';
import bgcubeLogoSquare from '../assets/bgcube_logo_square.png';
import kofiSymbol from '../assets/kofi_symbol.svg';
import patreonLogo from '../assets/patreon_logo.svg';

/**
 * Application header component displaying logo, subtitle, and Ko-fi widget.
 * @param {boolean} hasResults - Whether there are results to print
 * @param {boolean} isMetric - Whether metric units are enabled
 * @param {Function} onToggleMetric - Handler for toggling metric units
 */
export default function AppHeader({ hasResults = false, isMetric = false, onToggleMetric }) {
  const handlePrint = () => {
    window.print();
  };

  const [isMobile, setIsMobile] = useState(() => 
    typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT
  );

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    // Only load Patreon widget script on desktop
    if (!isMobile) {
      const script = document.createElement('script');
      script.src = 'https://c6.patreon.com/becomePatronButton.bundle.js';
      script.async = true;
      document.body.appendChild(script);

      return () => {
        const existingScript = document.querySelector('script[src="https://c6.patreon.com/becomePatronButton.bundle.js"]');
        if (existingScript) {
          document.body.removeChild(existingScript);
        }
      };
    }
  }, [isMobile]);

  return (
    <header>
      <div className="header-content">
        {!isMobile ? (
          <>
            {/* Desktop: Top row - Logo | space | Support buttons */}
            <div className="header-top-row">
              <img 
                src="/bgcube_logo.png" 
                alt="BGCUBE.app" 
                className="app-logo" 
              />
              <div className="header-spacer"></div>
              <div className="support-widgets">
                <div className="patreon-widget">
                  <a
                    href="https://www.patreon.com/bePatron?u=44563871"
                    data-patreon-widget-type="become-patron-button"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Become a member!
                  </a>
                </div>
                <div className="kofi-widget">
                  <a
                    href="https://ko-fi.com/A0A11G62JT"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <img
                      src="https://storage.ko-fi.com/cdn/kofi6.png?v=6"
                      alt="Buy Me a Coffee at ko-fi.com"
                      height="36"
                    />
                  </a>
                </div>
              </div>
            </div>

            {/* Desktop: Bottom row - Subtitle | space | Controls */}
            <div className="header-bottom-row">
              <p className="subtitle">
                Organize your{' '}
                <a
                  href="https://boardgamegeek.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="subtitle-link"
                >
                  BoardGameGeek
                </a>{' '}
                collection into{' '}
                <a
                  href="https://www.ikea.com/us/en/cat/kallax-shelving-units-58285/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="subtitle-link"
                >
                  IKEA Kallax shelving units
                </a>
              </p>
              <div className="header-spacer"></div>
              <div className="header-controls-bar">
                {hasResults && (
                  <IconButton
                    className="print-button"
                    onClick={handlePrint}
                    icon={FaPrint}
                    srLabel="Print"
                    title="Print this page"
                  />
                )}
                <div className="unit-toggle-group">
                  <button
                    type="button"
                    className={`unit-toggle-button ${!isMetric ? 'active' : ''}`}
                    onClick={() => isMetric && onToggleMetric && onToggleMetric()}
                    disabled={!isMetric}
                    title="Imperial units (inches, lbs)"
                    aria-pressed={!isMetric}
                  >
                    Imperial
                  </button>
                  <button
                    type="button"
                    className={`unit-toggle-button ${isMetric ? 'active' : ''}`}
                    onClick={() => !isMetric && onToggleMetric && onToggleMetric()}
                    disabled={isMetric}
                    title="Metric units (cm, grams)"
                    aria-pressed={isMetric}
                  >
                    Metric
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Mobile: Compact layout */}
            <div className="header-top-bar">
              <img 
                src={bgcubeLogoSquare} 
                alt="BGCUBE.app" 
                className="app-logo" 
              />
              <div className="support-widgets">
                <div className="patreon-widget">
                  <a
                    href="https://www.patreon.com/bePatron?u=44563871"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="patreon-mobile-link"
                    aria-label="Support on Patreon"
                  >
                    <img
                      src={patreonLogo}
                      alt="Patreon"
                      className="patreon-logo-icon"
                    />
                  </a>
                </div>
                <div className="kofi-widget">
                  <a
                    href="https://ko-fi.com/A0A11G62JT"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="kofi-mobile-link"
                    aria-label="Buy Me a Coffee on Ko-fi"
                  >
                    <img
                      src={kofiSymbol}
                      alt="Ko-fi"
                      className="kofi-symbol-icon"
                    />
                  </a>
                </div>
              </div>
            </div>

            <div className="header-controls-bar">
              {hasResults && (
                <IconButton
                  className="print-button"
                  onClick={handlePrint}
                  icon={FaPrint}
                  srLabel="Print"
                  title="Print this page"
                />
              )}
              <div className="unit-toggle-group">
                <button
                  type="button"
                  className={`unit-toggle-button ${!isMetric ? 'active' : ''}`}
                  onClick={() => isMetric && onToggleMetric && onToggleMetric()}
                  disabled={!isMetric}
                  title="Imperial units (inches, lbs)"
                  aria-pressed={!isMetric}
                >
                  Imperial
                </button>
                <button
                  type="button"
                  className={`unit-toggle-button ${isMetric ? 'active' : ''}`}
                  onClick={() => !isMetric && onToggleMetric && onToggleMetric()}
                  disabled={isMetric}
                  title="Metric units (cm, grams)"
                  aria-pressed={isMetric}
                >
                  Metric
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </header>
  );
}

