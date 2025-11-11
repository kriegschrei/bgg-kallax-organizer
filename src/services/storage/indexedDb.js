import { openDB } from 'idb';

const DB_NAME = 'bgcube-user-data';
const DB_VERSION = 3;

const STORE_EXCLUDED = 'excludedGames';
const STORE_ORIENTATION = 'orientationOverrides';
const STORE_DIMENSIONS = 'dimensionOverrides';
const STORE_SETTINGS = 'userSettings';
const STORE_RESULTS = 'lastResults';

const STORE_DEFINITIONS = [
  { name: STORE_EXCLUDED, options: { keyPath: 'key' } },
  { name: STORE_ORIENTATION, options: { keyPath: 'key' } },
  { name: STORE_DIMENSIONS, options: { keyPath: 'key' } },
  { name: STORE_SETTINGS, options: { keyPath: 'id' } },
  { name: STORE_RESULTS, options: { keyPath: 'id' } },
];

let dbPromise = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        STORE_DEFINITIONS.forEach(({ name, options }) => {
          if (db.objectStoreNames.contains(name)) {
            db.deleteObjectStore(name);
          }
          db.createObjectStore(name, options);
        });
      },
    });
  }
  return dbPromise;
}

function withTimestamp(payload = {}) {
  return {
    ...payload,
    updatedAt: Date.now(),
  };
}

async function readAll(storeName) {
  const db = await getDb();
  return db.getAll(storeName);
}

async function readOne(storeName, key, { ignoreNotFound = false } = {}) {
  const db = await getDb();
  try {
    return await db.get(storeName, key);
  } catch (error) {
    if (ignoreNotFound && error?.name === 'NotFoundError') {
      return null;
    }
    throw error;
  }
}

async function putRecord(storeName, record) {
  const db = await getDb();
  await db.put(storeName, withTimestamp(record));
}

async function deleteById(storeName, id) {
  if (!id) {
    return;
  }
  const db = await getDb();
  await db.delete(storeName, id);
}

function hasValidDimensions({ length, width, depth, height }) {
  const normalizedDepth = typeof depth === 'number' ? depth : height;
  return [length, width, normalizedDepth].every(
    (value) => typeof value === 'number' && !Number.isNaN(value) && value > 0,
  );
}

export async function getExcludedGames() {
  return readAll(STORE_EXCLUDED);
}

export async function saveExcludedGame(game) {
  if (!game?.key || typeof game.gameId !== 'number' || typeof game.versionId !== 'number') {
    return;
  }
  await putRecord(STORE_EXCLUDED, game);
}

export async function removeExcludedGame(id) {
  await deleteById(STORE_EXCLUDED, id);
}

export async function getOrientationOverrides() {
  return readAll(STORE_ORIENTATION);
}

export async function saveOrientationOverride(override) {
  if (
    !override?.key ||
    typeof override.gameId !== 'number' ||
    typeof override.versionId !== 'number' ||
    !override.orientation
  ) {
    return;
  }
  await putRecord(STORE_ORIENTATION, override);
}

export async function removeOrientationOverride(id) {
  await deleteById(STORE_ORIENTATION, id);
}

export async function getDimensionOverrides() {
  return readAll(STORE_DIMENSIONS);
}

export async function saveDimensionOverride(override) {
  if (
    !override?.key ||
    typeof override.gameId !== 'number' ||
    typeof override.versionId !== 'number'
  ) {
    return;
  }
  if (!hasValidDimensions(override)) {
    return;
  }

  await putRecord(STORE_DIMENSIONS, {
    ...override,
    length: override.length,
    width: override.width,
    depth: override.depth ?? override.height,
    height: override.height ?? override.depth,
  });
}

export async function removeDimensionOverride(id) {
  await deleteById(STORE_DIMENSIONS, id);
}

export async function getUserSettings() {
  return readOne(STORE_SETTINGS, 'appSettings');
}

export async function saveUserSettings(settings) {
  await putRecord(STORE_SETTINGS, {
    id: 'appSettings',
    ...(settings || {}),
  });
}

export async function clearUserSettings() {
  await deleteById(STORE_SETTINGS, 'appSettings');
}

export async function saveLastResult(result) {
  if (!result) {
    return;
  }
  await putRecord(STORE_RESULTS, {
    id: 'lastResult',
    ...result,
  });
}

export async function getLastResult() {
  return readOne(STORE_RESULTS, 'lastResult', { ignoreNotFound: true });
}

export async function clearLastResult() {
  await deleteById(STORE_RESULTS, 'lastResult');
}

