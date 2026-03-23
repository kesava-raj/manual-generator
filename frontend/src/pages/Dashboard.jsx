import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

function Dashboard() {
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchRuns();
    const interval = setInterval(fetchRuns, 5000);
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

  function getStatusBadge(status) {
    const styles = {
      running: 'status-running',
      completed: 'status-completed',
      failed: 'status-failed',
      pending: 'status-pending',
    };
    return styles[status] || styles.pending;
  }

  function getStatusIcon(status) {
    switch (status) {
      case 'running':
        return (
          <svg className="w-3.5 h-3.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        );
      case 'completed':
        return (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        );
      case 'failed':
        return (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        );
      default:
        return (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  }

  function formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr + 'Z');
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function truncateUrl(url) {
    try {
      const u = new URL(url);
      return u.hostname + (u.pathname !== '/' ? u.pathname.substring(0, 30) : '');
    } catch {
      return url.substring(0, 40);
    }
  }

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Runs</h1>
          <p className="text-sm text-white/40 mt-1">Manage your manual generation runs</p>
        </div>
        <button
          onClick={() => navigate('/new-run')}
          className="btn-brand text-sm flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Run
        </button>
      </div>

      {/* Runs List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
        </div>
      ) : runs.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <div className="text-4xl mb-4">📋</div>
          <h3 className="text-lg font-semibold text-white/70 mb-2">No runs yet</h3>
          <p className="text-sm text-white/30 mb-6">Start your first exploration to generate a manual</p>
          <button
            onClick={() => navigate('/new-run')}
            className="btn-brand text-sm"
          >
            Create First Run
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {runs.map((run, idx) => (
            <div
              key={run.id}
              onClick={() => {
                if (run.status === 'completed') {
                  navigate(`/run/${run.id}/results`);
                } else {
                  navigate(`/run/${run.id}`);
                }
              }}
              className="glass-card p-5 flex items-center justify-between cursor-pointer group hover:border-indigo-500/20 transition-all duration-300 hover:-translate-y-0.5 animate-slide-up"
              style={{ animationDelay: `${idx * 0.05}s` }}
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-lg">
                  🌐
                </div>
                <div>
                  <p className="text-sm font-medium text-white group-hover:text-indigo-400 transition-colors">
                    {truncateUrl(run.url)}
                  </p>
                  <p className="text-xs text-white/30 mt-1">
                    {formatDate(run.created_at)}
                    {run.total_steps > 0 && (
                      <span className="ml-3">• {run.total_steps} steps</span>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(run.status)}`}>
                  {getStatusIcon(run.status)}
                  {run.status.charAt(0).toUpperCase() + run.status.slice(1)}
                </span>
                <svg className="w-4 h-4 text-white/20 group-hover:text-indigo-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Dashboard;
