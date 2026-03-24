import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const LandingPage = () => {
  const navigate = useNavigate();

  useEffect(() => {
    if (localStorage.getItem('auth_token')) {
      navigate('/dashboard');
    }
  }, [navigate]);

  return (
    <div className="min-h-screen bg-navy overflow-hidden relative">
      {/* Background Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-red-600/5 rounded-full blur-[120px] animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/5 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }}></div>

      {/* Header */}
      <header className="relative z-10 px-6 py-4 border-b border-white/5 bg-navy/50 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded bg-gradient-to-br from-[#ef3e25] to-[#5d248f] flex items-center justify-center font-black text-white shadow-[0_0_15px_rgba(239,62,37,0.3)] text-xs">M</div>
            <div>
              <h1 className="text-white font-black leading-none text-base tracking-tight font-heading">MyProBuddy</h1>
              <span className="text-[8px] text-[#ef3e25] font-bold tracking-[0.2em] uppercase accent-text">Manual AI</span>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <Link to="/dashboard" className="text-white/60 hover:text-white transition-all font-medium text-sm">Login</Link>
            <a href="/api/auth/github/login" className="btn-brand px-4 py-2 text-xs">
              Connect GitHub
            </a>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="relative z-10 max-w-7xl mx-auto px-6 pt-24 pb-32">
        <div className="text-center max-w-4xl mx-auto mb-16">
          <div className="inline-flex items-center space-x-2 px-3 py-1 bg-purple-500/10 border border-purple-500/20 rounded-full mb-8">
            <div className="w-1.5 h-1.5 bg-[#5d248f] rounded-full animate-pulse"></div>
            <span className="text-[10px] text-purple-400 font-bold uppercase tracking-wider accent-text">Official AI Product Hub</span>
          </div>
          
          <h2 className="text-6xl md:text-7xl font-bold text-white mb-8 tracking-tight leading-[1.05]">
            Generate Software Manuals <br />
            <span className="brand-text brand-glow italic">Automatically</span>
          </h2>
          
          <p className="text-xl text-white/40 mb-12 max-w-2xl mx-auto leading-relaxed">
            Enter any website URL, and AutoManual AI will explore it with visual reasoning, 
            mapping UI actions to your source code and generating complete manuals in seconds.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => navigate('/new-run')}
              className="btn-brand text-lg px-10 py-4 w-full sm:w-auto"
            >
              Start Generating
            </button>
            <button
              onClick={() => navigate('/dashboard')}
              className="btn-purple text-lg px-10 py-4 w-full sm:w-auto"
            >
              View Dashboard
            </button>
          </div>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {[
            { 
              title: "Autonomous Exploration", 
              desc: "Gemini 1.5 Pro analyzes your UI visually and decides how to navigate your app like a human.", 
              icon: "🧠" 
            },
            { 
              title: "Source Code Mapping", 
              desc: "Automatically maps UI actions to the underlying code in your GitHub repository.", 
              icon: "🔗" 
            },
            { 
              title: "Enterprize Documentation", 
              desc: "Generates high-end branded Word and PDF manuals ready for your customers.", 
              icon: "📄" 
            }
          ].map((feature, i) => (
            <div key={i} className="glass-card p-10 hover:border-red-500/30 hover:shadow-[0_0_30px_rgba(239,62,37,0.05)] transition-all duration-500 group">
              <div className="text-4xl mb-6 group-hover:scale-110 transition-transform duration-300 inline-block">{feature.icon}</div>
              <h3 className="text-white font-bold text-xl mb-4">{feature.title}</h3>
              <p className="text-white/40 leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>
      </main>

      {/* Background decoration */}
      <div className="absolute top-[15%] right-0 w-[500px] h-[500px] bg-red-600/5 rounded-full blur-[150px] pointer-events-none"></div>
    
      {/* Footer */}
      <footer className="relative z-10 text-center py-8 border-t border-white/5">
        <p className="text-xs text-white/20">© 2026 AutoManual AI. Built with precision.</p>
      </footer>
    </div>
  );
};

export default LandingPage;
