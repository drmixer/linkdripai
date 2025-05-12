import React from 'react';
import Lottie from 'lottie-react';
import { motion } from 'framer-motion';

// When implementing a complete animation, we'll need to design a more detailed
// Lottie JSON animation showing the entire flow as described in the requirements

// We'll use a predefined Lottie animation JSON that will be created
// For now, we'll create a placeholder with visualization of the process
const animationData = {
  "v": "5.7.11",
  "fr": 30,
  "ip": 0,
  "op": 180,
  "w": 800,
  "h": 600,
  "nm": "LinkDripAI Process",
  "ddd": 0,
  "assets": [],
  "layers": [
    {
      "ddd": 0,
      "ind": 1,
      "ty": 4,
      "nm": "Background",
      "sr": 1,
      "ks": {
        "o": { "a": 0, "k": 100 },
        "r": { "a": 0, "k": 0 },
        "p": { "a": 0, "k": [400, 300, 0] },
        "a": { "a": 0, "k": [0, 0, 0] },
        "s": { "a": 0, "k": [100, 100, 100] }
      },
      "ao": 0,
      "shapes": [
        {
          "ty": "rc",
          "d": 1,
          "s": { "a": 0, "k": [760, 560] },
          "p": { "a": 0, "k": [0, 0] },
          "r": { "a": 0, "k": 20 },
          "nm": "Rectangle Path",
          "hd": false
        },
        {
          "ty": "fl",
          "c": { "a": 0, "k": [0.949, 0.969, 0.996, 1] },
          "o": { "a": 0, "k": 100 },
          "r": 1,
          "bm": 0,
          "nm": "Fill",
          "hd": false
        }
      ],
      "ip": 0,
      "op": 180,
      "st": 0,
      "bm": 0
    }
  ]
};

const HowItWorksAnimation = () => {
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
        <Lottie 
          animationData={animationData} 
          loop={true}
          className="w-full h-full"
        />
        
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