'use client';

import { useEffect, useState, useRef, useMemo, memo } from 'react';
import { useBackground } from '@/contexts/BackgroundContext';

interface NetworkNode {
  id: number;
  x: number;
  y: number;
  size: number;
  connections: number[];
  pulseDelay: number;
}

interface DataPacket {
  id: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  progress: number;
  delay: number;
  duration: number;
}

const MAX_PACKETS = 3;
const MAX_NODES = 8;

function AINetworkBackgroundComponent() {
  const [nodes, setNodes] = useState<NetworkNode[]>([]);
  const [packets, setPackets] = useState<DataPacket[]>([]);
  const { intensity, isReducedMotion } = useBackground();
  const nodeIdRef = useRef(0);
  const packetIdRef = useRef(0);
  const dimensionsRef = useRef({ width: 1920, height: 1080 });

  // Cache dimensions once
  useEffect(() => {
    if (typeof window !== 'undefined') {
      dimensionsRef.current = { width: window.innerWidth, height: window.innerHeight };
    }
  }, []);

  const intensityMultiplier = useMemo(() => {
    switch (intensity) {
      case 'low': return 0.5;
      case 'medium': return 0.8;
      case 'high': return 1.2;
      default: return 0.8;
    }
  }, [intensity]);

  // Initialize neural network nodes - only once
  useEffect(() => {
    if (isReducedMotion) return;

    const { width, height } = dimensionsRef.current;
    const nodeCount = Math.min(Math.floor(MAX_NODES * intensityMultiplier), MAX_NODES);
    const newNodes: NetworkNode[] = [];

    for (let i = 0; i < nodeCount; i++) {
      newNodes.push({
        id: nodeIdRef.current++,
        x: (Math.random() * 0.8 + 0.1) * width,
        y: (Math.random() * 0.8 + 0.1) * height,
        size: 3 + Math.random() * 4,
        connections: [],
        pulseDelay: Math.random() * 3000,
      });
    }

    // Create connections between nearby nodes
    newNodes.forEach(node => {
      const nearbyNodes = newNodes
        .filter(other => {
          if (other.id === node.id) return false;
          const distance = Math.sqrt(
            Math.pow(other.x - node.x, 2) + Math.pow(other.y - node.y, 2)
          );
          return distance < 200 && Math.random() > 0.6;
        })
        .slice(0, 2); // Max 2 connections per node (reduced)

      node.connections = nearbyNodes.map(n => n.id);
    });

    setNodes(newNodes);
  }, [intensityMultiplier, isReducedMotion]);

  // Generate data packets - slower interval
  useEffect(() => {
    if (isReducedMotion || nodes.length === 0) return;

    // Much slower interval for better performance
    const intervalTime = Math.max(3000, 4000 / intensityMultiplier);

    const interval = setInterval(() => {
      const sourceNode = nodes[Math.floor(Math.random() * nodes.length)];
      if (sourceNode.connections.length === 0) return;

      const targetNodeId = sourceNode.connections[Math.floor(Math.random() * sourceNode.connections.length)];
      const targetNode = nodes.find(n => n.id === targetNodeId);
      if (!targetNode) return;

      const id = packetIdRef.current++;
      const newPacket: DataPacket = {
        id,
        startX: sourceNode.x,
        startY: sourceNode.y,
        endX: targetNode.x,
        endY: targetNode.y,
        progress: 0,
        delay: Math.random() * 500,
        duration: 2000 + Math.random() * 2000,
      };

      setPackets(prev => [...prev.slice(-MAX_PACKETS + 1), newPacket]);

      setTimeout(() => {
        setPackets(prev => prev.filter(p => p.id !== id));
      }, newPacket.duration + newPacket.delay);
    }, intervalTime);

    return () => clearInterval(interval);
  }, [nodes, intensityMultiplier, isReducedMotion]);

  if (isReducedMotion) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-0" aria-hidden="true" style={{ contain: 'strict' }}>
      {/* Neural network grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.003] dark:opacity-[0.005]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none'%3E%3Cpath d='M25 25h50v50H25z' stroke='%2310b981' stroke-width='0.3' opacity='0.2'/%3E%3Ccircle cx='25' cy='25' r='1' fill='%2310b981' opacity='0.3'/%3E%3Ccircle cx='75' cy='25' r='1' fill='%2310b981' opacity='0.3'/%3E%3Ccircle cx='25' cy='75' r='1' fill='%2310b981' opacity='0.3'/%3E%3Ccircle cx='75' cy='75' r='1' fill='%2310b981' opacity='0.3'/%3E%3C/g%3E%3C/svg%3E")`,
          animation: 'neuralPulse 8s ease-in-out infinite',
        }}
      />

      {/* Network connections (SVG) */}
      <svg className="absolute inset-0 w-full h-full">
        <defs>
          <linearGradient id="connectionGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.02"/>
            <stop offset="50%" stopColor="#10b981" stopOpacity="0.05"/>
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.02"/>
          </linearGradient>
        </defs>

        {nodes.map(node =>
          node.connections.map(connectionId => {
            const targetNode = nodes.find(n => n.id === connectionId);
            if (!targetNode) return null;

            return (
              <line
                key={`${node.id}-${connectionId}`}
                x1={node.x}
                y1={node.y}
                x2={targetNode.x}
                y2={targetNode.y}
                stroke="url(#connectionGradient)"
                strokeWidth="1"
                className="animate-pulse-subtle"
                style={{ animationDelay: `${node.pulseDelay}ms` }}
              />
            );
          })
        )}
      </svg>

      {/* Neural network nodes */}
      {nodes.map(node => (
        <div
          key={node.id}
          className="absolute rounded-full bg-emerald-500 dark:bg-emerald-400"
          style={{
            left: `${node.x}px`,
            top: `${node.y}px`,
            width: `${node.size}px`,
            height: `${node.size}px`,
            transform: 'translate(-50%, -50%)',
            opacity: 0.04,
            animation: `nodePulse 3000ms ease-in-out infinite`,
            animationDelay: `${node.pulseDelay}ms`,
            boxShadow: `0 0 ${node.size * 2}px rgba(16, 185, 129, 0.3)`,
          }}
        />
      ))}

      {/* Data packets */}
      {packets.map(packet => {
        const x = packet.startX + (packet.endX - packet.startX) * (packet.progress / 100);
        const y = packet.startY + (packet.endY - packet.startY) * (packet.progress / 100);

        return (
          <div
            key={packet.id}
            className="absolute w-2 h-2 rounded-full bg-emerald-400"
            style={{
              left: `${x}px`,
              top: `${y}px`,
              transform: 'translate(-50%, -50%)',
              opacity: 0.06,
              animation: `dataPacket ${packet.duration}ms linear ${packet.delay}ms forwards`,
              boxShadow: '0 0 8px rgba(34, 197, 94, 0.5)',
              willChange: 'transform, opacity',
            }}
          />
        );
      })}

      {/* Circuit board pattern */}
      <div
        className="absolute inset-0 opacity-[0.002] dark:opacity-[0.004]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='200' height='200' viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none'%3E%3Cpath d='M50 50h100M50 100h100M50 150h100M50 50v100M100 50v100M150 50v100' stroke='%2310b981' stroke-width='0.3' opacity='0.1'/%3E%3Crect x='45' y='45' width='10' height='10' rx='2' fill='%2310b981' opacity='0.2'/%3E%3Crect x='95' y='95' width='10' height='10' rx='2' fill='%2310b981' opacity='0.2'/%3E%3Crect x='145' y='145' width='10' height='10' rx='2' fill='%2310b981' opacity='0.2'/%3E%3C/g%3E%3C/svg%3E")`,
          animation: 'circuitFlow 12s linear infinite',
        }}
      />

      {/* AI processing indicators - reduced count */}
      <div className="absolute inset-0">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="absolute"
            style={{
              left: `${15 + i * 20}%`,
              top: `${20 + (i % 2) * 60}%`,
              width: '1px',
              height: '40px',
              backgroundColor: '#10b981',
              opacity: 0.02,
              animation: `processingBar ${1500 + i * 300}ms ease-in-out infinite`,
              animationDelay: `${i * 200}ms`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

export const AINetworkBackground = memo(AINetworkBackgroundComponent);