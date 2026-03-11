/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState, useEffect } from 'react';
import Aquarium, { AquariumRef } from './components/Aquarium';

function useUnderwaterSound(enabled: boolean, customAudioUrl: string | null) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const intendedSrcRef = useRef<string | null>(null);

  useEffect(() => {
    if (!audioRef.current) {
      const audio = new Audio();
      audio.loop = true;
      audio.volume = 0.6;
      audioRef.current = audio;
      
      // If brook.mp3 fails to load, fallback to the wikimedia sound
      audio.addEventListener('error', () => {
        if (intendedSrcRef.current === '/brook.mp3' && audio.src.endsWith('brook.mp3')) {
          audio.src = "https://upload.wikimedia.org/wikipedia/commons/1/1f/Brook_sound.ogg";
          if (enabled) {
            const p = audio.play();
            if (p !== undefined) p.catch(() => {});
          }
        }
      });
    }

    const audio = audioRef.current;
    const targetSrc = customAudioUrl || "/brook.mp3";

    if (intendedSrcRef.current !== targetSrc) {
      intendedSrcRef.current = targetSrc;
      audio.src = targetSrc;
    }

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
  }, [enabled, customAudioUrl]);

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
  const [lightZoom, setLightZoom] = useState(0.1);
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
  const [customAudioUrl, setCustomAudioUrl] = useState<string | null>(() => {
    try {
      return localStorage.getItem('aquarium_custom_audio');
    } catch { return null; }
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  useUnderwaterSound(soundEnabled, customAudioUrl);

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setCustomAudioUrl(url);
      setSoundEnabled(true);
      
      // We can't easily save the object URL to localStorage as it expires,
      // but we can read it as a data URL if we want it to persist.
      // For performance with large audio files, we'll just use the object URL for the session.
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        if (result) {
          try {
            localStorage.setItem('aquarium_custom_audio', result);
          } catch (err) {
            console.warn('Audio file too large to save to localStorage');
          }
        }
      };
      reader.readAsDataURL(file);
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
    aquariumRef.current?.setLightZoom(lightZoom);
  }, [lightZoom]);

  useEffect(() => {
    aquariumRef.current?.setShowTime(showTime);
    try {
      localStorage.setItem('aquarium_showTime', showTime.toString());
    } catch {}
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
      <div className="absolute top-0 left-0 w-full p-4 pointer-events-none flex flex-col justify-end h-full pb-[max(1rem,env(safe-area-inset-bottom))] pr-[max(1rem,env(safe-area-inset-right))] pl-[max(1rem,env(safe-area-inset-left))]">
        
        {/* Bottom Right Controls */}
        <div className="pointer-events-auto flex flex-col items-end gap-3 self-end mb-4">
          
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
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`border px-4 py-1.5 rounded-full text-sm transition-all active:scale-95 ${
                soundEnabled 
                  ? 'bg-blue-600/80 hover:bg-blue-500/80 text-white border-blue-500/50' 
                  : 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border-slate-600/50'
              }`}
            >
              {soundEnabled ? 'Sound: On' : 'Sound: Off'}
            </button>

            <input 
              type="file" 
              accept="audio/*" 
              ref={fileInputRef} 
              onChange={handleAudioUpload} 
              className="hidden" 
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border border-slate-600/50 px-4 py-1.5 rounded-full text-sm transition-all active:scale-95"
              title="Upload custom background sound"
            >
              Upload Sound
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
