import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

const ExecutionPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [run, setRun] = useState(null);
  const [steps, setSteps] = useState([]);
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState('');
  const logEndRef = useRef(null);
  
  const getProgressPercent = () => {
    if (!run || run.status === 'pending') return 5;
    if (run.status === 'completed') return 100;
    const base = Math.min(steps.length * 20, 90);
    return base;
  };

  const latestStep = steps.length > 0 ? steps[steps.length - 1] : null;

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [runRes, stepsRes] = await Promise.all([
          axios.get(`/api/run/${id}`),
          axios.get(`/api/run/${id}/steps`)
        ]);
        setRun(runRes.data);
        setSteps(stepsRes.data);
      } catch (err) {
        setError('Failed to fetch run progress');
      }
    };

    fetchInitialData();

    // Set up SSE
    const eventSource = new EventSource(`/api/run/${id}/stream`);

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      // We handle specific event types below
    };

    eventSource.addEventListener('activity', (e) => {
      const data = JSON.parse(e.data);
      setLogs(prev => [...prev, { 
        id: Date.now(), 
        message: data.message, 
        timestamp: new Date().toLocaleTimeString() 
      }]);
    });

    eventSource.addEventListener('step', (e) => {
      const data = JSON.parse(e.data);
      // Refresh steps when a new one is added
      axios.get(`/api/run/${id}/steps`).then(res => setSteps(res.data));
    });

    eventSource.addEventListener('completed', (e) => {
      setRun(prev => ({ ...prev, status: 'completed' }));
      eventSource.close();
      setTimeout(() => navigate(`/run/${id}/results`), 2000);
    });

    eventSource.addEventListener('failed', (e) => {
      const data = JSON.parse(e.data);
      setError(data.error || 'Exploration failed');
      setRun(prev => ({ ...prev, status: 'failed' }));
      eventSource.close();
    });

    return () => eventSource.close();
  }, [id, navigate]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  if (loading || (!run && !error)) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-6">
        <div className="w-12 h-12 border-2 border-[#5d248f]/30 border-t-[#5d248f] rounded-full animate-spin" />
        <p className="text-white/40 animate-pulse accent-text uppercase tracking-widest text-xs">Summoning MyProBuddy Agent...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-32 text-red-500">
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto py-10 px-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
            run.status === 'running' ? 'status-running' :
            run.status === 'completed' ? 'status-completed' :
            run.status === 'failed' ? 'status-failed' : 'status-pending'
          }`}>
            {run.status === 'running' && (
              <div className="w-2 h-2 rounded-full bg-[#ef3e25] animate-pulse" />
            )}
            {run.status.charAt(0).toUpperCase() + run.status.slice(1)}
          </span>
          <h1 className="text-3xl font-black text-white mt-3 tracking-tight font-heading group">
            Tracing <span className="text-white/40 group-hover:text-[#ef3e25] transition-colors">{run.url}</span>
          </h1>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="glass-card p-8 mb-8 relative overflow-hidden">
        <div className="absolute inset-0 shimmer pointer-events-none" />
        <div className="flex items-center justify-between mb-4 relative z-10">
          <span className="text-sm font-semibold uppercase tracking-wider text-white/40">Exploration Progress</span>
          <span className="text-sm font-bold text-[#ef3e25] px-3 py-1 bg-[#ef3e25]/10 rounded-full border border-[#ef3e25]/20">
            {steps.length} steps captured
          </span>
        </div>
        <div className="h-3 bg-white/5 rounded-full overflow-hidden relative z-10 border border-white/5">
          <div
            className={`h-full rounded-full transition-all duration-1000 ease-out ${run.status === 'running' ? 'animate-brand-pulse' : ''}`}
            style={{
              width: `${getProgressPercent()}%`,
              background: run.status === 'failed'
                ? 'linear-gradient(90deg, #ef4444, #dc2626)'
                : 'linear-gradient(90deg, #ef3e25, #5d248f, #fc5109)',
              backgroundSize: '200% 100%'
            }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Live Screenshot */}
        <div className="glass-card p-6">
          <h3 className="text-sm font-medium text-white/50 mb-4">Latest Screenshot</h3>
          {latestStep && latestStep.screenshot_path ? (
            <div className="rounded-lg overflow-hidden border border-white/10">
              <img
                src={`/${latestStep.screenshot_path}`}
                alt={`Step ${latestStep.step_number}`}
                className="w-full h-auto"
                key={latestStep.id}
              />
            </div>
          ) : (
            <div className="h-48 rounded-lg bg-white/5 flex items-center justify-center">
              <p className="text-sm text-white/20">Waiting for first screenshot...</p>
            </div>
          )}
        </div>

        {/* Step Timeline */}
        <div className="glass-card p-6">
          <h3 className="text-sm font-medium text-white/50 mb-4">Step Timeline</h3>
          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
            {steps.length === 0 ? (
              <div className="flex items-center gap-3 py-4">
                <div className="w-6 h-6 border-2 border-[#5d248f]/30 border-t-[#5d248f] rounded-full animate-spin" /> {/* Updated color */}
                <span className="text-sm text-white/30">Initializing exploration...</span>
              </div>
            ) : (
              steps.map((step, idx) => (
                <div
                  key={step.id}
                  className="flex gap-3 animate-slide-in"
                  style={{ animationDelay: `${idx * 0.05}s` }}
                >
                  {/* Timeline dot */}
                  <div className="flex flex-col items-center">
                    <div className={`w-3 h-3 rounded-full border-2 transition-all duration-500 ${
                      idx < steps.length - 1 ? 'bg-[#5d248f] border-[#5d248f]' : // Assuming idx < steps.length - 1 is equivalent to index < activeStepIndex
                      idx === steps.length - 1 ? 'bg-[#ef3e25] border-[#ef3e25] animate-brand-pulse scale-125' : // Assuming idx === steps.length - 1 is active step
                      'bg-transparent border-white/20'
                    }`} />
                    {/* The step.step_number was removed in the instruction, re-adding it to maintain functionality */}
                    {/* The instruction provided a different structure for the dot, adapting it to fit existing logic */}
                    {idx < steps.length - 1 && (
                      <div className="w-px h-full bg-white/10 my-1" />
                    )}
                  </div>

                  {/* Step content */}
                  <div className="flex-1 pb-6">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-white/90">{step.action}</p>
                      <span className="text-[10px] text-white/30 font-mono">{new Date(step.created_at).toLocaleTimeString()}</span>
                    </div>
                    <p className="text-xs text-white/40 mt-1 leading-relaxed">{step.description}</p>
                    
                    {step.mapped_code && (
                      <div className="mt-4 bg-[#050C1A] rounded-xl border border-white/5 overflow-hidden shadow-inner">
                        <div className="bg-white/5 px-3 py-1.5 border-b border-white/5 flex items-center justify-between">
                          <span className="text-[9px] text-[#ef3e25] font-bold uppercase tracking-widest">Mapped Source Code</span> {/* Updated color */}
                          <div className="flex gap-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-white/10" />
                            <div className="relative h-1 bg-white/5 rounded-full overflow-hidden">
                              <div 
                                className="absolute left-0 top-0 h-full bg-gradient-to-r from-[#ef3e25] to-[#5d248f] transition-all duration-1000 ease-out"
                                style={{ width: `${getProgressPercent()}%` }} // Re-using getProgressPercent for explorationProgress
                              />
                            </div>
                          </div>
                        </div>
                        <pre className="p-4 text-[11px] text-white/70 font-mono overflow-x-auto whitespace-pre leading-relaxed custom-scrollbar">
                          {step.mapped_code}
                        </pre>
                      </div>
                    )}
                  </div>
                  </div>
                ))
              )}

            {/* Running indicator */}
            {run.status === 'running' && steps.length > 0 && (
              <div className="flex items-center gap-3 py-2">
                <div className="w-6 h-6 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
                <span className="text-sm text-white/30">Exploring...</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Completed banner */}
      {run.status === 'completed' && (
        <div className="glass-card p-6 mt-6 border-emerald-500/20 bg-emerald-500/5 text-center animate-slide-up">
          <div className="text-3xl mb-2">✅</div>
          <h3 className="text-lg font-semibold text-emerald-400">Exploration Complete!</h3>
          <p className="text-sm text-white/40 mt-1">Redirecting to results...</p>
        </div>
      )}

      {/* Failed banner */}
      {run.status === 'failed' && (
        <div className="glass-card p-6 mt-6 border-red-500/20 bg-red-500/5 text-center animate-slide-up">
          <div className="text-3xl mb-2">❌</div>
          <h3 className="text-lg font-semibold text-red-400">Exploration Failed</h3>
          <p className="text-sm text-white/40 mt-1">Check the steps above for details</p>
          <button
            onClick={() => navigate('/new-run')}
            className="btn-outline text-sm mt-4"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}

export default ExecutionPage;
