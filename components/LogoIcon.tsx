import React from 'react';

export const LogoIcon = ({ size = 24, className = "" }: { size?: number, className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    {/* Left face */}
    <path d="M12 13.5L3 8.5V18.5L12 23.5V13.5Z" fill="currentColor" fillOpacity="0.4"/>
    {/* Right face */}
    <path d="M12 13.5L21 8.5V18.5L12 23.5V13.5Z" fill="currentColor" fillOpacity="0.1"/>
    {/* Top face */}
    <path d="M12 2.5L21 8.5L12 13.5L3 8.5L12 2.5Z" fill="currentColor" />
  </svg>
);
