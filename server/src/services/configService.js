import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables from .env file relative to this file
// configService.js is in server/src/services/, so .env is at ../../.env
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../../.env') });

export const PORT = process.env.PORT || 3001;
export const BGG_API_BASE = 'https://boardgamegeek.com/xmlapi2';
export const BGG_API_TOKEN = process.env.BGG_API_TOKEN || '';
export const CACHE_ADMIN_PASSWORD = process.env.CACHE_ADMIN_PASSWORD || '';

