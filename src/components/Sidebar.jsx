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
    </div>
  );
}