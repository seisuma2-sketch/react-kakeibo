import { signOut } from 'firebase/auth';
import { auth } from '../firebase';

export default function Sidebar({ currentTab, setCurrentTab }) {
  // メニューのリスト（あとで増やせるように配列にしておく！）
  const menuItems = [
    { id: 'home', label: '総合' },
    { id: 'calendar', label: 'カレンダー' },
    { id: 'balance', label: '総合残高管理' },
    { id: 'income-expense', label: '収支確認' },
    { id: 'category', label: 'カテゴリ別内訳' },
    { id: 'playground', label: '残高遊び場' },
    { id: 'bs-pl', label: 'BS / PL 財務諸表' },
    { id: 'map', label: ' マップ' },
    { id: 'feed', label: '📡 情報傍受 (Feed)' }
  ];

  return (
    <div style={{ width: '220px', backgroundColor: '#11141a', borderRight: '1px solid #252838', display: 'flex', flexDirection: 'column', paddingTop: '30px' }}>
      
      {/* タイトル */}
      <div style={{ padding: '0 20px', marginBottom: '30px' }}>
        <h2 style={{ color: '#00ff66', margin: 0, fontSize: '18px', textShadow: '0 0 10px rgba(0,255,102,0.3)' }}>
          負け犬の家計簿
        </h2>
      </div>

      {/* メニューリスト */}
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, flex: 1 }}>
        {menuItems.map(item => (
          <li
            key={item.id}
            onClick={() => setCurrentTab(item.id)} // 🌟 クリックしたらタブを切り替える！
            style={{
              padding: '15px 20px',
              cursor: 'pointer',
              color: currentTab === item.id ? '#00ff66' : '#aaa', // 選ばれていたらネオングリーン！
              backgroundColor: currentTab === item.id ? 'rgba(0, 255, 102, 0.05)' : 'transparent',
              borderLeft: currentTab === item.id ? '4px solid #00ff66' : '4px solid transparent',
              fontWeight: currentTab === item.id ? 'bold' : 'normal',
              transition: 'all 0.2s ease-in-out'
            }}
            
          >
            {item.label}
          </li>
        ))}
      </ul>

      {/* 左下のユーザー表示 */}
      <div style={{ padding: '20px', borderTop: '1px solid #252838', fontSize: '12px', color: '#555' }}>
        React Edition v1.0
      </div>
      {/* 🌟 これを「情報傍受」ボタンの下あたり（一番下）に追加！ */}
      <div style={{ padding: '20px', borderTop: '1px solid #252838', marginTop: 'auto' }}>
        <button
          onClick={() => {
            if (window.confirm("システムからログアウトしますか？")) {
              signOut(auth).then(() => window.location.reload());
            }
          }}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px',
            background: 'rgba(255, 51, 102, 0.05)', color: '#ff3366', border: '1px solid #ff336655', borderRadius: '8px',
            fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s', fontSize: '13px', fontFamily: 'monospace'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 51, 102, 0.2)'; e.currentTarget.style.boxShadow = '0 0 10px rgba(255,51,102,0.3)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255, 51, 102, 0.05)'; e.currentTarget.style.boxShadow = 'none'; }}
        >
          <span>🚪</span> SYSTEM LOGOUT
        </button>
      </div>
    </div>
  );
}