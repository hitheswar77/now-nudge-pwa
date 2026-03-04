'use client';

import './EdgePanel.css';
import { useState } from 'react';
import { useProximityNudge } from '@/hooks/useProximityNudge';

interface NudgeCard {
    id: string;
    title: string;
    body: string;
    icon?: string;
    time?: string;
}

interface EdgePanelProps {
    cards?: NudgeCard[];
}

export default function EdgePanel({ cards = [] }: EdgePanelProps) {
    const [open, setOpen] = useState(false);
    const { nudges, position, error } = useProximityNudge();

    // Merge static cards with live proximity nudges
    const allCards: NudgeCard[] = [
        ...cards,
        ...nudges.map((n) => ({
            id: n.id,
            title: n.title,
            body: n.body,
            icon: '📍',
        })),
    ];

    return (
        <>
            {/* ── Pull Tab ─────────────────────────────────────────────────── */}
            <button
                aria-label="Open Edge Panel"
                onClick={() => setOpen(true)}
                className="edge-panel-tab"
            />

            {/* ── Backdrop ─────────────────────────────────────────────────── */}
            {open && (
                <div
                    className="edge-panel-backdrop"
                    onClick={() => setOpen(false)}
                />
            )}

            {/* ── Sliding Panel ────────────────────────────────────────────── */}
            <aside className={`edge-panel ${open ? 'edge-panel--open' : ''}`}>
                {/* Header */}
                <div className="edge-panel-header">
                    <span className="edge-panel-header__dot" />
                    <h2 className="edge-panel-header__title">Now Nudge</h2>
                    <button
                        className="edge-panel-header__close"
                        onClick={() => setOpen(false)}
                        aria-label="Close Edge Panel"
                    >
                        ✕
                    </button>
                </div>

                {/* Location pill */}
                {position && (
                    <div className="edge-panel-location-pill">
                        📡 {position.latitude.toFixed(4)}, {position.longitude.toFixed(4)}
                    </div>
                )}
                {error && (
                    <div className="edge-panel-error-pill">⚠️ {error}</div>
                )}

                {/* Scrollable cards row */}
                <div className="edge-panel-scroll">
                    {allCards.length === 0 ? (
                        <div className="edge-panel-empty">
                            <span>✨</span>
                            <p>No nudges nearby</p>
                        </div>
                    ) : (
                        allCards.map((card) => (
                            <NowCard key={card.id} card={card} />
                        ))
                    )}
                </div>

                {/* Footer */}
                <p className="edge-panel-footer">
                    Powered by Now Nudge PWA
                </p>
            </aside>
        </>
    );
}

function NowCard({ card }: { card: NudgeCard }) {
    return (
        <article className="now-card">
            <div className="now-card__icon">{card.icon ?? '🔔'}</div>
            <h3 className="now-card__title">{card.title}</h3>
            <p className="now-card__body">{card.body}</p>
            {card.time && <span className="now-card__time">{card.time}</span>}
        </article>
    );
}
