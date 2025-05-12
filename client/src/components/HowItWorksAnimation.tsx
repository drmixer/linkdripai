import React from 'react';
import { motion } from 'framer-motion';
import { Droplets, CircleCheck, Sparkles, BarChart3, ShieldCheck } from 'lucide-react';

// This component demonstrates the LinkDripAI workflow using interactive elements
// The animation visualizes 3 main steps:
// 1. AI discovering opportunities (Daily Drips)
// 2. Quality metrics analysis (DA, relevance, spam)
// 3. Premium opportunities accessible via Splashes

const HowItWorksAnimation = () => {

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7 }}
      viewport={{ once: true }}
      className="bg-white rounded-xl shadow-lg p-6 mx-auto mb-10 max-w-4xl"
    >
      <div className="text-center mb-8">
        <h3 className="text-xl font-bold text-gray-900">How LinkDripAI Works</h3>
        <p className="text-gray-600 mt-1">See the entire process from discovery to results</p>
      </div>
      
      {/* Interactive workflow animation */}
      <div className="relative py-8">
        {/* Connection lines */}
        <div className="absolute top-1/2 left-0 right-0 h-1 bg-gray-200 -translate-y-1/2 z-0"></div>
        
        {/* Steps */}
        <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Step 1: AI Discovery */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            viewport={{ once: true }}
            className="bg-white rounded-xl p-6 shadow-lg border border-primary/10"
          >
            <div className="mb-4 flex justify-center">
              <motion.div
                initial={{ scale: 0.8 }}
                animate={{ scale: [0.8, 1.1, 0.9, 1] }}
                transition={{ duration: 2, repeat: Infinity, repeatType: "reverse" }}
                className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center"
              >
                <Droplets className="h-8 w-8 text-primary" />
              </motion.div>
            </div>
            <h4 className="text-lg font-bold text-gray-900 text-center mb-2">Daily Fresh Drips</h4>
            <p className="text-gray-600 text-center text-sm">
              Our AI discovers fresh backlink opportunities tailored to your website's niche
            </p>
            <div className="mt-4 bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-500 mb-1">Per Website Allocation:</div>
              <ul className="text-xs space-y-1">
                <li className="flex items-center">
                  <div className="w-2 h-2 rounded-full bg-primary mr-2"></div>
                  <span>Starter: Up to 5 drips/day</span>
                </li>
                <li className="flex items-center">
                  <div className="w-2 h-2 rounded-full bg-primary mr-2"></div>
                  <span>Grow: Up to 10 drips/day</span>
                </li>
                <li className="flex items-center">
                  <div className="w-2 h-2 rounded-full bg-primary mr-2"></div>
                  <span>Pro: Up to 15 drips/day</span>
                </li>
              </ul>
            </div>
          </motion.div>
          
          {/* Step 2: Quality Metrics */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            viewport={{ once: true }}
            className="bg-white rounded-xl p-6 shadow-lg border border-green-500/10"
          >
            <div className="mb-4 flex justify-center">
              <motion.div
                animate={{ 
                  rotate: [0, 10, -10, 0],
                  scale: [1, 1.05, 0.95, 1] 
                }}
                transition={{ duration: 4, repeat: Infinity }}
                className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center"
              >
                <BarChart3 className="h-8 w-8 text-green-600" />
              </motion.div>
            </div>
            <h4 className="text-lg font-bold text-gray-900 text-center mb-2">Quality Metrics</h4>
            <p className="text-gray-600 text-center text-sm">
              Each opportunity is analyzed for key quality factors
            </p>
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs">Domain Authority</span>
                <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: '70%' }}
                    transition={{ duration: 1, delay: 0.5 }}
                    className="h-full bg-primary" 
                  />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs">Relevance Score</span>
                <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: '80%' }}
                    transition={{ duration: 1, delay: 0.8 }}
                    className="h-full bg-green-500" 
                  />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs">Spam Score</span>
                <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: '15%' }}
                    transition={{ duration: 1, delay: 1.1 }}
                    className="h-full bg-red-500" 
                  />
                </div>
              </div>
            </div>
          </motion.div>
          
          {/* Step 3: Splashes */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            viewport={{ once: true }}
            className="bg-white rounded-xl p-6 shadow-lg border border-purple-500/10"
          >
            <div className="mb-4 flex justify-center">
              <motion.div
                animate={{ 
                  boxShadow: [
                    "0 0 0 0 rgba(147, 51, 234, 0.2)",
                    "0 0 0 15px rgba(147, 51, 234, 0)",
                    "0 0 0 0 rgba(147, 51, 234, 0)"
                  ]
                }}
                transition={{ 
                  duration: 2,
                  repeat: Infinity,
                  repeatType: "loop"
                }}
                className="w-16 h-16 bg-purple-500/10 rounded-full flex items-center justify-center"
              >
                <Sparkles className="h-8 w-8 text-purple-600" />
              </motion.div>
            </div>
            <h4 className="text-lg font-bold text-gray-900 text-center mb-2">Splashes</h4>
            <p className="text-gray-600 text-center text-sm">
              Premium opportunities available across all your sites
            </p>
            <div className="mt-4 bg-purple-50 rounded-lg p-3">
              <div className="text-xs text-gray-600 mb-1">Premium Quality:</div>
              <ul className="text-xs space-y-1">
                <li className="flex items-center">
                  <div className="w-2 h-2 rounded-full bg-purple-500 mr-2"></div>
                  <span>DA 40+</span>
                </li>
                <li className="flex items-center">
                  <div className="w-2 h-2 rounded-full bg-purple-500 mr-2"></div>
                  <span>Relevance 80%+</span>
                </li>
                <li className="flex items-center">
                  <div className="w-2 h-2 rounded-full bg-purple-500 mr-2"></div>
                  <span>Spam Score &lt;2%</span>
                </li>
              </ul>
            </div>
          </motion.div>
        </div>
      </div>
      
      {/* Legend */}
      <div className="flex justify-center items-center gap-8 mt-8 text-sm">
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