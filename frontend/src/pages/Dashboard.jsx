import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const Dashboard = () => {
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchRuns();
    const interval = setInterval(fetchRuns, 10000);
    return () => clearInterval(interval);
  }, []);

  async function fetchRuns() {
    try {
      const res = await axios.get('/api/run');
      setRuns(res.data);
    } catch (err) {
      console.error('Failed to fetch runs:', err);
    } finally {
      setLoading(false);
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'running': return 'text-[#EF3E25] bg-[#EF3E25]/10 border-[#EF3E25]/20';
      case 'completed': return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
      case 'failed': return 'text-red-500 bg-red-500/10 border-red-500/20';
      default: return 'text-white/40 bg-white/5 border-white/10';
    }
  };

  const truncateUrl = (url) => {
    try {
      const u = new URL(url);
      return u.hostname;
    } catch {
      return url.length > 30 ? url.substring(0, 30) + '...' : url;
    }
  };

  return (
    <div className="min-h-screen py-16 px-6 bg-[#020205] relative overflow-hidden font-inter">
      {/* Background Decor */}
      <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] bg-[#5D248F]/5 rounded-full blur-[150px] pointer-events-none"></div>

      <div className="max-w-7xl mx-auto relative z-10">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-8 h-2 bg-[#EF3E25] rounded-full"></span>
              <h4 className="text-[10px] font-black text-[#EF3E25] uppercase tracking-[0.4em]">Operations Center</h4>
            </div>
            <h1 className="text-5xl font-black text-white tracking-tighter">MyProBuddy <span className="text-white/20">Fleet</span></h1>
          </div>
          
          <button 
            onClick={() => navigate('/new-run')}
            className="btn-brand px-10 py-5 text-xs font-black uppercase tracking-widest flex items-center gap-3 active:scale-[0.98] shadow-[0_0_20px_rgba(239,62,37,0.2)]"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
            </svg>
            Initialize Analysis
          </button>
        </header>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="glass-card p-8 h-48 shimmer opacity-20"></div>
            ))}
          </div>
        ) : runs.length === 0 ? (
          <div className="glass-card p-20 text-center border-dashed border-white/10 bg-white/[0.01]">
            <div className="text-white/10 text-6xl mb-6 font-black tracking-tighter">EMPTY_FLIGHT_DECK</div>
            <p className="text-white/40 font-medium mb-8">No documentation agents have been deployed yet.</p>
            <button onClick={() => navigate('/new-run')} className="btn-outline px-8 py-3 text-[10px] uppercase font-black tracking-widest">Deploy First Agent</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {runs.map((run, idx) => (
              <div
                key={run.id}
                onClick={() => navigate(run.status === 'completed' ? `/run/${run.id}/results` : `/run/${run.id}`)}
                className="glass-card p-8 group cursor-pointer hover:border-[#EF3E25]/30 hover:bg-white/[0.03] transition-all duration-500 animate-slide-up bg-gradient-to-br from-white/[0.02] to-transparent relative overflow-hidden"
                style={{ animationDelay: `${idx * 0.05}s` }}
              >
                {/* Decorative Accent */}
                <div className={`absolute top-0 right-0 w-32 h-32 blur-[40px] opacity-10 pointer-events-none transition-all duration-700 group-hover:opacity-20 ${run.status === 'completed' ? 'bg-emerald-500' : 'bg-[#EF3E25]'}`}></div>

                <div className="flex items-start justify-between mb-8 relative z-10">
                  <div className={`px-3 py-1.5 rounded-full border text-[9px] font-black uppercase tracking-widest ${getStatusColor(run.status)}`}>
                    {run.status}
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/50 group-hover:text-white group-hover:border-[#EF3E25]/20 group-hover:bg-[#EF3E25]/5 transition-all">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </div>
                </div>

                <div className="space-y-1 mt-auto relative z-10">
                  <h3 className="text-xl font-bold text-white tracking-tight group-hover:text-[#EF3E25] transition-colors truncate">
                    {truncateUrl(run.url)}
                  </h3>
                  <p className="text-[10px] font-black text-white/20 uppercase tracking-widest">
                    ID: {run.id.slice(0, 8)} • {new Date(run.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
