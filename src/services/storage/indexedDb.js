import { openDB } from 'idb';

const DB_NAME = 'bgcube-user-data';
const DB_VERSION = 2;

const STORE_EXCLUDED = 'excludedGames';
const STORE_ORIENTATION = 'orientationOverrides';
const STORE_DIMENSIONS = 'dimensionOverrides';
const STORE_SETTINGS = 'userSettings';
const STORE_RESULTS = 'lastResults';

let dbPromise = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_EXCLUDED)) {
          db.createObjectStore(STORE_EXCLUDED, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_ORIENTATION)) {
          db.createObjectStore(STORE_ORIENTATION, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_DIMENSIONS)) {
          db.createObjectStore(STORE_DIMENSIONS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
          db.createObjectStore(STORE_SETTINGS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_RESULTS)) {
          db.createObjectStore(STORE_RESULTS, { keyPath: 'id' });
        }
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

export async function getExcludedGames() {
  const db = await getDb();
  return db.getAll(STORE_EXCLUDED);
}

export async function saveExcludedGame(game) {
  if (!game?.id) {
    return;
  }
  const db = await getDb();
  await db.put(STORE_EXCLUDED, withTimestamp(game));
}

export async function removeExcludedGame(id) {
  if (!id) {
    return;
  }
  const db = await getDb();
  await db.delete(STORE_EXCLUDED, id);
}

export async function getOrientationOverrides() {
  const db = await getDb();
  return db.getAll(STORE_ORIENTATION);
}

export async function saveOrientationOverride(override) {
  if (!override?.id || !override?.orientation) {
    return;
  }
  const db = await getDb();
  await db.put(STORE_ORIENTATION, withTimestamp(override));
}

export async function removeOrientationOverride(id) {
  if (!id) {
    return;
  }
  const db = await getDb();
  await db.delete(STORE_ORIENTATION, id);
}

export async function getDimensionOverrides() {
  const db = await getDb();
  return db.getAll(STORE_DIMENSIONS);
}

export async function saveDimensionOverride(override) {
  if (!override?.id) {
    return;
  }
  const { length, width, depth } = override;
  if (
    typeof length !== 'number' ||
    typeof width !== 'number' ||
    typeof depth !== 'number' ||
    Number.isNaN(length) ||
    Number.isNaN(width) ||
    Number.isNaN(depth)
  ) {
    return;
  }

  const db = await getDb();
  await db.put(
    STORE_DIMENSIONS,
    withTimestamp({
      ...override,
      length,
      width,
      depth,
    }),
  );
}

export async function removeDimensionOverride(id) {
  if (!id) {
    return;
  }
  const db = await getDb();
  await db.delete(STORE_DIMENSIONS, id);
}

export async function getUserSettings() {
  const db = await getDb();
  return db.get(STORE_SETTINGS, 'appSettings');
}

export async function saveUserSettings(settings) {
  const db = await getDb();
  await db.put(
    STORE_SETTINGS,
    withTimestamp({
      id: 'appSettings',
      ...(settings || {}),
    }),
  );
}

export async function clearUserSettings() {
  const db = await getDb();
  await db.delete(STORE_SETTINGS, 'appSettings');
}

export async function clearAllOverrides() {
  const db = await getDb();
  await Promise.all([
    db.clear(STORE_EXCLUDED),
    db.clear(STORE_ORIENTATION),
    db.clear(STORE_DIMENSIONS),
  ]);
}

export async function saveLastResult(result) {
  if (!result) {
    return;
  }
  const db = await getDb();
  await db.put(
    STORE_RESULTS,
    withTimestamp({
      id: 'lastResult',
      ...result,
    }),
  );
}

export async function getLastResult() {
  const db = await getDb();
  try {
    return await db.get(STORE_RESULTS, 'lastResult');
  } catch (error) {
    if (error?.name === 'NotFoundError') {
      return null;
    }
    throw error;
  }
}

export async function clearLastResult() {
  const db = await getDb();
  await db.delete(STORE_RESULTS, 'lastResult');
}

