import { hashData } from '../cache/cacheUtils.js';
import { parseInteger } from '../../utils/numberUtils.js';
import { ensureArray } from '../../utils/arrayUtils.js';
import { buildVersionKey } from '../../utils/gameUtils.js';

const toBoolean = (value) => value === '1';

const normaliseVersionList = (versionNode, gameId) => {
  if (!versionNode) {
    return [{ versionId: -1, versionKey: buildVersionKey(gameId, -1) }];
  }

  const items = ensureArray(versionNode.item);

  if (!items || items.length === 0) {
    return [{ versionId: -1, versionKey: buildVersionKey(gameId, -1) }];
  }

  return items.map((item) => {
    const versionId = parseInteger(item?.$?.id, -1);
    return { versionId, versionKey: buildVersionKey(gameId, versionId) };
  });
};

const extractItemNodes = (collectionJson) => {
  if (!collectionJson || typeof collectionJson !== 'object') {
    return [];
  }

  if (Array.isArray(collectionJson)) {
    return collectionJson;
  }

  if (collectionJson.items?.item) {
    return collectionJson.items.item;
  }

  if (collectionJson.item) {
    return collectionJson.item;
  }

  return [];
};

export const mapCollectionItems = (collectionJson = {}) => {
  const rawItems = extractItemNodes(collectionJson);

  const items = ensureArray(rawItems);
  
  if (!items || items.length === 0) {
    console.debug(
      '⚠️  Collection mapper received no items. Keys:',
      Array.isArray(collectionJson) ? 'array' : Object.keys(collectionJson || {}),
    );
    return [];
  }
  console.debug(`📂 Mapping ${items.length} collection item(s) from XML payload`);

  const result = items.map((item) => {
    const attributes = item.$ || {};
    const status = item.status?.$ || item.status?.[0]?.$ || {};
    const subtype = attributes.subtype || attributes.objecttype || 'thing';
    const objectid = parseInteger(attributes.objectid, -1);

    const versionEntries = normaliseVersionList(item.version, objectid);

    return {
      objecttype: attributes.objecttype || 'thing',
      subtype,
      collectionId: parseInteger(attributes.collid, -1),
      gameId: objectid,
      name: item.name?._ || item.name?.[0]?._ || item.name?.$?.value || item.name || '',
      own: toBoolean(status.own),
      prevowned: toBoolean(status.prevowned),
      fortrade: toBoolean(status.fortrade),
      want: toBoolean(status.want),
      wanttoplay: toBoolean(status.wanttoplay),
      wanttobuy: toBoolean(status.wanttobuy),
      wishlist: toBoolean(status.wishlist),
      preordered: toBoolean(status.preordered),
      numplays: parseInteger(item.numplays?._ || item.numplays, 0),
      lastModified: status.lastmodified || null,
      versions: versionEntries.length > 0 ? versionEntries : [{ versionId: -1, versionKey: buildVersionKey(objectid, -1) }],
    };
  });

  return result;
};

export const generateCollectionHash = (collectionItems = []) => {
  const normalised = collectionItems
    .map((item) => ({
      ...item,
      versions: [...item.versions].sort((a, b) => a.versionId - b.versionId),
    }))
    .sort((a, b) => {
      if (a.gameId !== b.gameId) {
        return a.gameId - b.gameId;
      }
      return a.collectionId - b.collectionId;
    });

  return hashData(JSON.stringify(normalised));
};


