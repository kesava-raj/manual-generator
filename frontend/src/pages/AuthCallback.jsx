/**
 * Auth callback and token management for frontend
 */
import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      localStorage.setItem('auth_token', token);
      navigate('/dashboard');
    } else {
      navigate('/');
    }
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen bg-[#020205] flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-[#ef3e25]/30 border-t-[#ef3e25] rounded-full animate-spin mx-auto mb-6"></div>
        <p className="text-white/40 font-bold uppercase tracking-widest text-xs accent-text">Finalizing MyProBuddy Session...</p>
      </div>
    </div>
  );
}

export default AuthCallback;
