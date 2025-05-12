import React from 'react';
import { Link } from 'wouter';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  withText?: boolean;
  className?: string;
}

// Get logo path
const logoPath = '/assets/IMG_3844.png';

export function Logo({ size = 'md', withText = true, className = '' }: LogoProps) {
  // Determine logo size
  const sizeClasses = {
    sm: 'h-6 w-6',
    md: 'h-8 w-8',
    lg: 'h-10 w-10',
  };

  return (
    <Link href="/">
      <div className={`flex items-center cursor-pointer ${className}`}>
        <img 
          src={logoPath} 
          alt="LinkDripAI Logo" 
          className={`${sizeClasses[size]} object-contain`}
        />
        {withText && (
          <span className="ml-2 text-xl font-bold text-gray-900">LinkDripAI</span>
        )}
      </div>
    </Link>
  );
}

export default Logo;