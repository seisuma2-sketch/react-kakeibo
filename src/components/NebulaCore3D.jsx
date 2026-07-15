import React, { useRef, useState, useMemo, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useSpring, animated } from '@react-spring/three';
// 🌟 追加：ポストプロセッシング（後処理）ライブラリ
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🌌 モード1：MorphingCore（ワイヤーフレーム変形）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function MorphingCore({ currentTab, onTabClick, uiMode }) {
  const meshRef = useRef();
  const [hovered, setHover] = useState(false);

  const getActiveColor = () => {
    if (currentTab === 'input') return '#00ff66'; // 緑
    if (currentTab === 'balance') return '#ff9900'; // オレンジ
    if (currentTab === 'history') return '#b666ff'; // 紫
    return '#00bfff'; // feed
  };

  const { color, scale, rotationZ } = useSpring({
    color: getActiveColor(),
    scale: hovered ? 1.5 : 1.2,
    rotationZ: currentTab === 'input' ? 0 :
               currentTab === 'balance' ? Math.PI / 4 :
               currentTab === 'history' ? Math.PI / 2 : Math.PI,
    config: { mass: 1, tension: 170, friction: 20 }
  });

  useFrame((state, delta) => {
    meshRef.current.rotation.x += delta * 0.5;
    meshRef.current.rotation.y += delta * 0.5;
  });

  return (
    <animated.mesh
      ref={meshRef}
      scale={scale}
      rotation-z={rotationZ}
      onPointerOver={() => setHover(true)}
      onPointerOut={() => setHover(false)}
      onClick={onTabClick}
    >
      {currentTab === 'input' && <boxGeometry args={[1, 1, 1]} />}
      {currentTab === 'balance' && <sphereGeometry args={[0.7, 32, 32]} />}
      {currentTab === 'history' && <coneGeometry args={[0.7, 1.5, 4]} />}
      {currentTab === 'feed' && <torusGeometry args={[0.5, 0.2, 16, 100]} />}

      {/* 🌟 ハッキング：Bloomを効かせるために、emissiveIntensity（発光強度）を爆上げ！ */}
      <animated.meshStandardMaterial
        color={color}
        wireframe={true}
        emissive={color}
        emissiveIntensity={uiMode === 'morph' ? 3.5 : 1.0} // MORPHモードの時だけブワッと光らせる
        blending={THREE.AdditiveBlending} // 加算合成で光を重ねる
        transparent={true} // 滲みを綺麗に見せるために透明度も使う
        opacity={0.8}
      />
    </animated.mesh>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ✨ モード2：ParticleSwarmCore（数千の粒子群集）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const particleCount = 2000;
const generatePositions = (shape) => {
  const positions = new Float32Array(particleCount * 3);
  for (let i = 0; i < particleCount; i++) {
    let x, y, z;
    if (shape === 'input') { x = (Math.random() - 0.5) * 1.5; y = (Math.random() - 0.5) * 1.5; z = (Math.random() - 0.5) * 1.5; } 
    else if (shape === 'balance') { const u = Math.random(); const v = Math.random(); const theta = 2 * Math.PI * u; const phi = Math.acos(2 * v - 1); const r = 1.0 * Math.cbrt(Math.random()); x = r * Math.sin(phi) * Math.cos(theta); y = r * Math.sin(phi) * Math.sin(theta); z = r * Math.cos(phi); } 
    else if (shape === 'history') { const h = Math.random() * 2 - 1; const r = (1 - (h + 1) / 2) * 1.2; const theta = Math.random() * 2 * Math.PI; x = r * Math.cos(theta); y = h; z = r * Math.sin(theta); } 
    else { const u = Math.random() * Math.PI * 2; const v = Math.random() * Math.PI * 2; const R = 0.8; const r = 0.3 * Math.random(); x = (R + r * Math.cos(v)) * Math.cos(u); y = (R + r * Math.cos(v)) * Math.sin(u); z = r * Math.sin(v); }
    positions[i * 3] = x; positions[i * 3 + 1] = y; positions[i * 3 + 2] = z;
  }
  return positions;
};

function ParticleSwarmCore({ currentTab, onTabClick }) {
  const pointsRef = useRef();
  const materialRef = useRef();
  const targets = useMemo(() => ({ input: generatePositions('input'), balance: generatePositions('balance'), history: generatePositions('history'), feed: generatePositions('feed'), }), []);
  const currentPositions = useMemo(() => new Float32Array(targets.input), [targets]);

  const targetColors = {
    input: new THREE.Color('#00ff66'),
    balance: new THREE.Color('#ff9900'),
    history: new THREE.Color('#b666ff'),
    feed: new THREE.Color('#00bfff')
  };

  useFrame((state, delta) => {
    if (!pointsRef.current || !materialRef.current) return;
    const positions = pointsRef.current.geometry.attributes.position.array;
    const targetPos = targets[currentTab];
    for (let i = 0; i < particleCount * 3; i++) {
      positions[i] += (targetPos[i] - positions[i]) * 0.1;
    }
    pointsRef.current.geometry.attributes.position.needsUpdate = true;
    pointsRef.current.rotation.y += delta * 0.3;
    pointsRef.current.rotation.x += delta * 0.15;
    materialRef.current.color.lerp(targetColors[currentTab], 0.1);
  });

  return (
    <points ref={pointsRef} onClick={onTabClick}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={particleCount} array={currentPositions} itemSize={3} />
      </bufferGeometry>
      {/* 🌟 ハッキング：パーティクルもブワッと光らせるために AdditiveBlending（加算合成）を使用 */}
      <pointsMaterial ref={materialRef} size={0.07} color="#00ff66" transparent={true} blending={THREE.AdditiveBlending} depthWrite={false} />
    </points>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🚀 コア統合コンポーネント（表示部分）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export default function NebulaCore3D({ currentTab, setCurrentTab }) {
  // 設定でモードを変更できるように
  const [uiMode, setUiMode] = useState('morph'); // 初期モードをMORPHに

  const handleCoreClick = () => {
    const tabs = ['input', 'balance', 'history', 'feed'];
    const nextIndex = (tabs.indexOf(currentTab) + 1) % tabs.length;
    setCurrentTab(tabs[nextIndex]);
  };

  const getThemeColor = () => {
    if (currentTab === 'input') return '#00ff66';
    if (currentTab === 'balance') return '#ff9900';
    if (currentTab === 'history') return '#b666ff';
    return '#00bfff';
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '140px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      
      {/* 🔮 3D空間（Canvas） */}
      <Canvas style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1} />
        
        {/* モードに応じたコンポーネント出し分け */}
        {uiMode === 'particle' ? (
          <ParticleSwarmCore currentTab={currentTab} onTabClick={handleCoreClick} />
        ) : (
          <MorphingCore currentTab={currentTab} onTabClick={handleCoreClick} uiMode={uiMode} />
        )}

        {/* 🌟 魔法のコード：ポストプロセッシング（Bloomエフェクト）の追加 */}
        <EffectComposer>
          <Bloom
            luminanceThreshold={0.5} // この数値より明るいものが光る（0〜1）
            intensity={2.5}        // 発光の強さ（数値を上げると強烈に光る）
            radius={0.8}          // 滲みの広がり具合
            mipmapBlur             // 滲みを綺麗にする
          />
        </EffectComposer>
      </Canvas>

      {/* 📡 HUD: 現在のモード名表示（画面中央下） */}
      <div style={{
        position: 'absolute', bottom: '10px',
        color: getThemeColor(), fontFamily: 'monospace', fontSize: '12px', fontWeight: 'bold',
        textShadow: `0 0 10px ${getThemeColor()}`, pointerEvents: 'none'
      }}>
        [{currentTab.toUpperCase()}_MODE]
      </div>

      {/* ⚙️ HUD: モード切り替えスイッチ（画面右下） */}
      <div 
        onClick={() => setUiMode(uiMode === 'particle' ? 'morph' : 'particle')}
        style={{
          position: 'absolute', right: '20px', bottom: '10px', cursor: 'pointer',
          border: '1px solid #444', background: '#0a0c10', color: '#888',
          fontSize: '10px', padding: '4px 8px', borderRadius: '4px', fontFamily: 'monospace',
          zIndex: 101 // Canvasの上に置く
        }}
      >
        <span style={{ color: uiMode === 'particle' ? '#00ff66' : '#888' }}>PRTCL</span> | <span style={{ color: uiMode === 'morph' ? '#00bfff' : '#888' }}>MORPH</span>
      </div>

    </div>
  );
}