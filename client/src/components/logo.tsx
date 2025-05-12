import React from 'react';
import { Link } from 'wouter';
import logoImage from '@assets/IMG_3844.png';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Logo({ size = 'md', className = '' }: LogoProps) {
  // Determine logo size - much larger sizes to make the logo very visible
  const sizeClasses = {
    sm: 'h-14 w-auto',
    md: 'h-20 w-auto',
    lg: 'h-28 w-auto',
  };

  return (
    <Link href="/">
      <div className={`flex items-center cursor-pointer ${className}`}>
        <img 
          src={logoImage} 
          alt="LinkDripAI" 
          className={`${sizeClasses[size]} object-contain`}
        />
      </div>
    </Link>
  );
}

export default Logo;