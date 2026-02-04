import { motion } from 'motion/react';
import { useAutomation } from '../../context/AutomationContext';

export function SimulatedCursor() {
  const { execution } = useAutomation();

  if (execution.status === 'idle') return null;

  return (
    <motion.div
      className="absolute z-50 pointer-events-none"
      animate={{
        x: execution.cursorPosition.x,
        y: execution.cursorPosition.y,
      }}
      transition={{
        type: 'spring',
        stiffness: 120,
        damping: 20,
        mass: 0.8,
      }}
      style={{ left: -4, top: -2 }}
    >
      {/* Cursor SVG */}
      <svg width="20" height="24" viewBox="0 0 20 24" fill="none">
        <path
          d="M2 1L18 12.5L10.5 13.5L14 22L10.5 23.5L7 15L2 19V1Z"
          fill="white"
          stroke="#1a1a1a"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    </motion.div>
  );
}
