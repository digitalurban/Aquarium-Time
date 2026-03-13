/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState, useEffect } from 'react';
import Aquarium, { AquariumRef } from './components/Aquarium';

function useUnderwaterSound(enabled: boolean) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!audioRef.current) {
      const audio = new Audio('./water-loop.mp3');
      audio.loop = true;
      audio.volume = 0.6;
      audioRef.current = audio;
      
      // If water-loop.mp3 fails to load, fallback to the wikimedia sound
      audio.addEventListener('error', () => {
        if (audio.src.includes('water-loop.mp3')) {
          audio.src = "https://upload.wikimedia.org/wikipedia/commons/1/1f/Brook_sound.ogg";
          if (enabled) {
            audio.play().catch(() => {});
          }
        }
      });
    }

    const audio = audioRef.current;

    if (enabled) {
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          // Autoplay blocked, handled by interaction listener
        });
      }
    } else {
      audio.pause();
    }
  }, [enabled]);

  // Handle interaction to resume audio if autoplay was blocked
  useEffect(() => {
    const handleInteraction = () => {
      if (enabled && audioRef.current && audioRef.current.paused) {
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {
            // Ignore autoplay or load errors
          });
        }
      }
    };
    document.addEventListener('pointerdown', handleInteraction);
    return () => document.removeEventListener('pointerdown', handleInteraction);
  }, [enabled]);

  return audioRef;
}

export default function App() {
  const aquariumRef = useRef<AquariumRef>(null);
  const [airPump, setAirPump] = useState(() => {
    try {
      const saved = localStorage.getItem('aquarium_air');
      return saved !== null ? parseInt(saved, 10) : 50;
    } catch { return 50; }
  });
  const [flow, setFlow] = useState(() => {
    try {
      const saved = localStorage.getItem('aquarium_flow');
      return saved !== null ? parseInt(saved, 10) : 50;
    } catch { return 50; }
  });
  const [waterLightness, setWaterLightness] = useState(() => {
    try {
      const saved = localStorage.getItem('aquarium_waterLightness');
      return saved !== null ? parseInt(saved, 10) : 50;
    } catch { return 50; }
  });
  const [showOptions, setShowOptions] = useState(false);
  const [showTime, setShowTime] = useState(() => {
    try {
      const saved = localStorage.getItem('aquarium_showTime');
      return saved !== null ? saved === 'true' : true;
    } catch { return true; }
  });
  const [soundEnabled, setSoundEnabled] = useState(() => {
    try {
      const saved = localStorage.getItem('aquarium_sound');
      return saved !== null ? saved === 'true' : false;
    } catch { return false; }
  });
  
  const touchStartDistRef = useRef<number | null>(null);

  const audioRef = useUnderwaterSound(soundEnabled);

  const toggleSound = () => {
    const newState = !soundEnabled;
    setSoundEnabled(newState);
    if (audioRef.current) {
      if (newState) {
        audioRef.current.play().catch(() => {});
      } else {
        audioRef.current.pause();
      }
    }
  };

  useEffect(() => {
    try {
      localStorage.setItem('aquarium_sound', soundEnabled.toString());
    } catch {}
  }, [soundEnabled]);

  useEffect(() => {
    aquariumRef.current?.setAirPump(airPump);
    try {
      localStorage.setItem('aquarium_air', airPump.toString());
    } catch {}
  }, [airPump]);

  useEffect(() => {
    aquariumRef.current?.setFlow(flow);
    try {
      localStorage.setItem('aquarium_flow', flow.toString());
    } catch {}
  }, [flow]);

  useEffect(() => {
    aquariumRef.current?.setWaterLightness(waterLightness);
    try {
      localStorage.setItem('aquarium_waterLightness', waterLightness.toString());
    } catch {}
  }, [waterLightness]);

  useEffect(() => {
    aquariumRef.current?.setShowTime(showTime);
    try {
      localStorage.setItem('aquarium_showTime', showTime.toString());
    } catch {}
  }, [showTime]);

  const handleWheel = (e: React.WheelEvent) => {
    setWaterLightness(prev => Math.max(0, Math.min(100, prev - e.deltaY * 0.1)));
  };

  const getPinchDistance = (e: React.TouchEvent) => {
    if (e.touches.length < 2) return null;
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      touchStartDistRef.current = getPinchDistance(e);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchStartDistRef.current !== null) {
      const currentDist = getPinchDistance(e);
      if (currentDist !== null) {
        const delta = currentDist - touchStartDistRef.current;
        // Adjust sensitivity as needed
        setWaterLightness(prev => Math.max(0, Math.min(100, prev + delta * 0.5)));
        touchStartDistRef.current = currentDist;
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) {
      touchStartDistRef.current = null;
    }
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
      className="fixed inset-0 overflow-hidden bg-black font-sans selection:bg-blue-500/30"
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Aquarium Canvas */}
      <div className="absolute inset-0">
        <Aquarium ref={aquariumRef} />
      </div>

      {/* UI Overlay */}
      <div className="absolute inset-0 p-4 pointer-events-none flex flex-col justify-end pb-[max(1rem,env(safe-area-inset-bottom))] pr-[max(1rem,env(safe-area-inset-right))] pl-[max(1rem,env(safe-area-inset-left))]">
        
        {/* Bottom Right Controls */}
        <div className="pointer-events-auto flex flex-col items-end gap-3 self-end mb-4">
          
          {/* Options Menu */}
          <div 
            className={`flex flex-wrap gap-2 justify-end items-center bg-slate-900/80 p-3 rounded-2xl border border-slate-700/50 max-w-md md:max-w-2xl transition-all duration-300 origin-bottom-right ${
              showOptions ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
            }`}
          >
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
              onClick={toggleSound}
              className={`border px-4 py-1.5 rounded-full text-sm transition-all active:scale-95 ${
                soundEnabled 
                  ? 'bg-blue-600/80 hover:bg-blue-500/80 text-white border-blue-500/50' 
                  : 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border-slate-600/50'
              }`}
            >
              {soundEnabled ? 'Mute Sound' : 'Play Sound'}
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
