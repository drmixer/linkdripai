import React, { useState } from 'react';
import { motion } from 'framer-motion';

// The achievement goals to display
const ACHIEVEMENT_GOALS = [
  {
    title: "Discover AI-powered opportunities",
    description: "Get daily opportunities tailored to your website",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="16" x2="12" y2="12"></line>
        <line x1="12" y1="8" x2="12.01" y2="8"></line>
      </svg>
    ),
  },
  {
    title: "Target premium link opportunities",
    description: "Use splashes to unlock high-quality backlinks",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
      </svg>
    ),
  },
  {
    title: "Automated email outreach",
    description: "Save time with personalized email templates",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
        <polyline points="22,6 12,13 2,6"></polyline>
      </svg>
    ),
  },
  {
    title: "Track your success",
    description: "Monitor your backlink acquisition in real-time",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"></line>
        <line x1="12" y1="20" x2="12" y2="4"></line>
        <line x1="6" y1="20" x2="6" y2="14"></line>
      </svg>
    ),
  }
];

type GoalStepsProps = {
  currentStep: number;
};

export const OnboardingGoalSteps: React.FC<GoalStepsProps> = ({ 
  currentStep 
}) => {
  const [hoveredStep, setHoveredStep] = useState<number | null>(null);

  // Animation variants for staggered animation
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: {
        type: "spring",
        stiffness: 300,
        damping: 24
      }
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-6 bg-gray-50 rounded-lg">
      <h2 className="text-xl font-bold text-gray-800 mb-6 text-center">What You'll Achieve</h2>
      
      <motion.div 
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {ACHIEVEMENT_GOALS.map((goal, index) => (
          <motion.div
            key={`goal-${index}`}
            className={`relative p-4 bg-white rounded-lg shadow-sm border-2 transition-all duration-300 hover:shadow-md 
              ${hoveredStep === index ? 'border-primary' : 'border-transparent'}`}
            variants={itemVariants}
            onMouseEnter={() => setHoveredStep(index)}
            onMouseLeave={() => setHoveredStep(null)}
          >
            <div className="flex flex-col items-center text-center">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-3
                ${hoveredStep === index ? 'text-primary' : 'text-gray-600'}`}>
                {goal.icon}
              </div>
              
              <h3 className="text-gray-800 font-medium mb-2">{goal.title}</h3>
              <p className="text-sm text-gray-500">{goal.description}</p>
              
              {/* Animated indicator when hovered */}
              {hoveredStep === index && (
                <motion.div
                  className="absolute bottom-2 left-1/2 transform -translate-x-1/2 w-8 h-1 bg-primary rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: "2rem" }}
                  transition={{ duration: 0.3 }}
                />
              )}
            </div>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
};

export default OnboardingGoalSteps;