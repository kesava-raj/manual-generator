import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const NewRun = () => {
  const [url, setUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [repos, setRepos] = useState([]);
  const [selectedRepo, setSelectedRepo] = useState('');
  const [isMock, setIsMock] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reposLoading, setReposLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchRepos = async () => {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        setReposLoading(false);
        return;
      }

      try {
        const res = await axios.get(`/api/github/repos?token=${token}`);
        setRepos(res.data);
      } catch (err) {
        console.error("Failed to fetch repos", err);
      } finally {
        setReposLoading(false);
      }
    };

    fetchRepos();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Basic URL validation
    let finalUrl = url.trim();
    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
      finalUrl = 'https://' + finalUrl;
    }

    const token = localStorage.getItem('auth_token');

    try {
      const res = await axios.post('/api/run', {
        url: finalUrl,
        username: username.trim(),
        password,
        github_repo: selectedRepo,
        is_mock: isMock,
        user_id: token ? 'current' : '' // Backend will resolve 'current' using JWT if needed
      });
      navigate(`/run/${res.data.id}`);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to start exploration');
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-10 px-6">
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-white mb-2">New Exploration</h1>
        <p className="text-white/60">Enter a website URL to automatically generate a manual</p>
      </div>

      <form onSubmit={handleSubmit} className="glass-card p-8 space-y-8 relative overflow-hidden">
        {/* Decorative corner */}
        <div className="absolute -top-10 -right-10 w-20 h-20 bg-indigo-500/5 rounded-full blur-2xl"></div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-white/80 block">
            Website URL <span className="text-indigo-400">*</span>
          </label>
          <input
            type="text"
            required
            className="w-full bg-slate-900 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/20 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 outline-none transition-all"
            placeholder="https://example.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-white/60 block uppercase tracking-wider">Username / Email</label>
            <input
              type="text"
              className="w-full bg-slate-900 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/20 focus:border-indigo-500/30 outline-none transition-all"
              placeholder="user@example.com"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-white/60 block uppercase tracking-wider">Password</label>
            <input
              type="password"
              className="w-full bg-slate-900 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/20 focus:border-indigo-500/30 outline-none transition-all"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-white/80 block">
            Connect GitHub Repository
          </label>
          <select
            className="w-full bg-slate-900 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 outline-none transition-all appearance-none cursor-pointer"
            value={selectedRepo}
            onChange={(e) => setSelectedRepo(e.target.value)}
            disabled={reposLoading}
          >
            <option value="">-- Select a repository (Optional) --</option>
            {repos.map(repo => (
              <option key={repo.full_name} value={repo.full_name} className="bg-slate-900">
                {repo.full_name} {repo.private ? '🔒' : ''}
              </option>
            ))}
          </select>
          {reposLoading && <p className="text-[10px] text-indigo-400 animate-pulse">Loading your repositories...</p>}
          {!localStorage.getItem('auth_token') && (
            <p className="text-[10px] text-white/40 italic">Login with GitHub to select a repository for source mapping.</p>
          )}
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-lg text-sm flex items-start space-x-3">
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        <div className="flex items-center space-x-3 bg-indigo-500/5 p-4 rounded-lg border border-indigo-500/20 mb-2">
          <input 
            type="checkbox" 
            id="isMock"
            className="w-5 h-5 rounded border-indigo-500/30 bg-slate-900 text-indigo-500 focus:ring-indigo-500/50 cursor-pointer"
            checked={isMock}
            onChange={(e) => setIsMock(e.target.checked)}
          />
          <label htmlFor="isMock" className="text-sm text-white/80 cursor-pointer select-none">
            <span className="font-bold text-indigo-400">Enable Demo Mode:</span> Launch a specialized product showcase with pre-defined high-quality results.
          </label>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn-brand w-full flex items-center justify-center space-x-2 py-4"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-navy/30 border-t-navy rounded-full animate-spin"></div>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Start AI Exploration</span>
            </>
          )}
        </button>

        <div className="bg-white/5 border border-white/5 rounded-lg p-4">
          <p className="text-xs text-white/40 leading-relaxed">
            <span className="text-indigo-400 font-bold">Note:</span> Gemini 1.5 Pro will explore the website, 
            identifying interactive elements and mapping actions to your selected GitHub repository. 
            This process typically takes 2-5 minutes.
          </p>
        </div>
      </form>
    </div>
  );
};

export default NewRun;
