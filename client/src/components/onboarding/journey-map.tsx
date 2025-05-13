import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Steps in the onboarding journey
const JOURNEY_STEPS = [
  {
    title: "Choose Your Plan",
    description: "Select the best subscription plan for your needs",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
        <line x1="7" y1="7" x2="7.01" y2="7"></line>
      </svg>
    ),
  },
  {
    title: "Website Setup",
    description: "Add your website details for personalized opportunities",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
        <line x1="8" y1="21" x2="16" y2="21"></line>
        <line x1="12" y1="17" x2="12" y2="21"></line>
      </svg>
    ),
  },
  {
    title: "Content Preferences",
    description: "Tell us your niche preferences to improve matching",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="4" y1="21" x2="4" y2="14"></line>
        <line x1="4" y1="10" x2="4" y2="3"></line>
        <line x1="12" y1="21" x2="12" y2="12"></line>
        <line x1="12" y1="8" x2="12" y2="3"></line>
        <line x1="20" y1="21" x2="20" y2="16"></line>
        <line x1="20" y1="12" x2="20" y2="3"></line>
        <line x1="1" y1="14" x2="7" y2="14"></line>
        <line x1="9" y1="8" x2="15" y2="8"></line>
        <line x1="17" y1="16" x2="23" y2="16"></line>
      </svg>
    ),
  },
  {
    title: "Email Integration",
    description: "Set up your email to start sending outreach messages",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
        <polyline points="22,6 12,13 2,6"></polyline>
      </svg>
    ),
  }
];

type JourneyMapProps = {
  currentStep: number;
  totalSteps: number;
};

export const OnboardingJourneyMap: React.FC<JourneyMapProps> = ({ 
  currentStep,
  totalSteps 
}) => {
  // State for tracking which step to show detailed tooltip
  const [activeDetailStep, setActiveDetailStep] = useState<number | null>(null);

  // If total steps changes, adjust the journey map
  useEffect(() => {
    // This allows the component to adapt if the onboarding flow changes
  }, [totalSteps]);

  return (
    <div className="w-full max-w-4xl mx-auto mb-8 px-4">
      <h2 className="text-lg font-medium text-gray-700 mb-4">Your Onboarding Journey</h2>
      
      <div className="relative">
        {/* Main Journey Line */}
        <div className="absolute top-7 left-0 w-full h-1 bg-gray-200 rounded-full" />
        
        {/* Completed Journey Line */}
        <div 
          className="absolute top-7 left-0 h-1 bg-primary rounded-full transition-all duration-500 ease-in-out"
          style={{ width: `${((currentStep - 1) / (totalSteps - 1)) * 100}%` }}
        />
        
        {/* Journey Steps */}
        <div className="relative flex justify-between mb-2">
          {JOURNEY_STEPS.slice(0, totalSteps).map((step, index) => {
            const stepNumber = index + 1;
            const isActive = stepNumber === currentStep;
            const isCompleted = stepNumber < currentStep;
            
            return (
              <div 
                key={`step-${index}`}
                className="flex flex-col items-center relative"
                onMouseEnter={() => setActiveDetailStep(stepNumber)}
                onMouseLeave={() => setActiveDetailStep(null)}
              >
                {/* Step Circle */}
                <motion.div
                  className={`relative z-10 w-14 h-14 rounded-full flex items-center justify-center cursor-pointer
                    ${isActive 
                      ? 'bg-primary text-white' 
                      : isCompleted
                        ? 'bg-primary/20 text-primary'
                        : 'bg-gray-200 text-gray-500'
                    }`}
                  whileHover={{ scale: 1.1 }}
                  transition={{ type: "spring", stiffness: 400, damping: 10 }}
                >
                  {isCompleted ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  ) : (
                    <div className="flex items-center justify-center">
                      {step.icon}
                    </div>
                  )}

                  {/* Pulse animation for active step */}
                  {isActive && (
                    <motion.div
                      className="absolute -inset-1.5 rounded-full border-2 border-primary"
                      animate={{ 
                        scale: [1, 1.1, 1],
                        opacity: [0.7, 0.5, 0.7] 
                      }}
                      transition={{ 
                        duration: 2, 
                        repeat: Infinity,
                        repeatType: "loop"
                      }}
                    />
                  )}
                </motion.div>
                
                {/* Step Title */}
                <span className={`mt-2 text-sm font-medium ${isActive ? 'text-primary' : 'text-gray-600'}`}>
                  {step.title}
                </span>
                
                {/* Step Description - Shown on hover */}
                <AnimatePresence>
                  {activeDetailStep === stepNumber && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      transition={{ duration: 0.2 }}
                      className="absolute top-[90px] -left-10 w-[200px] z-20 p-3 bg-white shadow-lg rounded-lg text-xs text-gray-700"
                    >
                      {step.description}
                      <div className="absolute top-0 left-1/2 -mt-2 -ml-2 w-4 h-4 bg-white transform rotate-45 origin-center" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default OnboardingJourneyMap;