import { useEffect } from 'react';
import { AutomationProvider, useAutomation, useAutomationDispatch } from './context/AutomationContext';
import { useAutomationEngine } from './hooks/useAutomationEngine';
import { Header } from './components/Header';
import { MainLayout } from './components/MainLayout';
import { MobileMessage } from './components/MobileMessage';

function KeyboardShortcuts() {
  const { execution } = useAutomation();
  const dispatch = useAutomationDispatch();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          if (execution.status === 'running') {
            dispatch({ type: 'PAUSE_EXECUTION' });
          } else if (execution.status === 'paused') {
            dispatch({ type: 'RESUME_EXECUTION' });
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (execution.status === 'paused') {
            dispatch({ type: 'STEP_FORWARD' });
          }
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (execution.status === 'paused') {
            dispatch({ type: 'STEP_BACK' });
          }
          break;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dispatch, execution.status]);

  return null;
}

function AppInner() {
  useAutomationEngine();

  return (
    <>
      <KeyboardShortcuts />
      <MobileMessage />
      <div className="hidden md:flex flex-col h-screen">
        <Header />
        <MainLayout />
      </div>
    </>
  );
}

export default function App() {
  return (
    <AutomationProvider>
      <AppInner />
    </AutomationProvider>
  );
}
