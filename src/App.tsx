/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState, useEffect } from 'react';
import Aquarium, { AquariumRef } from './components/Aquarium';

export default function App() {
  const aquariumRef = useRef<AquariumRef>(null);
  const [airPump, setAirPump] = useState(50);
  const [flow, setFlow] = useState(50);
  const [lightZoom, setLightZoom] = useState(0.1);
  const [showOptions, setShowOptions] = useState(false);
  const [showTime, setShowTime] = useState(true);

  useEffect(() => {
    aquariumRef.current?.setAirPump(airPump);
  }, [airPump]);

  useEffect(() => {
    aquariumRef.current?.setFlow(flow);
  }, [flow]);

  useEffect(() => {
    aquariumRef.current?.setLightZoom(lightZoom);
  }, [lightZoom]);

  useEffect(() => {
    aquariumRef.current?.setShowTime(showTime);
  }, [showTime]);

  const handleWheel = (e: React.WheelEvent) => {
    setLightZoom(prev => Math.max(0.1, Math.min(3.0, prev - e.deltaY * 0.001)));
  };

  const handleFeed = () => {
    aquariumRef.current?.feed();
  };

  const handleAddFish = (species: 'tetra' | 'clownfish') => {
    aquariumRef.current?.addFish(species);
  };

  const handleRemoveFish = (species: 'tetra' | 'clownfish') => {
    aquariumRef.current?.removeFish(species);
  };

  const handleAddFlow = () => {
    setFlow(prev => Math.min(100, prev + 10));
  };

  const handleRemoveFlow = () => {
    setFlow(prev => Math.max(0, prev - 10));
  };

  const handleAddAir = () => {
    setAirPump(prev => Math.min(100, prev + 10));
  };

  const handleRemoveAir = () => {
    setAirPump(prev => Math.max(0, prev - 10));
  };

  return (
    <div 
      className="relative w-full h-screen overflow-hidden bg-black font-sans selection:bg-blue-500/30"
      onWheel={handleWheel}
    >
      {/* Aquarium Canvas */}
      <div className="absolute inset-0">
        <Aquarium ref={aquariumRef} />
      </div>

      {/* UI Overlay */}
      <div className="absolute top-0 left-0 w-full p-4 pointer-events-none flex flex-col justify-end h-full">
        
        {/* Bottom Right Controls */}
        <div className="pointer-events-auto flex flex-col items-end gap-3 self-end mb-4 mr-4">
          
          {/* Options Menu */}
          <div 
            className={`flex flex-wrap gap-2 justify-end items-center bg-slate-900/80 p-3 rounded-2xl border border-slate-700/50 max-w-md md:max-w-2xl transition-all duration-300 origin-bottom-right ${
              showOptions ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
            }`}
          >
            <button 
              onClick={handleFeed}
              className="bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border border-slate-600/50 px-4 py-1.5 rounded-full text-sm transition-all active:scale-95"
            >
              Feed
            </button>
            
            <button 
              onClick={() => setShowTime(!showTime)}
              className={`border px-4 py-1.5 rounded-full text-sm transition-all active:scale-95 ${
                showTime 
                  ? 'bg-blue-600/80 hover:bg-blue-500/80 text-white border-blue-500/50' 
                  : 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border-slate-600/50'
              }`}
            >
              {showTime ? 'Hide Time' : 'Show Time'}
            </button>

            <button 
              onClick={handleRemoveAir}
              className="bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border border-slate-600/50 px-4 py-1.5 rounded-full text-sm transition-all active:scale-95"
            >
              - Air
            </button>

            <div className="bg-slate-900/60 text-slate-300 border border-slate-700/50 px-4 py-1.5 rounded-full text-sm">
              Air: {airPump}%
            </div>

            <button 
              onClick={handleAddAir}
              className="bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border border-slate-600/50 px-4 py-1.5 rounded-full text-sm transition-all active:scale-95"
            >
              + Air
            </button>

            <button 
              onClick={() => handleRemoveFish('tetra')}
              className="bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border border-slate-600/50 px-4 py-1.5 rounded-full text-sm transition-all active:scale-95"
            >
              - Tetra
            </button>

            <button 
              onClick={() => handleAddFish('tetra')}
              className="bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border border-slate-600/50 px-4 py-1.5 rounded-full text-sm transition-all active:scale-95"
            >
              + Tetra
            </button>

            <button 
              onClick={() => handleRemoveFish('clownfish')}
              className="bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border border-slate-600/50 px-4 py-1.5 rounded-full text-sm transition-all active:scale-95"
            >
              - Clown
            </button>

            <button 
              onClick={() => handleAddFish('clownfish')}
              className="bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border border-slate-600/50 px-4 py-1.5 rounded-full text-sm transition-all active:scale-95"
            >
              + Clown
            </button>

            <button 
              onClick={handleRemoveFlow}
              className="bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border border-slate-600/50 px-4 py-1.5 rounded-full text-sm transition-all active:scale-95"
            >
              - Flow
            </button>

            <div className="bg-slate-900/60 text-slate-300 border border-slate-700/50 px-4 py-1.5 rounded-full text-sm">
              Flow: {flow}%
            </div>

            <button 
              onClick={handleAddFlow}
              className="bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border border-slate-600/50 px-4 py-1.5 rounded-full text-sm transition-all active:scale-95"
            >
              + Flow
            </button>
          </div>

          {/* Toggle Button */}
          <button 
            onClick={() => setShowOptions(!showOptions)}
            className="bg-slate-900/90 hover:bg-slate-800/95 text-slate-200 border border-slate-700/50 px-5 py-2 rounded-full text-sm font-medium transition-all active:scale-95 shadow-lg"
          >
            {showOptions ? 'Close' : 'Options'}
          </button>
        </div>
      </div>
    </div>
  );
}
