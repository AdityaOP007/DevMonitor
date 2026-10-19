import React, { useState, useEffect } from 'react';
import { X, ArrowRight, Check } from 'lucide-react';

export const TOUR_STORAGE_KEY = 'devmonitor_tour_completed';

interface StepInfo {
  title: string;
  targetId?: string;
  description: string;
}

const tourSteps: StepInfo[] = [
  {
    title: 'System Health Badge',
    targetId: 'topbar-status-badge',
    description: 'This badge shows your overall system status (Healthy, Degraded, or Down) determined by active service checks.',
  },
  {
    title: 'Key Plain-Language Metrics',
    targetId: 'metric-cards-container',
    description: 'Headline numbers like Requests, Errors, and Response Time. Click the info icon on any card to see what the metric means.',
  },
  {
    title: 'How It Works Guide',
    targetId: 'nav-how-it-works',
    description: 'Visit the "How It Works" page at any time to understand how Application, Prometheus, and Grafana work together.',
  },
];

export const OnboardingTour: React.FC = () => {
  const [isOpen, setIsOpen] = useState<boolean>(() => {
    try {
      return !localStorage.getItem(TOUR_STORAGE_KEY);
    } catch {
      return false;
    }
  });
  const [stepIndex, setStepIndex] = useState<number>(-1); // -1 = Welcome Modal, 0..2 = Tour Steps

  useEffect(() => {
    const handleReset = () => {
      setStepIndex(-1);
      setIsOpen(true);
    };

    window.addEventListener('devmonitor_reset_tour', handleReset);
    return () => window.removeEventListener('devmonitor_reset_tour', handleReset);
  }, []);

  const finishTour = () => {
    try {
      localStorage.setItem(TOUR_STORAGE_KEY, 'true');
    } catch {
      // Fallback
    }
    setIsOpen(false);
    setStepIndex(-1);
  };

  if (!isOpen) return null;

  // Welcome Modal (Step -1)
  if (stepIndex === -1) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
        <div className="bg-white rounded-xl border border-slate-200 max-w-lg w-full p-6 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h2 className="text-lg font-bold text-slate-900">Welcome to DevMonitor</h2>
            <button
              type="button"
              onClick={finishTour}
              className="text-slate-400 hover:text-slate-600 rounded p-1 focus:outline-none focus:ring-2 focus:ring-blue-600"
              aria-label="Close welcome modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <p className="mt-4 text-sm text-slate-600 leading-relaxed">
            Let's understand your system in 3 simple steps:
          </p>

          <ol className="mt-4 space-y-3 text-sm text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-100">
            <li className="flex items-start gap-2.5">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold shrink-0">1</span>
              <span><strong>Your application generates data:</strong> requests, errors, and performance counters.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold shrink-0">2</span>
              <span><strong>Prometheus collects that data:</strong> scrapes numbers regularly every 15 seconds.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold shrink-0">3</span>
              <span><strong>Grafana visualizes the data:</strong> turns numbers into understandable graphs and alerts.</span>
            </li>
          </ol>

          <div className="mt-6 flex items-center justify-between pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={finishTour}
              className="text-sm font-medium text-slate-500 hover:text-slate-800 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-600 rounded"
            >
              Skip
            </button>

            <button
              type="button"
              onClick={() => setStepIndex(0)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 shadow-sm"
            >
              <span>Start Tour</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Active Tour Step Callout
  const currentStep = tourSteps[stepIndex];

  return (
    <div className="fixed inset-0 z-50 pointer-events-none flex flex-col justify-end p-4 sm:p-6 lg:items-end">
      <div className="pointer-events-auto bg-white border border-slate-200 rounded-xl max-w-sm w-full p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100">
              Step {stepIndex + 1} of {tourSteps.length}
            </span>
            <h3 className="font-bold text-slate-900 text-sm">{currentStep.title}</h3>
          </div>
          <button
            type="button"
            onClick={finishTour}
            className="text-slate-400 hover:text-slate-600 p-1 rounded focus:outline-none focus:ring-1 focus:ring-blue-600"
            aria-label="Skip tour"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">{currentStep.description}</p>

        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={finishTour}
            className="text-xs text-slate-500 hover:text-slate-700"
          >
            Skip tour
          </button>

          {stepIndex < tourSteps.length - 1 ? (
            <button
              type="button"
              onClick={() => setStepIndex((prev) => prev + 1)}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-md text-xs font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <span>Next</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={finishTour}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-md text-xs font-medium hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <span>Done</span>
              <Check className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
