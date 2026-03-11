import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { VectorFish, Bubble, Food, Pebble, Rock, Driftwood, Plant, GhostShrimp, SideFilter, Snail, Crab } from '../lib/entities';

export interface AquariumRef {
  addFish: (species: 'tetra' | 'clownfish') => void;
  removeFish: (species: 'tetra' | 'clownfish') => void;
  feed: (x?: number, y?: number) => void;
  setFlow: (flow: number) => void;
  setAirPump: (level: number) => void;
  setWaterLightness: (lightness: number) => void;
  setShowTime: (show: boolean) => void;
}

const Aquarium = forwardRef<AquariumRef, {}>((props, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const stateRef = useRef({
    flow: 50,
    airPump: 50,
    waterLightness: 50,
    isDraggingFilter: false,
    dragOffsetY: 0,
    dragPointerId: -1,
    cameraX: 0,
    isDraggingBackground: false,
    dragStartX: 0,
    dragStartCameraX: 0,
    showTime: true,
  });

  const simRef = useRef({
    fishes: [] as VectorFish[],
    foods: [] as Food[],
    bubbles: [] as Bubble[],
    shrimps: [] as GhostShrimp[],
    snails: [] as Snail[],
    crabs: [] as Crab[],
    environment: [] as (Pebble | Rock | Driftwood)[],
    plants: [] as Plant[],
    taps: [] as {x: number, y: number, age: number, maxAge: number}[],
    sideFilter: null as SideFilter | null,
    width: 0,
    height: 0,
    bgGradient: null as CanvasGradient | null,
    envCanvases: [] as HTMLCanvasElement[],
  });

  useImperativeHandle(ref, () => ({
    addFish: (species: 'tetra' | 'clownfish') => {
      simRef.current.fishes.push(new VectorFish(simRef.current.width, simRef.current.height, species));
      
      // Save to localStorage
      const count = simRef.current.fishes.filter(f => f.species === species).length;
      localStorage.setItem(`aquarium_${species}s`, count.toString());
    },
    removeFish: (species: 'tetra' | 'clownfish') => {
      const fishes = simRef.current.fishes;
      for (let i = fishes.length - 1; i >= 0; i--) {
        if (fishes[i].species === species) {
          fishes.splice(i, 1);
          break;
        }
      }
      
      // Save to localStorage
      const count = simRef.current.fishes.filter(f => f.species === species).length;
      localStorage.setItem(`aquarium_${species}s`, count.toString());
    },
    feed: (x?: number, y?: number) => {
      const sim = simRef.current;
      const count = Math.floor(Math.random() * 5) + 3;
      for (let i = 0; i < count; i++) {
        const dropX = x ?? (Math.random() * (sim.width - 100) + 50);
        const dropY = y ?? (Math.random() * 20);
        sim.foods.push(new Food(dropX + (Math.random() * 40 - 20), dropY));
      }
    },
    setFlow: (flow: number) => { stateRef.current.flow = flow; },
    setAirPump: (level: number) => { stateRef.current.airPump = level; },
    setWaterLightness: (lightness: number) => { stateRef.current.waterLightness = lightness; },
    setShowTime: (show: boolean) => { stateRef.current.showTime = show; },
  }));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const sim = simRef.current;

    const generateEnvironment = () => {
      const pebbles: Pebble[] = [];
      const rocks: Rock[] = [];
      const driftwoods: Driftwood[] = [];
      const plants: Plant[] = [];
      
      // Increase pebble count for a denser floor
      const virtualWidth = sim.width + 800;
      const numPebbles = virtualWidth < 800 ? 500 : 1000;
      for (let i = 0; i < numPebbles; i++) pebbles.push(new Pebble(virtualWidth, sim.height));
      for (let i = 0; i < 6; i++) rocks.push(new Rock(virtualWidth, sim.height));
      for (let i = 0; i < 2; i++) driftwoods.push(new Driftwood(virtualWidth, sim.height));
      for (let i = 0; i < 35; i++) plants.push(new Plant(virtualWidth, sim.height));

      // Combine and sort by Y coordinate for correct depth rendering
      sim.environment = [...pebbles, ...rocks, ...driftwoods].sort((a, b) => a.y - b.y);
      sim.plants = plants;
    };

    const resize = () => {
      const parent = canvas.parentElement;
      if (parent) {
        // Use devicePixelRatio up to 2 for crispness on Retina displays without tanking performance
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        
        sim.width = width;
        sim.height = height;
        
        const oldY = sim.sideFilter?.y;
        sim.sideFilter = new SideFilter(sim.width, sim.height);
        if (oldY !== undefined) {
          sim.sideFilter.y = Math.max(0, Math.min(sim.height - sim.sideFilter.height, oldY));
        }
        
        // Background gradient is now drawn dynamically in drawBackground
        
        generateEnvironment();
        
        // Cache static environment (pebbles, rocks, driftwood) to layered offscreen canvases for parallax
        const virtualWidth = sim.width + 800;
        const envCanvases: HTMLCanvasElement[] = [];
        for (let i = 0; i < 3; i++) {
          const ec = document.createElement('canvas');
          ec.width = virtualWidth * dpr;
          ec.height = canvas.height;
          const ectx = ec.getContext('2d');
          if (ectx) {
            ectx.scale(dpr, dpr);
            
            if (i === 0) {
              // Draw a base gravel layer on the back-most canvas to prevent gaps
              const gravelBaseHeight = 80;
              const grad = ectx.createLinearGradient(0, sim.height - gravelBaseHeight, 0, sim.height);
              grad.addColorStop(0, 'rgba(10, 20, 30, 0)');
              grad.addColorStop(0.3, 'rgba(25, 35, 45, 0.9)');
              grad.addColorStop(1, 'rgba(5, 10, 15, 1)');
              ectx.fillStyle = grad;
              ectx.fillRect(0, sim.height - gravelBaseHeight, virtualWidth, gravelBaseHeight);
            }
            
            const minZ = i * 33.3;
            const maxZ = (i + 1) * 33.3;
            sim.environment
              .filter(item => item.z >= minZ && item.z < maxZ)
              .forEach(item => item.draw(ectx));
          }
          envCanvases.push(ec);
        }
        sim.envCanvases = envCanvases;
      }
    };
    
    let resizeTimeout: ReturnType<typeof setTimeout>;
    const resizeObserver = new ResizeObserver(() => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(resize, 50);
    });
    if (canvas.parentElement) {
      resizeObserver.observe(canvas.parentElement);
    }
    
    const handleOrientationChange = () => {
      setTimeout(resize, 100);
      setTimeout(resize, 300);
    };
    window.addEventListener('orientationchange', handleOrientationChange);
    
    resize();

    // Clear existing to prevent duplicates in React Strict Mode
    sim.fishes = [];
    sim.foods = [];
    sim.bubbles = [];
    sim.shrimps = [];
    sim.snails = [];
    sim.crabs = [];

    // Load saved fish counts or use defaults
    const savedTetras = localStorage.getItem('aquarium_tetras');
    const savedClowns = localStorage.getItem('aquarium_clowns');
    const numTetras = savedTetras !== null ? parseInt(savedTetras, 10) : 28;
    const numClowns = savedClowns !== null ? parseInt(savedClowns, 10) : 2;

    // Initial population
    for (let i = 0; i < numTetras; i++) sim.fishes.push(new VectorFish(sim.width, sim.height, 'tetra'));
    for (let i = 0; i < numClowns; i++) sim.fishes.push(new VectorFish(sim.width, sim.height, 'clownfish'));
    for (let i = 0; i < 2; i++) sim.shrimps.push(new GhostShrimp(sim.width, sim.height));
    for (let i = 0; i < 3; i++) sim.snails.push(new Snail(sim.width, sim.height));
    sim.crabs.push(new Crab(sim.width, sim.height));

    let animationId: number;

    const drawBackground = () => {
      const time = Date.now() / 1000;
      const { waterLightness, cameraX } = stateRef.current;
      const virtualWidth = sim.width + 800;

      // Realistic Blue Deep water gradient (fixed to screen)
      const lOffset = (waterLightness - 50) * 0.8;
      const grad = ctx.createLinearGradient(0, 0, 0, sim.height);
      grad.addColorStop(0, `hsl(200, 100%, ${Math.max(0, Math.min(100, 43 + lOffset))}%)`);
      grad.addColorStop(0.5, `hsl(204, 100%, ${Math.max(0, Math.min(100, 33 + lOffset))}%)`);
      grad.addColorStop(1, `hsl(206, 100%, ${Math.max(0, Math.min(100, 23 + lOffset))}%)`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, sim.width, sim.height);

      ctx.save();
      ctx.translate(-cameraX, 0);

      // Water surface
      ctx.fillStyle = 'rgba(220, 245, 255, 0.08)';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      for (let x = 0; x <= virtualWidth; x += 20) {
        ctx.lineTo(x, 20 + Math.sin(x * 0.02 + time) * 3);
      }
      ctx.lineTo(virtualWidth, 0);
      ctx.fill();
      
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = 0; x <= virtualWidth; x += 20) {
        const y = 20 + Math.sin(x * 0.02 + time) * 3;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      
      ctx.restore();
    };

    const loop = () => {
      const time = Date.now() / 1000;
      const { flow: rawFlow, airPump, cameraX, showTime } = stateRef.current;
      
      // Scale flow so 100% is equivalent to the old 30%
      const flow = rawFlow * 0.3;

      // Clock logic
      const d = new Date();
      const seconds = d.getSeconds();
      const isClockTime = showTime && seconds < 10;
      
      const tetras = sim.fishes.filter(f => f.species === 'tetra');
      
      if (isClockTime && tetras.length >= 28) {
        const hours = d.getHours().toString().padStart(2, '0');
        const minutes = d.getMinutes().toString().padStart(2, '0');
        const timeStr = hours + minutes;
        
        const DIGITS = [
          [1, 1, 1, 1, 1, 1, 0], // 0
          [0, 1, 1, 0, 0, 0, 0], // 1
          [1, 1, 0, 1, 1, 0, 1], // 2
          [1, 1, 1, 1, 0, 0, 1], // 3
          [0, 1, 1, 0, 0, 1, 1], // 4
          [1, 0, 1, 1, 0, 1, 1], // 5
          [1, 0, 1, 1, 1, 1, 1], // 6
          [1, 1, 1, 0, 0, 0, 0], // 7
          [1, 1, 1, 1, 1, 1, 1], // 8
          [1, 1, 1, 1, 0, 1, 1], // 9
        ];
        
        const w = 40;
        const h = 80;
        const spacing = 20;
        const groupSpacing = 40; // Between hours and minutes
        
        const totalWidth = 4 * w + 3 * spacing + groupSpacing;
        const startX = cameraX + sim.width / 2 - totalWidth / 2;
        const startY = sim.height / 2 - h / 2;
        
        let tetraIdx = 0;
        
        for (let i = 0; i < 4; i++) {
          const digitVal = parseInt(timeStr[i]);
          const segments = DIGITS[digitVal];
          
          const dx = startX + i * (w + spacing) + (i >= 2 ? groupSpacing - spacing : 0);
          const dy = startY;
          
          const segPositions = [
            { x: dx + w/2, y: dy, angle: 0 },           // A
            { x: dx + w, y: dy + h/4, angle: Math.PI/2 }, // B
            { x: dx + w, y: dy + 3*h/4, angle: Math.PI/2 },// C
            { x: dx + w/2, y: dy + h, angle: 0 },         // D
            { x: dx, y: dy + 3*h/4, angle: Math.PI/2 },   // E
            { x: dx, y: dy + h/4, angle: Math.PI/2 },     // F
            { x: dx + w/2, y: dy + h/2, angle: 0 }        // G
          ];
          
          for (let j = 0; j < 7; j++) {
            if (tetraIdx < tetras.length) {
              if (segments[j]) {
                tetras[tetraIdx].clockTarget = segPositions[j];
              } else {
                tetras[tetraIdx].clockTarget = null;
              }
              tetraIdx++;
            }
          }
        }
        
        // Any remaining tetras just swim normally
        for (; tetraIdx < tetras.length; tetraIdx++) {
          tetras[tetraIdx].clockTarget = null;
        }
      } else {
        // Clear all clock targets
        for (const f of tetras) {
          f.clockTarget = null;
        }
      }

      drawBackground();
      
      ctx.save();
      ctx.translate(-cameraX, 0);

      // Side Filter
      if (sim.sideFilter) {
        sim.sideFilter.update(sim.bubbles, time, rawFlow);
        sim.sideFilter.draw(ctx, time, rawFlow);
      }

      // Air Pump Bubbles
      if (airPump > 0) {
        const pumpX = sim.width * 0.75;
        // Spawn rate based on airPump level (0 to 100)
        const spawnChance = (airPump / 100) * 0.8;
        if (Math.random() < spawnChance) {
          // Spawn multiple bubbles at higher levels
          const count = Math.floor((airPump / 100) * 3) + 1;
          for (let i = 0; i < count; i++) {
            sim.bubbles.push(new Bubble(pumpX + (Math.random() * 20 - 10), sim.height - 20, 1.0));
          }
        }
      }

      // Random ambient bubbles (reduced frequency)
      if (Math.random() < 0.005) {
        sim.bubbles.push(new Bubble(Math.random() * (sim.width + 800), sim.height - 20, 0.5));
      }
      
      sim.bubbles = sim.bubbles.filter(b => b.y + b.size > 0);
      sim.bubbles.forEach(b => {
        b.update(flow, sim.width + 800);
        b.draw(ctx);
      });

      // Taps
      sim.taps = sim.taps.filter(t => t.age < t.maxAge);
      sim.taps.forEach(t => {
        t.age += 1;
        const progress = t.age / t.maxAge;
        const radius = progress * 100;
        const alpha = 1 - progress;
        
        ctx.beginPath();
        ctx.arc(t.x, t.y, radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.5})`;
        ctx.lineWidth = 2;
        ctx.stroke();
        
        ctx.beginPath();
        ctx.arc(t.x, t.y, radius * 0.7, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.2})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      });

      // Foods
      sim.foods = sim.foods.filter(f => !f.eaten);
      sim.foods.forEach(f => {
        f.update(sim.height, flow);
        f.draw(ctx);
      });

      // Parallax Entities (Plants, Fishes, Shrimps, and Crabs sorted by Z)
      const parallaxEntities: { type: 'plant' | 'fish' | 'shrimp' | 'crab', z: number, obj: any }[] = [
        ...(sim.plants || []).map(p => ({ type: 'plant' as const, z: p.z, obj: p })),
        ...sim.fishes.map(f => ({ type: 'fish' as const, z: f.z, obj: f })),
        ...sim.shrimps.map(s => ({ type: 'shrimp' as const, z: s.z, obj: s })),
        ...sim.crabs.map(c => ({ type: 'crab' as const, z: c.z, obj: c }))
      ];

      parallaxEntities.sort((a, b) => a.z - b.z);

      let currentEnvLayer = 0;
      const drawEnvLayer = (layer: number) => {
        if (sim.envCanvases[layer]) {
          ctx.save();
          // Use the actual device pixel ratio to translate correctly
          const dpr = Math.min(window.devicePixelRatio || 1, 2);
          ctx.setTransform(1, 0, 0, 1, -cameraX * dpr, 0);
          ctx.drawImage(sim.envCanvases[layer], 0, 0);
          ctx.restore();
        }
      };

      parallaxEntities.forEach(entity => {
        // Interleave environment layers based on z-depth
        while (currentEnvLayer < 3 && entity.z > (currentEnvLayer + 1) * 33.3) {
          drawEnvLayer(currentEnvLayer);
          currentEnvLayer++;
        }

        if (entity.type === 'plant') {
          const p = entity.obj as Plant;
          p.update();
          if (p.x > cameraX - 200 && p.x < cameraX + sim.width + 200) {
            p.draw(ctx, time, flow, sim.sideFilter);
          }
        } else if (entity.type === 'fish') {
          const f = entity.obj as VectorFish;
          f.update(sim.width, sim.height, sim.fishes, sim.foods, flow, sim.environment, sim.sideFilter, sim.taps);
          if (f.x > cameraX - 100 && f.x < cameraX + sim.width + 100) {
            f.draw(ctx);
          }
        } else if (entity.type === 'shrimp') {
          const s = entity.obj as GhostShrimp;
          s.update(sim.width, sim.height, sim.foods, sim.plants, sim.environment);
          if (s.x > cameraX - 100 && s.x < cameraX + sim.width + 100) {
            s.draw(ctx);
          }
        } else if (entity.type === 'crab') {
          const c = entity.obj as Crab;
          c.update(sim.width, sim.height);
          if (c.x > cameraX - 100 && c.x < cameraX + sim.width + 100) {
            c.draw(ctx);
          }
        }
      });

      // Draw remaining environment layers
      while (currentEnvLayer < 3) {
        drawEnvLayer(currentEnvLayer);
        currentEnvLayer++;
      }

      ctx.restore();

      // Draw snails on the glass (front-most layer, independent of cameraX for parallax effect or attached to glass)
      sim.snails.forEach(s => {
        s.update(sim.width, sim.height, sim.taps, cameraX);
        s.draw(ctx);
      });

      animationId = requestAnimationFrame(loop);
    };

    loop();

    return () => {
      clearTimeout(resizeTimeout);
      resizeObserver.disconnect();
      window.removeEventListener('orientationchange', handleOrientationChange);
      cancelAnimationFrame(animationId);
    };
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (stateRef.current.isDraggingFilter || stateRef.current.isDraggingBackground) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const simX = x + stateRef.current.cameraX;
    
    const sim = simRef.current;
    const filter = sim.sideFilter;
    
    if (filter) {
      const hitPadding = 20;
      if (
        simX >= filter.x - hitPadding && 
        simX <= filter.x + filter.width + hitPadding &&
        y >= filter.y - hitPadding &&
        y <= filter.y + filter.height + hitPadding
      ) {
        stateRef.current.isDraggingFilter = true;
        stateRef.current.dragOffsetY = y - filter.y;
        stateRef.current.dragPointerId = e.pointerId;
        try {
          canvas.setPointerCapture(e.pointerId);
        } catch (err) {
          // Ignore invalid pointerId errors
        }
        return;
      }
    }
    
    stateRef.current.isDraggingBackground = true;
    stateRef.current.dragStartX = e.clientX;
    stateRef.current.dragStartCameraX = stateRef.current.cameraX;
    stateRef.current.dragPointerId = e.pointerId;
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch (err) {
      // Ignore invalid pointerId errors
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerId !== stateRef.current.dragPointerId) return;
    
    if (stateRef.current.isDraggingFilter) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const y = e.clientY - rect.top;
      
      const sim = simRef.current;
      if (sim.sideFilter) {
        let newY = y - stateRef.current.dragOffsetY;
        newY = Math.max(0, Math.min(sim.height - sim.sideFilter.height, newY));
        sim.sideFilter.y = newY;
      }
    } else if (stateRef.current.isDraggingBackground) {
      const dx = e.clientX - stateRef.current.dragStartX;
      let newCameraX = stateRef.current.dragStartCameraX - dx;
      newCameraX = Math.max(0, Math.min(800, newCameraX));
      stateRef.current.cameraX = newCameraX;
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerId === stateRef.current.dragPointerId) {
      const canvas = canvasRef.current;
      if (canvas && canvas.hasPointerCapture(e.pointerId)) {
        try {
          canvas.releasePointerCapture(e.pointerId);
        } catch (err) {}
      }
      
      if (stateRef.current.isDraggingBackground) {
        const dx = Math.abs(e.clientX - stateRef.current.dragStartX);
        if (dx < 5) { // It was a tap
          const rect = canvas?.getBoundingClientRect();
          if (rect) {
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const simX = x + stateRef.current.cameraX;
            const sim = simRef.current;
            
            sim.taps.push({ x: simX, y, age: 0, maxAge: 60 });
            
            const count = Math.floor(Math.random() * 4) + 2;
            for (let i = 0; i < count; i++) {
              sim.foods.push(new Food(simX + (Math.random() * 30 - 15), y));
            }
          }
        }
      }
      
      stateRef.current.isDraggingFilter = false;
      stateRef.current.isDraggingBackground = false;
      stateRef.current.dragPointerId = -1;
    }
  };

  return (
    <canvas 
      ref={canvasRef} 
      className="w-full h-full block cursor-crosshair touch-none"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    />
  );
});

export default Aquarium;
