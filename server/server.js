import { createApp } from './src/app.js';
import { PORT, BGG_API_TOKEN } from './src/services/configService.js';
import { cleanup } from './src/services/cache/index.js';

const app = createApp();

app.listen(PORT, () => {
  console.log(`🚀 BGCube Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  
  if (!BGG_API_TOKEN) {
    console.warn('⚠️  WARNING: BGG_API_TOKEN not set in environment variables');
    console.warn('   Please create a server/.env file with your BGG API token');
  } else {
    console.log('✅ BGG API token configured');
  }
  
  console.log('🧹 Running initial cache cleanup...');
  cleanup();
  
  setInterval(() => {
    console.log('🧹 Running scheduled cache cleanup...');
    cleanup();
  }, 3600 * 1000);
  
  console.log('✅ Cache cleanup scheduled (every hour)');
});

