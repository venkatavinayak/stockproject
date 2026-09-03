import React, { useEffect, useRef } from 'react';
import { ShoppingBag } from 'lucide-react';

const BackgroundVideo = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // Floating motion particles matching app palette (Indigo, Emerald, Purple, Blue)
    const particles = Array.from({ length: 40 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.8,
      vy: (Math.random() - 0.5) * 0.8,
      radius: Math.random() * 3 + 1.5,
      color: ['#6366f1', '#8b5cf6', '#10b981', '#0284c7', '#ec4899'][Math.floor(Math.random() * 5)],
      alpha: Math.random() * 0.4 + 0.2
    }));

    let step = 0;

    const render = () => {
      step += 0.012;
      ctx.clearRect(0, 0, width, height);

      // 1. Soft Shifting Light Mesh Gradient (Matches Web App Palette)
      const g1X = width * 0.3 + Math.sin(step) * (width * 0.2);
      const g1Y = height * 0.3 + Math.cos(step * 0.8) * (height * 0.2);
      const grad1 = ctx.createRadialGradient(g1X, g1Y, 40, g1X, g1Y, Math.max(width, height) * 0.65);
      grad1.addColorStop(0, 'rgba(99, 102, 241, 0.12)'); // Iris Indigo
      grad1.addColorStop(0.6, 'rgba(139, 92, 246, 0.06)'); // Soft Purple
      grad1.addColorStop(1, 'rgba(248, 250, 252, 0)');

      const g2X = width * 0.7 + Math.cos(step * 0.9) * (width * 0.2);
      const g2Y = height * 0.7 + Math.sin(step * 1.1) * (height * 0.2);
      const grad2 = ctx.createRadialGradient(g2X, g2Y, 40, g2X, g2Y, Math.max(width, height) * 0.6);
      grad2.addColorStop(0, 'rgba(16, 185, 129, 0.12)'); // Emerald Green
      grad2.addColorStop(0.6, 'rgba(2, 132, 199, 0.06)'); // Sky Blue
      grad2.addColorStop(1, 'rgba(248, 250, 252, 0)');

      ctx.fillStyle = grad1;
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = grad2;
      ctx.fillRect(0, 0, width, height);

      // 2. Motion Graphics Network Node Connections
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.fill();

        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dist = Math.hypot(p.x - p2.x, p.y - p2.y);
          if (dist < 130) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = p.color;
            ctx.globalAlpha = (1 - dist / 130) * 0.18;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }

      ctx.globalAlpha = 1;
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden bg-gradient-to-br from-slate-50 via-indigo-50/30 to-slate-100">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      
      {/* ELEGANT LIGHT MOTION GRAPHICS INTRO WATERMARK */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none opacity-[0.05] transform -rotate-3 scale-110">
        <div className="relative flex items-center justify-center">
          <div className="w-[440px] h-[440px] rounded-full border-2 border-indigo-500 animate-ping" style={{ animationDuration: '5s' }}></div>
          <div className="absolute w-[350px] h-[350px] rounded-full border-4 border-dashed border-emerald-500 animate-spin" style={{ animationDuration: '30s' }}></div>
          <div className="absolute p-8 bg-indigo-600 rounded-[3.5rem] shadow-xl text-white animate-pulse" style={{ animationDuration: '3s' }}>
            <ShoppingBag size={120} />
          </div>
        </div>

        <div className="mt-8 text-center">
          <h2 className="text-7xl sm:text-8xl font-black font-title tracking-widest text-indigo-950 uppercase drop-shadow-sm">
            SmartStore AI
          </h2>
          <p className="text-sm font-extrabold text-indigo-800 tracking-[0.4em] uppercase mt-2">
            Cloud Multi-Tenant ERP System
          </p>
        </div>
      </div>
    </div>
  );
};

export default BackgroundVideo;
