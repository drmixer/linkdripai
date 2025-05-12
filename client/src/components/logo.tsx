import React from 'react';
import { Link } from 'wouter';
// Import the updated logo with drop and link icon
import logoImage from '@assets/IMG_3844.png';

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
          className={`${sizeClasses[size]} object-contain hover:scale-105 transition-all duration-300`}
        />
      </div>
    </Link>
  );
}

export default Logo;