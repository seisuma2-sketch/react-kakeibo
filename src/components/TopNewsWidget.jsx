import { useState, useEffect } from 'react';

export default function TopNewsWidget({ onClickViewAll }) {
  const [topArticle, setTopArticle] = useState(null);
  const [loading, setLoading] = useState(true);

  // 一覧と同じギズモードのRSSを使用
  const RSS_URL = 'https://www.gizmodo.jp/index.xml';
  const API_URL = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(RSS_URL)}`;

  useEffect(() => {
    const fetchTopNews = async () => {
      try {
        const res = await fetch(API_URL);
        const data = await res.json();
        if (data.items && data.items.length > 0) {
          setTopArticle(data.items[0]); // 最新の1件だけを取得
        }
      } catch (error) {
        console.error("ミニフィード取得エラー:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchTopNews();
  }, [API_URL]);

  if (loading) {
    return (
      <div style={{ background: '#11141a', padding: '15px', borderRadius: '8px', border: '1px dashed #252838', textAlign: 'center', color: '#555', fontSize: '11px', fontFamily: 'monospace' }}>
        📡 INTEL INTERCEPTING...
      </div>
    );
  }

  if (!topArticle) return null;

  return (
    <div style={{ background: '#11141a', padding: '15px', borderRadius: '8px', border: '1px solid #00bfff', display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: '#00bfff', fontSize: '10px', mountaineer: 'bold', fontFamily: 'monospace' }}>🛰️ LATEST TECH INTEL</span>
        <span onClick={onClickViewAll} style={{ color: '#666', fontSize: '10px', cursor: 'pointer', textDecoration: 'underline' }}>全ログを傍受</span>
      </div>
      
      <a 
        href={topArticle.link} 
        target="_blank" 
        rel="noopener noreferrer"
        style={{ textDecoration: 'none', display: 'flex', gap: '12px', alignItems: 'center' }}
      >
        {topArticle.thumbnail && (
          <img src={topArticle.thumbnail} alt="" style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #252838', opacity: 0.8 }} />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h4 style={{ color: '#fff', fontSize: '12px', margin: '0 0 2px 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: '1.2' }}>
            {topArticle.title}
          </h4>
          <span style={{ color: '#ff3366', fontSize: '10px', fontWeight: 'bold', fontFamily: 'monospace' }}>READ REPORT ➡️</span>
        </div>
      </a>
    </div>
  );
}