import React from 'react';

const BackgroundVideo = () => {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      {/* Background Video - Crystal Clear playback without black overlays or blur */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
      >
        <source src="/login-bg.mp4" type="video/mp4" />
      </video>
    </div>
  );
};

export default BackgroundVideo;


