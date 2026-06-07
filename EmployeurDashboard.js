import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';

const CONTRAT = 35 * 60;

function timeToMin(t) {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
function minToTime(min) {
  if (min === null || isNaN(min)) return '--h--';
  const sign = min < 0 ? '-' : '';
  const abs = Math.abs(Math.round(min));
  return `${sign}${Math.floor(abs/60)}h${(abs%60).toString().padStart(2,'0')}`;
}
function getMonday(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + (d.getDay() === 0 ? -6 : 1 - d.getDay()));
  return d.toISOString().split('T')[0];
}
function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}
function getLastSunday() {
  const today = new Date(); today.setHours(0,0,0,0);
  const d = today.getDay();
  const s = new Date(today);
  if (d === 0) s.setDate(today.getDate() - 7);
  else s.setDate(today.getDate() - d);
  return s.toISOString().split('T')[0];
}
function formatDate(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('fr-FR', { day:'numeric', month:'short' });
}

const S = {
  page:    { minHeight:'100vh', background:'#0a0a0a', color:'#e0d8c8', fontFamily:"'Courier New',monospace", paddingBottom:60 },
  header:  { background:'#0f0f0f', borderBottom:'2px solid #c8a96e', padding:'18px 20px', position:'sticky', top:0, zIndex:10 },
  wrap:    { maxWidth:800, margin:'0 auto', padding:'0 16px' },
  tag:     { fontSize:9, letterSpacing:4, color:'#c8a96e', textTransform:'uppercase' },
  card:    { background:'#111', border:'1px solid #1e1e1e', borderRadius:8, marginBottom:10, overflow:'hidden' },
  cardHead:{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'14px 16px', cursor:'pointer' },
  name:    { fontSize:13, fontWeight:700, color:'#e0d8c8' },
  hs:      { fontSize:18, fontWeight:700 },
  table:   { width:'100%', borderCollapse:'collapse', fontSize:11 },
  th:      { fontSize:8, color:'#333', letterSpacing:2, textTransform:'uppercase', padding:'8px 12px', textAlign:'left', borderBottom:'1px solid #161616' },
  td:      { padding:'8px 12px', borderBottom:'1px solid #111', color:'#888' },
};

export default function EmployeurDashboard() {
  const { profile, signOut } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [creneaux,  setCreneaux]  = useState({});
  const [periodes,  setPeriodes]  = useState({});
  const [open,      setOpen]      = useState(null);
  const [loading,   setLoading]   = useState(true);

  const lastSunday = getLastSunday();

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    // Charger tous les employés
    const { data: emps } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'employe')
      .order('nom');

    // Charger tous les créneaux
    const { data: slots } = await supabase
      .from('creneaux')
      .select('*')
      .order('date')
      .order('ordre');

    // Charger toutes les périodes
    const { data: pers } = await supabase
      .from('periodes')
      .select('*');

    const slotsByUser = {};
    (slots || []).forEach(s => {
      if (!slotsByUser[s.user_id]) slotsByUser[s.user_id] = [];
      slotsByUser[s.user_id].push(s);
    });

    const perByUser = {};
    (pers || []).forEach(p => { perByUser[p.user_id] = p.debut; });

    setEmployees(emps || []);
    setCreneaux(slotsByUser);
    setPeriodes(perByUser);
    setLoading(false);
  };

  const calcHS = (userId) => {
    const debut = periodes[userId];
    if (!debut) return 0;
    const slots = creneaux[userId] || [];
    // Grouper par semaine
    let monday = getMonday(debut);
    let totalHS = 0;
    while (monday <= lastSunday) {
      const sunday = addDays(monday, 6);
      if (sunday > lastSunday) break;
      let weekWorked = 0;
      for (let i = 0; i < 7; i++) {
        const day = addDays(monday, i);
        slots.filter(s => s.date === day).forEach(s => {
          const a = timeToMin(s.debut), b = timeToMin(s.fin);
          if (a !== null && b !== null) weekWorked += Math.max(0, b - a);
        });
      }
      totalHS += Math.max(0, weekWorked - CONTRAT);
      monday = addDays(monday, 7);
    }
    return totalHS;
  };

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div style={{ maxWidth:800, margin:'0 auto', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <div style={S.tag}>Tableau de bord employeur</div>
            <div style={{ fontSize:12, color:'#888', marginTop:2 }}>{profile?.prenom} {profile?.nom}</div>
          </div>
          <button onClick={signOut} style={{ background:'transparent', border:'1px solid #222', color:'#444', padding:'5px 12px', borderRadius:4, fontSize:9, letterSpacing:2, textTransform:'uppercase', cursor:'pointer' }}>Déconnexion</button>
        </div>
      </div>

      <div style={{ ...S.wrap, marginTop:20 }}>
        <div style={{ fontSize:9, color:'#444', letterSpacing:2, textTransform:'uppercase', marginBottom:16 }}>
          Période jusqu'au {formatDate(lastSunday)} — {employees.length} employé{employees.length > 1 ? 's' : ''}
        </div>

        {loading && <div style={{ color:'#333', fontSize:12, textAlign:'center', padding:40 }}>Chargement…</div>}

        {!loading && employees.map(emp => {
          const hs = calcHS(emp.id);
          const isOpen = open === emp.id;
          const slots = creneaux[emp.id] || [];
          const debut = periodes[emp.id];

          // Regrouper par date
          const byDate = {};
          slots.forEach(s => {
            if (!byDate[s.date]) byDate[s.date] = [];
            byDate[s.date].push(s);
          });

          return (
            <div key={emp.id} style={S.card}>
              <div style={S.cardHead} onClick={() => setOpen(isOpen ? null : emp.id)}>
                <div>
                  <div style={S.name}>{emp.prenom} {emp.nom}</div>
                  {debut && <div style={{ fontSize:9, color:'#444', marginTop:2 }}>Depuis le {formatDate(debut)}</div>}
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontSize:8, color:'#444', letterSpacing:2 }}>HS</div>
                    <div style={{ ...S.hs, color: hs > 0 ? '#7ecb9b' : '#444' }}>+{minToTime(hs)}</div>
                  </div>
                  <span style={{ color:'#333', transform: isOpen ? 'rotate(180deg)' : 'none', transition:'transform 0.2s' }}>▾</span>
                </div>
              </div>

              {isOpen && (
                <div style={{ borderTop:'1px solid #161616' }}>
                  {Object.keys(byDate).sort().map(date => (
                    <div key={date} style={{ padding:'10px 16px', borderBottom:'1px solid #111' }}>
                      <div style={{ fontSize:10, color:'#c8a96e', letterSpacing:1, marginBottom:6 }}>{formatDate(date)}</div>
                      <table style={S.table}>
                        <thead>
                          <tr>
                            <th style={S.th}>Type</th>
                            <th style={S.th}>Début</th>
                            <th style={S.th}>Fin</th>
                            <th style={S.th}>Durée</th>
                          </tr>
                        </thead>
                        <tbody>
                          {byDate[date].map(s => {
                            const dur = timeToMin(s.debut) !== null && timeToMin(s.fin) !== null
                              ? timeToMin(s.fin) - timeToMin(s.debut) : null;
                            return (
                              <tr key={s.id}>
                                <td style={S.td}>{s.type_id}</td>
                                <td style={S.td}>{s.debut || '—'}</td>
                                <td style={S.td}>{s.fin || '—'}</td>
                                <td style={S.td}>{dur !== null ? minToTime(dur) : '—'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ))}
                  {Object.keys(byDate).length === 0 && (
                    <div style={{ padding:16, fontSize:11, color:'#2a2a2a', textAlign:'center' }}>Aucune donnée saisie.</div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
