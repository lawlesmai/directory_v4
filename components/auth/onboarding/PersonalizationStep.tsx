'use client';

import React from 'react';

export const PersonalizationStep: React.FC = () => {
  const handleContinue = () => {
    console.log('Personalization step completed');
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-cream mb-4">Personalization</h2>
      <p className="text-sage/70 mb-6">Personalization step (stub implementation)</p>
      <button
        onClick={handleContinue}
        className="px-4 py-2 bg-teal-primary text-white rounded hover:bg-teal-secondary"
      >
        Continue
      </button>
    </div>
  );
};

export default PersonalizationStep;