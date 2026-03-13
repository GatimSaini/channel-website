import { useState, useEffect, useMemo } from 'react';
import { Play, ExternalLink, Youtube, X, Calendar, Eye, Loader2, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Video {
  id: string;
  title: string;
  description?: string;
  views?: string;
  uploadedAt?: string;
  thumbnail: string;
  url: string;
  category: string;
  language: string;
  duration: string;
}

interface ChannelInfo {
  name: string;
  url: string;
  icon: string;
}

export default function App() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [channel, setChannel] = useState<ChannelInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedLanguage, setSelectedLanguage] = useState('All');

  useEffect(() => {
    fetchVideos();
    
    // Poll for updates every 30 seconds to get descriptions as they load in the background
    const interval = setInterval(fetchVideos, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchVideos = async () => {
    try {
      const res = await fetch('/api/videos');
      if (!res.ok) throw new Error('Failed to fetch videos');
      const data = await res.json();
      setVideos(data.videos);
      setChannel(data.channel);
      setError('');
    } catch (err) {
      if (videos.length === 0) {
        setError('Could not load videos. Please try again later.');
      }
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const categories = useMemo(() => {
    const cats = new Set(videos.map(v => v.category));
    return ['All', ...Array.from(cats)].sort();
  }, [videos]);

  const languages = useMemo(() => {
    const langs = new Set(videos.map(v => v.language));
    return ['All', ...Array.from(langs)].sort();
  }, [videos]);

  const filteredVideos = useMemo(() => {
    return videos.filter(video => {
      const matchesCategory = selectedCategory === 'All' || video.category === selectedCategory;
      const matchesLanguage = selectedLanguage === 'All' || video.language === selectedLanguage;
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = video.title.toLowerCase().includes(searchLower) || 
                            (video.description && video.description.toLowerCase().includes(searchLower));
      
      return matchesCategory && matchesLanguage && matchesSearch;
    });
  }, [videos, searchQuery, selectedCategory, selectedLanguage]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 font-sans selection:bg-red-500/30">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800 p-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {channel ? (
              <>
                <img src={channel.icon} alt={channel.name} className="w-10 h-10 rounded-full" referrerPolicy="no-referrer" />
                <a href={channel.url} target="_blank" rel="noopener noreferrer" className="text-xl font-bold hover:text-red-500 transition-colors">
                  {channel.name}
                </a>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Youtube className="w-8 h-8 text-red-500" />
                <span className="text-xl font-bold">Loading...</span>
              </div>
            )}
          </div>
          
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
            <input 
              type="text" 
              placeholder="Search videos or descriptions..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-full py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-red-500 transition-all text-sm"
            />
          </div>
        </div>
        
        {/* Filters */}
        <div className="max-w-7xl mx-auto mt-4 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 overflow-x-auto pb-1 scrollbar-hide flex-1">
              <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider shrink-0">Category:</span>
              <div className="flex gap-2">
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                      selectedCategory === cat 
                        ? 'bg-zinc-100 text-zinc-900' 
                        : 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
            <div className="hidden md:block text-xs font-medium text-zinc-500 bg-zinc-900 px-3 py-1.5 rounded-full border border-zinc-800">
              Showing <span className="text-zinc-100">{filteredVideos.length}</span> videos
            </div>
          </div>

          <div className="flex items-center gap-3 overflow-x-auto pb-1 scrollbar-hide">
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider shrink-0">Language:</span>
            <div className="flex gap-2">
              {languages.map(lang => (
                <button
                  key={lang}
                  onClick={() => setSelectedLanguage(lang)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                    selectedLanguage === lang 
                      ? 'bg-red-500 text-white' 
                      : 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800'
                  }`}
                >
                  {lang}
                </button>
              ))}
            </div>
          </div>
          
          <div className="md:hidden text-center text-xs font-medium text-zinc-500">
            Showing <span className="text-zinc-100">{filteredVideos.length}</span> videos
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading && videos.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <Loader2 className="w-8 h-8 text-red-500 animate-spin" />
            <p className="text-zinc-400">Loading latest videos...</p>
          </div>
        ) : error && videos.length === 0 ? (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 text-center">
            <p className="text-red-400">{error}</p>
            <button 
              onClick={fetchVideos}
              className="mt-4 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm font-medium transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : filteredVideos.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-xl text-zinc-400">No videos found matching your criteria.</p>
            <button 
              onClick={() => { setSearchQuery(''); setSelectedCategory('All'); setSelectedLanguage('All'); }}
              className="mt-4 text-red-500 hover:underline"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredVideos.map((video) => (
              <motion.div 
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.2 }}
                key={video.id}
                onClick={() => setSelectedVideo(video)}
                className="group cursor-pointer flex flex-col gap-3"
              >
                <div className="relative aspect-video rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800">
                  <img 
                    src={video.thumbnail} 
                    alt={video.title}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute bottom-2 right-2 bg-black/80 text-xs font-medium px-2 py-1 rounded">
                    {video.duration}
                  </div>
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors" />
                </div>
                <div className="flex flex-col gap-1">
                  <h3 className="font-medium text-zinc-100 line-clamp-2 leading-snug group-hover:text-red-400 transition-colors">
                    {video.title}
                  </h3>
                  <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500 flex-wrap">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      video.category === 'Gaming' ? 'bg-purple-500/20 text-purple-300' : 'bg-blue-500/20 text-blue-300'
                    }`}>
                      {video.category}
                    </span>
                    <span className="bg-zinc-800 px-2 py-0.5 rounded text-zinc-300">
                      {video.language}
                    </span>
                    {video.duration && video.duration !== '0:00' && (
                      <span className="flex items-center gap-1">
                        <Play className="w-3 h-3" /> {video.duration}
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>

      {/* Video Modal */}
      <AnimatePresence>
        {selectedVideo && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
          >
            <div 
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => setSelectedVideo(null)}
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-4xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="flex items-center justify-between p-4 border-b border-zinc-800">
                <h2 className="font-semibold text-lg truncate pr-4">{selectedVideo.title}</h2>
                <button 
                  onClick={() => setSelectedVideo(null)}
                  className="p-2 hover:bg-zinc-800 rounded-full transition-colors shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="overflow-y-auto p-4 sm:p-6 flex flex-col gap-6">
                <div className="relative aspect-video w-full bg-black rounded-xl overflow-hidden border border-zinc-800 shadow-2xl group">
                  <img
                    src={selectedVideo.thumbnail}
                    alt={selectedVideo.title}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  {selectedVideo.duration && selectedVideo.duration !== '0:00' && (
                    <div className="absolute bottom-4 right-4 bg-black/80 backdrop-blur-md text-sm font-bold px-3 py-1.5 rounded-lg border border-white/10">
                      {selectedVideo.duration}
                    </div>
                  )}
                </div>
                
                <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                  <div className="flex items-center gap-4 text-sm text-zinc-400 flex-wrap">
                    <span className={`px-3 py-1.5 rounded-full font-medium ${
                      selectedVideo.category === 'Gaming' ? 'bg-purple-500/20 text-purple-300' : 'bg-blue-500/20 text-blue-300'
                    }`}>
                      {selectedVideo.category}
                    </span>
                    <span className="bg-zinc-800/50 px-3 py-1.5 rounded-full text-zinc-300">
                      {selectedVideo.language}
                    </span>
                    {selectedVideo.uploadedAt && (
                      <span className="flex items-center gap-1.5 bg-zinc-800/50 px-3 py-1.5 rounded-full">
                        <Calendar className="w-4 h-4 text-zinc-300" /> {formatDate(selectedVideo.uploadedAt)}
                      </span>
                    )}
                  </div>
                  
                  <div className="flex gap-3 w-full sm:w-auto">
                    <a 
                      href={`vnd.youtube://${selectedVideo.id}`}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white font-medium rounded-xl transition-colors"
                    >
                      <Youtube className="w-5 h-5" />
                      Open in App
                    </a>
                    <a 
                      href={selectedVideo.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white font-medium rounded-xl transition-colors"
                    >
                      <ExternalLink className="w-5 h-5" />
                      Watch on YouTube
                    </a>
                  </div>
                </div>
                
                {selectedVideo.description ? (
                  <div className="bg-zinc-800/30 rounded-xl p-4 border border-zinc-800/50">
                    <h3 className="text-sm font-semibold text-zinc-300 mb-2">Description</h3>
                    <p className="text-sm text-zinc-400 whitespace-pre-wrap leading-relaxed">
                      {selectedVideo.description}
                    </p>
                  </div>
                ) : (
                  <div className="bg-zinc-800/30 rounded-xl p-4 border border-zinc-800/50 flex items-center gap-2 text-zinc-500 text-sm">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading description...
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
