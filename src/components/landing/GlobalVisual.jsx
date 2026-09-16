import React, { useEffect, useRef } from 'react';
import { useTheme } from '../../context/ThemeContext';

export function GlobalVisual() {
  const canvasRef = useRef(null);
  const { isDark } = useTheme();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;

    // Handle high DPI
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;

    // Generate random communication nodes
    const nodeCount = 18;
    const nodes = [];
    for (let i = 0; i < nodeCount; i++) {
      nodes.push({
        x: Math.random() * (width - 40) + 20,
        y: Math.random() * (height - 40) + 20,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        radius: Math.random() * 2.5 + 2,
        pulse: Math.random() * Math.PI * 2
      });
    }

    let frame = 0;

    const render = () => {
      frame += 0.02;
      ctx.clearRect(0, 0, width, height);

      // Colors based on theme
      const nodeColor = isDark ? '#818cf8' : '#4f46e5';
      const lineColor = isDark ? 'rgba(99, 102, 241, 0.16)' : 'rgba(79, 70, 229, 0.12)';
      const pulseColor = isDark ? 'rgba(129, 140, 248, 0.25)' : 'rgba(79, 70, 229, 0.2)';

      // Update and draw connections
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 130) {
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.strokeStyle = lineColor;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }

      // Draw nodes and pulses
      nodes.forEach((node) => {
        node.x += node.vx;
        node.y += node.vy;

        if (node.x < 15 || node.x > width - 15) node.vx *= -1;
        if (node.y < 15 || node.y > height - 15) node.vy *= -1;

        node.pulse += 0.03;
        const pulseSize = node.radius + Math.sin(node.pulse) * 4;

        // Pulse ring
        if (pulseSize > 0) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, pulseSize + 4, 0, Math.PI * 2);
          ctx.fillStyle = pulseColor;
          ctx.fill();
        }

        // Center dot
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fillStyle = nodeColor;
        ctx.fill();
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isDark]);

  return (
    <div className="hero-visual">
      <canvas ref={canvasRef} className="globe-canvas" />
    </div>
  );
}
