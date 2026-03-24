import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

const ExecutionPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [run, setRun] = useState(null);
  const [steps, setSteps] = useState([]);
  const [visualLogs, setVisualLogs] = useState([]);
  const [techLogs, setTechLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const visualLogEndRef = useRef(null);
  const techLogEndRef = useRef(null);
  
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
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();

    // Set up SSE for v2.0 dual logging
    const eventSource = new EventSource(`/api/run/${id}/stream`);

    eventSource.addEventListener('visual_activity', (e) => {
      const data = JSON.parse(e.data);
      setVisualLogs(prev => [...prev, { 
        id: Date.now() + Math.random(), 
        message: data.message, 
        timestamp: new Date().toLocaleTimeString() 
      }]);
    });

    eventSource.addEventListener('tech_activity', (e) => {
      const data = JSON.parse(e.data);
      setTechLogs(prev => [...prev, { 
        id: Date.now() + Math.random(), 
        message: data.message, 
        timestamp: new Date().toLocaleTimeString() 
      }]);
    });

    eventSource.addEventListener('step', (e) => {
      // Refresh steps when a new one is added
      axios.get(`/api/run/${id}/steps`).then(res => setSteps(res.data));
    });

    eventSource.addEventListener('completed', (e) => {
      setRun(prev => ({ ...prev, status: 'completed' }));
      eventSource.close();
      // Automatic redirect after short delay
      setTimeout(() => navigate(`/run/${id}/results`), 3000);
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
    visualLogEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [visualLogs]);

  useEffect(() => {
    techLogEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [techLogs]);

  if (loading || (!run && !error)) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-6">
        <div className="w-12 h-12 border-2 border-[#5D248F]/30 border-t-[#5D248F] rounded-full animate-spin" />
        <p className="text-white/40 animate-pulse accent-text uppercase tracking-widest text-xs">Summoning MyProBuddy v2.0...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <div className="text-red-500 mb-4 animate-bounce">⚠️</div>
        <p className="text-red-500 font-bold uppercase tracking-widest text-sm">{error}</p>
        <button onClick={() => navigate('/new-run')} className="btn-outline mt-8">Back to Dashboard</button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-10 px-6 font-inter">
      <div className="flex items-center justify-between mb-8">
        <div>
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
            run.status === 'running' ? 'status-running' :
            run.status === 'completed' ? 'status-completed' : 'status-failed'
          }`}>
            {run.status === 'running' && (
              <div className="w-2 h-2 rounded-full bg-current animate-pulse" />
            )}
            {run.status}
          </span>
          <h1 className="text-4xl font-black text-white mt-3 tracking-tighter group transition-all">
            Exploring <span className="text-white/20 group-hover:text-[#EF3E25] transition-colors">{run.url}</span>
          </h1>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="glass-card p-6 mb-8 relative overflow-hidden">
        <div className="absolute inset-0 shimmer pointer-events-none opacity-30" />
        <div className="flex items-center justify-between mb-3 relative z-10">
          <span className="text-xs font-bold uppercase tracking-widest text-white/30">System Synthesis</span>
          <span className="text-xs font-black text-[#EF3E25] tracking-widest">
            {steps.length} MODULES MAPPED
          </span>
        </div>
        <div className="h-2 bg-white/5 rounded-full overflow-hidden relative z-10">
          <div
            className={`h-full brand-gradient transition-all duration-1000 ease-out`}
            style={{ width: `${getProgressPercent()}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* VISUAL AGENT CONSOLE */}
        <div className="space-y-4">
          <div className="flex items-center gap-3 px-2">
            <div className="w-2 h-2 rounded-full bg-[#EF3E25] brand-glow shadow-[0_0_10px_#EF3E25]"></div>
            <h3 className="text-xs font-black text-white uppercase tracking-widest">Visual Agent Log</h3>
          </div>
          <div className="glass-card bg-[#020205]/60 h-[400px] flex flex-col overflow-hidden border-[#EF3E25]/10">
            <div className="flex-1 overflow-y-auto p-6 space-y-4 font-mono text-[11px] leading-relaxed custom-scrollbar">
              {visualLogs.length === 0 && <p className="text-white/10 italic">Initializing visual sensors...</p>}
              {visualLogs.map(log => (
                <div key={log.id} className="animate-fade-in flex gap-3">
                  <span className="text-[#EF3E25]/40 shrink-0">[{log.timestamp}]</span>
                  <span className="text-white/60">{log.message}</span>
                </div>
              ))}
              <div ref={visualLogEndRef} />
            </div>
          </div>
        </div>

        {/* TECHNICAL AGENT CONSOLE */}
        <div className="space-y-4">
          <div className="flex items-center gap-3 px-2">
            <div className="w-2 h-2 rounded-full bg-[#5D248F] shadow-[0_0_10px_#5D248F]"></div>
            <h3 className="text-xs font-black text-white uppercase tracking-widest">Technical Agent Log</h3>
          </div>
          <div className="glass-card bg-[#020205]/60 h-[400px] flex flex-col overflow-hidden border-[#5D248F]/10">
            <div className="flex-1 overflow-y-auto p-6 space-y-4 font-mono text-[11px] leading-relaxed custom-scrollbar">
              {techLogs.length === 0 && <p className="text-white/10 italic">Waiting for code mapping events...</p>}
              {techLogs.map(log => (
                <div key={log.id} className="animate-fade-in flex gap-3">
                  <span className="text-[#5D248F]/40 shrink-0">[{log.timestamp}]</span>
                  <span className="text-white/80">{log.message}</span>
                </div>
              ))}
              <div ref={techLogEndRef} />
            </div>
          </div>
        </div>
      </div>

      {/* Recent Capture Preview */}
      <div className="mt-8">
        <div className="glass-card p-8 flex flex-col md:flex-row gap-8 items-center bg-gradient-to-br from-white/[0.02] to-transparent">
          <div className="w-full md:w-1/2 aspect-video rounded-xl bg-white/5 border border-white/10 overflow-hidden relative group">
            {latestStep ? (
              <img src={`/${latestStep.screenshot_path}`} className="w-full h-full object-cover grayscale-[0.5] group-hover:grayscale-0 transition-all duration-700" alt="Latest" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className="shimmer w-full h-full absolute inset-0 opacity-10"></div>
                <span className="text-[10px] uppercase font-black tracking-widest text-white/10">Observing Environment...</span>
              </div>
            )}
          </div>
          <div className="w-full md:w-1/2 space-y-4">
             <h4 className="text-[10px] font-black text-[#EF3E25] uppercase tracking-[0.2em]">Active Component Analysis</h4>
             {latestStep ? (
                <div className="animate-fade-in">
                  <p className="text-xl font-bold text-white mb-2">{latestStep.description}</p>
                  <p className="text-sm text-white/40 leading-relaxed font-medium mb-4">{latestStep.ai_reasoning}</p>
                  <div className="bg-white/5 rounded-lg p-4 border border-white/5 font-mono text-[10px] text-white/60">
                    <span className="text-[#EF3E25] font-black mr-2">LINKED SRC:</span>
                    {latestStep.mapped_code ? 'Code Block Identified' : 'Establishing mapping...'}
                  </div>
                </div>
             ) : (
                <div className="space-y-4 opacity-10">
                   <div className="h-6 w-3/4 bg-white/20 rounded"></div>
                   <div className="h-20 w-full bg-white/20 rounded"></div>
                   <div className="h-10 w-full bg-white/20 rounded"></div>
                </div>
             )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExecutionPage;
