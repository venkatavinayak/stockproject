import React from 'react';
import { ShoppingBag } from 'lucide-react';

const BackgroundVideo = () => {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden bg-slate-950">
      {/* Background Video */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover opacity-65 filter brightness-95 contrast-105"
      >
        <source src="/login-bg.mp4" type="video/mp4" />
      </video>

      {/* Overlay to ensure crisp contrast for login UI */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950/60 via-indigo-950/40 to-slate-950/70 backdrop-blur-[1px]" />

      {/* ELEGANT WATERMARK BADGE */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none opacity-[0.06] transform -rotate-3 scale-110">
        <div className="relative flex items-center justify-center">
          <div className="w-[440px] h-[440px] rounded-full border-2 border-indigo-400 animate-ping" style={{ animationDuration: '6s' }}></div>
          <div className="absolute w-[350px] h-[350px] rounded-full border-4 border-dashed border-emerald-400 animate-spin" style={{ animationDuration: '35s' }}></div>
          <div className="absolute p-8 bg-indigo-600 rounded-[3.5rem] shadow-xl text-white">
            <ShoppingBag size={120} />
          </div>
        </div>

        <div className="mt-8 text-center">
          <h2 className="text-7xl sm:text-8xl font-black font-title tracking-widest text-white uppercase drop-shadow-sm">
            SmartStore AI
          </h2>
          <p className="text-sm font-extrabold text-indigo-300 tracking-[0.4em] uppercase mt-2 font-title">
            Cloud Multi-Tenant ERP System
          </p>
        </div>
      </div>
    </div>
  );
};

export default BackgroundVideo;

