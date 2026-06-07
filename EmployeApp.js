import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';

// ─── UTILS ────────────────────────────────────────────────────────────────────

const CONTRAT_SEMAINE = 35 * 60;
const JOURS = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'];

const TYPES_DEFAULT = [
  { id:'intervention',  label:'Intervention',              is_pause:false, is_favori:true,  ordre:0 },
  { id:'chargement',    label:'Chargement / déchargement', is_pause:false, is_favori:false, ordre:1 },
  { id:'bureau',        label:'Bureau / étude devis',      is_pause:false, is_favori:true,  ordre:2 },
  { id:'trajet',        label:'Trajet',                    is_pause:false, is_favori:false, ordre:3 },
  { id:'pause',         label:'Pause déjeuner',            is_pause:true,  is_favori:true,  ordre:4 },
  { id:'reunion',       label:'Réunion',                   is_pause:false, is_favori:false, ordre:5 },
  { id:'formation',     label:'Formation',                 is_pause:false, is_favori:false, ordre:6 },
];

function toISO(date) { return date.toISOString().split('T')[0]; }
function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00'); d.setDate(d.getDate() + n); return toISO(d);
}
function getMonday(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + (d.getDay() === 0 ? -6 : 1 - d.getDay()));
  return toISO(d);
}
function formatDate(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('fr-FR', { day:'numeric', month:'short' });
}
function timeToMin(t) {
  if (!t || !t.includes(':')) return null;
  const [h, m] = t.split(':').map(Number);
  return isNaN(h) || isNaN(m) ? null : h * 60 + m;
}
function minToTime(min) {
  if (min === null || isNaN(min)) return '--h--';
  const sign = min < 0 ? '-' : '';
  const abs = Math.abs(Math.round(min));
  return `${sign}${Math.floor(abs/60)}h${(abs%60).toString().padStart(2,'0')}`;
}
function getLastSunday() {
  const today = new Date(); today.setHours(0,0,0,0);
  const d = today.getDay();
  const s = new Date(today);
  if (d === 0) s.setDate(today.getDate() - 7);
  else s.setDate(today.getDate() - d);
  return toISO(s);
}
function getWeeksBetween(startStr, endStr) {
  const weeks = [];
  let monday = getMonday(startStr);
  while (true) {
    const sunday = addDays(monday, 6);
    if (sunday > endStr) break;
    weeks.push({ monday, sunday, days: Array.from({length:7}, (_,i) => addDays(monday,i)) });
    monday = addDays(monday, 7);
  }
  return weeks;
}
function uid() { return Math.random().toString(36).slice(2,8); }

// ─── TIME INPUT ───────────────────────────────────────────────────────────────

function TimeInput({ value, onChange, minTime = null, maxTime = null }) {
  const ALL_HOURS  = Array.from({length:24}, (_,i) => String(i));
  const MAIN_HOURS = Array.from({length:16}, (_,i) => String(i+7));
  const MINUTES    = ['0','5','10','15','20','25','30','35','40','45','50','55'];

  const parsed = value && value.includes(':') ? value.split(':') : null;
  const hVal = parsed ? String(parseInt(parsed[0],10)) : '';
  const mVal = parsed ? String(parseInt(parsed[1],10)) : '';
  const hInt = hVal !== '' ? parseInt(hVal,10) : -1;
  const [forceAll, setForceAll] = useState(false);
  const showAll = forceAll || (hVal !== '' && (hInt < 7 || hInt > 22));

  const isHourDisabled = h => {
    const hm = parseInt(h,10)*60, hx = parseInt(h,10)*60+59;
    if (minTime !== null && hx < minTime) return true;
    if (maxTime !== null && hm > maxTime) return true;
    return false;
  };
  const isMinuteDisabled = m => {
    if (hVal === '') return false;
    const t = parseInt(hVal,10)*60+parseInt(m,10);
    if (minTime !== null && t < minTime) return true;
    if (maxTime !== null && t > maxTime) return true;
    return false;
  };
  const commit = (h,m) => {
    if (h===''||m==='') { onChange(''); return; }
    onChange(`${String(parseInt(h,10)).padStart(2,'0')}:${String(parseInt(m,10)).padStart(2,'0')}`);
  };
  const handleH = e => {
    const v = e.target.value;
    if (v==='__custom__') { setForceAll(true); return; }
    if (v==='') { onChange(''); return; }
    commit(v, mVal!==''?mVal:'0');
  };
  const handleM = e => {
    const v = e.target.value;
    if (v==='') { onChange(''); return; }
    commit(hVal!==''?hVal:'7', v);
  };
  const sel = { background:'#0a0a0a', border:'1px solid #222', borderRadius:4, color:'#e0d8c8', padding:'6px 2px', fontSize:14, fontFamily:'inherit', outline:'none', cursor:'pointer', textAlign:'center', width:'56px' };
  return (
    <div style={{ display:'flex', alignItems:'center', gap:3 }}>
      <select value={hVal} onChange={handleH} style={sel}>
        <option value=''>hh</option>
        {(showAll?ALL_HOURS:MAIN_HOURS).map(h=><option key={h} value={h} disabled={isHourDisabled(h)} style={{ color:isHourDisabled(h)?'#333':'#e0d8c8' }}>{h.padStart(2,'0')}</option>)}
        {!showAll && <option value='__custom__'>autre…</option>}
      </select>
      <span style={{ color:'#444', fontWeight:700 }}>:</span>
      <select value={mVal} onChange={handleM} style={sel}>
        <option value=''>mm</option>
        {MINUTES.map(m=><option key={m} value={m} disabled={isMinuteDisabled(m)} style={{ color:isMinuteDisabled(m)?'#333':'#e0d8c8' }}>{m.padStart(2,'0')}</option>)}
      </select>
    </div>
  );
}

// ─── TYPE SELECTOR ────────────────────────────────────────────────────────────

function TypeSelector({ value, types, onChange, onToggleFav, onAddType }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const current    = types.find(t => t.id === value);
  const favTypes   = types.filter(t => t.is_favori);
  const otherTypes = types.filter(t => !t.is_favori);
  return (
    <div ref={ref} style={{ position:'relative' }}>
      <button onClick={() => setOpen(o=>!o)} style={{ background:'#0a0a0a', border:'1px solid #2a2a2a', borderRadius:4, color:current?.is_pause?'#8a7a5a':'#c8a96e', padding:'4px 10px 4px 8px', fontSize:11, cursor:'pointer', display:'flex', alignItems:'center', gap:6, fontFamily:'inherit' }}>
        <span>{current?.label||'Choisir…'}</span><span style={{ fontSize:8, color:'#444' }}>▾</span>
      </button>
      {open && (
        <div style={{ position:'absolute', top:'calc(100% + 4px)', left:0, zIndex:30, background:'#141414', border:'1px solid #2a2a2a', borderRadius:8, minWidth:220, boxShadow:'0 8px 24px #000a', overflow:'hidden' }}>
          {favTypes.length > 0 && <>
            <div style={{ fontSize:8, color:'#333', letterSpacing:3, textTransform:'uppercase', padding:'8px 12px 4px' }}>★ Favoris</div>
            {favTypes.map(t => <TypeRow key={t.id} type={t} selected={t.id===value} isFav={true} onSelect={()=>{ onChange(t.id); setOpen(false); }} onToggleFav={()=>onToggleFav(t.id)} />)}
          </>}
          {otherTypes.length > 0 && <>
            <div style={{ fontSize:8, color:'#333', letterSpacing:3, textTransform:'uppercase', padding:'8px 12px 4px', borderTop:'1px solid #1a1a1a' }}>Autres</div>
            {otherTypes.map(t => <TypeRow key={t.id} type={t} selected={t.id===value} isFav={false} onSelect={()=>{ onChange(t.id); setOpen(false); }} onToggleFav={()=>onToggleFav(t.id)} />)}
          </>}
          <div style={{ borderTop:'1px solid #1a1a1a' }}>
            <button onClick={()=>{ setOpen(false); onAddType(); }} style={{ width:'100%', background:'transparent', border:'none', color:'#c8a96e44', padding:'9px 12px', fontSize:10, cursor:'pointer', textAlign:'left', letterSpacing:1, fontFamily:'inherit' }}>+ Nouveau type…</button>
          </div>
        </div>
      )}
    </div>
  );
}

function TypeRow({ type, selected, isFav, onSelect, onToggleFav }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'7px 12px', background:selected?'#1a1a1a':'transparent', cursor:'pointer' }}>
      <span onClick={onSelect} style={{ flex:1, fontSize:11, color:type.is_pause?'#7a6a4a':'#c0b89a' }}>
        {type.label}{type.is_pause && <span style={{ fontSize:9, color:'#4a3a2a', marginLeft:6 }}>(pause)</span>}
      </span>
      <button onClick={onToggleFav} style={{ background:'transparent', border:'none', color:isFav?'#c8a96e':'#2a2a2a', fontSize:13, cursor:'pointer', padding:'0 2px' }}>★</button>
    </div>
  );
}

// ─── APP EMPLOYÉ ──────────────────────────────────────────────────────────────

export default function EmployeApp() {
  const { user, profile, signOut } = useAuth();
  const lastSunday = getLastSunday();

  const [periodeDebut, setPeriodeDebut] = useState(null);
  const [creneaux,     setCreneaux]     = useState([]); // flat list from DB
  const [types,        setTypes]        = useState(TYPES_DEFAULT);
  const [tauxHS,       setTauxHS]       = useState(25);
  const [activeWeek,   setActiveWeek]   = useState(null);
  const [activeDay,    setActiveDay]    = useState(null);
  const [showTypeModal,setShowTypeModal]= useState(false);
  const [newTypeLabel, setNewTypeLabel] = useState('');
  const [newTypePause, setNewTypePause] = useState(false);
  const [saving,       setSaving]       = useState(false);

  // ── Chargement initial ──
  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  const loadData = async () => {
    const [{ data: per }, { data: slots }, { data: typesDB }] = await Promise.all([
      supabase.from('periodes').select('*').eq('user_id', user.id).single(),
      supabase.from('creneaux').select('*').eq('user_id', user.id).order('date').order('ordre'),
      supabase.from('types_activite').select('*').eq('user_id', user.id).order('ordre'),
    ]);

    if (per) setPeriodeDebut(per.debut);
    else {
      // Première utilisation : créer une période par défaut
      const debut = getMonday(addDays(lastSunday, -27));
      await supabase.from('periodes').insert({ user_id: user.id, debut });
      setPeriodeDebut(debut);
    }

    if (slots) setCreneaux(slots);

    if (typesDB && typesDB.length > 0) setTypes(typesDB);
    else {
      // Insérer les types par défaut
      const toInsert = TYPES_DEFAULT.map(t => ({ ...t, user_id: user.id }));
      const { data: inserted } = await supabase.from('types_activite').insert(toInsert).select();
      if (inserted) setTypes(inserted);
    }
  };

  const savePeriode = async (debut) => {
    await supabase.from('periodes').upsert({ user_id: user.id, debut }, { onConflict: 'user_id' });
  };

  // ── Créneaux locaux (par date) ──
  const getSlots = dateStr => creneaux.filter(s => s.date === dateStr).sort((a,b) => a.ordre - b.ordre);

  const addSlot = async (dateStr) => {
    const daySlots = getSlots(dateStr);
    const last = daySlots[daySlots.length - 1];
    const debut = last?.fin || '';
    const ordre = daySlots.length;
    const newSlot = { user_id: user.id, date: dateStr, type_id: types.find(t=>t.is_favori)?.id || 'intervention', debut: debut || null, fin: null, ordre };
    const { data } = await supabase.from('creneaux').insert(newSlot).select().single();
    if (data) setCreneaux(prev => [...prev, data]);
  };

  const updateSlot = async (slotId, field, newValue) => {
    const dbField = field; // debut, fin, type_id
    const val = newValue || null;

    // Mise à jour optimiste locale
    setCreneaux(prev => {
      const idx = prev.findIndex(s => s.id === slotId);
      if (idx === -1) return prev;
      const updated = prev.map((s, i) => {
        if (i === idx) return { ...s, [dbField]: val };
        // Report fin → debut suivant
        if (field === 'fin' && val && i === idx + 1 && prev[idx].date === s.date) {
          return { ...s, debut: val };
        }
        return s;
      });
      // Sauvegarder le suivant aussi si besoin
      const next = updated[idx + 1];
      if (field === 'fin' && val && next && next.date === prev[idx].date) {
        supabase.from('creneaux').update({ debut: val }).eq('id', next.id);
      }
      return updated;
    });

    await supabase.from('creneaux').update({ [dbField]: val }).eq('id', slotId);
  };

  const removeSlot = async (slotId) => {
    setCreneaux(prev => prev.filter(s => s.id !== slotId));
    await supabase.from('creneaux').delete().eq('id', slotId);
  };

  const toggleFav = async (typeId) => {
    const type = types.find(t => t.id === typeId);
    if (!type) return;
    const newFav = !type.is_favori;
    setTypes(prev => prev.map(t => t.id === typeId ? {...t, is_favori: newFav} : t));
    await supabase.from('types_activite').update({ is_favori: newFav }).eq('id', typeId).eq('user_id', user.id);
  };

  const addType = async () => {
    if (!newTypeLabel.trim()) return;
    const newType = { user_id: user.id, label: newTypeLabel.trim(), is_pause: newTypePause, is_favori: true, ordre: types.length };
    const { data } = await supabase.from('types_activite').insert(newType).select().single();
    if (data) setTypes(prev => [...prev, data]);
    setNewTypeLabel(''); setNewTypePause(false); setShowTypeModal(false);
  };

  // ── Stats ──
  const getDayWorked = dateStr => {
    let w = 0;
    getSlots(dateStr).forEach(s => {
      const a = timeToMin(s.debut), b = timeToMin(s.fin);
      if (a===null||b===null) return;
      if (!types.find(t=>t.id===s.type_id)?.is_pause) w += Math.max(0,b-a);
    });
    return w;
  };

  const weeks = periodeDebut ? getWeeksBetween(periodeDebut, lastSunday) : [];

  useEffect(() => {
    if (weeks.length > 0 && activeWeek === null) setActiveWeek(weeks.length - 1);
  }, [weeks.length, periodeDebut]);

  const getWeekStats = week => {
    let totalWorked = 0, daysWithData = 0;
    week.days.forEach(d => {
      const slots = getSlots(d);
      if (slots.length > 0) { totalWorked += getDayWorked(d); daysWithData++; }
    });
    return { totalWorked, daysWithData, hs: totalWorked - CONTRAT_SEMAINE };
  };

  const allStats    = weeks.map(getWeekStats);
  const totalHS     = allStats.reduce((a,s) => a + Math.max(0,s.hs), 0);
  const totalWorked = allStats.reduce((a,s) => a + s.totalWorked, 0);
  const cw = activeWeek !== null && weeks[activeWeek] ? weeks[activeWeek] : null;
  const periodeLabel = weeks.length > 0 ? `${formatDate(periodeDebut)} → ${formatDate(lastSunday)}` : 'Aucune semaine complète';

  const typeColor = id => {
    if (types.find(t=>t.id===id)?.is_pause) return '#5a4a2a';
    const cols = ['#1a3a4a','#1a3a2a','#3a1a4a','#3a3a1a','#1a4a3a','#4a2a1a','#2a1a3a'];
    return cols[types.findIndex(t=>t.id===id) % cols.length] || '#1a3a4a';
  };

  if (!periodeDebut) return <div style={{ color:'#444', textAlign:'center', padding:60, fontFamily:'monospace' }}>Chargement…</div>;

  return (
    <div style={{ fontFamily:"'Courier New',monospace", minHeight:'100vh', background:'#0a0a0a', color:'#e0d8c8', paddingBottom:80 }}>

      {/* HEADER */}
      <div style={{ background:'#0f0f0f', borderBottom:'2px solid #c8a96e', padding:'18px 16px 14px', position:'sticky', top:0, zIndex:20 }}>
        <div style={{ maxWidth:680, margin:'0 auto', display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:8 }}>
          <div>
            <div style={{ fontSize:9, letterSpacing:4, color:'#c8a96e', textTransform:'uppercase', marginBottom:2 }}>
              {profile?.prenom} {profile?.nom}
            </div>
            <div style={{ fontSize:12, color:'#888' }}>{periodeLabel}</div>
          </div>
          <div style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
            <div style={{ textAlign:'right' }}>
              <div style={{ fontSize:8, color:'#444', letterSpacing:2, textTransform:'uppercase' }}>HS à payer</div>
              <div style={{ fontSize:28, fontWeight:700, color:totalHS>0?'#7ecb9b':'#444', letterSpacing:-1 }}>
                +{minToTime(totalHS)}
              </div>
            </div>
            <button onClick={signOut} style={{ background:'transparent', border:'1px solid #222', color:'#444', padding:'5px 10px', borderRadius:4, fontSize:9, letterSpacing:2, textTransform:'uppercase', cursor:'pointer', marginTop:2 }}>⏻</button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth:680, margin:'0 auto', padding:'0 12px' }}>

        {/* CONFIG */}
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 0 10px', borderBottom:'1px solid #161616', flexWrap:'wrap' }}>
          <div>
            <div style={{ fontSize:8, color:'#333', letterSpacing:2, textTransform:'uppercase', marginBottom:3 }}>Début de période</div>
            <input type="date" value={periodeDebut}
              onChange={e => { setPeriodeDebut(e.target.value); savePeriode(e.target.value); setActiveWeek(null); setActiveDay(null); }}
              style={{ background:'#0a0a0a', border:'1px solid #222', color:'#c8a96e', padding:'4px 8px', borderRadius:4, fontSize:11, fontFamily:'inherit' }}
            />
          </div>
          <div style={{ marginLeft:'auto', display:'flex', gap:6, alignItems:'center' }}>
            <span style={{ fontSize:8, color:'#333', letterSpacing:2, textTransform:'uppercase' }}>Majoration</span>
            {[25,50].map(t => (
              <button key={t} onClick={() => setTauxHS(t)} style={{ background:tauxHS===t?'#c8a96e':'transparent', color:tauxHS===t?'#0a0a0a':'#c8a96e', border:'1px solid #c8a96e', borderRadius:3, padding:'3px 8px', fontSize:10, cursor:'pointer' }}>{t}%</button>
            ))}
          </div>
        </div>

        {/* ONGLETS SEMAINES */}
        {weeks.length > 0 && (
          <div style={{ display:'flex', overflowX:'auto', borderBottom:'1px solid #161616', marginTop:14 }}>
            {weeks.map((week,i) => {
              const s = allStats[i];
              return (
                <button key={i} onClick={() => { setActiveWeek(i); setActiveDay(null); }} style={{ flexShrink:0, padding:'7px 10px', background:'transparent', border:'none', borderBottom:activeWeek===i?'2px solid #c8a96e':'2px solid transparent', color:activeWeek===i?'#c8a96e':'#3a3a3a', cursor:'pointer', fontSize:9, letterSpacing:1, marginBottom:-1, textAlign:'center' }}>
                  <div>{formatDate(week.monday)}–{formatDate(week.sunday)}</div>
                  {s.daysWithData > 0 && <div style={{ fontSize:9, color:s.hs>0?'#7ecb9b':s.hs<0?'#e07070':'#444', marginTop:1 }}>{s.hs>=0?'+':''}{minToTime(s.hs)}</div>}
                </button>
              );
            })}
          </div>
        )}

        {/* JOURS */}
        {cw && (
          <div style={{ marginTop:14 }}>
            {cw.days.map((dateStr, idx) => {
              const slots    = getSlots(dateStr);
              const worked   = getDayWorked(dateStr);
              const isWeekend= idx >= 5;
              const isOpen   = activeDay === dateStr;

              // Chevauchements
              const overlaps = new Set();
              for (let i = 0; i < slots.length - 1; i++) {
                const finI = timeToMin(slots[i].fin), debutJ = timeToMin(slots[i+1].debut);
                if (finI !== null && debutJ !== null && debutJ < finI) { overlaps.add(i); overlaps.add(i+1); }
              }

              return (
                <div key={dateStr} style={{ marginBottom:6 }}>
                  <button onClick={() => setActiveDay(isOpen ? null : dateStr)} style={{ width:'100%', display:'flex', justifyContent:'space-between', alignItems:'center', background:isOpen?'#161616':'#111', border:`1px solid ${isOpen?'#2a2a2a':'#181818'}`, borderRadius:isOpen?'8px 8px 0 0':8, padding:'11px 14px', cursor:'pointer', color:'inherit' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <span style={{ fontSize:11, fontWeight:700, letterSpacing:2, textTransform:'uppercase', color:isWeekend?'#5a4a2a':'#c8a96e' }}>{JOURS[idx]}</span>
                      <span style={{ fontSize:10, color:'#333' }}>{formatDate(dateStr)}</span>
                      {slots.length > 0 && <span style={{ fontSize:9, color:'#3a3a3a', background:'#181818', padding:'2px 6px', borderRadius:3 }}>{slots.length} créneau{slots.length>1?'x':''}</span>}
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      {worked > 0 && <span style={{ fontSize:11, color:'#888' }}>{minToTime(worked)}</span>}
                      <span style={{ fontSize:14, color:'#333', transform:isOpen?'rotate(180deg)':'none', transition:'transform 0.2s' }}>▾</span>
                    </div>
                  </button>

                  {isOpen && (
                    <div style={{ background:'#0e0e0e', border:'1px solid #2a2a2a', borderTop:'none', borderRadius:'0 0 8px 8px', padding:'12px' }}>
                      {slots.length === 0 && <div style={{ fontSize:11, color:'#2a2a2a', textAlign:'center', padding:'12px 0' }}>Aucun créneau — appuie sur + pour commencer</div>}

                      {slots.map((slot, si) => {
                        const type    = types.find(t => t.id === slot.type_id);
                        const dur     = timeToMin(slot.debut) !== null && timeToMin(slot.fin) !== null ? timeToMin(slot.fin) - timeToMin(slot.debut) : null;
                        const hasOver = overlaps.has(si);
                        const nextSlot   = si < slots.length-1 ? slots[si+1] : null;
                        const nextDebut  = (nextSlot && nextSlot.fin) ? timeToMin(nextSlot.debut) : null;
                        const thisDebut  = timeToMin(slot.debut);

                        return (
                          <div key={slot.id} style={{ background:typeColor(slot.type_id)+'33', border:`1px solid ${hasOver?'#e07070':typeColor(slot.type_id)+'66'}`, borderRadius:6, padding:'10px 12px', marginBottom:8 }}>
                            {hasOver && <div style={{ fontSize:9, color:'#e07070', letterSpacing:1, marginBottom:8 }}>⚠ Chevauchement</div>}
                            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                              <TypeSelector value={slot.type_id} types={types} onChange={v => updateSlot(slot.id,'type_id',v)} onToggleFav={toggleFav} onAddType={() => setShowTypeModal(true)} />
                              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                                {dur !== null && dur >= 0 && <span style={{ fontSize:10, color:type?.is_pause?'#5a4a2a':'#7ecb9b', fontWeight:700 }}>{type?.is_pause?'−':''}{minToTime(dur)}</span>}
                                <button onClick={() => removeSlot(slot.id)} style={{ background:'transparent', border:'none', color:'#e07070', fontSize:16, cursor:'pointer', padding:'0 2px', lineHeight:1 }}>−</button>
                              </div>
                            </div>
                            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                              <div>
                                <div style={{ fontSize:8, color:'#3a3a3a', letterSpacing:2, textTransform:'uppercase', marginBottom:3 }}>Début</div>
                                <TimeInput key={slot.debut||'d'+slot.id} value={slot.debut||''} onChange={v => updateSlot(slot.id,'debut',v)} />
                              </div>
                              <div>
                                <div style={{ fontSize:8, color:'#3a3a3a', letterSpacing:2, textTransform:'uppercase', marginBottom:3 }}>Fin</div>
                                <TimeInput key={slot.fin||'f'+slot.id} value={slot.fin||''} onChange={v => updateSlot(slot.id,'fin',v)} minTime={thisDebut} maxTime={nextDebut} />
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      <button onClick={() => addSlot(dateStr)} style={{ width:'100%', background:'transparent', border:'1px dashed #2a2a2a', borderRadius:6, color:'#c8a96e', padding:'8px', fontSize:11, cursor:'pointer', letterSpacing:2, textTransform:'uppercase', marginTop:4 }}>+ Ajouter un créneau</button>

                      {worked > 0 && (
                        <div style={{ display:'flex', justifyContent:'flex-end', marginTop:10, gap:16 }}>
                          <span style={{ fontSize:10, color:'#444' }}>Total travaillé :</span>
                          <span style={{ fontSize:12, fontWeight:700, color:'#e0d8c8' }}>{minToTime(worked)}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Récap semaine */}
            {(() => {
              const s = cw ? getWeekStats(cw) : null;
              if (!s || s.daysWithData === 0) return null;
              return (
                <div style={{ background:'#111', border:'1px solid #1e1e1e', borderRadius:8, padding:'14px 16px', display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginTop:6 }}>
                  {[
                    { label:'TRAVAILLÉ',     value:minToTime(s.totalWorked), color:'#e0d8c8' },
                    { label:'CONTRAT (35h)', value:'35h00',                  color:'#555' },
                    { label:'SOLDE SEMAINE', value:`${s.hs>=0?'+':''}${minToTime(s.hs)}`, color:s.hs>0?'#7ecb9b':s.hs<0?'#e07070':'#444' },
                  ].map(({ label, value, color }) => (
                    <div key={label}>
                      <div style={{ fontSize:8, color:'#333', letterSpacing:2, marginBottom:3 }}>{label}</div>
                      <div style={{ fontSize:16, fontWeight:700, color }}>{value}</div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        )}

        {/* BILAN */}
        {weeks.length > 0 && (
          <div style={{ background:'#0d0d0d', border:'1px solid #c8a96e18', borderRadius:8, padding:'18px', marginTop:14 }}>
            <div style={{ fontSize:8, letterSpacing:3, color:'#c8a96e', textTransform:'uppercase', marginBottom:14 }}>Bilan — {periodeLabel}</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:totalHS>0?12:0 }}>
              {[
                { label:'TOTAL TRAVAILLÉ',       value:minToTime(totalWorked),  color:'#e0d8c8' },
                { label:'HS TOTALES',             value:`+${minToTime(totalHS)}`, color:totalHS>0?'#7ecb9b':'#444' },
                { label:`ÉQUIV. PAYÉ (${tauxHS}%)`, value:totalHS>0?minToTime(Math.round(totalHS*(1+tauxHS/100))):'—', color:'#c8a96e' },
              ].map(({ label, value, color }) => (
                <div key={label}>
                  <div style={{ fontSize:8, color:'#333', letterSpacing:2, marginBottom:3 }}>{label}</div>
                  <div style={{ fontSize:17, fontWeight:700, color }}>{value}</div>
                </div>
              ))}
            </div>
            {totalHS > 0 && (
              <div style={{ background:'#0a0a0a', borderRadius:5, padding:'10px 12px', fontSize:11, color:'#4a4a4a', lineHeight:1.8 }}>
                <span style={{ color:'#7ecb9b', fontWeight:700 }}>{minToTime(totalHS)}</span> d'HS → rémunérées comme{' '}
                <span style={{ color:'#e0d8c8', fontWeight:700 }}>{minToTime(Math.round(totalHS*(1+tauxHS/100)))}</span> d'heures normales ({tauxHS}%).
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODAL NOUVEAU TYPE */}
      {showTypeModal && (
        <div style={{ position:'fixed', inset:0, background:'#000000cc', zIndex:50, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ background:'#141414', border:'1px solid #2a2a2a', borderRadius:10, padding:24, width:280 }}>
            <div style={{ fontSize:10, color:'#c8a96e', letterSpacing:3, textTransform:'uppercase', marginBottom:16 }}>Nouveau type</div>
            <input placeholder="Nom de l'activité" value={newTypeLabel} onChange={e => setNewTypeLabel(e.target.value)}
              style={{ width:'100%', background:'#0a0a0a', border:'1px solid #222', borderRadius:4, color:'#e0d8c8', padding:'8px 10px', fontSize:13, fontFamily:'inherit', boxSizing:'border-box', outline:'none', marginBottom:12 }}
            />
            <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:11, color:'#666', marginBottom:18, cursor:'pointer' }}>
              <input type="checkbox" checked={newTypePause} onChange={e => setNewTypePause(e.target.checked)} />
              Ne compte pas dans les heures travaillées
            </label>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={() => { setShowTypeModal(false); setNewTypeLabel(''); }} style={{ flex:1, background:'transparent', border:'1px solid #222', color:'#555', padding:'8px', borderRadius:4, fontSize:11, cursor:'pointer' }}>Annuler</button>
              <button onClick={addType} style={{ flex:1, background:'#c8a96e', border:'none', color:'#0a0a0a', padding:'8px', borderRadius:4, fontSize:11, fontWeight:700, cursor:'pointer' }}>Créer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
