import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const NewRun = () => {
  const [url, setUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [repos, setRepos] = useState([]);
  const [selectedRepo, setSelectedRepo] = useState('');
  const [loading, setLoading] = useState(false);
  const [reposLoading, setReposLoading] = useState(true);
  const [error, setError] = useState('');
  const [logo, setLogo] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchRepos = async () => {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        setReposLoading(false);
        return;
      }

      try {
        const res = await axios.get('/api/github/repos', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        setRepos(res.data);
      } catch (err) {
        console.error("Failed to fetch repos", err);
      } finally {
        setReposLoading(false);
      }
    };

    fetchRepos();
  }, []);

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setLogo(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGitHubLogin = () => {
    window.location.href = '/api/auth/github/login';
  };

  const handleSubmit = async (mode = "dual") => {
    setLoading(true);
    setError('');

    let finalUrl = url.trim();
    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
      finalUrl = 'https://' + finalUrl;
    }

    const token = localStorage.getItem('auth_token');
    
    const formData = new FormData();
    formData.append('url', finalUrl);
    formData.append('username', username.trim());
    formData.append('password', password);
    formData.append('github_repo', selectedRepo);
    formData.append('run_mode', mode);
    if (logo) {
      formData.append('logo', logo);
    }

    try {
      // Use multipart/form-data for logo upload
      const res = await axios.post('/api/run', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}`
        }
      });
      navigate(`/run/${res.data.id}`);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to start exploration');
      setLoading(false);
    }
  };

  const isLoggedIn = !!localStorage.getItem('auth_token');

  return (
    <div className="min-h-screen py-16 px-6 bg-[#020205] relative overflow-hidden">
      {/* Background Blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#EF3E25]/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#5D248F]/10 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="max-w-4xl mx-auto relative z-10">
        <div className="text-center mb-12 animate-fade-in">
          <h1 className="text-5xl font-black text-white tracking-tighter mb-4">
            Initialize <span className="brand-text">MyProBuddy</span>
          </h1>
          <p className="text-lg text-white/40 font-medium accent-text tracking-wide">
            The Autonomous Documentation Agent for Modern SaaS
          </p>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Target & Identity */}
          <div className="lg:col-span-2 space-y-6">
            <div className="glass-card p-8 space-y-6 animate-slide-up">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <span className="w-2 h-6 bg-[#EF3E25] rounded-full"></span>
                Target Configuration
              </h3>
              
              <div className="space-y-2">
                <label className="text-xs font-bold text-white/40 uppercase tracking-widest">Site URL</label>
                <input
                  type="text"
                  required
                  className="input-field"
                  placeholder="https://app.yourproduct.com"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-white/40 uppercase tracking-widest">Username / Email</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="demo-user"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-white/40 uppercase tracking-widest">Password</label>
                  <input
                    type="password"
                    className="input-field"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="glass-card p-8 animate-slide-up" style={{ animationDelay: '0.1s' }}>
              <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <span className="w-2 h-6 bg-[#5D248F] rounded-full"></span>
                Technical Mapping
              </h3>
              
              {!isLoggedIn ? (
                <div className="text-center py-6 bg-white/5 rounded-xl border border-dashed border-white/10">
                  <p className="text-sm text-white/40 mb-4">Connect GitHub to enable the Technical Agent</p>
                  <button 
                    type="button"
                    onClick={handleGitHubLogin}
                    className="btn-purple flex items-center gap-2 mx-auto"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57bfs 0-1.065-.015-2.085c-3.33.72-4.035-1.605-4.035-1.605-.54-1.38-1.32-1.74-1.32-1.74-1.08-.735.09-.72.09-.72 1.201.084 1.83 1.23 1.83 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-.1.57-.1-2.655-.3-5.445-1.32-5.445-5.91 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.545 3.297-1.23 3.297-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.92 1.23 3.225 0 4.605-2.805 5.61-5.475 5.91.42.36.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
                    </svg>
                    Authorize GitHub
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-white/40 uppercase tracking-widest">Select Repository</label>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20">Connected</span>
                  </div>
                  <select
                    className="input-field appearance-none cursor-pointer"
                    value={selectedRepo}
                    onChange={(e) => setSelectedRepo(e.target.value)}
                    disabled={reposLoading}
                  >
                    <option value="">-- Choose Repository for Mapping --</option>
                    {repos.map(repo => (
                      <option key={repo.full_name} value={repo.full_name} className="bg-[#020205]">
                        {repo.full_name}
                      </option>
                    ))}
                  </select>
                  {reposLoading && <div className="shimmer h-1 w-full rounded mt-2"></div>}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Identity & Launch */}
          <div className="space-y-6">
            <div className="glass-card p-8 animate-slide-up" style={{ animationDelay: '0.2s' }}>
              <h3 className="text-xl font-bold text-white mb-6">Branding</h3>
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="aspect-square w-full rounded-2xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center cursor-pointer hover:bg-white/5 transition-all group relative overflow-hidden"
              >
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo Preview" className="w-full h-full object-contain p-4" />
                ) : (
                  <>
                    <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                      <svg className="w-6 h-6 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </div>
                    <span className="text-xs font-bold text-white/20 uppercase tracking-widest">Upload Custom Logo</span>
                  </>
                )}
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleLogoChange} 
                  className="hidden" 
                  accept="image/*"
                />
              </div>
              <p className="text-[10px] text-white/20 mt-4 text-center">Used for "User Manual" branding</p>
            </div>

            <div className="space-y-3 pt-4 animate-slide-up" style={{ animationDelay: '0.3s' }}>
              <button
                type="button"
                onClick={() => handleSubmit("user")}
                disabled={loading || !url}
                className="w-full btn-brand py-5 text-base flex flex-col items-center justify-center gap-1 active:scale-[0.98]"
              >
                <span className="text-lg">{loading ? "INITING..." : "BUILD USER MANUAL"}</span>
                <span className="text-[10px] opacity-60 font-normal uppercase">Visual Agent • Branded Docs</span>
              </button>

              <button
                type="button"
                onClick={() => handleSubmit("tech")}
                disabled={loading || !url || !selectedRepo}
                className="w-full btn-purple py-5 text-base flex flex-col items-center justify-center gap-1 active:scale-[0.98]"
              >
                <span className="text-lg">{loading ? "INITING..." : "MAP TECH ARCH"}</span>
                <span className="text-[10px] opacity-60 font-normal uppercase">Technical Agent • Code Logic</span>
              </button>
              
              <div className="p-4 bg-white/5 rounded-xl border border-white/5 backdrop-blur-sm">
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-[#EF3E25]/20 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-[#EF3E25] text-[10px] font-bold">!</span>
                  </div>
                  <p className="text-[10px] text-white/40 leading-relaxed italic">
                    AI will recursively explore tabs, buttons, and sub-menus to build the logic-base of your documentation.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewRun;
