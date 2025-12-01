import React, { useEffect, useRef } from 'react';

// --- Types ---

interface Vector {
  x: number;
  y: number;
}

interface Ball {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  mass: number;
}

// --- Constants ---

const NUM_BALLS = 20;
const GRAVITY = 0.15;
const FRICTION = 0.99; // Air resistance
const WALL_BOUNCE = 0.7; // Energy kept after hitting wall
const ROTATION_SPEED = 0.01;
const HEPTAGON_SIDES = 7;
const SUB_STEPS = 8; // Physics sub-steps for stability

// --- Helper Functions ---

const randomColor = (index: number, total: number) => {
  const hue = (index * 360) / total;
  return `hsl(${hue}, 70%, 60%)`;
};

const dot = (v1: Vector, v2: Vector) => v1.x * v2.x + v1.y * v2.y;
const sub = (v1: Vector, v2: Vector) => ({ x: v1.x - v2.x, y: v1.y - v2.y });
const add = (v1: Vector, v2: Vector) => ({ x: v1.x + v2.x, y: v1.y + v2.y });
const mult = (v: Vector, s: number) => ({ x: v.x * s, y: v.y * s });
const length = (v: Vector) => Math.sqrt(v.x * v.x + v.y * v.y);
const normalize = (v: Vector) => {
  const len = length(v);
  return len === 0 ? { x: 0, y: 0 } : { x: v.x / len, y: v.y / len };
};

const HeptagonSimulation: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // --- Initialization ---

    let width = window.innerWidth;
    let height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;

    const centerX = width / 2;
    const centerY = height / 2;
    const heptagonRadius = Math.min(width, height) * 0.4;
    
    let rotationAngle = 0;

    // Initialize Balls
    const balls: Ball[] = Array.from({ length: NUM_BALLS }).map((_, i) => ({
      id: i + 1,
      x: centerX + (Math.random() - 0.5) * 100,
      y: centerY + (Math.random() - 0.5) * 100,
      vx: (Math.random() - 0.5) * 15,
      vy: (Math.random() - 0.5) * 15,
      radius: 12 + Math.random() * 8, // Random size between 12 and 20
      color: randomColor(i, NUM_BALLS),
      mass: 1, // Simplified mass
    }));

    // --- Physics Engine ---

    const updatePhysics = () => {
      // Rotate Heptagon
      rotationAngle += ROTATION_SPEED;

      // Calculate Heptagon Vertices
      const vertices: Vector[] = [];
      for (let i = 0; i < HEPTAGON_SIDES; i++) {
        const theta = rotationAngle + (i * 2 * Math.PI) / HEPTAGON_SIDES;
        vertices.push({
          x: centerX + heptagonRadius * Math.cos(theta),
          y: centerY + heptagonRadius * Math.sin(theta),
        });
      }

      // Sub-stepping for stability
      const dt = 1 / SUB_STEPS;
      
      for (let step = 0; step < SUB_STEPS; step++) {
        balls.forEach((ball) => {
          // Apply Forces
          ball.vy += GRAVITY * dt;
          ball.vx *= FRICTION; // Simple damping
          ball.vy *= FRICTION;

          // Move Ball
          ball.x += ball.vx * dt;
          ball.y += ball.vy * dt;

          // --- Wall Collision Detection ---
          let collided = false;

          for (let i = 0; i < HEPTAGON_SIDES; i++) {
            const p1 = vertices[i];
            const p2 = vertices[(i + 1) % HEPTAGON_SIDES];

            // Vector representing the wall
            const wallVec = sub(p2, p1);
            const wallLen = length(wallVec);
            const wallUnit = normalize(wallVec);
            
            // Wall Normal (pointing inward)
            // For a convex polygon defined CCW, normal is (-y, x)
            // However, we need to ensure it points towards the center.
            // Heptagon center is (centerX, centerY). 
            // Midpoint of wall:
            const mid = mult(add(p1, p2), 0.5);
            const toCenter = sub({ x: centerX, y: centerY }, mid);
            
            // Standard normal vector candidates
            let normal = { x: -wallUnit.y, y: wallUnit.x };
            
            // Ensure normal points INWARD (same direction as toCenter)
            if (dot(normal, toCenter) < 0) {
              normal = { x: -normal.x, y: -normal.y };
            }

            // Vector from p1 to ball
            const toBall = sub({ x: ball.x, y: ball.y }, p1);
            
            // Distance from infinite line of the wall
            const dist = dot(toBall, normal);

            // Check if ball is "behind" the wall (outside the heptagon)
            // Since normal points inward, negative distance means outside.
            // However, we strictly want to keep it INSIDE.
            // Actually, for a container, 'inside' means positive distance from all walls?
            // Let's rely on the fact that if dist < radius, we are colliding.
            // But we must check if we are within the segment bounds effectively.
            
            // Project ball onto wall line to check segment bounds
            const projection = dot(toBall, wallUnit);
            
            // We treat the wall as an infinite plane for the bounce calculation first,
            // but effectively we only care if the ball is 'close' to this specific segment.
            // Since it's a closed convex loop, simply checking all planes works.
            // If distance < radius, push it out.
            
            if (dist < ball.radius) {
              collided = true;
              
              // 1. Position Correction (Push out)
              const overlap = ball.radius - dist;
              ball.x += normal.x * overlap;
              ball.y += normal.y * overlap;

              // 2. Velocity Reflection
              // We need relative velocity because the wall is moving (rotating)
              // Velocity of wall at contact point.
              // Contact point roughly at ball center - radius * normal
              const rVector = sub({x: ball.x, y: ball.y}, {x: centerX, y: centerY});
              // Angular velocity vector is effectively z-axis. V = omega x r
              // 2D cross product equivalent: (-omega * ry, omega * rx)
              const wallVel = {
                x: -ROTATION_SPEED * SUB_STEPS * (ball.y - centerY), // Scale rotation speed back to per-frame for velocity calc?
                // Wait, ROTATION_SPEED is per frame. So velocity is correct without dt scaling if we treat 1 frame = 1 time unit for velocity.
                // But we are in sub-steps. Let's approximate wall velocity.
                // Rotational velocity v = r * omega. 
                // Direction is tangent.
                y: ROTATION_SPEED * SUB_STEPS * (ball.x - centerX)
                // Note: The physics units are arbitrary here. 
                // To impart energy, we add a fraction of wall velocity.
              };
              
              // To make it simpler and more robust:
              // Standard reflection: V_new = V_old - 2(V_old . N) * N
              // With moving wall: V_rel = V_ball - V_wall
              // V_rel_new = V_rel - (1 + e) * (V_rel . N) * N
              // V_ball_new = V_rel_new + V_wall

              // Approx Wall Velocity at impact point
              // V_wall_tangent magnitude = radius_from_center * ROTATION_SPEED * (1/dt)? 
              // Since ROTATION_SPEED is angle per FRAME, and we are updating positions,
              // let's just use a "kick" factor based on rotation direction.
              
              // Tangent vector (rotation direction)
              const tangent = { x: -normal.y, y: normal.x };
              // Cross product of R and Tangent tells us if it spins CW or CCW relative to wall...
              // Simpler: Wall velocity at point P is perpendicular to radius from center.
              const distFromCenter = length(rVector);
              const wallSpeed = distFromCenter * ROTATION_SPEED * 60; // Approximate pixel/sec or just scale it up to feel right
              
              // Calculate actual wall velocity vector at this position
              const wallV = {
                 x: -Math.sin(Math.atan2(ball.y - centerY, ball.x - centerX)) * wallSpeed * 0.2, // Scaling factor for energy transfer
                 y: Math.cos(Math.atan2(ball.y - centerY, ball.x - centerX)) * wallSpeed * 0.2
              };

              const vRel = sub({x: ball.vx, y: ball.vy}, wallV);
              const vRelDotN = dot(vRel, normal);

              if (vRelDotN < 0) { // Only reflect if moving towards wall
                 const j = -(1 + WALL_BOUNCE) * vRelDotN;
                 const impulse = mult(normal, j);
                 
                 ball.vx = (vRel.x + impulse.x) + wallV.x;
                 ball.vy = (vRel.y + impulse.y) + wallV.y;
              }
            }
          }

          // --- Ball to Ball Collision ---
          // Simple O(N^2) check - acceptable for 20 balls
          for (let j = 0; j < balls.length; j++) {
            if (ball.id === balls[j].id) continue;
            const other = balls[j];
            
            const distVec = sub(other, ball);
            const d = length(distVec);
            const minDist = ball.radius + other.radius;

            if (d < minDist) {
              const overlap = minDist - d;
              const n = normalize(distVec);

              // Separate balls to prevent sticking
              const correction = mult(n, overlap * 0.5);
              ball.x -= correction.x;
              ball.y -= correction.y;
              other.x += correction.x;
              other.y += correction.y;

              // Exchange velocity (elastic collision)
              // For equal mass: swap velocity components along normal
              const vRel = sub({x: ball.vx, y: ball.vy}, {x: other.vx, y: other.vy});
              const vn = dot(vRel, n);

              if (vn > 0) {
                // Moving away, no collision resolution needed for velocity
                continue;
              }

              // Impulse scalar
              // j = -(1 + e) * v_rel_norm / (1/m1 + 1/m2)
              // m1 = m2 = 1 => div by 2
              const restitution = 0.8;
              const impulseScalar = (-(1 + restitution) * vn) / 2;
              
              const impulse = mult(n, impulseScalar);
              
              ball.vx += impulse.x;
              ball.vy += impulse.y;
              other.vx -= impulse.x;
              other.vy -= impulse.y;
            }
          }
        });
      }
    };

    const draw = () => {
      // Clear screen
      ctx.fillStyle = '#111827'; // Tailwind gray-900
      ctx.fillRect(0, 0, width, height);

      // Draw Heptagon
      ctx.beginPath();
      const vertices: Vector[] = [];
      for (let i = 0; i < HEPTAGON_SIDES; i++) {
        const theta = rotationAngle + (i * 2 * Math.PI) / HEPTAGON_SIDES;
        const x = centerX + heptagonRadius * Math.cos(theta);
        const y = centerY + heptagonRadius * Math.sin(theta);
        vertices.push({ x, y });
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      
      // Glow effect for the container
      ctx.strokeStyle = '#60A5FA'; // Tailwind blue-400
      ctx.lineWidth = 5;
      ctx.shadowBlur = 15;
      ctx.shadowColor = '#3B82F6'; // Tailwind blue-500
      ctx.stroke();
      
      // Reset shadow for balls
      ctx.shadowBlur = 0;

      // Draw Balls
      balls.forEach((ball) => {
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
        ctx.fillStyle = ball.color;
        ctx.fill();
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw Number
        ctx.fillStyle = 'white';
        ctx.font = `bold ${Math.floor(ball.radius)}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(ball.id.toString(), ball.x, ball.y);
      });
    };

    // --- Animation Loop ---

    let animationFrameId: number;

    const loop = () => {
      updatePhysics();
      draw();
      animationFrameId = requestAnimationFrame(loop);
    };

    loop();

    // --- Cleanup ---

    const handleResize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
      // Ideally re-center balls, but for now just let them be
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return <canvas ref={canvasRef} className="block" />;
};

export default HeptagonSimulation;