import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';

const MODE_OPTIONS = [
  { id: 'map', label: 'Map View', icon: '🗺️', shortcut: '1' },
  { id: 'compare', label: 'Compare View', icon: '📊', shortcut: '2' },
  { id: 'compare3d', label: '3D View', icon: '🏎️', shortcut: '3' },
];

export default function CommandPalette({ circuits, selectedId, compareId, mode, onSelectCircuit, onSetMode, isOpen, onClose }) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Filter results: modes first (if matching), then circuits
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const items = [];

    // Mode options
    const matchingModes = MODE_OPTIONS.filter(m =>
      m.label.toLowerCase().includes(q) || m.id.includes(q)
    );
    if (q === '' || matchingModes.length > 0) {
      (q === '' ? MODE_OPTIONS : matchingModes).forEach(m =>
        items.push({ type: 'mode', ...m })
      );
    }

    // Circuit options
    const matchingCircuits = circuits.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.location?.toLowerCase().includes(q) ||
      c.continent?.toLowerCase().includes(q)
    );
    matchingCircuits.slice(0, 20).forEach(c =>
      items.push({ type: 'circuit', id: c.id, label: c.name, sublabel: c.location, icon: '🏁' })
    );

    return items;
  }, [query, circuits]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const selectItem = useCallback((item) => {
    if (item.type === 'mode') {
      onSetMode(item.id);
    } else {
      onSelectCircuit(item.id);
    }
    onClose();
  }, [onSetMode, onSelectCircuit, onClose]);

  const onKeyDown = useCallback((e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => (i + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => (i - 1 + results.length) % results.length);
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault();
      selectItem(results[selectedIndex]);
    } else if (e.key === 'Escape') {
      onClose();
    }
  }, [results, selectedIndex, selectItem, onClose]);

  if (!isOpen) return null;

  return (
    <div className="cmd-overlay" onClick={onClose}>
      <div className="cmd-palette" onClick={e => e.stopPropagation()}>
        <div className="cmd-input-wrap">
          <span className="cmd-icon">⌘</span>
          <input
            ref={inputRef}
            className="cmd-input"
            type="text"
            placeholder="Search circuits or switch modes…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <span className="cmd-hint">ESC</span>
        </div>
        <div className="cmd-results">
          {results.length === 0 && (
            <div className="cmd-empty">No results for "{query}"</div>
          )}
          {results.map((item, i) => (
            <button
              key={item.type + '-' + (item.id || item.label)}
              className={`cmd-item${i === selectedIndex ? ' selected' : ''}`}
              onMouseEnter={() => setSelectedIndex(i)}
              onClick={() => selectItem(item)}
            >
              <span className="cmd-item-icon">{item.icon}</span>
              <span className="cmd-item-text">
                <span className="cmd-item-label">{item.label}</span>
                {item.sublabel && <span className="cmd-item-sublabel">{item.sublabel}</span>}
              </span>
              {item.type === 'mode' && <span className="cmd-item-shortcut">⌘{item.shortcut}</span>}
              {item.type === 'circuit' && item.id === selectedId && <span className="cmd-item-active">selected</span>}
              {item.type === 'circuit' && item.id === compareId && <span className="cmd-item-active compare">compare</span>}
            </button>
          ))}
        </div>
        <div className="cmd-footer">
          <span>↑↓ navigate</span>
          <span>↵ select</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  );
}
