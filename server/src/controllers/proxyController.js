import { BGG_API_TOKEN, BGG_API_BASE } from '../services/configService.js';
import { bggApiRequest } from '../services/bggService.js';

export const getCollectionProxy = async (req, res) => {
  try {
    const username = req.params.username?.toString().toLowerCase();
    const { own, preordered, stats } = req.query;

    if (!BGG_API_TOKEN) {
      console.error('❌ BGG API token not configured');
      return res.status(500).json({
        error:
          'BGG API token not configured. Please set BGG_API_TOKEN in server/.env file',
      });
    }

    const params = new URLSearchParams();
    if (username) params.append('username', username);
    if (own) params.append('own', own);
    if (preordered) params.append('preordered', preordered);
    if (stats) params.append('stats', stats);

    const url = `${BGG_API_BASE}/collection?${params.toString()}`;
    console.log('🔍 Fetching BGG collection:');
    console.log('   Username:', username);
    console.log('   URL:', url);
    console.log('   Parameters:', { own, preordered, stats });

    const response = await bggApiRequest(url, {
      headers: {
        Authorization: `Bearer ${BGG_API_TOKEN}`,
        Accept: 'application/xml',
      },
    });

    console.log('✅ BGG API Response:');
    console.log('   Status:', response.status);
    console.log('   Content-Type:', response.headers['content-type']);
    console.log('   Data length:', response.data.length);
    console.log('   Response preview:', response.data.substring(0, 500));

    if (response.data.includes('<error')) {
      console.warn('⚠️  BGG returned error in XML');
    }

    const itemMatches = response.data.match(/<item/g);
    if (itemMatches) {
      console.log('   Items found:', itemMatches.length);
    } else {
      console.warn('⚠️  No items found in response');
    }

    res.set('Content-Type', 'application/xml');
    return res.send(response.data);
  } catch (error) {
    console.error('❌ Error fetching collection:');
    console.error('   Message:', error.message);
    console.error('   Status:', error.response?.status);
    console.error('   Status Text:', error.response?.statusText);

    if (error.response?.data) {
      console.error('   Response data:', error.response.data.substring(0, 500));
    }

    if (error.response?.status === 401) {
      console.error('   → Token authentication failed');
      return res.status(401).json({
        error: 'BGG API authorization failed. Your token may be invalid or expired.',
      });
    }

    if (error.response?.status === 202) {
      console.warn('   → Collection still processing');
      return res.status(202).json({
        error: 'BGG is still processing this collection. Please try again in a few moments.',
      });
    }

    return res.status(error.response?.status || 500).json({
      error: error.message || 'Failed to fetch collection from BGG',
    });
  }
};

export const getThingProxy = async (req, res) => {
  try {
    const { id, stats, versions } = req.query;

    if (!BGG_API_TOKEN) {
      return res.status(500).json({
        error:
          'BGG API token not configured. Please set BGG_API_TOKEN in server/.env file',
      });
    }

    if (!id) {
      return res.status(400).json({ error: 'Game ID(s) required' });
    }

    const params = new URLSearchParams();
    params.append('id', id);
    if (stats) params.append('stats', stats);
    if (versions) params.append('versions', versions);

    const url = `${BGG_API_BASE}/thing?${params.toString()}`;
    console.log('🔍 Fetching thing details:');
    console.log('   IDs:', id);
    console.log('   URL:', url);

    const response = await bggApiRequest(url, {
      headers: {
        Authorization: `Bearer ${BGG_API_TOKEN}`,
        Accept: 'application/xml',
      },
    });

    console.log('✅ BGG Thing API Response:');
    console.log('   Status:', response.status);
    console.log('   Data length:', response.data.length);

    res.set('Content-Type', 'application/xml');
    return res.send(response.data);
  } catch (error) {
    console.error('❌ Error fetching thing:');
    console.error('   Message:', error.message);
    console.error('   Status:', error.response?.status);

    if (error.response?.status === 401) {
      console.error('   → Token authentication failed');
      return res.status(401).json({
        error: 'BGG API authorization failed. Your token may be invalid or expired.',
      });
    }

    return res.status(error.response?.status || 500).json({
      error: error.message || 'Failed to fetch game details from BGG',
    });
  }
};

