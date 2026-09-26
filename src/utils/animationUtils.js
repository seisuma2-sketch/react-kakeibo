import { useState, useEffect, useRef } from 'react';

/**
 * 目標数値まで滑らかにカウントアップするカスタムフック
 * @param {number} targetValue - 目標の数値
 * @param {number} duration - アニメーションの時間（ミリ秒）
 * @returns {number} アニメーション中の現在値（整数）
 */
export function useCountUp(targetValue, duration = 600) {
  const [displayValue, setDisplayValue] = useState(targetValue || 0);
  const startValueRef = useRef(targetValue || 0);
  const startTimeRef = useRef(null);
  const reqIdRef = useRef(null);

  useEffect(() => {
    const startVal = startValueRef.current;
    const endVal = Number.isFinite(targetValue) ? targetValue : 0;
    
    // 値が変わらない場合はスキップ
    if (startVal === endVal) {
      setDisplayValue(endVal);
      return;
    }

    startTimeRef.current = null;

    const animate = (timestamp) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      
      // イージング関数: cubic ease-out
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(startVal + (endVal - startVal) * easeOut);

      setDisplayValue(current);

      if (progress < 1) {
        reqIdRef.current = requestAnimationFrame(animate);
      } else {
        startValueRef.current = endVal;
        setDisplayValue(endVal);
      }
    };

    reqIdRef.current = requestAnimationFrame(animate);

    return () => {
      if (reqIdRef.current) cancelAnimationFrame(reqIdRef.current);
    };
  }, [targetValue, duration]);

  return displayValue;
}
