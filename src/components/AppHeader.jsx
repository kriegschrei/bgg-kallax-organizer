import React from 'react';

/**
 * Application header component displaying logo, subtitle, and Ko-fi widget.
 */
export default function AppHeader() {
  return (
    <header>
      <div className="header-content">
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
        <div className="kofi-widget" aria-live="polite">
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
    </header>
  );
}

