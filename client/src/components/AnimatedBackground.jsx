import { useEffect, useRef } from 'react';

export default function AnimatedBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let animationFrameId;
    let particles = [];
    let connections = [];

    // Set canvas size
    const resizeCanvas = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      initParticles();
    };

    // Initialize particles (representing health data points)
    const initParticles = () => {
      particles = [];
      const numParticles = 80; // Increased number
      
      for (let i = 0; i < numParticles; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.5,
          vy: (Math.random() - 0.5) * 0.5,
          radius: Math.random() * 3 + 2, // Larger particles
          opacity: Math.random() * 0.4 + 0.6, // Higher opacity
          pulsePhase: Math.random() * Math.PI * 2,
          pulseSpeed: 0.02 + Math.random() * 0.02,
        });
      }
    };

    // Animation loop
    const animate = (time) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Update and draw particles
      particles.forEach((particle, i) => {
        // Update position
        particle.x += particle.vx;
        particle.y += particle.vy;

        // Bounce off edges
        if (particle.x < 0 || particle.x > canvas.width) particle.vx *= -1;
        if (particle.y < 0 || particle.y > canvas.height) particle.vy *= -1;

        // Update pulse
        particle.pulsePhase += particle.pulseSpeed;
        const pulse = Math.sin(particle.pulsePhase) * 0.5 + 0.5;

        // Draw particle with pulse effect
        const gradient = ctx.createRadialGradient(
          particle.x, particle.y, 0,
          particle.x, particle.y, particle.radius * (1 + pulse)
        );
        gradient.addColorStop(0, `rgba(59, 130, 246, ${particle.opacity * (0.8 + pulse * 0.2)})`);
        gradient.addColorStop(1, `rgba(59, 130, 246, 0)`);

        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.radius * (1 + pulse * 0.5), 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        // Draw connections between nearby particles (neural network effect)
        for (let j = i + 1; j < particles.length; j++) {
          const other = particles[j];
          const dx = particle.x - other.x;
          const dy = particle.y - other.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < 150) {
            const opacity = (1 - distance / 150) * 0.4; // Increased opacity
            ctx.beginPath();
            ctx.moveTo(particle.x, particle.y);
            ctx.lineTo(other.x, other.y);
            ctx.strokeStyle = `rgba(59, 130, 246, ${opacity})`;
            ctx.lineWidth = 1.5; // Thicker lines
            ctx.stroke();
          }
        }
      });

      // Draw DNA helix pattern
      const helixY = canvas.height * 0.3;
      const helixAmplitude = 60; // Larger amplitude
      const helixFrequency = 0.01;
      const helixSpeed = time * 0.0001;

      // First strand with glow
      ctx.shadowBlur = 10;
      ctx.shadowColor = 'rgba(59, 130, 246, 0.5)';
      ctx.beginPath();
      for (let x = 0; x < canvas.width; x += 3) {
        const y1 = helixY + Math.sin(x * helixFrequency + helixSpeed) * helixAmplitude;
        
        if (x === 0) {
          ctx.moveTo(x, y1);
        } else {
          ctx.lineTo(x, y1);
        }
      }
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.4)'; // More visible
      ctx.lineWidth = 3; // Thicker
      ctx.stroke();

      // Second strand with glow
      ctx.shadowColor = 'rgba(16, 185, 129, 0.5)';
      ctx.beginPath();
      for (let x = 0; x < canvas.width; x += 3) {
        const y2 = helixY - Math.sin(x * helixFrequency + helixSpeed) * helixAmplitude;
        
        if (x === 0) {
          ctx.moveTo(x, y2);
        } else {
          ctx.lineTo(x, y2);
        }
      }
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.4)'; // More visible
      ctx.lineWidth = 3; // Thicker
      ctx.stroke();

      // Reset shadow
      ctx.shadowBlur = 0;

      // Draw connecting lines between helixes
      for (let x = 0; x < canvas.width; x += 25) {
        const y1 = helixY + Math.sin(x * helixFrequency + helixSpeed) * helixAmplitude;
        const y2 = helixY - Math.sin(x * helixFrequency + helixSpeed) * helixAmplitude;
        
        ctx.beginPath();
        ctx.moveTo(x, y1);
        ctx.lineTo(x, y2);
        ctx.strokeStyle = 'rgba(59, 130, 246, 0.2)'; // More visible
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    animate(0);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ opacity: 0.85 }}
    />
  );
}
