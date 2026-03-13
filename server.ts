import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import yts from 'yt-search';
import dotenv from 'dotenv';

dotenv.config({ path: ['.env.local', '.env'] });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const CHANNEL_ID = 'UCy8CUVT0ZUc18zRr3CzokEw';
const UPLOADS_PLAYLIST_ID = 'UUy8CUVT0ZUc18zRr3CzokEw';

interface VideoData {
  id: string;
  title: string;
  thumbnail: string;
  duration: string;
  url: string;
  category: string;
  language: string;
  description?: string;
  views?: number;
  uploadDate?: string;
}

let cachedVideos: VideoData[] = [];
let isFetchingDetails = false;

function detectLanguage(title: string, description?: string): string {
  const text = (title + ' ' + (description || '')).toLowerCase();
  
  // Simple heuristic for Hindi vs English
  // Check for Devanagari script range: \u0900-\u097F
  if (/[\u0900-\u097F]/.test(text)) {
    return 'Hindi';
  }
  
  // Keywords for Hindi/Bollywood content
  const hindiKeywords = ['hindi', 'bollywood', 't-series', 'gaana', 'arijit', 'neha kakkar', 'jubin', 'shreya'];
  if (hindiKeywords.some(kw => text.includes(kw))) {
    return 'Hindi';
  }

  return 'English';
}

function extractCategory(title: string): string {
  const lowerTitle = title.toLowerCase();
  if (
    lowerTitle.includes('fortnite') || 
    lowerTitle.includes('gaming') || 
    lowerTitle.includes('gameplay') ||
    lowerTitle.includes('xbox') ||
    lowerTitle.includes('ps5') ||
    lowerTitle.includes('nintendo')
  ) {
    return 'Gaming';
  }
  
  return 'Music';
}

function parseISO8601Duration(duration: string): string {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return '0:00';
  const hours = parseInt(match[1] || '0');
  const minutes = parseInt(match[2] || '0');
  const seconds = parseInt(match[3] || '0');
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

async function fetchVideoDetailsInBackground() {
  if (isFetchingDetails || !YOUTUBE_API_KEY) return;
  isFetchingDetails = true;
  
  try {
    const videosToFetch = cachedVideos.filter(v => !v.description || v.duration === '0:00' || v.category === 'Other' || v.language === 'English');
    for (let i = 0; i < videosToFetch.length; i += 50) {
      const batch = videosToFetch.slice(i, i + 50);
      const ids = batch.map(v => v.id).join(',');
      
      try {
        const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${ids}&key=${YOUTUBE_API_KEY}`;
        const res = await fetch(url);
        const data = await res.json();
        
        if (data.items) {
          data.items.forEach((item: any) => {
            const video = cachedVideos.find(v => v.id === item.id);
            if (video) {
              video.description = item.snippet.description;
              video.views = parseInt(item.statistics.viewCount);
              video.uploadDate = item.snippet.publishedAt;
              video.duration = parseISO8601Duration(item.contentDetails.duration);
              
              const langCode = item.snippet.defaultAudioLanguage || item.snippet.defaultLanguage;
              if (langCode) {
                try {
                  const baseLang = langCode.split('-')[0];
                  const displayNames = new Intl.DisplayNames(['en'], { type: 'language' });
                  video.language = displayNames.of(baseLang) || langCode.toUpperCase();
                } catch (e) {
                  video.language = langCode.toUpperCase();
                }
              } else {
                video.language = detectLanguage(item.snippet.title, item.snippet.description);
              }
              
              if (item.snippet.categoryId === '20') {
                video.category = 'Gaming';
              } else if (item.snippet.categoryId === '10') {
                video.category = 'Music';
              } else {
                video.category = extractCategory(item.snippet.title);
              }
              
              const thumbs = item.snippet.thumbnails;
              video.thumbnail = thumbs.maxres?.url || thumbs.standard?.url || thumbs.high?.url || thumbs.medium?.url || thumbs.default?.url;
            }
          });
        }
      } catch (err) {
        console.error(`Failed to fetch details for batch starting at ${i}`, err);
      }
    }
  } finally {
    isFetchingDetails = false;
  }
}

async function updateVideosCache() {
  try {
    if (YOUTUBE_API_KEY) {
      let allItems: any[] = [];
      let nextPageToken = '';
      
      for (let i = 0; i < 4; i++) {
        const pageTokenParam = nextPageToken ? `&pageToken=${nextPageToken}` : '';
        const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${UPLOADS_PLAYLIST_ID}&maxResults=50${pageTokenParam}&key=${YOUTUBE_API_KEY}`;
        
        const res = await fetch(url);
        const data = await res.json();
        
        if (data.items) {
          allItems = [...allItems, ...data.items];
        }
        
        nextPageToken = data.nextPageToken;
        if (!nextPageToken) break;
      }
      
      if (allItems.length > 0) {
        const newVideos = allItems.map((item: any) => {
          const videoId = item.contentDetails.videoId;
          const existing = cachedVideos.find(cv => cv.id === videoId);
          const thumbs = item.snippet.thumbnails;
          const title = item.snippet.title;
          const description = item.snippet.description;
          
          return {
            id: videoId,
            title: title,
            thumbnail: thumbs.maxres?.url || thumbs.standard?.url || thumbs.high?.url || thumbs.medium?.url || thumbs.default?.url,
            duration: existing?.duration || '0:00',
            url: `https://www.youtube.com/watch?v=${videoId}`,
            category: extractCategory(title),
            language: existing?.language || detectLanguage(title, description),
            description: description,
            views: existing?.views,
            uploadDate: item.snippet.publishedAt,
          };
        });
        cachedVideos = newVideos;
      }
    } else {
      const r = await yts({ listId: UPLOADS_PLAYLIST_ID });
      const newVideos = r.videos.map(v => {
        const existing = cachedVideos.find(cv => cv.id === v.videoId);
        return {
          id: v.videoId,
          title: v.title,
          thumbnail: v.thumbnail,
          duration: v.duration.timestamp,
          url: `https://www.youtube.com/watch?v=${v.videoId}`,
          category: extractCategory(v.title),
          language: existing?.language || detectLanguage(v.title),
          description: existing?.description,
          views: existing?.views,
          uploadDate: existing?.uploadDate,
        };
      });
      cachedVideos = newVideos;
    }
    
    fetchVideoDetailsInBackground();
  } catch (error) {
    console.error('Error updating videos cache:', error);
  }
}

// Initial fetch
updateVideosCache();
// Update every 5 minutes
setInterval(updateVideosCache, 5 * 60 * 1000);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // API routes FIRST
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/api/videos', (req, res) => {
    res.json({
      channel: {
        name: 'Entertain-Tangle',
        url: 'https://youtube.com/@Entertain-Tangle-Official',
        icon: 'https://yt3.ggpht.com/vIiJwdgg5qihPh8BAYPxFwwqNeBEEVCj7gV_eVPcKBYbG3zta3_5HXZGzdAuzdIyET7GXtvB=s176-c-k-c0x00ffffff-no-rj-mo'
      },
      videos: cachedVideos
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
