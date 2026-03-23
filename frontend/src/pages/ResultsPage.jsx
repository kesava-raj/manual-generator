import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

function ResultsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [run, setRun] = useState(null);
  const [steps, setSteps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [expandedStep, setExpandedStep] = useState(null);

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

  async function handleDownload() {
    setDownloading(true);
    try {
      const response = await axios.get(`/api/run/${id}/download`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `manual-${id.slice(0, 8)}.docx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed:', err);
      alert('Failed to download document. It may not be generated yet.');
    } finally {
      setDownloading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-10 h-10 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
      </div>
    );
  }

  if (!run) {
    return (
      <div className="text-center py-20">
        <h2 className="text-xl text-white/50">Run not found</h2>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Exploration Results</h1>
          <p className="text-sm text-white/40 mt-1">{run.url}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/dashboard')}
            className="btn-outline text-sm"
          >
            ← Back
          </button>
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="btn-gold text-sm flex items-center gap-2"
            id="download-manual-btn"
          >
            {downloading ? (
              <>
                <div className="w-4 h-4 border-2 border-navy/30 border-t-navy rounded-full animate-spin" />
                Downloading...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download Manual (.docx)
              </>
            )}
          </button>
        </div>
      </div>

      {/* Summary Card */}
      <div className="glass-card p-6 mb-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <p className="text-xs text-white/30 uppercase tracking-wider">Status</p>
          <p className="text-sm font-medium text-emerald-400 mt-1">
            {run.status.charAt(0).toUpperCase() + run.status.slice(1)}
          </p>
        </div>
        <div>
          <p className="text-xs text-white/30 uppercase tracking-wider">Total Steps</p>
          <p className="text-sm font-medium text-white mt-1">{steps.length}</p>
        </div>
        <div>
          <p className="text-xs text-white/30 uppercase tracking-wider">Started</p>
          <p className="text-sm font-medium text-white mt-1">
            {new Date(run.created_at + 'Z').toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-xs text-white/30 uppercase tracking-wider">Completed</p>
          <p className="text-sm font-medium text-white mt-1">
            {run.completed_at ? new Date(run.completed_at + 'Z').toLocaleString() : '—'}
          </p>
        </div>
      </div>

      {/* Steps Grid */}
      <div className="space-y-4">
        {steps.map((step, idx) => (
          <div
            key={step.id}
            className="glass-card overflow-hidden group animate-slide-up"
            style={{ animationDelay: `${idx * 0.03}s` }}
          >
            <div
              className="p-5 flex items-center justify-between cursor-pointer hover:bg-white/[0.02] transition-colors"
              onClick={() => setExpandedStep(expandedStep === step.id ? null : step.id)}
            >
              <div className="flex items-center gap-4">
                <div className="w-8 h-8 rounded-lg gold-gradient flex items-center justify-center text-navy font-bold text-sm flex-shrink-0">
                  {step.step_number}
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{step.action}</p>
                  <p className="text-xs text-white/30 mt-0.5">{step.description}</p>
                </div>
              </div>
              <svg
                className={`w-5 h-5 text-white/20 transition-transform duration-200 ${
                  expandedStep === step.id ? 'rotate-180' : ''
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>

            {/* Expanded Screenshot */}
            {expandedStep === step.id && step.screenshot_path && (
              <div className="px-5 pb-5 animate-fade-in">
                <div className="rounded-lg overflow-hidden border border-white/10">
                  <img
                    src={`/${step.screenshot_path}`}
                    alt={`Step ${step.step_number}`}
                    className="w-full h-auto"
                    loading="lazy"
                  />
                </div>
                {step.url && (
                  <p className="text-xs text-white/20 mt-2 break-all">📍 {step.url}</p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Empty state */}
      {steps.length === 0 && (
        <div className="glass-card p-12 text-center">
          <div className="text-4xl mb-4">📭</div>
          <h3 className="text-lg font-semibold text-white/50">No steps recorded</h3>
          <p className="text-sm text-white/30 mt-1">The exploration might have ended before capturing any steps</p>
        </div>
      )}
    </div>
  );
}

export default ResultsPage;
