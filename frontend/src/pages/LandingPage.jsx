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
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500/5 rounded-full blur-[120px] animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-cyan-500/5 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }}></div>

      {/* Header */}
      <header className="relative z-10 px-6 py-4 border-b border-white/5 bg-navy/50 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded bg-gradient-to-br from-indigo-500 to-cyan-400 flex items-center justify-center font-bold text-white shadow-[0_0_15px_rgba(99,102,241,0.3)] text-sm">A</div>
            <div>
              <h1 className="text-white font-bold leading-none text-sm">AutoManual</h1>
              <span className="text-[8px] text-indigo-400 font-medium tracking-widest uppercase">AI Agent</span>
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
          <div className="inline-flex items-center space-x-2 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full mb-8">
            <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-pulse"></div>
            <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider">Powered by Gemini 1.5 Pro</span>
          </div>
          
          <h2 className="text-6xl md:text-7xl font-bold text-white mb-8 tracking-tight leading-[1.05]">
            Generate Software Manuals <br />
            <span className="brand-text brand-glow italic">Automatically</span>
          </h2>
          
          <p className="text-xl text-white/40 mb-12 max-w-2xl mx-auto leading-relaxed">
            Enter any website URL, and AutoManual AI will explore it with visual reasoning, 
            mapping UI actions to your source code and generating complete manuals in seconds.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center space-x-0 sm:space-x-6 space-y-4 sm:space-y-0">
            <button 
              onClick={() => navigate('/new-run')}
              className="btn-brand px-10 py-5 text-base w-full sm:w-auto"
            >
              Start AI Agent →
            </button>
            <a 
              href="/api/auth/github/login"
              className="px-10 py-5 bg-white/5 border border-white/10 text-white font-bold rounded-xl hover:bg-white/10 transition-all duration-300 w-full sm:w-auto flex items-center justify-center space-x-3"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
              </svg>
              <span>Connect GitHub</span>
            </a>
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
            <div key={i} className="glass-card p-10 hover:border-indigo-500/30 hover:shadow-[0_0_30px_rgba(99,102,241,0.05)] transition-all duration-500 group">
              <div className="text-4xl mb-6 group-hover:scale-110 transition-transform duration-300 inline-block">{feature.icon}</div>
              <h3 className="text-white font-bold text-xl mb-4">{feature.title}</h3>
              <p className="text-white/40 leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>
      </main>

      {/* Background decoration */}
      <div className="absolute top-[15%] right-0 w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-[150px] pointer-events-none"></div>
    
      {/* Footer */}
      <footer className="relative z-10 text-center py-8 border-t border-white/5">
        <p className="text-xs text-white/20">© 2026 AutoManual AI. Built with precision.</p>
      </footer>
    </div>
  );
};

export default LandingPage;
