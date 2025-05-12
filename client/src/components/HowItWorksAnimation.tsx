import React, { useState, useEffect } from 'react';
import Lottie from 'lottie-react';
import { motion } from 'framer-motion';

// We're using a custom Lottie animation that demonstrates the LinkDripAI workflow
// The animation shows 3 main steps:
// 1. AI discovering opportunities (Daily Drips)
// 2. Quality metrics analysis (DA, relevance, spam)
// 3. Premium opportunities accessible via Splashes

const HowItWorksAnimation = () => {
  const [animationData, setAnimationData] = useState<any>(null);

  useEffect(() => {
    // Load the animation data
    fetch('/assets/link-drip-animation.json')
      .then(response => response.json())
      .then(data => setAnimationData(data))
      .catch(error => console.error('Error loading animation:', error));
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7 }}
      viewport={{ once: true }}
      className="bg-white rounded-xl shadow-lg p-4 mx-auto mb-10 max-w-4xl"
    >
      <div className="text-center mb-6">
        <h3 className="text-xl font-bold text-gray-900">How LinkDripAI Works</h3>
        <p className="text-gray-600 mt-1">See the entire process from discovery to results</p>
      </div>
      
      <div className="relative h-[350px] rounded-lg overflow-hidden">
        {animationData ? (
          <Lottie 
            animationData={animationData} 
            loop={true}
            className="w-full h-full"
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
          </div>
        )}
        
        {/* Overlay explanatory text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-3xl">
            <div className="bg-white/90 p-4 rounded-lg shadow-md">
              <h4 className="font-bold text-primary">Daily Drips</h4>
              <p className="text-sm text-gray-700">
                AI discovers fresh backlink opportunities tailored to your website's niche (per-site allocation)
              </p>
            </div>
            
            <div className="bg-white/90 p-4 rounded-lg shadow-md">
              <h4 className="font-bold text-primary">Quality Metrics</h4>
              <p className="text-sm text-gray-700">
                Each opportunity is analyzed for Domain Authority, relevance, and spam score
              </p>
            </div>
            
            <div className="bg-white/90 p-4 rounded-lg shadow-md">
              <h4 className="font-bold text-primary">Splashes</h4>
              <p className="text-sm text-gray-700">
                Premium opportunities (DA 40+, relevance 80%+, spam &lt;2%) available across all your sites
              </p>
            </div>
          </div>
        </div>
      </div>
      
      <div className="flex justify-center items-center gap-8 mt-6 text-sm">
        <div className="flex items-center">
          <div className="w-3 h-3 rounded-full bg-primary mr-2"></div>
          <span>Daily Drips (per site)</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 rounded-full bg-purple-500 mr-2"></div>
          <span>Splashes (across all sites)</span>
        </div>
      </div>
    </motion.div>
  );
};

export default HowItWorksAnimation;