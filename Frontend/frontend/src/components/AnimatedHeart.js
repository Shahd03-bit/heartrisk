import React from 'react';
import heartSvg from '../anatomical heart.svg';
import '../styles/AnimatedHeart.css';

export default function AnimatedHeart({ animate }) {
  return (
    <div className={`heart-container ${animate ? 'animate' : ''}`}>
      <img 
        src={heartSvg} 
        alt="Animated Heart" 
        className="heart-image"
      />
      
      {/* Pulsing glow effect */}
      <div className="heart-glow"></div>
    </div>
  );
}
