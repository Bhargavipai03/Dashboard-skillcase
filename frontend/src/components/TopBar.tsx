import { Activity, Calendar, LayoutDashboard, AreaChart, Users, CreditCard } from 'lucide-react';

interface TopBarProps {
    view: string;
    setView: (view: 'dashboard' | 'attendance' | 'global_analytics' | 'directory' | 'payments') => void;

    selectedLanguage: string;
    setSelectedLanguage: (v: string) => void;

    selectedLevel: string;
    setSelectedLevel: (v: string) => void;

    selectedBatch: string;
    setSelectedBatch: (v: string) => void;
}

const LANGUAGES = ['German', 'French', 'Chinese', 'Japanese', 'Spanish'];
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
// Generate batches 1-20
const BATCHES = Array.from({ length: 20 }, (_, i) => (i + 1).toString());

export const TopBar: React.FC<TopBarProps> = ({
    view,
    setView,
    selectedLanguage,
    setSelectedLanguage,
    selectedLevel,
    setSelectedLevel,
    selectedBatch,
    setSelectedBatch
}) => {

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--surface)',
            borderBottom: '1px solid var(--border)',
            padding: '1rem 2rem'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--primary)' }}>
                    <Activity size={28} />
                    <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>Health Analyzer Pro</h1>
                </div>

                <div style={{ display: 'flex', gap: '1rem', background: 'var(--background)', padding: '0.25rem', borderRadius: '0.5rem' }}>
                    <button
                        onClick={() => setView('dashboard')}
                        style={{
                            padding: '0.5rem 1.5rem',
                            borderRadius: '0.25rem',
                            border: 'none',
                            background: view === 'dashboard' ? 'var(--primary)' : 'transparent',
                            color: view === 'dashboard' ? 'white' : 'var(--text)',
                            fontWeight: view === 'dashboard' ? 600 : 500,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                        }}
                    >
                        <LayoutDashboard size={18} /> Dashboard
                    </button>
                    <button
                        onClick={() => setView('attendance')}
                        style={{
                            padding: '0.5rem 1.5rem',
                            borderRadius: '0.25rem',
                            border: 'none',
                            background: view === 'attendance' ? 'var(--primary)' : 'transparent',
                            color: view === 'attendance' ? 'white' : 'var(--text)',
                            fontWeight: view === 'attendance' ? 600 : 500,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                        }}
                    >
                        <Calendar size={18} /> Attendance
                    </button>
                    <button
                        onClick={() => setView('global_analytics')}
                        style={{
                            padding: '0.5rem 1.5rem',
                            borderRadius: '0.25rem',
                            border: 'none',
                            background: view === 'global_analytics' ? 'var(--primary)' : 'transparent',
                            color: view === 'global_analytics' ? 'white' : 'var(--text)',
                            fontWeight: view === 'global_analytics' ? 600 : 500,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                        }}
                    >
                        <AreaChart size={18} /> All Batches Tracker
                    </button>
                    <button
                        onClick={() => setView('directory')}
                        style={{
                            padding: '0.5rem 1.5rem',
                            borderRadius: '0.25rem',
                            border: 'none',
                            background: view === 'directory' ? 'var(--primary)' : 'transparent',
                            color: view === 'directory' ? 'white' : 'var(--text)',
                            fontWeight: view === 'directory' ? 600 : 500,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                        }}
                    >
                        <Users size={18} /> Directory
                    </button>
                    <button
                        onClick={() => setView('payments')}
                        style={{
                            padding: '0.5rem 1.5rem',
                            borderRadius: '0.25rem',
                            border: 'none',
                            background: view === 'payments' ? 'var(--primary)' : 'transparent',
                            color: view === 'payments' ? 'white' : 'var(--text)',
                            fontWeight: view === 'payments' ? 600 : 500,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                        }}
                    >
                        <CreditCard size={18} /> Payments
                    </button>
                </div>
            </div>

            {/* Selectors */}
            <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', background: 'var(--background)', padding: '1rem', borderRadius: '0.5rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Language / Course</label>
                    <input
                        list="language-options"
                        value={selectedLanguage}
                        onChange={(e) => setSelectedLanguage(e.target.value)}
                        placeholder="Type or select..."
                        style={{ padding: '0.5rem', borderRadius: '0.25rem', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', minWidth: '150px' }}
                    />
                    <datalist id="language-options">
                        {LANGUAGES.map(l => <option key={l} value={l} />)}
                    </datalist>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Level</label>
                    <select
                        value={selectedLevel}
                        onChange={(e) => setSelectedLevel(e.target.value)}
                        style={{ padding: '0.5rem', borderRadius: '0.25rem', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', minWidth: '100px' }}
                    >
                        {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Batch</label>
                    <select
                        value={selectedBatch}
                        onChange={(e) => setSelectedBatch(e.target.value)}
                        style={{ padding: '0.5rem', borderRadius: '0.25rem', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', minWidth: '100px' }}
                    >
                        {BATCHES.map(b => <option key={b} value={b}>Batch {b}</option>)}
                    </select>
                </div>
            </div>
        </div>
    );
};
