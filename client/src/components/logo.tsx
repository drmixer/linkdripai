import React from 'react';
import { useLocation } from 'wouter';
// Import the neon blue glowing logo
import logoImage from '@assets/LinkDripAI.png';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Logo({ size = 'md', className = '' }: LogoProps) {
  const [_, navigate] = useLocation();
  
  // Significantly larger sizes to make the logo dominate - per user request
  const sizeClasses = {
    sm: 'h-28 w-auto',
    md: 'h-40 w-auto',
    lg: 'h-56 w-auto',
  };

  const [location] = useLocation();
  
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    
    // If we're on the landing page, don't navigate away
    if (location === '/' || location === '') {
      return; // Stay on the landing page
    }
    
    // If we're on the auth page, go to landing page
    if (location === '/auth') {
      navigate('/');
      return;
    }
    
    // For other pages, use session helper to check login status and navigate
    import('@/lib/session-helper').then(module => {
      const { isLoggedIn, navigateBasedOnAuth } = module;
      navigateBasedOnAuth(isLoggedIn());
    });
  };

  return (
    <img 
      src={logoImage} 
      alt="LinkDripAI" 
      onClick={handleClick}
      className={`${sizeClasses[size]} object-contain drop-shadow-[0_0_12px_rgba(0,157,255,0.8)] hover:drop-shadow-[0_0_18px_rgba(0,157,255,1)] hover:scale-105 transition-all duration-300 cursor-pointer ${className}`}
    />
  );
}

export default Logo;