import React, { useState, useEffect } from 'react';

export default function App() {
  const [meta, setMeta] = useState({
    categories: [],
    presets: [],
    regions: ['All'],
    years: [2026],
    defaultYear: 2026
  });

  const [preferences, setPreferences] = useState({});
  const [year, setYear] = useState(2026);
  const [region, setRegion] = useState('All');
  const [results, setResults] = useState([]);
  const [totalEvaluated, setTotalEvaluated] = useState(0);
  const [loading, setLoading] = useState(false);
  const [activePreset, setActivePreset] = useState(null);
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [lastChangedKey, setLastChangedKey] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Authentication & User State
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('globematch_token') || null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'register'
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' });
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authNotice, setAuthNotice] = useState('');
  const [toast, setToast] = useState(null);
  const [showPrevSelectionBanner, setShowPrevSelectionBanner] = useState(true);
  const [savingPriorities, setSavingPriorities] = useState(false);
  const [pendingSuitableCountry, setPendingSuitableCountry] = useState(null);

  // Toast Helper
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4500);
  };

  // Check and restore user session from JWT token on mount
  useEffect(() => {
    if (token) {
      fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then((res) => {
          if (!res.ok) throw new Error('Session expired');
          return res.json();
        })
        .then((data) => {
          if (data.user) {
            setUser(data.user);
            setShowPrevSelectionBanner(true);

            // Restore user's previous preferences if they exist
            if (data.user.preferences && Object.keys(data.user.preferences).length > 0) {
              setPreferences(data.user.preferences);
            }
            if (data.user.preferredRegion) {
              setRegion(data.user.preferredRegion);
            }
            if (data.user.preferredYear) {
              setYear(data.user.preferredYear);
            }
            if (data.user.activePreset) {
              setActivePreset(data.user.activePreset);
            }

            showToast(`Welcome back, ${data.user.name}! Your previous selections were restored.`);
          }
        })
        .catch(() => {
          // Token invalid or expired
          localStorage.removeItem('globematch_token');
          setToken(null);
          setUser(null);
        });
    }
  }, [token]);

  // Apply preset helper
  const applyPreset = (preset, categoriesList = meta.categories) => {
    setActivePreset(preset.id);
    const newPrefs = {};
    const catList = categoriesList || meta.categories;
    catList.forEach((cat) => {
      newPrefs[cat.key] = preset.weights[cat.key] || 0;
    });
    setPreferences(newPrefs);
  };

  // Fetch metadata on mount
  useEffect(() => {
    fetch('/api/meta')
      .then((res) => res.json())
      .then((data) => {
        setMeta(data);
        if (data.defaultYear && !user) setYear(data.defaultYear);

        // Initialize with first preset only if user has no saved preferences yet
        if (!user || !user.preferences || Object.keys(user.preferences).length === 0) {
          if (data.presets && data.presets.length > 0) {
            applyPreset(data.presets[0], data.categories);
          } else if (data.categories) {
            const initial = {};
            data.categories.forEach((cat) => (initial[cat.key] = 0));
            setPreferences(initial);
          }
        }
      })
      .catch((err) => {
        console.error('Error loading metadata:', err);
        setErrorMsg('Unable to connect to the backend server. Please verify it is running on port 5000.');
      });
  }, []);

  // Compute total allocated points
  const totalPoints = Object.values(preferences).reduce((sum, val) => sum + (Number(val) || 0), 0);
  const remainingPoints = 100 - totalPoints;

  // Slider change handler
  const handleSliderChange = (key, value) => {
    setActivePreset(null);
    setLastChangedKey(key);
    const val = Math.max(0, Math.min(100, parseInt(value, 10) || 0));
    setPreferences((prev) => ({
      ...prev,
      [key]: val
    }));
  };

  // Quick increment/decrement
  const handleStep = (key, delta) => {
    setActivePreset(null);
    setLastChangedKey(key);
    setPreferences((prev) => {
      const current = prev[key] || 0;
      const next = Math.max(0, Math.min(100, current + delta));
      return { ...prev, [key]: next };
    });
  };

  // Normalize active weights to exactly 100
  const handleNormalize = () => {
    if (totalPoints === 0) return;
    const factor = 100 / totalPoints;
    let accumulated = 0;
    const activeKeys = Object.keys(preferences).filter((k) => preferences[k] > 0);
    const newPrefs = { ...preferences };

    activeKeys.forEach((k, idx) => {
      if (idx === activeKeys.length - 1) {
        newPrefs[k] = Math.max(0, 100 - accumulated);
      } else {
        const scaled = Math.round(preferences[k] * factor);
        newPrefs[k] = scaled;
        accumulated += scaled;
      }
    });
    setPreferences(newPrefs);
  };

  // Auto-fill remainder into target category
  const handleAutoFillRemainder = () => {
    if (remainingPoints === 0) return;
    const targetKey = lastChangedKey || Object.keys(preferences).find((k) => preferences[k] > 0) || meta.categories[0]?.key;
    if (!targetKey) return;

    setPreferences((prev) => ({
      ...prev,
      [targetKey]: Math.max(0, (prev[targetKey] || 0) + remainingPoints)
    }));
  };

  // Reset all to 0
  const handleReset = () => {
    setActivePreset(null);
    const resetPrefs = {};
    meta.categories.forEach((cat) => (resetPrefs[cat.key] = 0));
    setPreferences(resetPrefs);
  };

  // Rank countries API call
  const fetchRankings = async () => {
    if (totalPoints <= 0) {
      setErrorMsg('Please allocate points to at least one category.');
      return;
    }
    setErrorMsg('');
    setLoading(true);

    try {
      const response = await fetch('/api/rank-countries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preferences,
          year,
          region,
          limit: 30
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch rankings');
      }

      setResults(data.results || []);
      setTotalEvaluated(data.totalEvaluated || 0);
    } catch (err) {
      setErrorMsg(err.message || 'Error occurred while ranking countries.');
    } finally {
      setLoading(false);
    }
  };

  // Auto-fetch on preset change or filters
  useEffect(() => {
    if (totalPoints > 0 && meta.categories.length > 0) {
      fetchRankings();
    }
  }, [activePreset, region, year]);

  // Handle Authentication (Login / Register)
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/register';
    const payload = authMode === 'login'
      ? { email: authForm.email, password: authForm.password }
      : {
          name: authForm.name,
          email: authForm.email,
          password: authForm.password,
          preferences,
          activePreset,
          preferredRegion: region,
          preferredYear: year,
          selectedCountry: pendingSuitableCountry || user?.selectedCountry || null
        };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      // Successful login/register
      localStorage.setItem('globematch_token', data.token);
      setToken(data.token);
      setUser(data.user);
      setShowAuthModal(false);
      setAuthForm({ name: '', email: '', password: '' });
      setAuthNotice('');
      setShowPrevSelectionBanner(true);

      // If pending country selection was queued before login, save it now
      if (pendingSuitableCountry) {
        await saveCountrySelection(pendingSuitableCountry, data.token);
        setPendingSuitableCountry(null);
      } else if (data.user.preferences && Object.keys(data.user.preferences).length > 0) {
        // Restore user's previous preferences
        setPreferences(data.user.preferences);
        if (data.user.preferredRegion) setRegion(data.user.preferredRegion);
        if (data.user.preferredYear) setYear(data.user.preferredYear);
        if (data.user.activePreset) setActivePreset(data.user.activePreset);
      }

      showToast(
        authMode === 'login'
          ? `Welcome back, ${data.user.name}! That is your previous selection restored.`
          : `Account created! Welcome to GlobeMatch, ${data.user.name}.`,
        'success'
      );
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  // Sign out
  const handleLogout = () => {
    localStorage.removeItem('globematch_token');
    setToken(null);
    setUser(null);
    setShowPrevSelectionBanner(false);
    showToast('You have signed out successfully.', 'info');
  };

  // Save or Select Suitable Country API
  const saveCountrySelection = async (countryItem, currentAuthToken = token) => {
    try {
      const res = await fetch('/api/user/select-country', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${currentAuthToken}`
        },
        body: JSON.stringify({
          country: countryItem.country,
          region: countryItem.region,
          matchScore: countryItem.matchScore,
          rank: countryItem.rank,
          currentPreferences: preferences
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update suitable country');
      }

      setUser(data.user);
      setShowPrevSelectionBanner(true);
      showToast(`⭐ ${countryItem.country} selected as your suitable country!`, 'success');
    } catch (err) {
      showToast(err.message || 'Error saving suitable country', 'error');
    }
  };

  // Trigger suitable country selection from UI
  const handleSelectSuitableCountry = (countryItem) => {
    if (!user) {
      setPendingSuitableCountry(countryItem);
      setAuthMode('login');
      setAuthNotice(`Please sign in or create an account to select ${countryItem.country} as your suitable country.`);
      setShowAuthModal(true);
      return;
    }

    saveCountrySelection(countryItem);
  };

  // Save Current Priorities Profile to Database
  const handleSavePriorities = async () => {
    if (!user) {
      setAuthMode('login');
      setAuthNotice('Please sign in to save your priorities profile.');
      setShowAuthModal(true);
      return;
    }

    setSavingPriorities(true);
    try {
      const res = await fetch('/api/user/save-selection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          preferences,
          activePreset,
          preferredRegion: region,
          preferredYear: year
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save priorities');
      }

      setUser(data.user);
      showToast('Your priorities have been saved to your account!', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to save priorities', 'error');
    } finally {
      setSavingPriorities(false);
    }
  };

  // Restore saved priorities from user profile
  const handleRestoreUserPriorities = () => {
    if (!user || !user.preferences) return;
    setPreferences(user.preferences);
    if (user.preferredRegion) setRegion(user.preferredRegion);
    if (user.preferredYear) setYear(user.preferredYear);
    if (user.activePreset) setActivePreset(user.activePreset);
    showToast('Previous priorities restored into sliders!', 'info');
  };

  // Filtered results for search
  const filteredResults = results.filter((r) =>
    r.country.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.region.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Check if a country is the user's selected suitable country
  const isSelectedCountry = (countryName) => {
    return user?.selectedCountry?.country === countryName;
  };

  // Collect prioritized categories for display in banner
  const getPrioritizedCategories = (prefs) => {
    if (!prefs) return [];
    return Object.entries(prefs)
      .filter(([, weight]) => Number(weight) > 0)
      .map(([key, weight]) => {
        const cat = meta.categories.find((c) => c.key === key);
        return {
          key,
          label: cat?.label || key,
          icon: cat?.icon || '🔹',
          weight
        };
      })
      .sort((a, b) => b.weight - a.weight);
  };

  return (
    <div className="app-container">
      {/* Top Navigation & User Header */}
      <nav className="top-nav-bar">
        <div className="brand-identity">
          <span className="brand-logo-icon">🌍</span>
          <span>GlobeMatch</span>
        </div>

        <div className="nav-auth-actions">
          {user ? (
            <>
              {user.selectedCountry?.country && (
                <div className="user-suitable-quickpill" title="Your currently selected suitable country">
                  <span>⭐ Suitable Country:</span>
                  <strong>{user.selectedCountry.country}</strong>
                  {user.selectedCountry.matchScore && (
                    <span>({user.selectedCountry.matchScore}%)</span>
                  )}
                </div>
              )}

              <button
                className="btn-save-priorities-pill"
                onClick={handleSavePriorities}
                disabled={savingPriorities}
                title="Save current slider weights to your profile"
              >
                <span>💾</span>
                <span>{savingPriorities ? 'Saving...' : 'Save Priorities'}</span>
              </button>

              <div className="user-profile-badge">
                <div className="user-avatar-circle">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div className="user-info-text">
                  <span className="user-display-name">{user.name}</span>
                  <span className="user-display-email">{user.email}</span>
                </div>
              </div>

              <button className="btn-nav-logout" onClick={handleLogout} title="Sign out">
                Sign Out
              </button>
            </>
          ) : (
            <>
              <button
                className="btn-nav-auth-login"
                onClick={() => {
                  setAuthMode('login');
                  setAuthNotice('');
                  setShowAuthModal(true);
                }}
              >
                Sign In
              </button>
              <button
                className="btn-nav-auth-signup"
                onClick={() => {
                  setAuthMode('register');
                  setAuthNotice('');
                  setShowAuthModal(true);
                }}
              >
                Create Free Account
              </button>
            </>
          )}
        </div>
      </nav>

      {/* Hero Header */}
      <header className="hero-header">
        <div className="brand-badge">
          Personalized Quality of Life & Destination Finder
        </div>
        <h1 className="hero-title">Find Your Ideal Country</h1>
        <p className="hero-subtitle">
          Distribute 100 points across global indices to discover the nations matching your priorities.
          Sign in to save your personal preferences and suitable country destination!
        </p>

        <div className="stats-ribbon">
          <span><strong>5,850+</strong> Records</span>
          <span>•</span>
          <span><strong>217</strong> Nations</span>
          <span>•</span>
          <span><strong>12</strong> Indices</span>
          <span>•</span>
          <span>Evaluation Year: <strong>{year}</strong></span>
        </div>
      </header>

      {/* Prominent "That is your previous selection" Banner */}
      {user && showPrevSelectionBanner && (user.selectedCountry?.country || (user.preferences && Object.keys(user.preferences).length > 0)) && (
        <section className="previous-selection-banner" aria-label="Previous Selection">
          <div className="prev-banner-header">
            <div className="prev-banner-badge">
              <span>✓ Stored User Profile</span>
            </div>
            <h2 className="prev-banner-title">
              <span>⭐ That is your previous selection</span>
            </h2>
            <button
              className="btn-banner-action-secondary"
              onClick={() => setShowPrevSelectionBanner(false)}
              style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
              title="Hide banner"
            >
              ✕ Dismiss
            </button>
          </div>

          <div className="prev-banner-body">
            {/* Country Info */}
            <div className="prev-country-highlight">
              <div className="prev-country-icon">
                🏛️
              </div>
              <div>
                <div className="prev-country-name">
                  {user.selectedCountry?.country ? (
                    <>
                      {user.selectedCountry.country}
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--success)', marginLeft: '0.5rem' }}>
                        ★ Suitable Country Selected
                      </span>
                    </>
                  ) : (
                    <span style={{ color: 'var(--text-muted)' }}>No suitable country selected yet</span>
                  )}
                </div>
                <div className="prev-country-sub">
                  {user.selectedCountry?.country ? (
                    <>
                      Region: <strong>{user.selectedCountry.region || 'Global'}</strong>
                      {user.selectedCountry.matchScore && (
                        <span> • Match Score: <strong>{user.selectedCountry.matchScore}%</strong></span>
                      )}
                      {user.selectedCountry.savedAt && (
                        <span> • Saved: {new Date(user.selectedCountry.savedAt).toLocaleDateString()}</span>
                      )}
                    </>
                  ) : (
                    'Click "Select as Suitable Country" on any card below to save your top pick.'
                  )}
                </div>
              </div>
            </div>

            {/* Priorities Chips */}
            <div className="prev-priorities-summary">
              <span className="prev-priorities-title">Your Saved Priority Breakdown:</span>
              <div className="prev-chips-row">
                {getPrioritizedCategories(user.preferences).map((cat) => (
                  <span key={cat.key} className="prev-chip">
                    {cat.icon} {cat.label}: <strong>{cat.weight} pts</strong>
                  </span>
                ))}
                {getPrioritizedCategories(user.preferences).length === 0 && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    No priorities saved yet. Adjust sliders and click "Save Priorities".
                  </span>
                )}
              </div>
            </div>

            {/* Banner Actions */}
            <div className="prev-banner-actions">
              {user.selectedCountry?.country && (
                <button
                  className="btn-banner-action-primary"
                  onClick={() => {
                    const matchInResults = results.find((r) => r.country === user.selectedCountry.country);
                    if (matchInResults) {
                      setSelectedCountry(matchInResults);
                    } else {
                      setSearchQuery(user.selectedCountry.country);
                    }
                  }}
                >
                  View Suitable Country Details
                </button>
              )}
              <button
                className="btn-banner-action-secondary"
                onClick={handleRestoreUserPriorities}
                title="Reset sliders back to your saved profile"
              >
                Reset Sliders to Saved
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Main Layout */}
      <div className="main-layout">
        {/* Left: Preferences Panel */}
        <aside className="glass-panel">
          <div className="panel-header">
            <h2 className="panel-title">Your Priorities</h2>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              100 Points Total
            </span>
          </div>

          {/* Points Budget Box */}
          <div className="points-budget-box">
            <div>
              <div className="points-label">Total Allocated</div>
              <div className="points-display">
                <span className={`points-val ${totalPoints === 100 ? 'exact' : totalPoints < 100 ? 'under' : 'over'}`}>
                  {totalPoints}
                </span>
                <span className="points-total">/ 100</span>
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div className="points-label">
                {totalPoints === 100 ? 'Budget Status' : totalPoints < 100 ? 'Remaining' : 'Excess'}
              </div>
              <div style={{
                fontWeight: 600,
                fontSize: '0.9rem',
                color: totalPoints === 100 ? 'var(--success)' : totalPoints < 100 ? 'var(--warning)' : 'var(--danger)'
              }}>
                {totalPoints === 100 ? 'Balanced' : totalPoints < 100 ? `${remainingPoints} pts left` : `${totalPoints - 100} pts over`}
              </div>
            </div>
          </div>

          {/* Quick Presets */}
          <div className="presets-section">
            <div className="section-caption">
              <span>Quick Presets</span>
            </div>
            <div className="presets-grid">
              {meta.presets.map((preset) => (
                <button
                  key={preset.id}
                  className={`preset-chip ${activePreset === preset.id ? 'active' : ''}`}
                  onClick={() => applyPreset(preset)}
                >
                  <span>{preset.icon}</span>
                  <span>{preset.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Smart Balance Helpers */}
          <div className="smart-actions">
            <button
              className="btn-secondary-action"
              onClick={handleNormalize}
              disabled={totalPoints === 0 || totalPoints === 100}
            >
              Scale to 100
            </button>
            <button
              className="btn-secondary-action"
              onClick={handleAutoFillRemainder}
              disabled={remainingPoints <= 0}
            >
              Fill Remainder
            </button>
            <button
              className="btn-secondary-action"
              onClick={handleReset}
            >
              Reset
            </button>
          </div>

          {/* Sliders List */}
          <div className="section-caption">
            <span>Ranking Metrics</span>
          </div>

          <div className="sliders-list">
            {meta.categories.map((cat) => {
              const currentVal = preferences[cat.key] || 0;
              return (
                <div key={cat.key} className={`slider-card ${currentVal > 0 ? 'active-weight' : ''}`}>
                  <div className="slider-top-row">
                    <div className="slider-label-group">
                      <span className="slider-icon">{cat.icon}</span>
                      <span className="slider-title">{cat.label}</span>
                    </div>
                    <span className="slider-badge">{currentVal} pts</span>
                  </div>
                  <p className="slider-desc">{cat.description}</p>
                  
                  <div className="range-container">
                    <button
                      className="step-btn"
                      onClick={() => handleStep(cat.key, -5)}
                      disabled={currentVal <= 0}
                    >
                      -
                    </button>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={currentVal}
                      onChange={(e) => handleSliderChange(cat.key, e.target.value)}
                      className="custom-range"
                    />
                    <button
                      className="step-btn"
                      onClick={() => handleStep(cat.key, 5)}
                      disabled={currentVal >= 100}
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Filters & Submit */}
          <div className="controls-footer">
            <div className="filter-row">
              <div className="filter-group">
                <label>Region</label>
                <select
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  className="select-input"
                >
                  {meta.regions.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              <div className="filter-group">
                <label>Year</label>
                <select
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                  className="select-input"
                >
                  {meta.years.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>

            {errorMsg && (
              <div style={{ color: 'var(--danger)', fontSize: '0.8rem', textAlign: 'center' }}>
                {errorMsg}
              </div>
            )}

            <button
              className="btn-primary-submit"
              onClick={fetchRankings}
              disabled={loading || totalPoints === 0}
            >
              {loading ? 'Evaluating...' : 'Update Recommendations'}
            </button>

            {user ? (
              <button
                className="btn-secondary-action"
                style={{ marginTop: '0.65rem', borderColor: '#bbf7d0', color: '#15803d', background: '#f0fdf4' }}
                onClick={handleSavePriorities}
                disabled={savingPriorities}
              >
                {savingPriorities ? 'Saving...' : '💾 Save as My Priority Profile'}
              </button>
            ) : (
              <button
                className="btn-secondary-action"
                style={{ marginTop: '0.65rem' }}
                onClick={() => {
                  setAuthMode('login');
                  setAuthNotice('Sign in to store your priorities and suitable country!');
                  setShowAuthModal(true);
                }}
              >
                🔐 Sign in to Save Priorities
              </button>
            )}
          </div>
        </aside>

        {/* Right: Results List */}
        <main className="results-container">
          {/* Topbar */}
          <div className="results-topbar">
            <div className="results-meta">
              Showing <strong>{filteredResults.length}</strong> matches
              {totalEvaluated > 0 && ` from ${totalEvaluated} countries evaluated`}
              {region !== 'All' && ` in ${region}`}
            </div>

            <div className="search-box">
              <span>🔍</span>
              <input
                type="text"
                placeholder="Search country or region..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Cards Grid */}
          {loading ? (
            <div className="empty-state">
              <span className="empty-icon">⏳</span>
              <p>Calculating rankings based on your priorities...</p>
            </div>
          ) : filteredResults.length > 0 ? (
            <div className="country-cards-grid">
              {filteredResults.map((item) => {
                const isSuitable = isSelectedCountry(item.country);

                return (
                  <div
                    key={item.country}
                    className={`country-card ${item.rank <= 3 ? `rank-${item.rank}` : ''} ${isSuitable ? 'is-selected-suitable' : ''}`}
                  >
                    <div>
                      {/* Selected Suitable Country Tag */}
                      {isSuitable && (
                        <div className="suitable-tag-badge">
                          <span>★ YOUR SELECTED SUITABLE COUNTRY</span>
                        </div>
                      )}

                      {/* Header */}
                      <div className="country-card-header">
                        <div className="rank-indicator">
                          <span className="rank-number">#{item.rank}</span>
                        </div>

                        <div className="match-score-badge">
                          <div className="match-pct">{item.matchScore}%</div>
                          <div className="match-label">Match Score</div>
                        </div>
                      </div>

                      {/* Country Name */}
                      <div className="country-identity">
                        <h3 className="country-name">{item.country}</h3>
                        <span className="country-region-tag">{item.region}</span>
                      </div>

                      {/* Breakdown */}
                      <div className="breakdown-bars">
                        {Object.entries(item.breakdown || {}).map(([catKey, bData]) => {
                          const catMeta = meta.categories.find((c) => c.key === catKey);
                          return (
                            <div key={catKey} className="breakdown-item">
                              <div className="breakdown-labels">
                                <span>
                                  {catMeta?.icon} {catMeta?.label || catKey} ({bData.weightPercent}%)
                                </span>
                                <span>
                                  {catKey === 'Economic_Tier' ? `Tier ${bData.raw}` : `Rank #${bData.raw}`}
                                </span>
                              </div>
                              <div className="bar-track">
                                <div
                                  className="bar-fill"
                                  style={{ width: `${Math.min(100, Math.max(5, bData.score))}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Actions: View Indicators & Select as Suitable Country */}
                    <div className="card-actions-row">
                      <button
                        className={`btn-card-suitable ${isSuitable ? 'selected' : 'unselected'}`}
                        onClick={() => handleSelectSuitableCountry(item)}
                        title={isSuitable ? 'This is currently your chosen suitable country' : 'Select this as your suitable country'}
                      >
                        {isSuitable ? '★ Suitable Country ✓' : '☆ Select as Suitable'}
                      </button>

                      <button
                        className="btn-details"
                        style={{ flex: 1 }}
                        onClick={() => setSelectedCountry(item)}
                      >
                        All Indicators
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty-state">
              <span className="empty-icon">🌍</span>
              <p>No countries match the current criteria.</p>
            </div>
          )}
        </main>
      </div>

      {/* Country Detail Modal */}
      {selectedCountry && (
        <div className="modal-overlay" onClick={() => setSelectedCountry(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {selectedCountry.country}
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  {selectedCountry.region} • Year {selectedCountry.year} • Match Score:{' '}
                  <strong style={{ color: 'var(--success)' }}>{selectedCountry.matchScore}%</strong>
                </p>
              </div>
              <button className="modal-close-btn" onClick={() => setSelectedCountry(null)}>
                ✕
              </button>
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <button
                className={`btn-card-suitable ${isSelectedCountry(selectedCountry.country) ? 'selected' : 'unselected'}`}
                style={{ width: '100%', padding: '0.75rem', fontSize: '0.85rem' }}
                onClick={() => handleSelectSuitableCountry(selectedCountry)}
              >
                {isSelectedCountry(selectedCountry.country)
                  ? '★ Currently Selected as Your Suitable Country ✓'
                  : '☆ Select as My Suitable Country'}
              </button>
            </div>

            <h4 style={{ color: 'var(--text-secondary)', marginBottom: '0.85rem', fontSize: '0.85rem', fontWeight: 600 }}>
              Complete Indicator Breakdown:
            </h4>

            <div className="all-ranks-grid">
              {meta.categories.map((cat) => {
                const rankVal = selectedCountry.allRanks?.[cat.key];
                const isPrioritized = (preferences[cat.key] || 0) > 0;

                return (
                  <div
                    key={cat.key}
                    className="rank-stat-card"
                    style={{
                      borderColor: isPrioritized ? '#c7d2fe' : undefined,
                      background: isPrioritized ? '#eef2ff' : undefined
                    }}
                  >
                    <div>
                      <div className="stat-label">
                        {cat.icon} {cat.label}
                      </div>
                      {isPrioritized && (
                        <span style={{ fontSize: '0.68rem', color: 'var(--primary)', fontWeight: 600 }}>
                          Prioritized ({preferences[cat.key]} pts)
                        </span>
                      )}
                    </div>
                    <div className="stat-val">
                      {cat.key === 'Economic_Tier'
                        ? rankVal ? `Tier ${rankVal}` : 'N/A'
                        : rankVal ? `#${rankVal}` : 'N/A'}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: '1.25rem', textAlign: 'center' }}>
              <button
                className="btn-secondary-action"
                style={{ display: 'inline-block', padding: '0.5rem 1.75rem', width: 'auto' }}
                onClick={() => setSelectedCountry(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Authentication Modal (Login & Sign Up) */}
      {showAuthModal && (
        <div className="modal-overlay" onClick={() => setShowAuthModal(false)}>
          <div className="auth-modal-card" onClick={(e) => e.stopPropagation()}>
            <button
              className="modal-close-btn"
              style={{ position: 'absolute', top: '1.25rem', right: '1.25rem' }}
              onClick={() => setShowAuthModal(false)}
            >
              ✕
            </button>

            <div className="auth-modal-header">
              <div className="auth-modal-icon">
                {authMode === 'login' ? '🔐' : '✨'}
              </div>
              <h3 className="auth-modal-title">
                {authMode === 'login' ? 'Welcome Back' : 'Create Your Account'}
              </h3>
              <p className="auth-modal-desc">
                {authMode === 'login'
                  ? 'Sign in to access your previous selections and priorities.'
                  : 'Register to store your priorities and suitable country destination.'}
              </p>
            </div>

            {authNotice && (
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', padding: '0.65rem 0.85rem', borderRadius: '6px', fontSize: '0.8rem', marginBottom: '1rem', textAlign: 'center' }}>
                {authNotice}
              </div>
            )}

            {/* Tabs */}
            <div className="auth-tabs-toggle">
              <button
                className={`auth-tab-btn ${authMode === 'login' ? 'active' : ''}`}
                onClick={() => {
                  setAuthMode('login');
                  setAuthError('');
                }}
              >
                Sign In
              </button>
              <button
                className={`auth-tab-btn ${authMode === 'register' ? 'active' : ''}`}
                onClick={() => {
                  setAuthMode('register');
                  setAuthError('');
                }}
              >
                Register
              </button>
            </div>

            {authError && (
              <div className="auth-modal-error">
                <span>⚠️</span>
                <span>{authError}</span>
              </div>
            )}

            <form onSubmit={handleAuthSubmit}>
              {authMode === 'register' && (
                <div className="auth-form-field">
                  <label>Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Sarah Connor"
                    className="auth-form-input"
                    value={authForm.name}
                    onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })}
                  />
                </div>
              )}

              <div className="auth-form-field">
                <label>Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  className="auth-form-input"
                  value={authForm.email}
                  onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                />
              </div>

              <div className="auth-form-field">
                <label>Password</label>
                <input
                  type="password"
                  required
                  placeholder="At least 6 characters"
                  className="auth-form-input"
                  value={authForm.password}
                  onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                />
              </div>

              <button
                type="submit"
                className="auth-modal-submit-btn"
                disabled={authLoading}
              >
                {authLoading
                  ? 'Please wait...'
                  : authMode === 'login'
                  ? 'Sign In'
                  : 'Create Account & Save Selection'}
              </button>
            </form>

            <div className="auth-hint-box">
              🔒 <strong>Your Data is Preserved:</strong> Once logged in, your country selection and custom priority points are automatically stored and shown whenever you return!
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toast && (
        <div className="toast-container">
          <div className={`toast-box ${toast.type}`}>
            <span>{toast.type === 'success' ? '✅' : toast.type === 'error' ? '❌' : 'ℹ️'}</span>
            <span>{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}
