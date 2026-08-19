import React, { useState } from 'react';
import {
  signInWithGoogle,
  signInWithEmail,
  registerWithEmail,
  sendPasswordReset
} from '../../services/authService';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const [mode, setMode] = useState<'signin' | 'register' | 'forgot'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const resetForm = () => {
    setError(null);
    setSuccessMsg(null);
    setEmail('');
    setPassword('');
    setName('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setIsLoading(true);
    try {
      await signInWithGoogle();
      handleClose();
    } catch (err: any) {
      console.error("Google login error:", err);
      setError(err.message || "Failed to sign in with Google.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!email) {
      setError("Please enter your email address.");
      return;
    }

    if (mode !== 'forgot' && !password) {
      setError("Please enter your password.");
      return;
    }

    setIsLoading(true);

    try {
      if (mode === 'signin') {
        await signInWithEmail(email, password);
        handleClose();
      } else if (mode === 'register') {
        if (password.length < 6) {
          setError("Password must be at least 6 characters.");
          setIsLoading(false);
          return;
        }
        await registerWithEmail(email, password, name);
        handleClose();
      } else if (mode === 'forgot') {
        await sendPasswordReset(email);
        setSuccessMsg("Password reset email sent! Check your inbox.");
        setIsLoading(false);
      }
    } catch (err: any) {
      console.error("Auth error:", err);
      let friendlyMessage = err.message || "An error occurred. Please try again.";
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        friendlyMessage = "Incorrect email or password. Please check your credentials.";
      } else if (err.code === 'auth/email-already-in-use') {
        friendlyMessage = "An account with this email already exists. Try signing in instead.";
      } else if (err.code === 'auth/weak-password') {
        friendlyMessage = "Password is too weak. Please use at least 6 characters.";
      } else if (err.code === 'auth/invalid-email') {
        friendlyMessage = "Please enter a valid email address.";
      }
      setError(friendlyMessage);
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="px-6 pt-5 pb-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="bg-emerald-500/10 text-emerald-400 p-2 rounded-xl border border-emerald-500/20">
              <i className="fa-solid fa-cloud-arrow-up text-base"></i>
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-100">
                {mode === 'signin' && "Sign In to RV SafePath"}
                {mode === 'register' && "Create an Account"}
                {mode === 'forgot' && "Reset Your Password"}
              </h3>
              <p className="text-xs text-slate-400">
                {mode === 'forgot' ? "Enter your email to receive a password reset link" : "Sync your RV specs & trips across all your devices"}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-200 hover:bg-slate-800 p-1.5 rounded-lg transition"
          >
            <i className="fa-solid fa-xmark text-sm"></i>
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-4">
          {/* Error Message */}
          {error && (
            <div className="bg-red-950/60 border border-red-800/80 text-red-300 text-xs px-3.5 py-2.5 rounded-xl flex items-start gap-2">
              <i className="fa-solid fa-triangle-exclamation mt-0.5 text-red-400 shrink-0"></i>
              <span>{error}</span>
            </div>
          )}

          {/* Success Message */}
          {successMsg && (
            <div className="bg-emerald-950/60 border border-emerald-800/80 text-emerald-300 text-xs px-3.5 py-2.5 rounded-xl flex items-start gap-2">
              <i className="fa-solid fa-circle-check mt-0.5 text-emerald-400 shrink-0"></i>
              <span>{successMsg}</span>
            </div>
          )}

          {mode !== 'forgot' && (
            <>
              {/* 1-Click Google Sign-In */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isLoading}
                className="w-full bg-slate-800 hover:bg-slate-700/90 text-slate-100 border border-slate-700 hover:border-slate-600 font-semibold py-2.5 px-4 rounded-xl flex items-center justify-center gap-3 transition shadow-sm disabled:opacity-50 text-sm"
              >
                <i className="fa-brands fa-google text-emerald-400 text-base"></i>
                <span>Continue with Google</span>
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3 my-2">
                <div className="flex-1 h-px bg-slate-800"></div>
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">or with email</span>
                <div className="flex-1 h-px bg-slate-800"></div>
              </div>
            </>
          )}

          {/* Email / Password Form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === 'register' && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Your Name (Optional)</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. John"
                  className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 transition"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 transition"
              />
            </div>

            {mode !== 'forgot' && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-300">Password</label>
                  {mode === 'signin' && (
                    <button
                      type="button"
                      onClick={() => { resetForm(); setMode('forgot'); }}
                      className="text-[11px] text-emerald-400 hover:underline"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 transition"
                />
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 px-4 rounded-xl transition shadow-lg shadow-emerald-950/50 flex items-center justify-center gap-2 text-sm disabled:opacity-50 mt-4"
            >
              {isLoading ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin"></i>
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  {mode === 'signin' && <span>Sign In</span>}
                  {mode === 'register' && <span>Create Free Account</span>}
                  {mode === 'forgot' && <span>Send Reset Link</span>}
                </>
              )}
            </button>
          </form>

          {/* Toggle between Sign In / Register / Back to Sign In */}
          <div className="pt-2 text-center text-xs text-slate-400">
            {mode === 'signin' && (
              <p>
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => { resetForm(); setMode('register'); }}
                  className="text-emerald-400 font-semibold hover:underline"
                >
                  Create Account
                </button>
              </p>
            )}

            {mode === 'register' && (
              <p>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => { resetForm(); setMode('signin'); }}
                  className="text-emerald-400 font-semibold hover:underline"
                >
                  Sign In
                </button>
              </p>
            )}

            {mode === 'forgot' && (
              <button
                type="button"
                onClick={() => { resetForm(); setMode('signin'); }}
                className="text-emerald-400 font-semibold hover:underline flex items-center gap-1.5 mx-auto"
              >
                <i className="fa-solid fa-arrow-left text-[10px]"></i>
                <span>Back to Sign In</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
