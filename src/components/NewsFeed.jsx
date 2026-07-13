import { useState, useEffect } from 'react';

export default function NewsFeed() {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);

  // 取得したいサイトのRSS URL（例：ギズモード・ジャパン）
  // 複数混ぜることも可能ですが、まずは1つから
  const RSS_URL = 'https://www.gizmodo.jp/index.xml';
  const API_URL = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(RSS_URL)}`;

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const res = await fetch(API_URL);
        const data = await res.json();
        if (data.items) {
          setNews(data.items);
        }
      } catch (error) {
        console.error("通信傍受エラー:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchNews();
  }, [API_URL]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', minHeight: '50vh', flexDirection: 'column' }}>
        <div style={{ position: 'relative', width: '60px', height: '60px' }}>
          <div style={{ position: 'absolute', width: '100%', height: '100%', border: '2px dashed #00bfff', borderRadius: '50%', animation: 'spin 2s linear infinite' }}></div>
          <div style={{ position: 'absolute', width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '24px' }}>📡</div>
        </div>
        <div style={{ color: '#00bfff', marginTop: '15px', fontFamily: 'monospace', letterSpacing: '2px' }}>[ FETCHING INTEL... ]</div>
        <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ background: '#11141a', padding: '20px', borderRadius: '8px', border: '1px solid #252838', minHeight: '80vh' }}>
      <div style={{ borderBottom: '1px solid #252838', paddingBottom: '15px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: '20px', margin: 0, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
          📡 最新テクノロジー通信
        </h2>
        <span style={{ color: '#00ff66', fontSize: '12px', fontFamily: 'monospace', border: '1px solid #00ff66', padding: '2px 6px', borderRadius: '4px' }}>
          CONNECTION SECURE
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
        {news.map((item, index) => {
          // 日付のフォーマット（サイバーっぽく）
          const pubDate = new Date(item.pubDate);
          const dateStr = pubDate.toISOString().slice(0, 16).replace('T', ' ');

          return (
            <a 
              key={index} 
              href={item.link} 
              target="_blank" 
              rel="noopener noreferrer"
              className="news-card"
              style={{
                display: 'flex', flexDirection: 'column', background: '#0a0c10', border: '1px solid #1a1d24', borderRadius: '8px', overflow: 'hidden', textDecoration: 'none', transition: 'all 0.3s ease'
              }}
            >
              {/* サムネイル画像 */}
              {item.thumbnail && (
                <div style={{ width: '100%', height: '140px', overflow: 'hidden', position: 'relative' }}>
                  <img src={item.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.8 }} />
                  <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'linear-gradient(to bottom, transparent, #0a0c10)' }}></div>
                </div>
              )}
              
              <div style={{ padding: '15px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ color: '#00bfff', fontSize: '11px', fontFamily: 'monospace', marginBottom: '8px' }}>{dateStr}</div>
                <h3 style={{ color: '#fff', fontSize: '14px', margin: '0 0 10px 0', lineHeight: '1.4', flex: 1 }}>
                  {item.title}
                </h3>
                <div style={{ color: '#ff3366', fontSize: '12px', textAlign: 'right', fontWeight: 'bold' }}>READ MORE &gt;&gt;</div>
              </div>
            </a>
          );
        })}
      </div>

      <style>{`
        .news-card:hover {
          border-color: #00bfff !important;
          box-shadow: 0 0 15px rgba(0, 191, 255, 0.2);
          transform: translateY(-3px);
        }
        .news-card:hover img {
          opacity: 1 !important;
          transform: scale(1.05);
          transition: all 0.3s ease;
        }
      `}</style>
    </div>
  );
}