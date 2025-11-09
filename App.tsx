
import React, { useState } from 'react';
import ExerciseTracker from './components/ExerciseTracker';
import Conversation from './components/Conversation';
import { DumbbellIcon, MessageCircleIcon } from './components/Icons';

type View = 'tracker' | 'coach';

// Fix: Add `children` to NavButtonProps to allow nesting content and resolve TypeScript errors.
interface NavButtonProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

const NavButton: React.FC<NavButtonProps> = ({
  active,
  onClick,
  children,
}) => (
  <button
    onClick={onClick}
    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
      active
        ? 'bg-indigo-600 text-white'
        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
    }`}
  >
    {children}
  </button>
);

const App: React.FC = () => {
  const [view, setView] = useState<View>('tracker');

  const renderView = () => {
    switch (view) {
      case 'tracker':
        return <ExerciseTracker />;
      case 'coach':
        return <Conversation />;
      default:
        return <ExerciseTracker />;
    }
  };

  return (
    <div className="h-screen bg-gray-900 text-gray-100 flex flex-col font-sans">
      <header className="bg-gray-800 shadow-lg z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Form<span className="text-indigo-400">AI</span>
            </h1>
          </div>
        </div>
      </header>
      <main className="flex-grow flex flex-col overflow-hidden">
        {renderView()}
      </main>
      <footer className="bg-gray-800 shadow-up-lg z-10">
        <nav className="flex">
          <NavButton active={view === 'tracker'} onClick={() => setView('tracker')}>
            <DumbbellIcon className="w-5 h-5" />
            <span>Form Tracker</span>
          </NavButton>
          <NavButton active={view === 'coach'} onClick={() => setView('coach')}>
            <MessageCircleIcon className="w-5 h-5" />
            <span>AI Coach</span>
          </NavButton>
        </nav>
      </footer>
    </div>
  );
};

export default App;