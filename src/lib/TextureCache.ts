import * as PIXI from 'pixi.js';
import { VectorFish, Bubble, Food, Pebble, Rock, Driftwood, Plant, GhostShrimp, SideFilter } from '../lib/entities';

export const TextureCache: any = {
  initialized: false,
};

export function initTextures() {
  if (TextureCache.initialized) return;
  
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { alpha: true })!;
  
  const renderFrames = (w: number, h: number, frames: number, drawFn: (ctx: CanvasRenderingContext2D, t: number) => void) => {
    canvas.width = w;
    canvas.height = h;
    const textures = [];
    for (let i = 0; i < frames; i++) {
      ctx.clearRect(0, 0, w, h);
      ctx.save();
      drawFn(ctx, i / frames);
      ctx.restore();
      textures.push(PIXI.Texture.from(canvas.toDataURL()));
    }
    return textures;
  };

  // Tetras
  TextureCache.tetra = renderFrames(64, 64, 10, (ctx, t) => {
    ctx.translate(32, 32);
    const f = new VectorFish(100, 100, 'tetra');
    f.x = 0; f.y = 0; f.angle = 0; f.size = 1; f.z = 66.666;
    f.vx = 1; f.vy = 0; f.idOffset = 0;
    const originalNow = Date.now;
    Date.now = () => t * (Math.PI * 2 / 5) * 1000;
    f.draw(ctx);
    Date.now = originalNow;
  });

  // Clownfish
  TextureCache.clownfish = renderFrames(64, 64, 10, (ctx, t) => {
    ctx.translate(32, 32);
    const f = new VectorFish(100, 100, 'clownfish');
    f.x = 0; f.y = 0; f.angle = 0; f.size = 1; f.z = 66.666;
    f.vx = 1; f.vy = 0; f.idOffset = 0;
    const originalNow = Date.now;
    Date.now = () => t * (Math.PI * 2 / 5) * 1000;
    f.draw(ctx);
    Date.now = originalNow;
  });

  // Shrimp
  TextureCache.shrimp = renderFrames(64, 64, 10, (ctx, t) => {
    ctx.translate(32, 32);
    const s = new GhostShrimp(100, 100);
    s.x = 0; s.y = 0; s.facingRight = true; s.z = 66.666;
    s.state = 'walking';
    s.legPhase = t * Math.PI * 2;
    s.draw(ctx);
  });

  // Bubble
  TextureCache.bubble = renderFrames(16, 16, 1, (ctx) => {
    ctx.translate(8, 8);
    const b = new Bubble(0, 0, 1);
    b.y = 0;
    b.draw(ctx);
  })[0];

  // Food
  TextureCache.food = renderFrames(16, 16, 1, (ctx) => {
    ctx.translate(8, 8);
    const f = new Food(0, 0);
    f.y = 0;
    f.draw(ctx);
  })[0];

  // Environment
  TextureCache.pebbles = [];
  for(let i=0; i<3; i++) {
    TextureCache.pebbles.push(renderFrames(32, 32, 1, (ctx) => {
      ctx.translate(16, 16);
      const p = new Pebble(100, 100);
      p.x = 0; p.y = 0; p.z = 66.666;
      p.draw(ctx);
    })[0]);
  }

  TextureCache.rocks = [];
  for(let i=0; i<3; i++) {
    TextureCache.rocks.push(renderFrames(128, 128, 1, (ctx) => {
      ctx.translate(64, 64);
      const r = new Rock(100, 100);
      r.x = 0; r.y = 0; r.z = 66.666;
      r.draw(ctx);
    })[0]);
  }

  TextureCache.driftwoods = [];
  for(let i=0; i<2; i++) {
    TextureCache.driftwoods.push(renderFrames(256, 256, 1, (ctx) => {
      ctx.translate(128, 128);
      const d = new Driftwood(100, 100);
      d.x = 0; d.y = 0; d.z = 66.666;
      d.draw(ctx);
    })[0]);
  }

  TextureCache.plants = [];
  for(let i=0; i<5; i++) {
    TextureCache.plants.push(renderFrames(128, 256, 10, (ctx, t) => {
      ctx.translate(64, 256);
      const p = new Plant(100, 100);
      p.x = 0; p.y = 0; p.z = 66.666;
      p.currentHeight = p.maxHeight;
      p.draw(ctx, t * Math.PI, 50);
    }));
  }

  TextureCache.sideFilter = renderFrames(64, 128, 1, (ctx) => {
    const s = new SideFilter(100, 256);
    s.x = 0; s.y = 0;
    s.draw(ctx, 0, 50);
  })[0];

  TextureCache.initialized = true;
}
