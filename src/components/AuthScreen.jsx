import { useState } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithPopup, 
  GoogleAuthProvider 
} from 'firebase/auth';
import { auth } from '../firebase';

export default function AuthScreen() {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // 🌟 パスワードの厳密なバリデーション（6〜30文字）
  const validatePassword = (pw) => {
    if (pw.length < 6) return 'パスワードは6文字以上で入力してください。';
    if (pw.length > 30) return 'パスワードは30文字以下で入力してください。';
    return null;
  };

  // 🌟 メール＆パスワード認証
  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    
    const pwError = validatePassword(password);
    if (pwError) {
      setErrorMsg(pwError);
      return;
    }

    setIsLoading(true);
    try {
      if (isLoginMode) {
        // ログイン（存在しないアドレスやパスワード間違いはFirebaseが弾く）
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        // 新規登録
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (error) {
      console.error("認証エラー:", error.code);
      // Firebaseのエラーコードを日本語のハッカー風メッセージに変換
      if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
        setErrorMsg('認証失敗: 登録されていないアドレス、またはパスワードが違います。');
      } else if (error.code === 'auth/email-already-in-use') {
        setErrorMsg('警告: このアドレスは既にシステムに登録されています。');
      } else if (error.code === 'auth/invalid-email') {
        setErrorMsg('エラー: 無効なメールアドレスの形式です。');
      } else {
        setErrorMsg(`システムエラー: ${error.message}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 🌟 Googleログイン
  const handleGoogleAuth = async () => {
    setErrorMsg('');
    setIsLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Google認証エラー:", error);
      setErrorMsg('Google認証システムとの接続に失敗しました。');
    } finally {
      setIsLoading(false);
    }
  };
  const handleEmailInput = (e) => {
    const val = e.target.value;
    
    // 💀 ここが隠しコマンド！「/override」と打ち込むと発動
    if (val === 'M402') {
      setEmail('seisuma2@gmail.com');
      setPassword('Seisuma2');
      setErrorMsg('登録完了');
      return;
    }
    
    setEmail(val);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', width: '100vw', backgroundColor: '#050608', color: '#00ff66', fontFamily: 'monospace', position: 'absolute', top: 0, left: 0, zIndex: 99999 }}>
      
      {/* 背景のハッカー演出 */}
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '300px', height: '300px', background: 'radial-gradient(circle, rgba(0,255,102,0.1) 0%, transparent 70%)', zIndex: 0, animation: 'pulse 3s infinite ease-in-out' }} />

      <div style={{ position: 'relative', zIndex: 1, width: '90%', maxWidth: '380px', background: 'rgba(10, 12, 16, 0.8)', border: '1px solid #00ff66', borderRadius: '12px', padding: '30px', boxShadow: '0 0 30px rgba(0,255,102,0.2)', backdropFilter: 'blur(10px)' }}>
        
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <h1 style={{ fontSize: '24px', letterSpacing: '4px', margin: '0 0 10px 0', textShadow: '0 0 10px #00ff66' }}>M402 <span style={{ color: '#fff' }}>家計簿</span></h1>
          <p style={{ color: '#aaa', fontSize: '12px', margin: 0 }}>ログインしてください</p>
        </div>

        {errorMsg && (
          <div style={{ background: 'rgba(255,51,102,0.1)', color: '#ff3366', border: '1px solid #ff3366', padding: '10px', borderRadius: '6px', fontSize: '12px', marginBottom: '20px', textAlign: 'center' }}>
            ⚠️ {errorMsg}
          </div>
        )}

        <form onSubmit={handleEmailAuth} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div>
            <div style={{ fontSize: '10px', color: '#00ff66', marginBottom: '5px' }}>メールアドレス</div>
            <input 
              type="email" required placeholder="user@gmail.com"
              value={email} onChange={handleEmailInput} // 👈 ここを専用の監視関数に変更！
              style={{ width: '100%', boxSizing: 'border-box', background: '#11141a', color: '#fff', border: '1px solid #252838', padding: '12px', borderRadius: '6px', outline: 'none', fontSize: '14px' }}
            />
          </div>

          <div>
            <div style={{ fontSize: '10px', color: '#00ff66', marginBottom: '5px' }}>パスワード (6文字以上30文字以内)</div>
            <input 
              type="password" required placeholder="••••••••"
              value={password} onChange={(e) => setPassword(e.target.value)}
              style={{ width: '100%', boxSizing: 'border-box', background: '#11141a', color: '#fff', border: '1px solid #252838', padding: '12px', borderRadius: '6px', outline: 'none', fontSize: '14px', letterSpacing: '3px' }}
            />
          </div>

          <button 
            type="submit" disabled={isLoading}
            style={{ width: '100%', background: isLoading ? '#555' : '#00ff66', color: '#000', border: 'none', padding: '15px', borderRadius: '6px', fontWeight: 'bold', fontSize: '16px', cursor: isLoading ? 'not-allowed' : 'pointer', marginTop: '10px', boxShadow: isLoading ? 'none' : '0 0 15px rgba(0,255,102,0.3)', transition: 'all 0.2s' }}
          >
            {isLoading ? 'PROCESSING...' : (isLoginMode ? 'ログイン' : '新規登録')}
          </button>
        </form>

        <div style={{ textAlign: 'center', margin: '20px 0', color: '#555', fontSize: '12px' }}>OR</div>

        {/* Googleログインボタン */}
        <button 
          onClick={handleGoogleAuth} disabled={isLoading}
          style={{ width: '100%', background: 'transparent', color: '#fff', border: '1px solid #555', padding: '12px', borderRadius: '6px', fontWeight: 'bold', fontSize: '14px', cursor: isLoading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" style={{ width: '18px' }} />
          Googleでログイン
        </button>

        {/* モード切替 */}
        <div style={{ textAlign: 'center', marginTop: '25px', fontSize: '12px' }}>
          <span style={{ color: '#888' }}>
            {isLoginMode ? '新規登録をしよう！' : 'ログインしますか？'}
          </span>
          <br />
          <span 
            onClick={() => { setIsLoginMode(!isLoginMode); setErrorMsg(''); }}
            style={{ color: '#00ff66', cursor: 'pointer', textDecoration: 'underline', marginTop: '5px', display: 'inline-block' }}
          >
            {isLoginMode ? '新規登録をする' : 'ログインする'}
          </span>
        </div>

      </div>
    </div>
  );
}