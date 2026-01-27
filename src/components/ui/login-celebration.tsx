import { useEffect, useState, useCallback } from 'react';

interface LoginCelebrationProps {
  onComplete?: () => void;
  userName?: string;
}

export function LoginCelebration({ onComplete, userName }: LoginCelebrationProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [isFadingOut, setIsFadingOut] = useState(false);

  // Force Seahawks theme on every login
  useEffect(() => {
    const STORAGE_KEY = 'mindforge-color-scheme';
    const validSchemes = ['electric-blue', 'deep-gold', 'power-red', 'seattle-seahawks', 'pink-rose', 'uw-huskies'];
    
    // Update localStorage
    localStorage.setItem(STORAGE_KEY, 'seattle-seahawks');
    
    // Apply theme class immediately
    const root = document.documentElement;
    validSchemes.forEach(scheme => {
      root.classList.remove(`theme-${scheme}`);
    });
    root.classList.add('theme-seattle-seahawks');
  }, []);

  // Check for reduced motion preference
  const prefersReducedMotion = typeof window !== 'undefined' 
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const handleDismiss = useCallback(() => {
    if (isFadingOut) return;
    setIsFadingOut(true);
    setTimeout(() => {
      setIsVisible(false);
      onComplete?.();
    }, 500);
  }, [isFadingOut, onComplete]);

  useEffect(() => {
    // Auto-dismiss after 2.5 seconds
    const timer = setTimeout(() => {
      handleDismiss();
    }, prefersReducedMotion ? 500 : 2500);

    // Allow escape key to dismiss early
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleDismiss();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleDismiss, prefersReducedMotion]);

  if (!isVisible) return null;

  // Generate confetti particles
  const confettiColors = ['#69BE28', '#002244', '#A5ACAF', '#69BE28', '#002244'];
  const confettiParticles = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    color: confettiColors[i % confettiColors.length],
    left: `${Math.random() * 100}%`,
    delay: `${Math.random() * 2}s`,
    duration: `${2 + Math.random() * 2}s`,
    size: `${8 + Math.random() * 8}px`,
  }));

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center cursor-pointer transition-opacity duration-500 ${
        isFadingOut ? 'opacity-0' : 'opacity-100'
      }`}
      onClick={handleDismiss}
      role="dialog"
      aria-label="Login celebration"
    >
      {/* Background overlay with Seahawks gradient */}
      <div 
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(135deg, #002244 0%, #001a33 50%, #002244 100%)',
        }}
      />

      {/* Confetti particles */}
      {!prefersReducedMotion && confettiParticles.map((particle) => (
        <div
          key={particle.id}
          className="absolute top-0 pointer-events-none"
          style={{
            left: particle.left,
            width: particle.size,
            height: particle.size,
            backgroundColor: particle.color,
            borderRadius: particle.id % 2 === 0 ? '50%' : '2px',
            animation: `confetti-fall ${particle.duration} linear ${particle.delay} forwards`,
            willChange: 'transform, opacity',
          }}
        />
      ))}

      {/* Main content */}
      <div className="relative z-10 text-center px-4">
        {/* Emoji decorations */}
        <div className={`text-4xl mb-4 ${!prefersReducedMotion ? 'animate-bounce' : ''}`}>
          🏈 ✨ 🎉 ✨ 🏈
        </div>

        {/* Main text */}
        <h1
          className="text-5xl md:text-7xl font-bold mb-6"
          style={{
            color: '#69BE28',
            textShadow: '0 0 20px rgba(105, 190, 40, 0.8), 0 4px 8px rgba(0, 0, 0, 0.3)',
            animation: prefersReducedMotion ? 'none' : 'bounce-in 0.5s ease-out forwards, seahawks-glow 1.5s ease-in-out infinite 0.5s',
            willChange: 'transform, opacity, text-shadow',
          }}
        >
          GO SEAHAWKS!
        </h1>

        {/* Welcome message */}
        {userName && (
          <p 
            className="text-xl md:text-2xl text-white/90"
            style={{
              animation: prefersReducedMotion ? 'none' : 'fade-in 0.5s ease-out 0.3s forwards',
              opacity: prefersReducedMotion ? 1 : 0,
            }}
          >
            Welcome back, {userName}!
          </p>
        )}

        {/* Bottom emoji decorations */}
        <div className={`text-4xl mt-6 ${!prefersReducedMotion ? 'animate-bounce' : ''}`} style={{ animationDelay: '0.2s' }}>
          🏈 ✨ 🎉 ✨ 🏈
        </div>

        {/* Click to dismiss hint */}
        <p 
          className="text-sm text-white/50 mt-8"
          style={{
            animation: prefersReducedMotion ? 'none' : 'fade-in 0.5s ease-out 1s forwards',
            opacity: prefersReducedMotion ? 1 : 0,
          }}
        >
          Click anywhere or press Escape to continue
        </p>
      </div>
    </div>
  );
}
