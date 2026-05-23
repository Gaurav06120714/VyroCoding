'use client';

import dynamic from 'next/dynamic';
import type { CSSProperties, ReactNode } from 'react';

// Dynamically import with SSR disabled — liquid-glass-react uses browser-only APIs
// (document.createElement, canvas, window) that crash during Next.js SSR
const LiquidGlassBase = dynamic(() => import('liquid-glass-react'), {
  ssr: false,
  loading: () => null,
});

interface LiquidGlassProps {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  cornerRadius?: number;
  displacementScale?: number;
  blurAmount?: number;
  saturation?: number;
  aberrationIntensity?: number;
  elasticity?: number;
  padding?: string;
  onClick?: () => void;
  overLight?: boolean;
  mode?: 'standard' | 'polar' | 'prominent' | 'shader';
}

/** Card surface */
export function GlassCard({
  children,
  className = '',
  style,
  cornerRadius = 20,
  displacementScale = 80,
  blurAmount = 0.08,
  saturation = 140,
  aberrationIntensity = 2,
  elasticity = 0.12,
  padding,
  onClick,
  mode = 'standard',
}: LiquidGlassProps) {
  return (
    <LiquidGlassBase
      displacementScale={displacementScale}
      blurAmount={blurAmount}
      saturation={saturation}
      aberrationIntensity={aberrationIntensity}
      elasticity={elasticity}
      cornerRadius={cornerRadius}
      padding={padding}
      onClick={onClick}
      mode={mode}
      style={{ width: '100%', ...style }}
      className={className}
    >
      {children}
    </LiquidGlassBase>
  );
}

/** Pill / small badge */
export function GlassPill({ children, className = '', style, onClick }: LiquidGlassProps) {
  return (
    <LiquidGlassBase
      displacementScale={40}
      blurAmount={0.06}
      saturation={130}
      aberrationIntensity={1}
      elasticity={0.3}
      cornerRadius={999}
      onClick={onClick}
      style={style}
      className={className}
    >
      {children}
    </LiquidGlassBase>
  );
}

/** Button */
export function GlassButton({ children, className = '', style, cornerRadius = 100, onClick }: LiquidGlassProps) {
  return (
    <LiquidGlassBase
      displacementScale={64}
      blurAmount={0.1}
      saturation={130}
      aberrationIntensity={2}
      elasticity={0.35}
      cornerRadius={cornerRadius}
      padding="8px 20px"
      onClick={onClick}
      style={style}
      className={className}
    >
      {children}
    </LiquidGlassBase>
  );
}

export default LiquidGlassBase;
