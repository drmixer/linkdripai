import React, { useEffect, useRef } from 'react';
import lottie from 'lottie-web';
import { motion } from 'framer-motion';

// AI process steps
const AI_PROCESS_STEPS = [
  {
    title: "AI Opportunity Discovery",
    description: "Our AI analyzes the web to find relevant backlink opportunities"
  },
  {
    title: "Quality Assessment",
    description: "Opportunities are ranked by quality metrics like DA, PA and spam score"
  },
  {
    title: "Matching to Your Site",
    description: "The best matches for your website's niche and content are selected"
  },
  {
    title: "Daily Drips Delivery",
    description: "Fresh opportunities are delivered to your dashboard every day"
  }
];

// This component uses a simple placeholder animation until we create a custom Lottie animation
const AiProcessAnimation: React.FC = () => {
  const animationContainer = useRef<HTMLDivElement>(null);
  const [currentStep, setCurrentStep] = React.useState(0);

  // Simulate a Lottie animation with CSS animations for now
  useEffect(() => {
    // In a real implementation, we would load a Lottie animation file here
    // Example: 
    // if (animationContainer.current) {
    //   const anim = lottie.loadAnimation({
    //     container: animationContainer.current,
    //     renderer: 'svg',
    //     loop: true,
    //     autoplay: true,
    //     path: '/animations/ai-process.json'
    //   });
    //   return () => anim.destroy();
    // }
    
    // Instead, we'll cycle through the steps to simulate the process
    const interval = setInterval(() => {
      setCurrentStep((prev) => (prev + 1) % AI_PROCESS_STEPS.length);
    }, 3000);
    
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-8">
      <h2 className="text-xl font-bold text-gray-800 mb-3 text-center">How Our AI Works For You</h2>
      <p className="text-center text-gray-600 mb-8 max-w-2xl mx-auto">
        LinkDripAI uses advanced algorithms to find, assess, and deliver the best backlink opportunities for your website
      </p>
      
      <div className="flex flex-col md:flex-row gap-8 items-center justify-center">
        {/* Animation Area */}
        <div 
          ref={animationContainer}
          className="w-full md:w-1/2 h-64 bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg flex items-center justify-center relative overflow-hidden"
        >
          {/* Placeholder Animation - Replace with actual Lottie */}
          <div className="relative w-full h-full flex items-center justify-center">
            {/* Center hub */}
            <div className="w-24 h-24 bg-primary rounded-full flex items-center justify-center text-white z-10">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
            </div>
            
            {/* Orbiting elements */}
            {[0, 1, 2, 3].map((i) => (
              <motion.div
                key={`orbit-${i}`}
                className="absolute w-12 h-12 bg-white rounded-full shadow-md flex items-center justify-center text-primary"
                initial={{ rotate: i * 90, x: 80 }}
                animate={{ 
                  rotate: [i * 90, i * 90 + 360],
                  scale: i === currentStep ? 1.2 : 1
                }}
                transition={{ 
                  rotate: { duration: 20, repeat: Infinity, ease: "linear" },
                  scale: { duration: 0.3 }
                }}
              >
                {i === 0 && (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                  </svg>
                )}
                {i === 1 && (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                    <polyline points="10 9 9 9 8 9"></polyline>
                  </svg>
                )}
                {i === 2 && (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="4 7 4 4 20 4 20 7"></polyline>
                    <line x1="9" y1="20" x2="15" y2="20"></line>
                    <line x1="12" y1="4" x2="12" y2="20"></line>
                  </svg>
                )}
                {i === 3 && (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"></polyline>
                    <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"></path>
                  </svg>
                )}
              </motion.div>
            ))}
            
            {/* Data stream lines */}
            {[0, 1, 2, 3].map((i) => (
              <motion.div
                key={`line-${i}`}
                className="absolute inset-0 flex items-center justify-center"
                initial={{ rotate: i * 90 }}
                animate={{
                  rotate: [i * 90, i * 90 + 5, i * 90 - 5, i * 90]
                }}
                transition={{
                  duration: 5,
                  repeat: Infinity,
                  repeatType: "reverse"
                }}
              >
                <div className={`w-px h-full bg-primary/20 ${i === currentStep ? 'bg-primary/50' : ''}`} />
              </motion.div>
            ))}
            
            {/* Floating particles */}
            {[...Array(15)].map((_, i) => (
              <motion.div
                key={`particle-${i}`}
                className="absolute w-1.5 h-1.5 bg-primary/60 rounded-full"
                initial={{ 
                  x: Math.random() * 300 - 150, 
                  y: Math.random() * 300 - 150,
                  opacity: 0 
                }}
                animate={{ 
                  x: 0, 
                  y: 0,
                  opacity: [0, 1, 0]
                }}
                transition={{ 
                  duration: 2 + Math.random() * 3, 
                  repeat: Infinity,
                  delay: Math.random() * 5
                }}
              />
            ))}
          </div>
        </div>
        
        {/* Steps */}
        <div className="w-full md:w-1/2">
          <div className="space-y-4">
            {AI_PROCESS_STEPS.map((step, index) => (
              <motion.div 
                key={`step-${index}`}
                className={`p-4 rounded-lg border-l-4 transition-all duration-300 ${
                  currentStep === index 
                    ? 'bg-primary/10 border-primary' 
                    : 'bg-white border-gray-200'
                }`}
                animate={{
                  scale: currentStep === index ? 1.02 : 1,
                  x: currentStep === index ? 5 : 0
                }}
                transition={{ duration: 0.3 }}
              >
                <h3 className={`font-medium mb-1 ${
                  currentStep === index ? 'text-primary' : 'text-gray-800'
                }`}>
                  {step.title}
                </h3>
                <p className="text-sm text-gray-600">{step.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AiProcessAnimation;