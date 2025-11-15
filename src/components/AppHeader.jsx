import React, { useEffect } from 'react';
import { FaPrint } from 'react-icons/fa';
import IconButton from './IconButton';

/**
 * Application header component displaying logo, subtitle, and Ko-fi widget.
 * @param {boolean} hasResults - Whether there are results to print
 */
export default function AppHeader({ hasResults = false }) {
  const handlePrint = () => {
    window.print();
  };

  useEffect(() => {
    // Load Patreon widget script
    const script = document.createElement('script');
    script.src = 'https://c6.patreon.com/becomePatronButton.bundle.js';
    script.async = true;
    document.body.appendChild(script);

    return () => {
      // Cleanup script on unmount
      const existingScript = document.querySelector('script[src="https://c6.patreon.com/becomePatronButton.bundle.js"]');
      if (existingScript) {
        document.body.removeChild(existingScript);
      }
    };
  }, []);

  return (
    <header>
      <div className="header-content">
        {hasResults && (
          <IconButton
            className="print-button"
            onClick={handlePrint}
            icon={FaPrint}
            srLabel="Print"
            title="Print this page"
          />
        )}
        <img src="/bgcube_logo.png" alt="BGCUBE.app" className="app-logo" />
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
        <div className="support-widgets" aria-live="polite">
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
    </header>
  );
}

