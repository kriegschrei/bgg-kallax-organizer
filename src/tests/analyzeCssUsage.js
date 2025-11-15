/**
 * CSS Usage Analyzer
 * 
 * Analyzes CSS files to find potentially unused classes.
 * This script parses CSS files and searches JSX/JS files for className usage.
 * 
 * Usage: node src/tests/analyzeCssUsage.js
 * 
 * Note: This is a basic analyzer. For production use, consider tools like:
 * - PurgeCSS
 * - uncss
 * - stylelint with unused-selectors plugin
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Extracts class names from CSS content.
 * @param {string} cssContent - The CSS file content
 * @returns {Set<string>} Set of class names found
 */
function extractClassNames(cssContent) {
  const classNames = new Set();
  // Match CSS class selectors: .class-name, .class-name:hover, etc.
  const classRegex = /\.([a-zA-Z0-9_-]+)(?::[a-zA-Z-]+|\[|,|$|\s)/g;
  let match;

  while ((match = classRegex.exec(cssContent)) !== null) {
    const className = match[1];
    // Skip CSS variables and pseudo-classes
    if (!className.startsWith('--') && !className.includes(':')) {
      classNames.add(className);
    }
  }

  return classNames;
}

/**
 * Finds all CSS files in the src directory.
 * @param {string} dir - Directory to search
 * @returns {string[]} Array of CSS file paths
 */
function findCssFiles(dir) {
  const cssFiles = [];
  const files = fs.readdirSync(dir, { withFileTypes: true });

  for (const file of files) {
    const fullPath = path.join(dir, file.name);
    if (file.isDirectory()) {
      cssFiles.push(...findCssFiles(fullPath));
    } else if (file.name.endsWith('.css')) {
      cssFiles.push(fullPath);
    }
  }

  return cssFiles;
}

/**
 * Finds all JSX/JS files in the src directory.
 * @param {string} dir - Directory to search
 * @returns {string[]} Array of JSX/JS file paths
 */
function findJsFiles(dir) {
  const jsFiles = [];
  const files = fs.readdirSync(dir, { withFileTypes: true });

  for (const file of files) {
    const fullPath = path.join(dir, file.name);
    if (file.isDirectory() && !file.name.includes('node_modules')) {
      jsFiles.push(...findJsFiles(fullPath));
    } else if (file.name.endsWith('.js') || file.name.endsWith('.jsx')) {
      jsFiles.push(fullPath);
    }
  }

  return jsFiles;
}

/**
 * Extracts class names used in JSX/JS files.
 * @param {string} filePath - Path to JSX/JS file
 * @returns {Set<string>} Set of class names found
 */
function extractUsedClasses(filePath) {
  const usedClasses = new Set();
  const content = fs.readFileSync(filePath, 'utf-8');

  // Match className="..." or className={`...`} or className={...}
  const classNameRegex = /className\s*=\s*["'`]([^"'`]+)["'`]|className\s*=\s*\{[^}]*["'`]([^"'`]+)["'`]/g;
  let match;

  while ((match = classNameRegex.exec(content)) !== null) {
    const classString = match[1] || match[2];
    if (classString) {
      // Split by spaces and add each class
      classString.split(/\s+/).forEach((cls) => {
        const trimmed = cls.trim();
        if (trimmed) {
          usedClasses.add(trimmed);
        }
      });
    }
  }

  return usedClasses;
}

/**
 * Main analysis function.
 */
function analyzeCssUsage() {
  const srcDir = path.join(__dirname, '..');
  const cssFiles = findCssFiles(srcDir);
  const jsFiles = findJsFiles(srcDir);

  console.log(`Found ${cssFiles.length} CSS files`);
  console.log(`Found ${jsFiles.length} JS/JSX files\n`);

  const allDefinedClasses = new Set();
  const allUsedClasses = new Set();

  // Extract all defined classes from CSS files
  for (const cssFile of cssFiles) {
    const content = fs.readFileSync(cssFile, 'utf-8');
    const classes = extractClassNames(content);
    classes.forEach((cls) => allDefinedClasses.add(cls));
    console.log(`${path.relative(srcDir, cssFile)}: ${classes.size} classes`);
  }

  // Extract all used classes from JS/JSX files
  for (const jsFile of jsFiles) {
    const classes = extractUsedClasses(jsFile);
    classes.forEach((cls) => allUsedClasses.add(cls));
  }

  // Find potentially unused classes
  const unusedClasses = Array.from(allDefinedClasses).filter(
    (cls) => !allUsedClasses.has(cls)
  );

  console.log(`\nTotal defined classes: ${allDefinedClasses.size}`);
  console.log(`Total used classes: ${allUsedClasses.size}`);
  console.log(`\nPotentially unused classes (${unusedClasses.length}):`);

  if (unusedClasses.length > 0) {
    unusedClasses.sort().forEach((cls) => {
      console.log(`  - .${cls}`);
    });
    console.log(
      '\nNote: Some classes may be used dynamically or in template strings.'
    );
  } else {
    console.log('  None found!');
  }
}

// Run the analyzer
try {
  analyzeCssUsage();
} catch (error) {
  console.error('Error analyzing CSS usage:', error);
  process.exit(1);
}

