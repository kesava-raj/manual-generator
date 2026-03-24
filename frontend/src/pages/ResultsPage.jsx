import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

const ResultsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [run, setRun] = useState(null);
  const [steps, setSteps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(null); // 'user' | 'tech' | null
  const [expandedStep, setExpandedStep] = useState(null);
  const [mode, setMode] = useState('branded'); // 'branded' | 'generic'

  useEffect(() => {
    fetchData();
  }, [id]);

  async function fetchData() {
    try {
      const [runRes, stepsRes] = await Promise.all([
        axios.get(`/api/run/${id}`),
        axios.get(`/api/run/${id}/steps`),
      ]);
      setRun(runRes.data);
      setSteps(stepsRes.data);
    } catch (err) {
      console.error('Failed to fetch:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleDownload(type) {
    setDownloading(type);
    try {
      const response = await axios.get(`/api/run/${id}/download/${type}?mode=${mode}`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${mode}_${type}_manual_${id.slice(0, 8)}.docx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed:', err);
      alert(`Failed to download ${mode} ${type} manual. It might still be compiling.`);
    } finally {
      setDownloading(null);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-4">
        <div className="w-12 h-12 border-2 border-[#EF3E25]/30 border-t-[#EF3E25] rounded-full animate-spin" />
        <span className="text-[10px] font-black uppercase tracking-widest text-white/20">Synthesizing Artifacts...</span>
      </div>
    );
  }

  if (!run) return <div className="text-center py-20 text-white/20">Run not found</div>;

  return (
    <div className="max-w-7xl mx-auto py-12 px-6 animate-fade-in font-inter">
      {/* Header Area */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 mb-12">
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
             <span className="w-2 h-8 bg-[#EF3E25] rounded-full"></span>
             <h4 className="text-[10px] font-black text-[#EF3E25] uppercase tracking-[0.3em]">Synthesis Repository</h4>
          </div>
          <h1 className="text-5xl font-black text-white tracking-tighter">Exploration <span className="text-white/20">Complete</span></h1>
          
          {/* Mode Toggle */}
          <div className="flex items-center gap-4 bg-white/5 p-1 rounded-full w-fit mt-4 border border-white/10">
            <button 
              onClick={() => setMode('branded')}
              className={`px-6 py-2 text-[10px] font-black uppercase tracking-widest rounded-full transition-all ${mode === 'branded' ? 'bg-[#EF3E25] text-white' : 'text-white/40 hover:text-white'}`}
            >
              Branded Mode
            </button>
            <button 
              onClick={() => setMode('generic')}
              className={`px-6 py-2 text-[10px] font-black uppercase tracking-widest rounded-full transition-all ${mode === 'generic' ? 'bg-white text-black' : 'text-white/40 hover:text-white'}`}
            >
              Generic Mode
            </button>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-4 items-center">
          <button
            onClick={() => handleDownload('user')}
            disabled={!!downloading}
            className={`px-8 py-4 text-xs font-black uppercase tracking-widest flex items-center gap-3 active:scale-[0.98] transition-all ${mode === 'branded' ? 'btn-brand' : 'bg-white text-black hover:bg-white/90'}`}
          >
            {downloading === 'user' ? <div className={`w-4 h-4 border-2 rounded-full animate-spin ${mode === 'branded' ? 'border-white/30 border-t-white' : 'border-black/30 border-t-black'}`} /> : null}
            Download {mode === 'branded' ? 'Visual' : 'Engineering'} User Guide
          </button>
          
          <button
            onClick={() => handleDownload('tech')}
            disabled={!!downloading}
            className={`px-8 py-4 text-xs font-black uppercase tracking-widest flex items-center gap-3 active:scale-[0.98] transition-all ${mode === 'branded' ? 'btn-purple' : 'bg-white/10 text-white border border-white/20 hover:bg-white/20'}`}
          >
            {downloading === 'tech' ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
            {mode === 'branded' ? 'Technical Spec' : 'System Architecture'}
          </button>
        </div>
      </div>

      {/* Grid: Left Summary, Right Modules */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Stats */}
        <div className="lg:col-span-1 space-y-6">
           <div className="glass-card p-8 border-white/5 bg-gradient-to-br from-white/[0.03] to-transparent">
              <h3 className="text-xs font-black text-white/40 uppercase tracking-widest mb-6">Execution Runtime</h3>
              <div className="space-y-6">
                 <div>
                    <label className="text-[9px] font-black text-[#EF3E25] uppercase tracking-widest block mb-1">Status</label>
                    <p className="text-xl font-bold text-white uppercase">{run.status}</p>
                 </div>
                 <div>
                    <label className="text-[9px] font-black text-[#5D248F] uppercase tracking-widest block mb-1">Captured Logic</label>
                    <p className="text-xl font-bold text-white">{steps.length} Modules</p>
                 </div>
                 <div>
                    <label className="text-[9px] font-black text-white/20 uppercase tracking-widest block mb-1">Generated At</label>
                    <p className="text-sm font-medium text-white/60">{new Date().toLocaleDateString()}</p>
                 </div>
              </div>
           </div>
           
           <button onClick={() => navigate('/new-run')} className="w-full glass-card p-6 text-center hover:bg-white/5 transition-colors border-white/5 group">
              <span className="text-[10px] font-black text-white/20 uppercase tracking-widest group-hover:text-white transition-colors">Start New Analysis →</span>
           </button>
        </div>

        {/* Right Column: Step Gallery */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-xs font-black text-white/40 uppercase tracking-widest mb-4 px-2">Knowledge Fragments</h3>
          {steps.map((step, idx) => (
            <div
              key={step.id}
              className="glass-card overflow-hidden group animate-slide-up bg-[#020205]/40"
              style={{ animationDelay: `${idx * 0.05}s` }}
            >
              <div
                className="p-6 flex items-center justify-between cursor-pointer hover:bg-white/[0.02] transition-all"
                onClick={() => setExpandedStep(expandedStep === step.id ? null : step.id)}
              >
                <div className="flex items-center gap-6">
                  <div className="w-10 h-10 rounded-xl brand-gradient flex items-center justify-center text-white font-black text-sm shrink-0 shadow-lg">
                    {step.step_number}
                  </div>
                  <div>
                    <p className="text-base font-bold text-white tracking-tight">{step.description}</p>
                    <p className="text-[10px] font-black text-white/20 uppercase tracking-widest mt-1">{step.action}</p>
                  </div>
                </div>
                <div className={`p-2 rounded-full bg-white/5 text-white/20 transition-transform ${expandedStep === step.id ? 'rotate-180 bg-[#EF3E25]/10 text-[#EF3E25]' : ''}`}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              {expandedStep === step.id && (
                <div className="px-6 pb-6 animate-fade-in space-y-4">
                  <div className="rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
                    <img src={`/${step.screenshot_path}`} alt="UI Capture" className="w-full h-auto" />
                  </div>
                  <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                     <p className="text-xs text-white/60 leading-relaxed italic">"{step.ai_reasoning}"</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ResultsPage;
