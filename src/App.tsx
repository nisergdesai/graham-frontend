import React, { useState, useEffect, useRef } from 'react';
import './App.css';

type ResultValue = [string | number | boolean | number[], boolean] | Record<string, any>;

function formatBoolean(val: boolean): React.ReactElement {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: '12px',
        backgroundColor: val ? '#4caf50' : '#f44336',
        color: 'white',
        fontWeight: 600,
        fontSize: '0.85rem',
        minWidth: 32,
        textAlign: 'center',
        userSelect: 'none',
      }}
      aria-label={val ? 'Passed' : 'Failed'}
    >
      {val ? 'Yes' : 'No'}
    </span>
  );
}

function renderValue(value: any): React.ReactNode {
  if (Array.isArray(value)) {
    if (value.length === 2 && typeof value[1] === 'boolean') {
      const [val, passed] = value;

      if (Array.isArray(val)) {
        return (
          <div style={{ marginLeft: '1rem' }}>
            {formatBoolean(passed)}{' '}
            <span>
              Last 5 years EPS:{' '}
              {val.map((v: number, i: number) => (
                <span key={i} style={{ marginRight: 6 }}>
                  {v.toFixed(2)}
                  {i < val.length - 1 ? ',' : ''}
                </span>
              ))}
            </span>
          </div>
        );
      }

      return (
        <div style={{ marginLeft: '1rem' }}>
          {formatBoolean(passed)} <span>{val?.toString()}</span>
        </div>
      );
    }

    return (
      <ul>
        {value.map((v, i) => (
          <li key={i}>{renderValue(v)}</li>
        ))}
      </ul>
    );
  } else if (typeof value === 'object' && value !== null) {
    return (
      <ul>
        {Object.entries(value).map(([k, v]) => (
          <li key={k}>
            <strong>{k}:</strong> {renderValue(v)}
          </li>
        ))}
      </ul>
    );
  } else if (typeof value === 'boolean') {
    return formatBoolean(value);
  } else {
    return value?.toString() ?? '';
  }
}

interface Suggestion {
  symbol: string;
  description: string;
}

function App() {
  const [ticker, setTicker] = useState('');
  const [results, setResults] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const suggestionRef = useRef<HTMLUListElement>(null);

  // Fetch suggestions debounce (unchanged)
  useEffect(() => {
    if (ticker.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      setHighlightedIndex(-1);
      return;
    }

    const timer = setTimeout(() => {
      fetch(
        `https://finnhub.io/api/v1/search?q=${ticker}&token=d25v029r01qhge4ei8i0d25v029r01qhge4ei8ig`
      )
        .then(res => res.json())
        .then(data => {
          if (data && data.result) {
            const filtered = data.result.filter((item: any) => item.type === 'Common Stock');
            setSuggestions(filtered.slice(0, 5));
            setShowSuggestions(filtered.length > 0);
            setHighlightedIndex(-1);
          }
        })
        .catch(() => {
          setSuggestions([]);
          setShowSuggestions(false);
          setHighlightedIndex(-1);
        });
    }, 400);

    return () => clearTimeout(timer);
  }, [ticker]);

  // Close suggestions only on analysis start, NOT on outside click
  // So remove the outside click handler or adjust it accordingly
  // Alternatively, keep but only close if not loading and no analysis triggered
  // Here we remove it for simplicity

  const fetchAnalysis = async (manualTicker?: string) => {
    const queryTicker = manualTicker ?? ticker.trim();
    if (!queryTicker) return;
  
    setLoading(true);
    setResults(null);
    setShowSuggestions(false); // <-- hide suggestions only here
    setHighlightedIndex(-1);
  
    try {
      const res = await fetch(`http://localhost:8000/analyze?ticker=${queryTicker}`);
      const data = await res.json();
      setResults(data);
      setTicker(queryTicker);
      setHistory(prev => {
        const updated = [queryTicker, ...prev.filter(t => t !== queryTicker)];
        return updated.slice(0, 10);
      });
    } catch (e) {
      setResults({ error: 'Failed to fetch analysis.' });
    } finally {
      setLoading(false);
    }
  };

  const clearAll = () => {
    setTicker('');
    setResults(null);
    setSuggestions([]);
    setShowSuggestions(false);
    setHighlightedIndex(-1);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showSuggestions && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightedIndex(i => (i + 1) % suggestions.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightedIndex(i => (i <= 0 ? suggestions.length - 1 : i - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (highlightedIndex >= 0) {
          const selected = suggestions[highlightedIndex];
          setTicker(selected.symbol);
          fetchAnalysis(selected.symbol);
        } else {
          // No suggestion highlighted, check for exact match:
          const exactMatch = suggestions.find(s => s.symbol.toUpperCase() === ticker.trim().toUpperCase());
          if (exactMatch) {
            fetchAnalysis(exactMatch.symbol);
          } else {
            // Optional: show alert or just do nothing
          }
        }
      } else if (e.key === 'Escape') {
        setShowSuggestions(false);
        setHighlightedIndex(-1);
      }
    } else if (e.key === 'Enter') {
      // Suggestions not shown, just fetch analysis if ticker not empty
      if (ticker.trim()) {
        fetchAnalysis();
      }
    }
  };

  return (
    <div className="App">
      <h1>Graham Screener</h1>

      <div className="card" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flexGrow: 1, maxWidth: 280 }}>
          <input
            value={ticker}
            onChange={e => {
              setTicker(e.target.value);
              setShowSuggestions(true);
            }}
            onKeyDown={onKeyDown}
            placeholder="Enter stock ticker"
            disabled={loading}
            autoFocus
            aria-label="Stock ticker input"
            autoComplete="off"
          />
          {showSuggestions && suggestions.length > 0 && (
            <ul
              className="suggestions-list"
              ref={suggestionRef}
              style={{
                position: 'absolute',
                zIndex: 10,
                background: 'white',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                width: '100%',
                borderRadius: 8,
                marginTop: 4,
                maxHeight: 200,
                overflowY: 'auto',
                padding: 0,
                listStyle: 'none',
              }}
              role="listbox"
              aria-label="Ticker suggestions"
            >
              {suggestions.map((s, i) => (
                <li
                  key={s.symbol}
                  onClick={() => {
                    setTicker(s.symbol);
                    setShowSuggestions(false);
                    fetchAnalysis(s.symbol);
                  }}
                  style={{
                    padding: '0.5rem 1rem',
                    cursor: 'pointer',
                    borderBottom: '1px solid #e0e0e0',
                    backgroundColor: i === highlightedIndex ? '#bde4ff' : 'white',
                  }}
                  role="option"
                  aria-selected={i === highlightedIndex}
                  tabIndex={-1}
                >
                  <strong>{s.symbol}</strong> — {s.description}
                </li>
              ))}
            </ul>
          )}
        </div>
        <button onClick={() => fetchAnalysis()} disabled={loading}>
          {loading ? <div className="spinner" aria-label="Loading"></div> : 'Analyze'}
        </button>
        <button onClick={clearAll} disabled={loading || !ticker} className="clear-btn">
          Clear
        </button>
      </div>

      {/* ... rest remains unchanged */}


      <div className="results" style={{ marginTop: '20px' }}>
        {!results && <p>Enter a ticker and press Analyze or Enter to see results.</p>}
        {results && (
          'error' in results ? (
            <p style={{ color: 'red' }}>{results.error}</p>
          ) : (
            <>
              <p>
                <strong>Ticker:</strong> {results.ticker}
              </p>
              <div>{renderValue(results.graham_results)}</div>
              {results.cached && <p style={{ fontStyle: 'italic', marginTop: '0.5rem' }}>* Results served from cache</p>}
            </>
          )
        )}
      </div>

      {history.length > 0 && (
        <div className="history" style={{ marginTop: '2rem' }}>
          <h3>Search History</h3>
          <ul>
            {history.map(t => (
              <li key={t}>
                <button
                  onClick={() => {
                    setTicker(t);
                    fetchAnalysis(t);
                  }}
                  disabled={loading}
                  className="history-btn"
                >
                  {t}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default App;
