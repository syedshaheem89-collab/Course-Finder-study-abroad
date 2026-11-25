'use client';

import React, { useId } from 'react';

interface OrbisSymbolProps {
  size?: number;
  className?: string;
  variant?: 'adaptive' | 'dark' | 'light';
}

const RING_ANGLES_DEG = [0, 45, 90, 135, 180, 225, 270, 315] as const;

export function OrbisSymbol({
  size = 28,
  className = '',
  variant = 'adaptive',
}: OrbisSymbolProps) {
  const uid = useId().replace(/:/g, '');
  const gradMain = `orbis-grad-main-${uid}`;
  const gradHighlight = `orbis-grad-hi-${uid}`;

  const colorClass =
    variant === 'dark'
      ? 'text-[#14181F]'
      : variant === 'light'
      ? 'text-[#F5F5F7]'
      : 'text-[#14181F] dark:text-[#F5F5F7]';

  const midTone = variant === 'light' ? '#98A2B3' : '#64748B';
  const sheenTone = variant === 'light' ? '#D0D5DD' : '#94A3B8';
  const strokeWidth = size <= 24 ? 2.75 : 2.35;

  const d = 12.5;
  const r = 30.5;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      aria-hidden="true"
      className={`shrink-0 ${colorClass} ${className}`}
    >
      <defs>
        <linearGradient id={gradMain} x1="15%" y1="85%" x2="85%" y2="15%">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.96" />
          <stop offset="52%" stopColor={midTone} stopOpacity="0.88" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.92" />
        </linearGradient>
        <linearGradient id={gradHighlight} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={midTone} stopOpacity="0.72" />
          <stop offset="50%" stopColor={sheenTone} stopOpacity="0.52" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.9" />
        </linearGradient>
      </defs>

      {RING_ANGLES_DEG.map((deg, idx) => {
        const rad = (deg * Math.PI) / 180;
        const cx = Number((50 + d * Math.cos(rad)).toFixed(2));
        const cy = Number((50 + d * Math.sin(rad)).toFixed(2));
        const useHighlight = idx % 2 === 1;
        return (
          <circle
            key={deg}
            cx={cx}
            cy={cy}
            r={r}
            stroke={`url(#${useHighlight ? gradHighlight : gradMain})`}
            strokeWidth={strokeWidth}
          />
        );
      })}
    </svg>
  );
}

interface OrbisWordmarkProps {
  brandName?: string;
  showTagline?: boolean;
  iconSize?: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function OrbisWordmark({
  brandName = 'Orbis',
  showTagline = false,
  iconSize = 26,
  size = 'md',
  className = '',
}: OrbisWordmarkProps) {
  const trimmed = (brandName || 'Orbis').trim();
  const isOrbis = trimmed.toLowerCase() === 'orbis';
  const displayName = isOrbis ? 'orbis' : trimmed;

  const textSizeClass =
    size === 'lg'
      ? 'text-[22px] sm:text-[24px]'
      : size === 'sm'
      ? 'text-[16px]'
      : 'text-[19px]';

  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <OrbisSymbol size={iconSize} variant="adaptive" />
      <span className="flex flex-col leading-none">
        <span
          className={`${textSizeClass} font-semibold tracking-[-0.035em] leading-none text-[#1D1D1F] dark:text-[#F5F5F7]`}
        >
          {displayName}
        </span>
        {showTagline && (
          <span className="text-[9px] sm:text-[10px] font-medium tracking-[0.16em] uppercase text-[#6E6E73] dark:text-[#A1A1A6] mt-1">
            THE GLOBAL COURSE FINDER
          </span>
        )}
      </span>
    </span>
  );
}
