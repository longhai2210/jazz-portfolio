'use client';

import { useEffect, useRef } from 'react';

interface AudioVisualizerProps {
  isPlaying: boolean;
}

export default function AudioVisualizer({ isPlaying }: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    const barCount = 16;
    const barWidth = 3;
    const barGap = 2;
    
    // Set fixed visualizer bounds
    const width = (canvas.width = barCount * (barWidth + barGap) - barGap);
    const height = (canvas.height = 32);

    // Initial bar heights
    const heights = Array(barCount).fill(2);
    const targetHeights = Array(barCount).fill(2);

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < barCount; i++) {
        if (isPlaying) {
          // Generate pseudo frequency values using complex sine waves
          const time = Date.now() * 0.004;
          const factor1 = Math.sin(time + i * 0.5) * 12;
          const factor2 = Math.cos(time * 0.7 - i * 0.3) * 8;
          targetHeights[i] = Math.max(2, Math.abs(factor1 + factor2) + 2);
        } else {
          // Return to baseline when paused
          targetHeights[i] = 2;
        }

        // Interpolate current height towards target for smooth motion
        heights[i] += (targetHeights[i] - heights[i]) * 0.25;

        // Draw bar with gold accent gradient
        const barHeight = heights[i];
        const x = i * (barWidth + barGap);
        const y = height - barHeight;

        // Create linear vertical gradient matching the design system
        const gradient = ctx.createLinearGradient(x, y, x, height);
        gradient.addColorStop(0, '#d4a574'); // jazz-gold
        gradient.addColorStop(1, '#c9a96e'); // jazz-brass

        ctx.fillStyle = gradient;
        
        // Draw rounded rectangle for soft aesthetics
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, [1.5, 1.5, 0, 0]);
        ctx.fill();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isPlaying]);

  return (
    <canvas
      ref={canvasRef}
      className="w-[80px] h-[32px] pointer-events-none opacity-80"
      title={isPlaying ? 'Audio playing' : 'Audio paused'}
    />
  );
}
