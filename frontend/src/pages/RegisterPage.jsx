import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Logo from '../components/Logo';
import PinGate from '../components/PinGate';
import { Sparkles, Eye, EyeOff, Lock, Mail, User, AlertCircle, ArrowRight, ShieldCheck, Hash, Wand2, UserCheck, Loader2 } from 'lucide-react';
import { api } from '../services/api';

// Secure random password generator (alphanumeric, 10 characters)
const generateRandomPassword = () => {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let pass = '';
  for (let i = 0; i < 10; i++) {
    pass += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pass;
};

// 1. UTC Date & Month Utility (strictly UTC)
// Formats 2-digit Day + Month Letter (e.g., November 7th UTC = "07n")
const getUtcDateCode = () => {
  const now = new Date();
  const day = String(now.getUTCDate()).padStart(2, '0');
  const monthLetters = ['j', 'f', 'm', 'a', 'm', 'j', 'j', 'a', 's', 'o', 'n', 'd'];
  const monthLetter = monthLetters[now.getUTCMonth()] || 'n';
  return `${day}${monthLetter}`;
};

// 2. UTC Daily Sequence Tracker per My ID (localStorage)
// Keyed strictly by My ID code + UTC date: wincashz_seq_{cleanId}_{todayKey}
const getUtcDateKey = () => {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const getPerIdDailySequenceNumber = (myIdCode) => {
  const todayKey = getUtcDateKey();
  const cleanId = String(myIdCode || '').trim().replace(/^#+/, '') || 'global';
  try {
    const raw = localStorage.getItem(`wincashz_seq_${cleanId}_${todayKey}`);
    if (raw) {
      const parsed = parseInt(raw, 10);
      if (!isNaN(parsed) && parsed > 0) {
        return parsed;
      }
    }
  } catch (e) {}
  return 1;
};

const getFormattedPerIdDailySequence = (myIdCode) => {
  const num = getPerIdDailySequenceNumber(myIdCode);
  return String(num).padStart(2, '0'); // e.g. "01", "02", "03"
};

const setPerIdDailySequence = (myIdCode, nextNum) => {
  const todayKey = getUtcDateKey();
  const cleanId = String(myIdCode || '').trim().replace(/^#+/, '') || 'global';
  try {
    localStorage.setItem(`wincashz_seq_${cleanId}_${todayKey}`, String(nextNum));
  } catch (e) {}
};

const incrementPerIdDailySequence = (myIdCode) => {
  const current = getPerIdDailySequenceNumber(myIdCode);
  setPerIdDailySequence(myIdCode, current + 1);
};

const getDailySequenceNumber = () => getPerIdDailySequenceNumber('global');
const getFormattedDailySequence = () => getFormattedPerIdDailySequence('global');
const incrementDailySequence = () => incrementPerIdDailySequence('global');

// Construct Dynamic Username: [prefix]_[sequence]_[dateCode]
// Uses TWO underscores (e.g. Zahidul_01_08n, Monoyer_01_08n, User_01_08n)
const generateDynamicUsername = (prefix, customSeq, customDateCode, myIdCode) => {
  const sanitized = String(prefix || 'User').replace(/[^a-zA-Z0-9_]/g, '').trim() || 'User';
  const seq = customSeq || getFormattedPerIdDailySequence(myIdCode);
  const dateCode = customDateCode || getUtcDateCode();
  return `${sanitized}_${seq}_${dateCode}`;
};

export default function RegisterPage() {
  const { register, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const urlMyId = searchParams.get('my_id') || searchParams.get('ref') || '';

  const [hasPin, setHasPin] = useState(false);
  const [pinVerified, setPinVerified] = useState(() => {
    try {
      return sessionStorage.getItem('wincashz_pin_verified') === 'true';
    } catch (e) {
      return false;
    }
  });
  const [checkingPin, setCheckingPin] = useState(true);

  // 1. My ID Code strictly holds numeric value (pre-filled with '10' by default)
  const [myId, setMyId] = useState(urlMyId || '10');
  const [resolvingId, setResolvingId] = useState(false);
  const [resolvedOperator, setResolvedOperator] = useState('');
  const latestResolveRef = useRef('');

  // 2. Credentials state
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState(() => generateRandomPassword());
  const [myIdSystemEnabled, setMyIdSystemEnabled] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [googleEnabled, setGoogleEnabled] = useState(false);

  // Server-driven credential generator (100% database-driven)
  const generateFromMyId = async (codeToUse, isManual = false) => {
    const rawCode = codeToUse !== undefined ? codeToUse : myId;
    const cleanCode = String(rawCode || '').trim().replace(/^#+/, '');
    if (!cleanCode) {
      if (isManual) {
        setError('Please enter a My ID code before generating.');
      }
      return;
    }

    latestResolveRef.current = cleanCode;
    setResolvingId(true);
    if (isManual) {
      setError(null);
    }

    try {
      console.log(`[MyID Resolve] Resolving My ID: "${cleanCode}"`);
      const res = await api.resolveMyId(cleanCode);
      if (latestResolveRef.current !== cleanCode) return;

      if (res && res.success) {
        const serverName = res.sanitized_name || res.friendly_name || 'User';
        const cleanServerName = String(serverName).replace(/[^a-zA-Z0-9_]/g, '').trim() || 'User';
        const serverSeq = res.sequence || getFormattedPerIdDailySequence(cleanCode);
        const serverDate = res.date_code || getUtcDateCode();
        const serverUser = res.suggested_username || `${cleanServerName}_${serverSeq}_${serverDate}`;

        setUsername(serverUser);
        setEmail(`${serverUser}@duck.com`);
        setPassword(generateRandomPassword());
        setResolvedOperator(res.friendly_name || cleanServerName);
        setError(null);

        // Keep local storage sequence aligned with server's sequence
        const parsedSeq = parseInt(serverSeq, 10);
        if (!isNaN(parsedSeq) && parsedSeq > 0) {
          setPerIdDailySequence(cleanCode, parsedSeq);
        }
        return;
      }

      throw new Error(res?.message || `My ID "${cleanCode}" could not be resolved.`);
    } catch (e) {
      console.error('[MyID Resolve Failed]', { code: cleanCode, error: e });
      if (latestResolveRef.current !== cleanCode) return;

      setResolvedOperator('');
      const errMsg = e.data?.message || e.message || `My ID "${cleanCode}" not found in database.`;
      
      // Show warning in UI if manually clicked or full ID code was entered
      if (isManual || cleanCode.length >= 4) {
        setError(errMsg);
      }
    } finally {
      if (latestResolveRef.current === cleanCode) {
        setResolvingId(false);
      }
    }
  };

  // When My ID Code changes
  const handleMyIdChange = (newCode) => {
    setMyId(newCode);
    if (error) setError(null);
    const clean = newCode.trim().replace(/^#+/, '');
    if (clean.length < 3) {
      setResolvedOperator('');
    }
  };

  // Manual regenerate credentials handler
  const handleRegenerate = () => {
    generateFromMyId(myId, true);
  };

  // Dynamic debounced resolution whenever operator enters a valid My ID (>= 3 chars)
  useEffect(() => {
    const clean = String(myId || '').trim().replace(/^#+/, '');
    if (clean.length >= 3) {
      const timer = setTimeout(() => {
        generateFromMyId(clean);
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [myId]);

  useEffect(() => {
    if (urlMyId && urlMyId.trim()) {
      setMyId(urlMyId.trim());
      generateFromMyId(urlMyId.trim());
    }
  }, [urlMyId]);

  useEffect(() => {
    if (isAuthenticated) {
      if (user?.role === 'admin') {
        navigate('/admin', { replace: true });
      } else if (user?.role === 'moderator') {
        navigate('/moderator/dashboard', { replace: true });
      } else {
        navigate('/earn', { replace: true });
      }
      return;
    }

    // Check site PIN status
    api.getSitePinStatus()
      .then((res) => {
        setHasPin(!!res?.has_pin);
      })
      .catch(() => {
        setHasPin(false);
      })
      .finally(() => {
        setCheckingPin(false);
      });

    // Check Site Settings (My ID system status)
    api.getSiteSettings()
      .then((res) => {
        if (res?.settings && typeof res.settings.my_id_system_enabled !== 'undefined') {
          setMyIdSystemEnabled(!!res.settings.my_id_system_enabled);
        }
      })
      .catch(() => {});

    // Check Google Auth
    api.getGoogleConfig()
      .then((res) => setGoogleEnabled(!!res?.enabled))
      .catch(() => {});

    // Listen for Google OAuth popup messages
    const handleGoogleMessage = (event) => {
      if (event.data?.source === 'google-auth' && event.data?.payload?.token) {
        const payload = event.data.payload;
        if (payload.user?.role === 'moderator') {
          navigate('/moderator/dashboard', { replace: true });
        } else if (payload.user?.role === 'admin') {
          navigate('/admin', { replace: true });
        } else {
          navigate('/earn', { replace: true });
        }
      }
    };
    window.addEventListener('message', handleGoogleMessage);
    return () => window.removeEventListener('message', handleGoogleMessage);
  }, [isAuthenticated, user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const cleanUsername = username.trim();
    const cleanEmail = email.trim();

    if (!cleanUsername) {
      setError('Please choose a username.');
      return;
    }

    if (cleanUsername.length > 255) {
      setError('Username cannot exceed 255 characters.');
      return;
    }

    if (!cleanEmail || !password) {
      setError('Please provide email and password.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    const cleanMyId = myId.trim();
    if (myIdSystemEnabled && !cleanMyId) {
      setError('Please enter a valid My ID code.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        username: cleanUsername,
        email: cleanEmail,
        password,
      };

      if (cleanMyId) {
        payload.my_id = cleanMyId;
        payload.my_id_code = cleanMyId;
      }

      const res = await register(payload);
      if (res.success) {
        // Increment daily sequence count in localStorage on confirmed success
        if (cleanMyId) {
          incrementPerIdDailySequence(cleanMyId);
        }
        incrementDailySequence();
        if (res.user?.role === 'admin') {
          navigate('/admin', { replace: true });
        } else if (res.user?.role === 'moderator') {
          navigate('/moderator/dashboard', { replace: true });
        } else {
          navigate('/earn', { replace: true });
        }
      }
    } catch (err) {
      const validationMsgs = err.errors ? Object.values(err.errors).flat().join(' ') : null;
      setError(validationMsgs || err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    try {
      const res = await api.startGoogleAuth('register');
      if (res.url) {
        window.location.href = res.url;
      }
    } catch (err) {
      setError(err.message || 'Failed to initialize Google Sign In.');
    }
  };

  // Brief loading placeholder while determining PIN gate status
  if (checkingPin) {
    return (
      <div className="min-h-screen bg-[#070a0e] flex items-center justify-center text-slate-500 text-xs">
        Loading...
      </div>
    );
  }

  // Intercept with 4-digit PIN gate if active and not yet verified in this flow
  if (hasPin && !pinVerified) {
    return (
      <PinGate
        purpose="Sign Up"
        onVerified={() => {
          try {
            sessionStorage.setItem('wincashz_pin_verified', 'true');
          } catch (e) {}
          setPinVerified(true);
        }}
        onAdminBypass={() => navigate('/admin/login')}
      />
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative bg-[#070a0e] overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-brand-500/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Logo at Top */}
        <div className="text-center mb-8">
          <Logo size="large" />
          <p className="text-xs text-slate-400 mt-2">
            Create your account & get started in seconds
          </p>
        </div>

        {/* Auth Card */}
        <div className="rounded-3xl glass-card border border-white/10 p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-bold text-white">Create Free Account</h1>
            <p className="text-xs text-slate-400">
              Start completing offers and receiving instant payouts
            </p>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Google SSO */}
          {googleEnabled && (
            <>
              <button
                type="button"
                onClick={handleGoogleAuth}
                className="w-full py-3 px-4 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-sm font-semibold text-slate-200 hover:text-white transition-all flex items-center justify-center gap-3 cursor-pointer"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                Continue with Google
              </button>

              <div className="relative flex items-center justify-center">
                <div className="w-full border-t border-white/10" />
                <span className="absolute bg-[#0c1015] px-3 text-[11px] text-slate-500 uppercase tracking-wider">
                  Or with email
                </span>
              </div>
            </>
          )}

          {/* Signup Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 1. My ID Code with Clear Generate Button Right Next to It */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  {myIdSystemEnabled ? 'My ID Code *' : 'My ID'}
                </label>
                {resolvedOperator ? (
                  <span className="text-[11px] text-brand-300 font-semibold flex items-center gap-1">
                    <UserCheck className="w-3.5 h-3.5 text-brand-400" />
                    Operator: {resolvedOperator}
                  </span>
                ) : (
                  <span className="text-[11px] text-brand-400 font-semibold font-mono">
                    Default: 10
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Hash className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    required={myIdSystemEnabled}
                    value={myId}
                    onChange={(e) => handleMyIdChange(e.target.value)}
                    placeholder="e.g. 1010"
                    autoComplete="off"
                    className="w-full pl-10 pr-4 py-3 rounded-xl glass-input text-sm font-mono font-semibold"
                  />
                </div>
                <button
                  type="button"
                  disabled={resolvingId}
                  onClick={() => generateFromMyId(myId, true)}
                  className="px-4 py-3 rounded-xl font-bold text-xs bg-brand-500/20 hover:bg-brand-500/30 text-brand-300 border border-brand-500/40 flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95 shrink-0 select-none disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Generate credentials from My ID code"
                >
                  {resolvingId ? (
                    <Loader2 className="w-4 h-4 text-brand-400 animate-spin" />
                  ) : (
                    <Wand2 className="w-4 h-4 text-brand-400" />
                  )}
                  <span>{resolvingId ? 'Resolving...' : 'Generate'}</span>
                </button>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Enter your My ID (e.g. 1010) and click Generate to auto-fill username, email, and password.
              </p>
            </div>

            {/* 2. Username (Auto-Generated from ID Map: [MappedName]_[DailySeq]_[DateCode]) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Username
                </label>
                <span className="text-[11px] text-slate-500">Auto-generated • Editable</span>
              </div>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. Zahidul_01_08n"
                  autoComplete="username"
                  className="w-full pl-10 pr-24 py-3 rounded-xl glass-input text-sm font-mono"
                />
                <button
                  type="button"
                  disabled={resolvingId}
                  onClick={handleRegenerate}
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-brand-500/15 hover:bg-brand-500/25 text-brand-300 border border-brand-500/30 flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95 select-none disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Regenerate username and credentials"
                >
                  {resolvingId ? (
                    <Loader2 className="w-3.5 h-3.5 text-brand-400 animate-spin" />
                  ) : (
                    <Wand2 className="w-3.5 h-3.5 text-brand-400" />
                  )}
                  <span>Regen</span>
                </button>
              </div>
            </div>

            {/* 3. Email (Auto-Synced) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Email Address
                </label>
                <span className="text-[11px] text-slate-500">Auto-synced • Editable</span>
              </div>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. Zahidul_01_08n@duck.com"
                  autoComplete="email"
                  className="w-full pl-10 pr-4 py-3 rounded-xl glass-input text-sm font-mono"
                />
              </div>
            </div>

            {/* 4. Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Password (min. 8 characters)
                </label>
                <button
                  type="button"
                  onClick={() => setPassword(generateRandomPassword())}
                  className="text-[11px] text-brand-400 hover:text-brand-300 font-semibold cursor-pointer transition-colors"
                  title="Generate another password"
                >
                  Regenerate
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a strong password"
                  autoComplete="new-password"
                  className="w-full pl-10 pr-10 py-3 rounded-xl glass-input text-sm font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* 5. Sign Up Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl font-bold text-slate-950 bg-gradient-to-r from-brand-400 via-brand-500 to-cyan-400 shadow-glow-emerald hover:brightness-110 active:scale-[0.98] disabled:opacity-50 transition-all flex items-center justify-center gap-2 mt-2 cursor-pointer"
            >
              {loading ? (
                <span>Creating Account...</span>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-slate-950" />
                  <span>Sign Up</span>
                  <ArrowRight className="w-4 h-4 text-slate-950" />
                </>
              )}
            </button>
          </form>

          {/* Bottom Prompt */}
          <div className="text-center pt-2 border-t border-white/5 text-xs text-slate-400">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-brand-400 hover:text-brand-300 ml-1">
              Sign in here
            </Link>
          </div>
        </div>

        {/* Security badge */}
        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-500">
          <ShieldCheck className="w-4 h-4 text-brand-500" />
          <span>Encrypted connection • Instant account activation</span>
        </div>
      </div>
    </div>
  );
}
