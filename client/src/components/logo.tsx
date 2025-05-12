import React from 'react';
import { Link } from 'wouter';
// Import the new neon blue logo
import logoImage from '@assets/ChatGPT Image May 11, 2025, 09_17_57 PM.png';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Logo({ size = 'md', className = '' }: LogoProps) {
  // Determine logo size - extremely large sizes to make the logo dominate
  const sizeClasses = {
    sm: 'h-20 w-auto',
    md: 'h-32 w-auto',
    lg: 'h-48 w-auto',
  };

  return (
    <Link href="/">
      <div className={`flex items-center cursor-pointer ${className}`}>
        <img 
          src={logoImage} 
          alt="LinkDripAI" 
          className={`${sizeClasses[size]} object-contain drop-shadow-[0_0_10px_rgba(0,157,255,0.7)] hover:drop-shadow-[0_0_15px_rgba(0,157,255,0.9)] transition-all duration-300`}
        />
      </div>
    </Link>
  );
}

export default Logo;