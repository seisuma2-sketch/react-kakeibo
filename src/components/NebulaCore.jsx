import React, { useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';

// 🌟 3Dオブジェクト本体（キモくないスタイリッシュ版）
function CoreMesh({ netIncome }) {
  const outerRef = useRef();
  const innerRef = useRef();

  const isDeficit = netIncome < 0;
  
  const baseColor = isDeficit ? '#ff3366' : '#00ff66';
  const emissiveColor = isDeficit ? '#aa0000' : '#00aa22';

  const baseSpeed = 0.003;
  const currentSpeed = isDeficit ? baseSpeed * 3 : baseSpeed;

  useFrame((state) => {
    const time = state.clock.elapsedTime;

    if (outerRef.current && innerRef.current) {
      outerRef.current.rotation.y += currentSpeed;
      outerRef.current.rotation.z += currentSpeed * 0.5;

      innerRef.current.rotation.y -= currentSpeed * 1.5;
      innerRef.current.rotation.x = Math.sin(time) * 0.2; 

      const hover = Math.sin(time * 1.5) * 0.1;
      outerRef.current.position.y = hover;
      innerRef.current.position.y = hover;
    }
  });

  return (
    <group>
      {/* 🛡️ 外側のバリア（二十面体） */}
      <mesh ref={outerRef}>
        <icosahedronGeometry args={[1.4, 1]} />
        <meshStandardMaterial
          color={baseColor}
          emissive={emissiveColor}
          emissiveIntensity={1}
          wireframe={true}
          transparent={true}
          opacity={0.3} 
        />
      </mesh>

      {/* 💎 内側のコア（八面体） */}
      <mesh ref={innerRef}>
        <octahedronGeometry args={[0.7, 0]} />
        <meshStandardMaterial
          color={baseColor}
          emissive={emissiveColor}
          emissiveIntensity={2}
          wireframe={false} 
        />
      </mesh>
    </group>
  );
}

// 🌟 ダッシュボードに表示される枠組み
export default function NebulaCore({ netIncome, isStealthMode }) {
  // 🌟 解説パネルの開閉を管理する状態（State）
  const [showInfo, setShowInfo] = useState(false);
  
  if (isStealthMode) {
    return (
      <div style={{ background: '#11141a', padding: '20px', borderRadius: '8px', border: '1px dashed #252838', height: '300px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ color: '#555', fontSize: '14px', letterSpacing: '2px' }}>[ CORE OFFLINE ]</div>
      </div>
    );
  }

  const isDeficit = netIncome < 0;

  return (
    <div style={{ background: '#11141a', padding: '20px', borderRadius: '8px', border: `1px solid ${isDeficit ? '#ff3366' : '#252838'}`, height: '300px', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', overflow: 'hidden' }}>
      
      <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
        <h3 style={{ margin: 0, fontSize: '16px', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
           3D ホログラム
        </h3>
        
        {/* 🌟 バッジと「？」ボタンを横に並べる */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '12px', fontWeight: 'bold', color: isDeficit ? '#ff3366' : '#00ff66', background: '#0a0c10', padding: '4px 8px', borderRadius: '4px', border: `1px solid ${isDeficit ? '#ff3366' : '#00ff66'}` }}>
            {isDeficit ? ' 警告' : ' 安定'}
          </span>
          
          <button 
            onClick={() => setShowInfo(!showInfo)} 
            style={{ 
              background: showInfo ? '#00bfff' : 'transparent', 
              color: showInfo ? '#000' : '#00bfff', 
              border: '1px solid #00bfff', 
              borderRadius: '50%', width: '24px', height: '24px', 
              cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', 
              fontSize: '14px', fontWeight: 'bold', transition: 'all 0.2s' 
            }}
          >
            ?
          </button>
        </div>
      </div>

      {/* 🌟 クリックされたら表示される解説パネル（オーバーレイ） */}
      {showInfo && (
        <div style={{
          position: 'absolute', top: '60px', right: '20px', width: '250px', 
          background: 'rgba(10, 12, 16, 0.95)', border: '1px solid #00bfff', 
          borderRadius: '8px', padding: '15px', zIndex: 100, 
          backdropFilter: 'blur(5px)', boxShadow: '0 0 20px rgba(0, 191, 255, 0.3)', 
          fontSize: '12px', color: '#fff', lineHeight: '1.6'
        }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#00bfff', borderBottom: '1px solid #252838', paddingBottom: '5px' }}>
             3Dホログラム仕様
          </h4>
          <div style={{ marginBottom: '8px' }}>
            <span style={{ color: '#00ff66', fontWeight: 'bold' }}> 黒字 </span>
            <br />総資産が安定している状態。コアは正常な出力でゆったりと浮遊・回転します。
          </div>
          <div style={{ marginBottom: '8px' }}>
            <span style={{ color: '#ff3366', fontWeight: 'bold' }}> 赤字 </span>
            <br />支出が収入を上回り警告状態。コアが赤く染まり、回転速度が上昇します。
          </div>
          <div style={{ color: '#aaa', fontSize: '11px', marginTop: '10px', paddingTop: '5px', borderTop: '1px dashed #555' }}>
            ※マウス操作で視点のドラッグ回転が可能です。
          </div>
        </div>
      )}

      {/* 3Dキャンバス */}
      <div style={{ width: '100%', flex: 1, cursor: 'grab' }}>
        <Canvas camera={{ position: [0, 0, 4] }}>
          <ambientLight intensity={0.5} />
          <pointLight position={[10, 10, 10]} intensity={1} />
          <CoreMesh netIncome={netIncome} />
          <OrbitControls enableZoom={false} />
        </Canvas>
      </div>

      {/* スキャンライン演出 */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))', backgroundSize: '100% 2px, 3px 100%', pointerEvents: 'none', zIndex: 5, opacity: 0.3 }}></div>
    </div>
  );
}