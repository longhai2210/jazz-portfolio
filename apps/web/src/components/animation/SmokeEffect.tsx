'use client';

import { useEffect, useRef } from 'react';
import { useThemeStore } from '@/stores/themeStore';

export default function SmokeEffect() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { theme } = useThemeStore();
  const themeRef = useRef(theme);

  useEffect(() => {
    themeRef.current = theme;
  }, [theme]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // Particle class for smoke puffs
    class Particle {
      x: number;
      y: number;
      size: number;
      speedX: number;
      speedY: number;
      alpha: number;
      decay: number;
      colorType: number;

      constructor() {
        this.x = Math.random() * width;
        this.y = height + Math.random() * 50; // Start off-screen bottom
        this.size = 80 + Math.random() * 120; // large soft puffs
        this.speedX = Math.random() * 0.4 - 0.2; // slow sideways drift
        this.speedY = -(0.3 + Math.random() * 0.5); // slow rising
        this.alpha = 0.01 + Math.random() * 0.05; // very faint
        this.decay = 0.0001 + Math.random() * 0.0002;
        this.colorType = Math.random() > 0.5 ? 1 : 2;
      }

      update() {
        this.x += this.speedX;
        this.y += this.speedY;
        this.alpha -= this.decay;
        this.size += 0.05; // expand puff size slightly as it rises
        
        // Wrap horizontally
        if (this.x < -this.size) this.x = width + this.size;
        if (this.x > width + this.size) this.x = -this.size;
      }

      draw(context: CanvasRenderingContext2D) {
        context.save();
        context.beginPath();

        const currentTheme = themeRef.current;
        let colorStr = '';
        if (currentTheme === 'light-jazz') {
          // Warm golden-sepia dust motes
          colorStr = this.colorType === 1 ? '160, 143, 124' : '184, 168, 152';
        } else {
          // Dark blue/grey smoke
          colorStr = this.colorType === 1 ? '26, 26, 64' : '30, 30, 45';
        }
        
        // Create radial gradient for a soft smoke cloud appearance
        const grad = context.createRadialGradient(
          this.x, this.y, 0,
          this.x, this.y, this.size
        );
        grad.addColorStop(0, `rgba(${colorStr}, ${this.alpha})`);
        grad.addColorStop(0.5, `rgba(${colorStr}, ${this.alpha * 0.5})`);
        grad.addColorStop(1, 'rgba(0,0,0,0)');

        context.fillStyle = grad;
        context.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        context.fill();
        context.restore();
      }
    }

    const particles: Particle[] = Array.from({ length: 18 }).map(() => new Particle());

    // Animation Loop
    const animate = () => {
      // Clear with clearRect to keep it transparent, allowing background to show through
      ctx.clearRect(0, 0, width, height);

      particles.forEach((p) => {
        p.update();
        p.draw(ctx);

        // Reset particle if it is fully faded or rises too far
        if (p.alpha <= 0 || p.y < -p.size) {
          Object.assign(p, new Particle());
          p.y = height + 10; // reset to bottom
        }
      });

      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    // Resize Handler
    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const isDark = theme === 'dark';

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-none z-0 animate-fade-in duration-700"
      style={{ mixBlendMode: isDark ? 'screen' : 'multiply' }}
    />
  );
}
