export type Species = 'tetra' | 'clownfish';

function normalizeAngle(angle: number): number {
  while (angle <= -Math.PI) angle += Math.PI * 2;
  while (angle > Math.PI) angle -= Math.PI * 2;
  return angle;
}

export class VectorFish {
  id: string;
  species: Species;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  angle: number;
  size: number;
  baseSpeed: number;
  maxSpeed: number;
  maxForce: number;
  idOffset: number;
  clockTarget: { x: number, y: number, angle: number } | null = null;

  constructor(width: number, height: number, species?: Species) {
    this.id = Math.random().toString(36).substr(2, 9);
    this.species = species || (Math.random() > 0.8 ? 'clownfish' : 'tetra');
    this.x = Math.random() * width;
    this.z = Math.random() * 100; // 0 is back, 100 is front
    this.vz = (Math.random() - 0.5) * 0.2; // Slow depth movement
    
    if (this.species === 'clownfish') {
      this.y = height - 150 - Math.random() * 150; // Clownfish prefer bottom
      this.size = 1.0 + Math.random() * 0.3;
      this.baseSpeed = 1.2 + Math.random() * 0.8;
      this.maxForce = 0.10 + Math.random() * 0.08;
    } else {
      this.y = Math.random() * (height - 200) + 100; // Tetras everywhere
      this.size = 0.8 + Math.random() * 0.3;
      this.baseSpeed = 1.0 + Math.random() * 0.5;
      this.maxForce = 0.08 + Math.random() * 0.04; // Increased power for schooling
    }
    
    this.angle = Math.random() * Math.PI * 2;
    this.vx = Math.cos(this.angle);
    this.vy = Math.sin(this.angle);
    this.maxSpeed = this.baseSpeed;
    this.idOffset = Math.random() * 1000;
  }

  update(width: number, height: number, fishes: VectorFish[], foods: Food[], flow: number, environment: (Pebble | Rock | Driftwood)[], sideFilter: SideFilter | null, taps: {x: number, y: number, age: number, maxAge: number}[]) {
    let ax = 0;
    let ay = 0;
    let nearestFood: Food | null = null;

    // Adjust max speed based on flow (50 is neutral, 0 is slow, 100 is fast)
    const flowMultiplier = 0.5 + (flow / 100); // 0.5x to 1.5x speed
    this.maxSpeed = this.baseSpeed * flowMultiplier;

    if (this.clockTarget) {
      const dx = this.clockTarget.x - this.x;
      const dy = this.clockTarget.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist > 0) {
        // Scale force down as it gets closer to avoid jitter
        const forceScale = Math.min(1, dist / 20);
        ax += (dx / dist) * this.maxForce * 20.0 * forceScale;
        ay += (dy / dist) * this.maxForce * 20.0 * forceScale;
      }
      
      const dz = 50 - this.z;
      this.vz += dz * 0.02;
      this.vz *= 0.9;
      
      this.vx *= 0.90;
      this.vy *= 0.90;
    } else {
      // 1. Seek Food
      let minDist = 300;
      for (const food of foods) {
        if (food.eaten) continue;
        const dx = food.x - this.x;
        const dy = food.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < minDist) {
          minDist = dist;
          nearestFood = food;
        }
      }

      if (nearestFood) {
        const dx = nearestFood.x - this.x;
        const dy = nearestFood.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 25 * this.size) {
          nearestFood.eaten = true;
        } else {
          // Slow down as we get closer to avoid orbiting
          const forceScale = dist < 100 ? Math.max(0.2, dist / 100) : 1;
          ax += (dx / dist) * this.maxForce * 4.0 * forceScale;
          ay += (dy / dist) * this.maxForce * 4.0 * forceScale;
          
          // Add a damping force to reduce perpendicular velocity (orbiting)
          this.vx *= 0.95;
          this.vy *= 0.95;
        }
      } else {
      // 2. Flocking (Tetras flock strongly, Clownfish weakly)
      let sepX = 0, sepY = 0, sepCount = 0;
      let aliX = 0, aliY = 0, aliCount = 0;
      let cohX = 0, cohY = 0, cohCount = 0;

      const perceptionRadius = this.species === 'tetra' ? 150 : 200;
      const separationRadius = (this.species === 'tetra' ? 30 : 100) * this.size;

      for (const other of fishes) {
        if (other === this) continue;
        const dx = this.x - other.x;
        const dy = this.y - other.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 0 && dist < separationRadius) {
          sepX += dx / dist;
          sepY += dy / dist;
          sepCount++;
        }

        if (dist > 0 && dist < perceptionRadius && this.species === other.species) {
          aliX += other.vx;
          aliY += other.vy;
          aliCount++;
          cohX += other.x;
          cohY += other.y;
          cohCount++;
        }
      }

      if (sepCount > 0) {
        const sepMult = this.species === 'tetra' ? 2.5 : 3.5;
        ax += (sepX / sepCount) * this.maxForce * sepMult;
        ay += (sepY / sepCount) * this.maxForce * sepMult;
      }

      if (aliCount > 0) {
        aliX /= aliCount;
        aliY /= aliCount;
        const speed = Math.sqrt(aliX * aliX + aliY * aliY);
        if (speed > 0) {
          const aliMult = this.species === 'tetra' ? 1.2 : 1.4;
          ax += ((aliX / speed) * this.maxSpeed - this.vx) * this.maxForce * aliMult;
          ay += ((aliY / speed) * this.maxSpeed - this.vy) * this.maxForce * aliMult;
        }
        
        cohX /= cohCount;
        cohY /= cohCount;
        const dx = cohX - this.x;
        const dy = cohY - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 0) {
          const cohMult = this.species === 'tetra' ? 0.8 : 1.1;
          ax += ((dx / dist) * this.maxSpeed - this.vx) * this.maxForce * cohMult;
          ay += ((dy / dist) * this.maxSpeed - this.vy) * this.maxForce * cohMult;
        }
      }

      // 3. Wander
      const time = Date.now() / 1000 + this.idOffset;
      const wanderMult = this.species === 'tetra' ? 0.8 : 1.8;
      ax += Math.cos(time * 0.5) * this.maxForce * wanderMult;
      ay += Math.sin(time * 0.6) * this.maxForce * wanderMult;
      
      // Tap evasion
      for (const tap of taps) {
        const dx = this.x - tap.x;
        const dy = this.y - tap.y;
        const distSq = dx * dx + dy * dy;
        if (distSq < 300 * 300) {
          const dist = Math.sqrt(distSq);
          // Strongest force when tap is new
          const ageFactor = 1 - (tap.age / tap.maxAge);
          const force = (1 - dist / 300) * this.maxForce * 20.0 * ageFactor;
          if (dist > 0) {
            ax += (dx / dist) * force;
            ay += (dy / dist) * force;
          }
        }
      }
      
      // Swim against current instinct
      const virtualWidth = width + 800; // Extend tank to the right
      if (flow > 0 && this.x > virtualWidth * 0.4) {
        // Stronger urge to swim left as they get further right
        const rightBias = (this.x - virtualWidth * 0.4) / (virtualWidth * 0.6);
        ax -= (flow / 100) * this.maxForce * (1.0 + rightBias * 2.0); 
      }

      // Repel from side filter (top pump) area for tetras
      if (this.species === 'tetra' && sideFilter) {
        const pumpX = sideFilter.x + sideFilter.width;
        const pumpY = sideFilter.y + sideFilter.height / 2;
        const dx = this.x - pumpX;
        const dy = this.y - pumpY;
        const distSq = dx * dx + dy * dy;
        if (distSq < 120 * 120) {
          const dist = Math.sqrt(distSq);
          const force = (1 - dist / 120) * this.maxForce * 3.0;
          if (dist > 0) {
            ax += (dx / dist) * force;
            ay += (dy / dist) * force;
          }
        }
      }
      
      // Clownfish prefer bottom
      if (this.species === 'clownfish') {
        const targetY = height - 100;
        ay += (targetY - this.y) * 0.0002;
      }

      // 4. Hardscape Interactions
      for (const item of environment) {
        if (item instanceof Pebble) continue;
        
        const dx = this.x - item.x;
        const dy = this.y - item.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        // Avoidance
        const avoidRadius = item instanceof Rock ? item.width * 0.8 : item.width * 0.5;
        if (dist < avoidRadius) {
          const force = (1 - dist / avoidRadius) * this.maxForce * 5.0;
          if (dist > 0) {
            ax += (dx / dist) * force;
            ay += (dy / dist) * force;
          }
        }

        // Clownfish Territory Attraction
        if (this.species === 'clownfish') {
          const territoryRadius = 300;
          if (dist < territoryRadius) {
            // Gentle pull towards the hardscape
            const pull = (1 - dist / territoryRadius) * 0.0005;
            ax -= dx * pull;
            ay -= dy * pull;
          }
        }
      }
    }

    // 4. Avoid Walls smoothly
    const marginX = 100;
    const marginY = 80;
    const turnFactor = this.maxForce * 6;
    const wallVirtualWidth = width + 800; // Extend tank to the right
    
    if (this.x < marginX) ax += turnFactor * (marginX - this.x) / marginX;
    if (this.x > wallVirtualWidth - marginX) ax -= turnFactor * (this.x - (wallVirtualWidth - marginX)) / marginX;
    
    if (this.y < marginY) ay += turnFactor * (marginY - this.y) / marginY;
    
    const bottomMargin = nearestFood ? 15 : marginY + 50;
    if (this.y > height - bottomMargin) ay -= turnFactor * (this.y - (height - bottomMargin)) / marginY;

    // 5. Flow effect (Horizontal push from left to right)
    const flowMag = flow / 100;
    // Apply flow as a force (acceleration) instead of direct velocity addition
    // This allows fish to swim against it more naturally
    ax += flowMag * 0.025; // Slightly reduced push
  }

    // Apply acceleration
    this.vx += ax;
    this.vy += ay;

    // Limit speed
    const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    if (this.clockTarget) {
      if (speed > this.maxSpeed * 4) {
        this.vx = (this.vx / speed) * this.maxSpeed * 4;
        this.vy = (this.vy / speed) * this.maxSpeed * 4;
      }
    } else {
      if (speed > this.maxSpeed) {
        this.vx = (this.vx / speed) * this.maxSpeed;
        this.vy = (this.vy / speed) * this.maxSpeed;
      } else if (speed < this.maxSpeed * 0.3) {
        if (speed > 0) {
          this.vx = (this.vx / speed) * (this.maxSpeed * 0.3);
          this.vy = (this.vy / speed) * (this.maxSpeed * 0.3);
        } else {
          this.vx = this.maxSpeed * 0.3;
          this.vy = 0;
        }
      }
    }

    this.x += this.vx;
    this.y += this.vy;
    this.z += this.vz;
    
    if (this.z < 0) { this.z = 0; this.vz *= -1; }
    if (this.z > 100) { this.z = 100; this.vz *= -1; }

    // Smooth angle rotation
    if (this.clockTarget && Math.sqrt(this.vx*this.vx + this.vy*this.vy) < 1.5) {
      let diff1 = normalizeAngle(this.clockTarget.angle - this.angle);
      let diff2 = normalizeAngle(this.clockTarget.angle + Math.PI - this.angle);
      let diff = Math.abs(diff1) < Math.abs(diff2) ? diff1 : diff2;
      this.angle += diff * 0.15;
    } else {
      const targetAngle = Math.atan2(this.vy, this.vx);
      let diff = normalizeAngle(targetAngle - this.angle);
      this.angle += diff * 0.1;
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.translate(this.x, this.y);
    
    const isFlipped = Math.abs(normalizeAngle(this.angle)) > Math.PI / 2;
    ctx.rotate(this.angle);
    if (isFlipped) {
      ctx.scale(1, -1);
    }

    // Parallax scale based on z-depth (0.6x at back, 1.2x at front)
    const depthScale = 0.6 + (this.z / 100) * 0.6;
    ctx.scale(this.size * depthScale, this.size * depthScale);

    const time = Date.now() / 1000 + this.idOffset;
    const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    const tailSway = Math.sin(time * (10 + speed * 5)) * (0.2 + speed * 0.1);
    const finSway = Math.sin(time * 5) * 0.1;

    if (this.species === 'tetra') {
      this.drawTetra(ctx, tailSway, finSway);
    } else {
      this.drawClownfish(ctx, tailSway, finSway);
    }

    ctx.restore();
  }

  drawTetra(ctx: CanvasRenderingContext2D, tailSway: number, finSway: number) {
    // Tail
    ctx.save();
    ctx.translate(-10, 0);
    ctx.rotate(tailSway);
    ctx.fillStyle = 'rgba(200, 200, 200, 0.5)';
    ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(-8, -5); ctx.lineTo(-6, 0); ctx.lineTo(-8, 5); ctx.fill();
    ctx.restore();

    // Body
    ctx.fillStyle = '#e2e8f0';
    ctx.beginPath(); ctx.ellipse(0, 0, 12, 4, 0, 0, Math.PI*2); ctx.fill();

    // Neon Stripes
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#00ffff'; // Neon cyan
    ctx.beginPath(); ctx.moveTo(-8, -1); ctx.lineTo(6, -1); ctx.stroke();
    
    ctx.strokeStyle = '#ff3333'; // Neon red
    ctx.beginPath(); ctx.moveTo(-2, 1); ctx.lineTo(10, 1); ctx.stroke();

    // Pectoral fin
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.save();
    ctx.translate(3, 1.5);
    ctx.rotate(finSway + 0.2);
    ctx.beginPath(); ctx.ellipse(0, 0, 2.5, 1, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // Eye
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(8, -1, 1.5, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(8.5, -1, 0.8, 0, Math.PI*2); ctx.fill();
  }

  drawClownfish(ctx: CanvasRenderingContext2D, tailSway: number, finSway: number) {
    // Tail
    ctx.save();
    ctx.translate(-12, 0);
    ctx.rotate(tailSway * 1.2);
    ctx.fillStyle = '#ea580c';
    ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(-8, -6); ctx.quadraticCurveTo(-10, 0, -8, 6); ctx.fill();
    ctx.lineWidth = 1; ctx.strokeStyle = '#000'; ctx.stroke();
    ctx.restore();

    // Top fin
    ctx.fillStyle = '#ea580c';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-4, -6); ctx.quadraticCurveTo(0, -12, 4, -5); ctx.fill(); ctx.stroke();

    // Body
    ctx.fillStyle = '#ea580c';
    ctx.beginPath(); ctx.ellipse(0, 0, 14, 7, 0, 0, Math.PI*2); ctx.fill();

    // White Bands
    const drawBand = (x: number, w: number, h: number) => {
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(x, 0, w, h, 0, 0, Math.PI*2); ctx.fill(); ctx.stroke();
    };
    drawBand(5, 2, 6.5);
    drawBand(-2, 2.5, 7);
    drawBand(-9, 1.5, 5);

    // Pectoral fin
    ctx.save();
    ctx.translate(1, 2);
    ctx.rotate(finSway * 2 + 0.5);
    ctx.fillStyle = '#ea580c';
    ctx.beginPath(); ctx.ellipse(0, 0, 3.5, 2, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.restore();

    // Eye
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(10, -2, 1.5, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(10.5, -2, 0.8, 0, Math.PI*2); ctx.fill();
  }
}

export class Bubble {
  x: number;
  y: number;
  size: number;
  vy: number;
  vx: number = 0;
  wobble: number;
  wobbleSpeed: number;
  startX: number;

  constructor(x: number, y: number, sizeMultiplier: number = 1) {
    this.startX = x;
    this.x = x;
    this.y = y;
    // Smaller, more realistic bubbles
    this.size = (Math.random() * 1.5 + 0.5) * sizeMultiplier;
    // Faster rise for larger bubbles, slower for tiny ones
    this.vy = -(Math.random() * 0.5 + 0.4) * (this.size * 0.5 + 0.5);
    this.wobble = Math.random() * Math.PI * 2;
    this.wobbleSpeed = Math.random() * 0.1 + 0.05;
  }

  update(flow: number, width: number) {
    const flowMag = flow / 100;
    // Rise speed slightly affected by flow turbulence
    this.y += this.vy * (1 + flowMag * 0.3);
    this.wobble += this.wobbleSpeed * (1 + flowMag * 2);
    
    // Apply horizontal velocity (initial push)
    this.startX += this.vx;
    this.vx *= 0.96; // Decay velocity over time
    
    // Flow pushes bubbles horizontally as they rise
    // Reduced push for bubbles on the left
    const xFactor = 0.15 + 0.85 * Math.min(1, this.startX / (width * 0.4));
    this.startX += flowMag * 0.625 * xFactor;
    
    // More wobble for smaller bubbles, and flow increases wobble width
    const wobbleWidth = (3 / this.size) * (1 + flowMag * 6);
    this.x = this.startX + Math.sin(this.wobble) * wobbleWidth;

    // Keep bubbles inside the tank horizontally
    if (this.x > width - 5) {
      this.x = width - 5;
      this.startX = this.x - Math.sin(this.wobble) * wobbleWidth;
    }
    if (this.x < 5) {
      this.x = 5;
      this.startX = this.x - Math.sin(this.wobble) * wobbleWidth;
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    
    // Highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.beginPath();
    ctx.arc(this.x - this.size * 0.3, this.y - this.size * 0.3, this.size * 0.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

export class Food {
  id: string;
  x: number;
  y: number;
  vy: number;
  vx: number;
  eaten: boolean;
  life: number;

  constructor(x: number, y: number) {
    this.id = Math.random().toString(36).substr(2, 9);
    this.x = x;
    this.y = y;
    this.vy = 0.5 + Math.random() * 0.5;
    this.vx = (Math.random() - 0.5) * 0.5;
    this.eaten = false;
    this.life = 0;
  }

  update(height: number, flow: number) {
    const flowMag = flow / 100;
    if (this.y < height - 15) {
      this.y += this.vy * (1 + flowMag * 0.5);
      this.x += this.vx * (1 + flowMag);
    } else {
      this.y = height - 15;
      this.life++;
      if (this.life > 1000) { // Decay after a while on the bottom
        this.eaten = true;
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = '#d97706'; // Amber/Brown flake
    ctx.beginPath();
    ctx.arc(this.x, this.y, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

export class Pebble {
  x: number;
  y: number;
  rX: number;
  rY: number;
  angle: number;
  lightColor: string;
  darkColor: string;
  z: number;

  constructor(width: number, height: number) {
    this.x = Math.random() * width;
    // Spread pebbles across the bottom 40px
    this.y = height - Math.random() * 40;
    this.z = Math.random() * 100;
    
    // Slightly smaller pebbles
    this.rX = Math.random() * 6 + 4;
    this.rY = this.rX * (0.4 + Math.random() * 0.4);
    this.angle = Math.random() * Math.PI;
    
    // Darker, slightly blue-tinted colors to blend with deep water
    const baseColors = [
      [100, 110, 120], // mid blue-gray
      [80, 90, 100],   // dark blue-gray
      [60, 70, 80],    // darker blue-gray
      [50, 60, 70],    // slate blue
      [40, 50, 60],    // dark slate
      [30, 40, 50],    // very dark slate
    ];
    const base = baseColors[Math.floor(Math.random() * baseColors.length)];
    const r = Math.min(255, Math.max(0, base[0] + (Math.random() * 15 - 7)));
    const g = Math.min(255, Math.max(0, base[1] + (Math.random() * 15 - 7)));
    const b = Math.min(255, Math.max(0, base[2] + (Math.random() * 15 - 7)));
    
    this.lightColor = `rgb(${r+20}, ${g+25}, ${b+30})`; // Highlight has a blue tint
    this.darkColor = `rgb(${r-30}, ${g-30}, ${b-20})`;
  }

  draw(ctx: CanvasRenderingContext2D) {
    const depthScale = 0.6 + (this.z / 100) * 0.6;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(depthScale, depthScale);
    
    ctx.fillStyle = this.darkColor;
    ctx.beginPath();
    ctx.ellipse(0, 0, this.rX, this.rY, this.angle, 0, Math.PI * 2);
    ctx.fill();
    
    // Simple highlight instead of gradient
    ctx.fillStyle = this.lightColor;
    ctx.beginPath();
    ctx.ellipse(-this.rX * 0.2, -this.rY * 0.2, this.rX * 0.4, this.rY * 0.4, this.angle, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

export class Rock {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  detailColor: string;
  z: number;
  points: {x: number, y: number}[];

  constructor(width: number, height: number) {
    this.x = Math.random() * width;
    this.y = height - 20 - Math.random() * 30;
    this.z = Math.random() * 100;
    this.width = 150 + Math.random() * 150;
    this.height = 100 + Math.random() * 120;
    
    const shade = 60 + Math.random() * 40;
    this.color = `rgb(${shade}, ${shade}, ${shade})`; // Neutral gray
    this.detailColor = `rgb(${shade - 20}, ${shade - 20}, ${shade - 20})`;
    
    // Generate irregular rock shape
    this.points = [];
    const segments = 12;
    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const r = 0.8 + Math.random() * 0.8;
      this.points.push({
        x: Math.cos(angle) * this.width * 0.5 * r,
        y: Math.sin(angle) * this.height * 0.5 * r
      });
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    const depthScale = 0.6 + (this.z / 100) * 0.6;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(depthScale, depthScale);

    // Subtle shadow
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(0, this.height * 0.3, this.width * 0.6, this.height * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1.0;

    ctx.fillStyle = this.color;
    ctx.strokeStyle = this.detailColor;
    ctx.lineWidth = 2;
    
    ctx.beginPath();
    const p0 = this.points[0];
    const pLast = this.points[this.points.length - 1];
    ctx.moveTo((p0.x + pLast.x) / 2, (p0.y + pLast.y) / 2);
    for (let i = 0; i < this.points.length; i++) {
      const p1 = this.points[i];
      const p2 = this.points[(i + 1) % this.points.length];
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;
      ctx.quadraticCurveTo(p1.x, p1.y, midX, midY);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Highlights
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    const hp0 = this.points[0];
    ctx.moveTo(hp0.x * 0.7, hp0.y * 0.7);
    for (let i = 0; i < Math.floor(this.points.length / 2); i++) {
      const p1 = this.points[i];
      const p2 = this.points[(i + 1) % this.points.length];
      const midX = ((p1.x + p2.x) / 2) * 0.7;
      const midY = ((p1.y + p2.y) / 2) * 0.7;
      ctx.quadraticCurveTo(p1.x * 0.7, p1.y * 0.7, midX, midY);
    }
    ctx.fill();

    // Moss/Algae (very subtle)
    ctx.globalAlpha = 0.1;
    ctx.fillStyle = '#1b5e20';
    ctx.beginPath();
    for (let i = 0; i < this.points.length; i++) {
      if (this.points[i].y < -this.height * 0.2) { // Only on top parts
        ctx.arc(this.points[i].x, this.points[i].y, 8, 0, Math.PI * 2);
      }
    }
    ctx.fill();
    
    ctx.restore();
  }
}

export class Driftwood {
  x: number;
  y: number;
  width: number;
  height: number;
  z: number;
  rotation: number;
  color: string;
  detailColor: string;
  branches: { length: number, angle: number, thickness: number }[];

  constructor(width: number, height: number) {
    this.x = Math.random() * width;
    this.y = height - 30 - Math.random() * 30;
    this.z = Math.random() * 100;
    this.width = 250 + Math.random() * 250;
    this.height = 60 + Math.random() * 60;
    this.rotation = (Math.random() - 0.5) * 0.4;
    
    // Weathered driftwood colors
    const woodShades = [
      { base: '#8d6e63', detail: '#5d4037' }, // Warm tan
      { base: '#a1887f', detail: '#795548' }, // Lighter weathered
      { base: '#795548', detail: '#4e342e' }, // Darker weathered
      { base: '#bcaaa4', detail: '#8d6e63' }, // Silvery tan
    ];
    const wood = woodShades[Math.floor(Math.random() * woodShades.length)];
    this.color = wood.base;
    this.detailColor = wood.detail;
    
    this.branches = [];
    const numBranches = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < numBranches; i++) {
      this.branches.push({
        length: 80 + Math.random() * 120,
        angle: (Math.random() - 0.5) * 1.5,
        thickness: 18 + Math.random() * 12
      });
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    const depthScale = 0.6 + (this.z / 100) * 0.6;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    ctx.scale(depthScale, depthScale);

    // Subtle shadow
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(0, this.height * 0.4, this.width * 0.6, this.height * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1.0;

    ctx.fillStyle = this.color;
    ctx.strokeStyle = this.detailColor;
    ctx.lineWidth = 2;

    // Main trunk
    ctx.beginPath();
    ctx.ellipse(0, 0, this.width * 0.5, this.height * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Wood grain detail
    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = this.detailColor;
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      const yOff = (Math.random() - 0.5) * this.height * 0.4;
      ctx.moveTo(-this.width * 0.4, yOff);
      ctx.bezierCurveTo(
        -this.width * 0.2, yOff + (Math.random() - 0.5) * 10,
        this.width * 0.2, yOff + (Math.random() - 0.5) * 10,
        this.width * 0.4, yOff
      );
      ctx.stroke();
    }
    ctx.globalAlpha = 1.0;

    // Branches
    this.branches.forEach((branch, i) => {
      ctx.save();
      const xPos = (i / (this.branches.length - 1) - 0.5) * this.width * 0.7;
      ctx.translate(xPos, 0);
      ctx.rotate(branch.angle);
      
      // Tapered branch with rounded end
      const tipRadius = branch.thickness * 0.25;
      ctx.beginPath();
      ctx.moveTo(0, -branch.thickness * 0.5);
      ctx.quadraticCurveTo(branch.length * 0.5, -branch.thickness * 0.4, branch.length - tipRadius, -tipRadius);
      ctx.arc(branch.length - tipRadius, 0, tipRadius, -Math.PI/2, Math.PI/2);
      ctx.quadraticCurveTo(branch.length * 0.5, branch.thickness * 0.4, 0, branch.thickness * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Branch grain
      ctx.globalAlpha = 0.2;
      ctx.beginPath();
      ctx.moveTo(branch.length * 0.2, 0);
      ctx.lineTo(branch.length * 0.8, 0);
      ctx.stroke();
      ctx.globalAlpha = 1.0;
      
      ctx.restore();
    });

    // Texture lines
    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = '#000';
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const ty = (i - 4) * (this.height * 0.1);
      const xStart = -this.width * 0.4 * (1 - Math.abs(ty/this.height));
      const xEnd = this.width * 0.4 * (1 - Math.abs(ty/this.height));
      ctx.moveTo(xStart, ty);
      ctx.lineTo(xEnd, ty);
    }
    ctx.stroke();
    
    ctx.restore();
  }
}

export class Plant {
  x: number;
  y: number;
  z: number;
  type: 'grass' | 'leafy' | 'elodea';
  segments: number;
  maxHeight: number;
  currentHeight: number;
  growthRate: number;
  color: string;
  swayPhase: number;
  blades?: { xOff: number, hMult: number, swayOff: number }[];
  growing: boolean;

  constructor(width: number, height: number) {
    this.x = Math.random() * width;
    this.y = height - Math.random() * 50; // Spread plants in depth
    this.z = Math.random() * 100; // 0 is back, 100 is front
    const rand = Math.random();
    if (rand > 0.6) this.type = 'grass';
    else if (rand > 0.3) this.type = 'leafy';
    else this.type = 'elodea';
    this.segments = Math.floor(Math.random() * 6) + 6; // 6 to 11
    
    // Grow to ~80% of tank height
    this.maxHeight = height * 0.8 * (0.8 + Math.random() * 0.4); 
    this.currentHeight = Math.random() * this.maxHeight; // Start at random height
    
    // Growth rate set for a cycle of roughly 1 hour (3600 seconds)
    // Assuming 60 fps, 3600 * 60 = 216000 frames.
    // To grow ~600px in 216000 frames, rate is ~0.0027 per frame.
    this.growthRate = 0.001 + Math.random() * 0.003; 
    
    this.growing = Math.random() > 0.5;
    
    const colors = ['#15803d', '#166534', '#22c55e', '#10b981', '#047857'];
    this.color = colors[Math.floor(Math.random() * colors.length)];
    this.swayPhase = Math.random() * Math.PI * 2;

    if (this.type === 'grass') {
      const numBlades = Math.floor(Math.random() * 4) + 3; // 3 to 6 blades
      this.blades = Array.from({length: numBlades}, () => ({
        xOff: (Math.random() - 0.5) * 20,
        hMult: 0.4 + Math.random() * 0.8, // Varying heights
        swayOff: Math.random() * Math.PI
      }));
    }
  }

  update() {
    if (this.growing) {
      this.currentHeight += this.growthRate;
      if (this.currentHeight >= this.maxHeight) {
        this.growing = false;
      }
    } else {
      this.currentHeight -= this.growthRate * 0.5; // Die off a bit slower
      if (this.currentHeight <= 10) {
        this.growing = true;
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D, time: number, flow: number, sideFilter: any = null) {
    ctx.save();
    // Parallax scale based on z-depth
    const depthScale = 0.6 + (this.z / 100) * 0.6;
    // Translate to plant base, scale, then translate back to draw relative to original coordinates
    ctx.translate(this.x, this.y);
    ctx.scale(depthScale, depthScale);
    ctx.translate(-this.x, -this.y);

    let effectiveFlow = flow;
    if (sideFilter) {
      const filterCenterY = sideFilter.y + sideFilter.height / 2;
      const plantTop = this.y - this.currentHeight;
      const plantBottom = this.y;
      
      // Check if filter is vertically aligned with the plant
      if (filterCenterY >= plantTop - 50 && filterCenterY <= plantBottom + 50) {
        // Calculate horizontal distance factor (closer = stronger)
        const distFactor = Math.max(0, 1 - this.x / 800); 
        effectiveFlow += flow * 2.0 * distFactor; // Up to 3x flow
      }
    }

    const flowMag = effectiveFlow / 100;
    const flowTilt = flowMag * 40; // Constant tilt to the right
    
    if (this.type === 'grass' && this.blades) {
      ctx.fillStyle = this.color;
      for (const blade of this.blades) {
        const h = this.currentHeight * blade.hMult;
        const sway = flowTilt + Math.sin(time * (1.5 + flowMag * 1.2) + this.swayPhase + blade.swayOff) * (h * (flowMag * 0.14));
        const bx = this.x + blade.xOff;
        
        ctx.beginPath();
        ctx.moveTo(bx - 3, this.y);
        ctx.quadraticCurveTo(bx + sway * 0.5, this.y - h * 0.5, bx + sway, this.y - h);
        ctx.quadraticCurveTo(bx + sway * 0.5 + 3, this.y - h * 0.5, bx + 3, this.y);
        ctx.fill();
      }
    } else if (this.type === 'elodea') {
      const seedState = { val: this.x * 1000 };
      this.drawElodeaBranch(ctx, this.x, this.y, this.currentHeight * 0.4, flowTilt * 0.01, 3, time, flowMag, this.swayPhase, seedState);
    } else {
      // Leafy
      const sway = flowTilt + Math.sin(time * (1.2 + flowMag * 1.2) + this.swayPhase) * (this.currentHeight * (flowMag * 0.14));
      
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.quadraticCurveTo(this.x + sway * 0.5, this.y - this.currentHeight * 0.5, this.x + sway, this.y - this.currentHeight);
      ctx.stroke();

      ctx.fillStyle = this.color;
      // Only draw leaves up to the current grown height proportion
      const activeSegments = Math.floor((this.currentHeight / this.maxHeight) * this.segments);
      
      for (let i = 1; i <= activeSegments; i++) {
        const t = i / this.segments;
        const px = (1-t)*(1-t)*this.x + 2*(1-t)*t*(this.x + sway*0.5) + t*t*(this.x + sway);
        const py = (1-t)*(1-t)*this.y + 2*(1-t)*t*(this.y - this.currentHeight*0.5) + t*t*(this.y - this.currentHeight);

        const leafSway = Math.sin(time * 2 + i) * 0.2;
        const leafSize = 1 - (t * 0.6); // Leaves get smaller towards top
        
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(leafSway + (sway * 0.02));
        
        // Left leaf
        ctx.beginPath(); ctx.ellipse(-6 * leafSize, 0, 7 * leafSize, 3 * leafSize, -Math.PI/6, 0, Math.PI*2); ctx.fill();
        // Right leaf
        ctx.beginPath(); ctx.ellipse(6 * leafSize, 0, 7 * leafSize, 3 * leafSize, Math.PI/6, 0, Math.PI*2); ctx.fill();
        
        ctx.restore();
      }
    }
    ctx.restore();
  }

  drawElodeaBranch(ctx: CanvasRenderingContext2D, startX: number, startY: number, length: number, angle: number, depth: number, time: number, flowMag: number, swayPhase: number, seedState: { val: number }) {
    if (depth === 0 || length < 5) return;

    const random = () => {
      let x = Math.sin(seedState.val++) * 10000;
      return x - Math.floor(x);
    };

    // Calculate end point with sway
    const sway = Math.sin(time * (1.0 + flowMag) + swayPhase + depth) * (length * flowMag * 0.3);
    const endX = startX + Math.sin(angle) * length + sway;
    const endY = startY - Math.cos(angle) * length;

    // Draw stem
    ctx.strokeStyle = this.color;
    ctx.lineWidth = depth * 1.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.quadraticCurveTo(startX + sway * 0.5, startY - length * 0.5, endX, endY);
    ctx.stroke();

    // Draw leaves along the stem
    // Reduce leaf density for performance and use simple lines instead of ellipses
    const numLeaves = Math.floor(length / 12);
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 1.5 + depth * 0.5;
    ctx.beginPath();
    for (let i = 1; i <= numLeaves; i++) {
      const t = i / numLeaves;
      const px = (1-t)*(1-t)*startX + 2*(1-t)*t*(startX + sway*0.5) + t*t*endX;
      const py = (1-t)*(1-t)*startY + 2*(1-t)*t*(startY - length*0.5) + t*t*endY;

      const leafSize = 4 + depth * 1.5;
      
      // Whorl of leaves
      const whorlSway = Math.sin(time * 2 + i) * 0.1;
      const baseAngle = angle + whorlSway;
      
      for (let j = 0; j < 2; j++) {
        // Draw leaves roughly perpendicular to the stem
        const leafAngle = baseAngle + (j * Math.PI) + (Math.PI / 2);
        ctx.moveTo(px, py);
        ctx.lineTo(px + Math.cos(leafAngle) * leafSize, py + Math.sin(leafAngle) * leafSize);
      }
    }
    ctx.stroke();

    // Branching
    if (depth > 1) {
      // Main continuation
      this.drawElodeaBranch(ctx, endX, endY, length * (0.7 + random()*0.2), angle + (random() - 0.5) * 0.2, depth - 1, time, flowMag, swayPhase, seedState);
      
      // Side branches
      if (random() > 0.3) {
        const branchAngle = angle - 0.3 - random() * 0.3;
        this.drawElodeaBranch(ctx, endX, endY, length * (0.5 + random()*0.2), branchAngle, depth - 1, time, flowMag, swayPhase, seedState);
      }
      if (random() > 0.3) {
        const branchAngle = angle + 0.3 + random() * 0.3;
        this.drawElodeaBranch(ctx, endX, endY, length * (0.5 + random()*0.2), branchAngle, depth - 1, time, flowMag, swayPhase, seedState);
      }
      
      // Occasional mid-stem branch
      if (random() > 0.6) {
        const midT = 0.3 + random() * 0.4;
        const midX = (1-midT)*(1-midT)*startX + 2*(1-midT)*midT*(startX + sway*0.5) + midT*midT*endX;
        const midY = (1-midT)*(1-midT)*startY + 2*(1-midT)*midT*(startY - length*0.5) + midT*midT*endY;
        const branchAngle = angle + (random() > 0.5 ? 0.5 : -0.5);
        this.drawElodeaBranch(ctx, midX, midY, length * 0.6, branchAngle, depth - 1, time, flowMag, swayPhase, seedState);
      }
    }
  }
}

export class GhostShrimp {
  x: number;
  y: number;
  vx: number;
  vy: number;
  targetX: number | null;
  targetY: number | null;
  width: number;
  height: number;
  legPhase: number;
  facingRight: boolean;
  state: 'walking' | 'swimming' | 'climbing';
  targetPlant: Plant | null;
  targetRock: Rock | null;
  targetWood: Driftwood | null;
  surfacePoint: { x: number, y: number } | null;
  swimPhase: number;
  z: number;
  vz: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.x = Math.random() * width;
    this.y = height - 15;
    this.z = Math.random() * 100;
    this.vz = 0; // Velocity in z-direction
    this.vx = 0;
    this.vy = 0;
    this.targetX = null;
    this.targetY = null;
    this.legPhase = 0;
    this.facingRight = Math.random() > 0.5;
    this.state = 'walking';
    this.targetPlant = null;
    this.targetRock = null;
    this.targetWood = null;
    this.surfacePoint = null;
    this.swimPhase = 0;
  }

  update(width: number, height: number, foods: Food[], plants: Plant[], environment: (Pebble | Rock | Driftwood)[]) {
    this.width = width + 800; // Extend tank to the right
    this.height = height;
    const floorY = height - 15;
    
    const rocks = environment.filter(e => e instanceof Rock) as Rock[];
    const woods = environment.filter(e => e instanceof Driftwood) as Driftwood[];

    if (this.state === 'walking') {
      // If on a rock or wood, stay on its surface
      if (this.targetRock && this.surfacePoint) {
        this.y = this.targetRock.y + this.surfacePoint.y;
        this.x = this.targetRock.x + this.surfacePoint.x;
      } else if (this.targetWood && this.surfacePoint) {
        this.y = this.targetWood.y + this.surfacePoint.y;
        this.x = this.targetWood.x + this.surfacePoint.x;
      } else {
        this.y = floorY;
      }
      
      this.vy = 0;

      // Look for food
      let closestFood: Food | null = null;
      let minDist = Infinity;

      for (const f of foods) {
        if (!f.eaten) {
          const dist = Math.sqrt(Math.pow(f.x - this.x, 2) + Math.pow(f.y - this.y, 2));
          if (dist < minDist && dist < 200) {
            minDist = dist;
            closestFood = f;
          }
        }
      }

      if (closestFood) {
        this.targetX = closestFood.x;
        // If food is higher up, maybe swim to it
        if (closestFood.y < this.y - 20 && Math.random() < 0.05) {
          this.state = 'swimming';
          this.targetY = closestFood.y;
        }
        
        if (minDist < 15) {
          closestFood.eaten = true;
          this.targetX = null;
        }
      } else {
        if (this.targetX === null || Math.abs(this.targetX - this.x) < 5) {
          const rand = Math.random();
          if (rand < 0.015 && plants.length > 0) {
            // Start climbing a plant
            this.state = 'climbing';
            this.targetPlant = plants[Math.floor(Math.random() * plants.length)];
            this.targetRock = null;
            this.targetWood = null;
            this.targetX = this.targetPlant.x;
            this.vz = (this.targetPlant.z - this.z) * 0.1;
          } else if (rand < 0.01 && rocks.length > 0) {
            // Start climbing a rock
            this.state = 'climbing';
            this.targetRock = rocks[Math.floor(Math.random() * rocks.length)];
            this.targetPlant = null;
            this.targetWood = null;
            this.targetX = this.targetRock.x;
            this.vz = (this.targetRock.z - this.z) * 0.1;
          } else if (rand < 0.01 && woods.length > 0) {
            // Start climbing driftwood
            this.state = 'climbing';
            this.targetWood = woods[Math.floor(Math.random() * woods.length)];
            this.targetPlant = null;
            this.targetRock = null;
            this.targetX = this.targetWood.x;
            this.vz = (this.targetWood.z - this.z) * 0.1;
          } else if (rand < 0.02) {
            // Start swimming
            this.state = 'swimming';
            this.targetPlant = null;
            this.targetRock = null;
            this.targetWood = null;
            this.targetX = this.x + (Math.random() * 300 - 150);
            this.targetY = this.y - 100 - Math.random() * 250;
            this.targetX = Math.max(20, Math.min(this.width - 20, this.targetX));
            this.targetY = Math.max(50, this.targetY);
            
            const targetZ = Math.random() * 100;
            this.vz = (targetZ - this.z) * 0.01;
          } else if (rand < 0.05) {
            this.targetX = this.x + (Math.random() * 400 - 200);
            this.targetX = Math.max(20, Math.min(this.width - 20, this.targetX));
          } else if (rand < 0.1) {
            this.targetX = null;
          }
        }
      }

      if (this.targetX !== null && !this.targetRock && !this.targetWood) {
        this.targetX = Math.max(10, Math.min(this.width - 10, this.targetX));
        const dx = this.targetX - this.x;
        if (Math.abs(dx) > 2) {
          this.vx = Math.sign(dx) * 0.12;
          this.facingRight = this.vx > 0;
          this.legPhase += 0.03;
        } else {
          this.vx = 0;
        }
      } else {
        this.vx = 0;
      }
      
      this.vz *= 0.95;

    } else if (this.state === 'swimming') {
      this.swimPhase += 0.1;
      this.legPhase += 0.1; // Reduced leg speed
      
      if (this.targetX !== null && this.targetY !== null) {
        this.targetX = Math.max(10, Math.min(this.width - 10, this.targetX));
        const dx = this.targetX - this.x;
        const dy = this.targetY - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist > 5) {
          this.vx = (dx / dist) * 0.4; // Reduced swimming speed
          this.vy = (dy / dist) * 0.4;
          this.facingRight = this.vx > 0;
        } else {
          // Reached target, either swim somewhere else or sink back down
          if (Math.random() < 0.3) {
            this.targetX = this.x + (Math.random() * 200 - 100);
            this.targetY = this.y + (Math.random() * 100 - 50);
            // Keep within bounds
            this.targetX = Math.max(20, Math.min(this.width - 20, this.targetX));
            this.targetY = Math.max(height * 0.3, Math.min(floorY, this.targetY));
          } else {
            // Swim down to the floor
            this.targetX = this.x;
            this.targetY = floorY;
            this.vz = 0;
          }
        }
      } else {
        // Swim down to the floor
        this.targetX = this.x;
        this.targetY = floorY;
      }
      
      // Apply z-velocity
      this.z += this.vz;
      if (this.z < 0) { this.z = 0; this.vz = 0; }
      if (this.z > 100) { this.z = 100; this.vz = 0; }
      
      // Add a little bobbing motion when swimming
      this.vy += Math.sin(this.swimPhase) * 0.1;
      
      // If we hit the floor, go back to walking
      if (this.y >= floorY) {
        this.y = floorY;
        this.state = 'walking';
      }

    } else if (this.state === 'climbing') {
      this.legPhase += 0.05;
      
      if (this.targetPlant) {
        // Plant climbing logic
        this.z += this.vz;
        this.vz *= 0.9;
        
        if (this.targetPlant.x < 10 || this.targetPlant.x > this.width - 10) {
          this.targetPlant = null;
          this.state = 'swimming';
          this.targetX = this.x;
          this.targetY = floorY;
        } else {
          const dx = this.targetPlant.x - this.x;
          if (Math.abs(dx) > 2 && this.y >= floorY - 5) {
            this.vx = Math.sign(dx) * 0.15;
            this.vy = 0;
            this.facingRight = this.vx > 0;
          } else {
            this.vx = 0;
            this.x = this.targetPlant.x;
            const minClimbY = this.targetPlant.y - this.targetPlant.currentHeight + 20;
            if (this.targetY === null || this.targetY > this.y) {
              this.targetY = minClimbY + Math.random() * (this.y - minClimbY);
            }
            const dy = this.targetY - this.y;
            if (Math.abs(dy) > 2) {
              this.vy = Math.sign(dy) * 0.2;
              this.facingRight = Math.sin(Date.now() / 500) > 0;
            } else {
              if (Math.random() < 0.02) {
                this.state = 'swimming';
                this.targetX = this.x + (Math.random() > 0.5 ? 50 : -50);
                this.targetY = this.y - 20;
                this.targetPlant = null;
              } else if (Math.random() < 0.05) {
                this.targetY = minClimbY + Math.random() * (floorY - minClimbY);
              } else {
                this.vy = 0;
              }
            }
          }
        }
      } else if (this.targetRock) {
        // Rock climbing logic
        this.z += this.vz;
        this.vz *= 0.9;
        
        const dx = this.targetRock.x - this.x;
        if (Math.abs(dx) > 5 && !this.surfacePoint) {
          this.vx = Math.sign(dx) * 0.15;
          this.vy = 0;
          this.facingRight = this.vx > 0;
        } else {
          this.vx = 0;
          if (!this.surfacePoint) {
            // Pick a point on the rock surface
            const angle = Math.random() * Math.PI; // Top half
            const r = 0.5 + Math.random() * 0.4;
            this.surfacePoint = {
              x: Math.cos(angle) * this.targetRock.width * 0.5 * r,
              y: -Math.sin(angle) * this.targetRock.height * 0.5 * r
            };
            this.targetY = this.targetRock.y + this.surfacePoint.y;
            this.targetX = this.targetRock.x + this.surfacePoint.x;
          }
          
          const dy = this.targetY! - this.y;
          const dx2 = this.targetX! - this.x;
          if (Math.abs(dy) > 2 || Math.abs(dx2) > 2) {
            const dist = Math.sqrt(dx2 * dx2 + dy * dy);
            this.vx = (dx2 / dist) * 0.2;
            this.vy = (dy / dist) * 0.2;
            this.facingRight = this.vx > 0;
          } else {
            this.vx = 0;
            this.vy = 0;
            if (Math.random() < 0.01) {
              this.state = 'walking'; // Stay on rock but in walking state
            } else if (Math.random() < 0.01) {
              this.state = 'swimming';
              this.targetRock = null;
              this.surfacePoint = null;
            }
          }
        }
      } else if (this.targetWood) {
        // Wood climbing logic
        this.z += this.vz;
        this.vz *= 0.9;
        
        const dx = this.targetWood.x - this.x;
        if (Math.abs(dx) > 5 && !this.surfacePoint) {
          this.vx = Math.sign(dx) * 0.15;
          this.vy = 0;
          this.facingRight = this.vx > 0;
        } else {
          this.vx = 0;
          if (!this.surfacePoint) {
            // Pick a point on the wood
            this.surfacePoint = {
              x: (Math.random() - 0.5) * this.targetWood.width * 0.8,
              y: (Math.random() - 0.5) * this.targetWood.height * 0.4
            };
            this.targetY = this.targetWood.y + this.surfacePoint.y;
            this.targetX = this.targetWood.x + this.surfacePoint.x;
          }
          
          const dy = this.targetY! - this.y;
          const dx2 = this.targetX! - this.x;
          if (Math.abs(dy) > 2 || Math.abs(dx2) > 2) {
            const dist = Math.sqrt(dx2 * dx2 + dy * dy);
            this.vx = (dx2 / dist) * 0.2;
            this.vy = (dy / dist) * 0.2;
            this.facingRight = this.vx > 0;
          } else {
            this.vx = 0;
            this.vy = 0;
            if (Math.random() < 0.01) {
              this.state = 'walking';
            } else if (Math.random() < 0.01) {
              this.state = 'swimming';
              this.targetWood = null;
              this.surfacePoint = null;
            }
          }
        }
      } else {
        this.state = 'swimming';
        this.targetX = this.x;
        this.targetY = floorY;
      }
    }

    this.x += this.vx;
    this.y += this.vy;
    
    // Keep in bounds
    this.x = Math.max(10, Math.min(this.width - 10, this.x));
    this.y = Math.min(floorY, this.y);
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    
    // Parallax scale based on z-depth (0.6x at back, 1.2x at front)
    const depthScale = 0.6 + (this.z / 100) * 0.6;
    ctx.translate(this.x, this.y);
    ctx.scale(depthScale, depthScale);
    
    // If facing right, flip the context because the default drawing faces left
    if (this.facingRight) {
      ctx.scale(-1, 1);
    }
    
    // If swimming or climbing, maybe rotate a bit
    if (this.state === 'swimming') {
      const angle = Math.atan2(this.vy, Math.abs(this.vx || 1)) * 0.5;
      ctx.rotate(this.facingRight ? angle : -angle);
    } else if (this.state === 'climbing' && this.vy !== 0) {
      // Tilt up or down when climbing
      ctx.rotate(this.vy < 0 ? 0.5 : -0.5);
    }

    // Pink shrimp colors - increased opacity
    ctx.strokeStyle = 'rgba(255, 180, 200, 0.9)';
    ctx.fillStyle = 'rgba(255, 200, 220, 0.6)';
    ctx.lineWidth = 2;

    // Body - reduced scale (0.7x)
    ctx.scale(0.7, 0.7);
    ctx.beginPath();
    ctx.moveTo(-12, 0); // Head
    ctx.quadraticCurveTo(-5, -8, 5, -5); // Back
    ctx.quadraticCurveTo(15, -2, 18, 2); // Tail
    ctx.quadraticCurveTo(5, 2, -12, 0); // Belly
    ctx.fill();
    ctx.stroke();

    // Tail fan
    ctx.beginPath();
    ctx.moveTo(18, 2);
    ctx.lineTo(24, -2);
    ctx.lineTo(22, 6);
    ctx.lineTo(18, 2);
    ctx.fill();
    ctx.stroke();

    // Legs
    for (let i = 0; i < 4; i++) {
      const legX = -2 + i * 4;
      const legY = Math.sin(this.legPhase + i) * 3;
      ctx.beginPath();
      ctx.moveTo(legX, 1);
      ctx.lineTo(legX - 2, 6 + legY);
      ctx.lineTo(legX, 10 + legY);
      ctx.stroke();
    }

    // Antennae
    ctx.beginPath();
    ctx.moveTo(-12, -2);
    ctx.quadraticCurveTo(-18, -10, -25, -12 + Math.sin(this.legPhase)*2);
    ctx.moveTo(-12, -1);
    ctx.quadraticCurveTo(-20, -5, -28, -2 + Math.cos(this.legPhase)*2);
    ctx.stroke();

    // Eye
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.beginPath();
    ctx.arc(-9, -3, 1.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

export class SideFilter {
  x: number;
  y: number;
  width: number;
  height: number;
  aquariumWidth: number;
  aquariumHeight: number;

  constructor(aquariumWidth: number, aquariumHeight: number) {
    this.aquariumWidth = aquariumWidth;
    this.aquariumHeight = aquariumHeight;
    this.width = 40;
    this.height = 60;
    this.x = 0; // Attached to left wall
    this.y = 80; // Positioned vertically
  }

  update(simBubbles: Bubble[], time: number, flow: number) {
    // Spawn bubbles from the nozzle shooting across
    if (flow > 0) {
      const spawnChance = (flow / 100) * 0.8;
      if (Math.random() < spawnChance) {
        const bX = this.x + this.width + 15; // End of nozzle
        const bY = this.y + 30 + (Math.random() * 10 - 5); // Center of nozzle
        const bubble = new Bubble(bX, bY, 0.5 + Math.random() * 0.8);
        // Give these bubbles a strong initial horizontal velocity (shooting out)
        bubble.vx = (flow / 100) * 15; 
        simBubbles.push(bubble);
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D, time: number, flow: number) {
    ctx.save();
    
    // Draw the filter unit on the side wall
    const unitGrad = ctx.createLinearGradient(this.x, this.y, this.x + this.width, this.y);
    unitGrad.addColorStop(0, '#111');
    unitGrad.addColorStop(1, '#333');
    ctx.fillStyle = unitGrad;
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 2;
    
    // Main body (box attached to wall)
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(this.x - 5, this.y, this.width + 5, this.height, 5);
    } else {
      ctx.rect(this.x - 5, this.y, this.width + 5, this.height);
    }
    ctx.fill();
    ctx.stroke();

    // Nozzle
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.moveTo(this.x + this.width, this.y + 15);
    ctx.lineTo(this.x + this.width + 15, this.y + 20);
    ctx.lineTo(this.x + this.width + 15, this.y + 40);
    ctx.lineTo(this.x + this.width, this.y + 45);
    ctx.fill();
    ctx.stroke();

    // Horizontal flow effect if flow > 0
    if (flow > 0) {
      const flowFactor = flow / 100;
      const jetLength = 300 * flowFactor; // Longer jet
      
      ctx.save();
      // Draw horizontal "jet" lines
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 5; i++) {
        const lineY = this.y + 18 + i * 6;
        const speed = 200 * flowFactor;
        const offset = (time * speed + i * 40) % (jetLength + 100);
        
        const grad = ctx.createLinearGradient(this.x + this.width + 15, lineY, this.x + this.width + 15 + jetLength, lineY);
        grad.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
        grad.addColorStop(0.5, 'rgba(255, 255, 255, 0.15)');
        grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        
        ctx.strokeStyle = grad;
        ctx.setLineDash([20, 30]);
        ctx.lineDashOffset = -offset;
        
        ctx.beginPath();
        ctx.moveTo(this.x + this.width + 15, lineY);
        ctx.lineTo(this.x + this.width + 15 + jetLength, lineY + Math.sin(time * 3 + i) * 8);
        ctx.stroke();
      }
      
      // Small particles/bubbles in the jet that travel further
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      const particleCount = 15;
      for (let i = 0; i < particleCount; i++) {
        const pSpeed = (150 + (i % 5) * 50) * flowFactor;
        const pOffset = (time * pSpeed + i * 80) % (this.aquariumWidth + 100);
        const pX = this.x + this.width + 15 + pOffset;
        
        // Only draw if within aquarium width
        if (pX < this.aquariumWidth) {
          const pY = this.y + 30 + Math.sin(time * 8 + i) * 15;
          const pSize = 0.5 + (i % 3) * 0.5;
          ctx.beginPath();
          ctx.arc(pX, pY, pSize, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }
    
    ctx.restore();
  }
}

export class Snail {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  falling: boolean;
  hiding: boolean;
  hideTimer: number;
  size: number;
  color: string;
  shellColor: string;
  wobblePhase: number;

  constructor(width: number, height: number) {
    this.x = Math.random() * width;
    this.y = Math.random() * height;
    this.vx = (Math.random() - 0.5) * 0.05;
    this.vy = (Math.random() - 0.5) * 0.05;
    this.angle = Math.atan2(this.vy, this.vx);
    this.falling = false;
    this.hiding = false;
    this.hideTimer = 0;
    this.size = 6 + Math.random() * 3;
    this.color = '#a39171';
    this.shellColor = '#5c4033';
    this.wobblePhase = Math.random() * Math.PI * 2;
  }

  update(width: number, height: number, taps: {x: number, y: number, age: number, maxAge: number}[], cameraX: number) {
    if (this.falling) {
      this.vy += 0.05; // gravity
      this.y += this.vy;
      this.x += this.vx;
      
      if (this.y >= height - 15) {
        this.y = height - 15;
        this.falling = false;
        this.hiding = true; // hide when hitting the ground
        this.hideTimer = 100 + Math.random() * 100;
        this.vx = 0;
        this.vy = 0;
      }
    } else {
      // Check for taps
      for (const tap of taps) {
        if (tap.age <= 2) { // Only react when tap is fresh
          const screenTapX = tap.x - cameraX;
          const dx = this.x - screenTapX;
          const dy = this.y - tap.y;
          const distSq = dx * dx + dy * dy;
          if (distSq < 10000) { // 100px radius
            this.falling = true;
            this.hiding = true; // hide when tapped
            this.vy = 0;
            this.vx = (Math.random() - 0.5) * 1;
            break;
          }
        }
      }

      if (!this.falling) {
        if (this.hiding) {
          this.hideTimer--;
          if (this.hideTimer <= 0) {
            this.hiding = false;
            this.vx = (Math.random() - 0.5) * 0.05;
            this.vy = (Math.random() - 0.5) * 0.05;
          }
        } else {
          // Randomly decide to hide
          if (Math.random() < 0.002) {
            this.hiding = true;
            this.hideTimer = 200 + Math.random() * 300; // Hide for 200-500 frames
            this.vx = 0;
            this.vy = 0;
          } else {
            // Slow wandering
            if (Math.random() < 0.01) {
              this.vx += (Math.random() - 0.5) * 0.02;
              this.vy += (Math.random() - 0.5) * 0.02;
            }

            // Normalize speed
            const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
            if (speed > 0.05) {
              this.vx = (this.vx / speed) * 0.05;
              this.vy = (this.vy / speed) * 0.05;
            }

            this.x += this.vx;
            this.y += this.vy;
            
            if (speed > 0.01) {
              this.angle = Math.atan2(this.vy, this.vx);
            }

            // Keep on glass
            if (this.x < 0) { this.x = 0; this.vx *= -1; }
            if (this.x > width) { this.x = width; this.vx *= -1; }
            if (this.y < 0) { this.y = 0; this.vy *= -1; }
            if (this.y > height) { this.y = height; this.vy *= -1; }
          }
        }
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.translate(this.x, this.y);
    
    if (!this.falling) {
      ctx.rotate(this.angle);
    } else {
      ctx.rotate(this.vy * 0.1); // Spin a bit while falling
    }

    // Draw body
    if (!this.hiding) {
      ctx.fillStyle = this.color;
      ctx.beginPath();
      // Body stretches out when moving
      const stretch = this.falling ? 1 : 1.2 + Math.sin(Date.now() / 500 + this.wobblePhase) * 0.2;
      ctx.ellipse(this.size * 0.2, 0, this.size * stretch * 1.5, this.size * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();

      // Antennae
      if (!this.falling) {
        const headX = this.size * 0.2 + this.size * stretch * 1.5;
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(headX - this.size * 0.3, -this.size * 0.2);
        ctx.lineTo(headX + this.size * 0.4, -this.size * 0.6);
        ctx.moveTo(headX - this.size * 0.3, this.size * 0.2);
        ctx.lineTo(headX + this.size * 0.4, this.size * 0.6);
        ctx.stroke();
      }
    }

    // Draw shell
    ctx.fillStyle = this.shellColor;
    ctx.beginPath();
    ctx.arc(-this.size * 0.2, 0, this.size * 0.8, 0, Math.PI * 2);
    ctx.fill();
    
    // Shell spiral detail
    ctx.strokeStyle = '#3e2723';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(-this.size * 0.2, 0, this.size * 0.5, 0, Math.PI * 1.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(-this.size * 0.2, 0, this.size * 0.2, 0, Math.PI * 1.5);
    ctx.stroke();

    ctx.restore();
  }
}
