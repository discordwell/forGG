import { motion, AnimatePresence } from 'motion/react';
import { useAutomation } from '../../context/AutomationContext';

export function HighlightOverlay() {
  const { execution } = useAutomation();

  return (
    <>
      {/* Element highlight */}
      <AnimatePresence>
        {execution.activeHighlight && (
          <motion.div
            className="absolute z-30 border-2 border-forge-400 rounded-md pointer-events-none"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            style={{
              left: execution.activeHighlight.x,
              top: execution.activeHighlight.y,
              width: execution.activeHighlight.w,
              height: execution.activeHighlight.h,
            }}
          >
            <div className="absolute inset-0 bg-forge-400/10 rounded-md" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Click ripple */}
      <AnimatePresence>
        {execution.showRipple && (
          <motion.div
            className="absolute z-40 pointer-events-none"
            style={{
              left: execution.showRipple.x - 15,
              top: execution.showRipple.y - 15,
            }}
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="w-[30px] h-[30px] rounded-full border-2 border-forge-500 animate-ripple" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Screenshot flash */}
      <AnimatePresence>
        {execution.showFlash && (
          <motion.div
            className="absolute inset-0 z-40 bg-white pointer-events-none animate-flash"
            initial={{ opacity: 0.8 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          />
        )}
      </AnimatePresence>

      {/* Data extraction scanline */}
      <AnimatePresence>
        {execution.showScanline && (
          <motion.div
            className="absolute inset-x-0 z-40 pointer-events-none h-full overflow-hidden"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="w-full h-1 bg-gradient-to-r from-transparent via-green-400 to-transparent animate-scanline shadow-[0_0_15px_rgba(64,192,87,0.5)]" />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
