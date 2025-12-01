import React from 'react';
import HeptagonSimulation from './components/HeptagonSimulation';

const App: React.FC = () => {
  return (
    <div className="relative w-full h-screen bg-gray-900 flex flex-col items-center justify-center overflow-hidden">
      <div className="absolute top-4 left-4 z-10 text-white/80 pointer-events-none">
        <h1 className="text-2xl font-bold">Heptagon Physics</h1>
        <p className="text-sm opacity-70">20 Balls • Gravity • Rotating Container</p>
      </div>
      <HeptagonSimulation />
    </div>
  );
};

export default App;