import React from 'react';
import { Link } from 'wouter';
import LogoImage from '@assets/LinkDripAI-neon.png';

type LogoProps = {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'light' | 'dark';
  withText?: boolean;
};

export const Logo: React.FC<LogoProps> = ({ 
  size = 'md',
  variant = 'dark',
  withText = true 
}) => {
  // Size mappings
  const sizeClasses = {
    sm: 'h-8',
    md: 'h-10',
    lg: 'h-14'
  };

  // Text color based on variant
  const textColorClass = variant === 'light' ? 'text-white' : 'text-gray-800';

  return (
    <div className="flex items-center">
      <div className="flex items-center cursor-pointer" onClick={() => window.location.href = '/'}>
        <img 
          src={LogoImage}
          alt="LinkDripAI" 
          className={`${sizeClasses[size]} ${withText ? 'mr-3' : ''}`}
        />
        
        {withText && (
          <span className={`font-bold text-xl ${textColorClass}`}>
            LinkDripAI
          </span>
        )}
      </div>
    </div>
  );
};

export default Logo;