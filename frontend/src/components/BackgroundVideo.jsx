import React from 'react';

const BackgroundVideo = () => {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden bg-slate-950">
      {/* Background Video Player */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover scale-105 filter brightness-90 saturate-125 transition-opacity duration-1000"
      >
        <source src="https://v.ftcdn.net/06/18/74/42/700_F_618744229_oNf4JdFv23vGqO19qA2R0qE8M5tA6XbF_ST.mp4" type="video/mp4" />
        <source src="https://assets.mixkit.co/videos/preview/mixkit-digital-network-nodes-connection-loop-41559-large.mp4" type="video/mp4" />
      </video>

      {/* Vibrant Shifting Ambient Overlay matching Web UI palette */}
      <div className="absolute inset-0 bg-gradient-to-tr from-slate-950/85 via-indigo-950/60 to-slate-900/80 backdrop-blur-[2px]" />
      
      {/* Soft Radial Gradient Highlights */}
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none animate-pulse" style={{ animationDuration: '6s' }} />
      <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-emerald-500/15 rounded-full blur-[120px] pointer-events-none animate-pulse" style={{ animationDuration: '8s' }} />
    </div>
  );
};

export default BackgroundVideo;
