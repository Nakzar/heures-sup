import { useState } from 'react';
import { useAuth } from '../lib/AuthContext';

const S = {
  page:    { minHeight:'100vh', background:'#0a0a0a', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Courier New',monospace", padding:16 },
  card:    { background:'#111', border:'1px solid #222', borderRadius:12, padding:32, width:'100%', maxWidth:380 },
  title:   { fontSize:10, letterSpacing:4, color:'#c8a96e', textTransform:'uppercase', marginBottom:24 },
  label:   { fontSize:9, color:'#444', letterSpacing:2, textTransform:'uppercase', marginBottom:4, display:'block' },
  input:   { width:'100%', background:'#0a0a0a', border:'1px solid #222', borderRadius:4, color:'#e0d8c8', padding:'10px 12px', fontSize:13, fontFamily:'inherit', boxSizing:'border-box', outline:'none', marginBottom:14 },
  row:     { display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 },
  btn:     { width:'100%', background:'#c8a96e', border:'none', color:'#0a0a0a', padding:'11px', borderRadius:4, fontSize:12, fontWeight:700, cursor:'pointer', letterSpacing:1, marginTop:6 },
  btnSec:  { width:'100%', background:'transparent', border:'1px solid #222', color:'#666', padding:'11px', borderRadius:4, fontSize:11, cursor:'pointer', marginTop:10 },
  error:   { fontSize:11, color:'#e07070', marginBottom:12, padding:'8px 10px', background:'#1a0a0a', borderRadius:4, border:'1px solid #e0707033' },
  success: { fontSize:11, color:'#7ecb9b', marginBottom:12, padding:'8px 10px', background:'#0a1a0a', borderRadius:4, border:'1px solid #7ecb9b33' },
  select:  { width:'100%', background:'#0a0a0a', border:'1px solid #222', borderRadius:4, color:'#e0d8c8', padding:'10px 12px', fontSize:13, fontFamily:'inherit', boxSizing:'border-box', outline:'none', marginBottom:14 },
};

export default function LoginPage() {
  const { signIn, signUp } = useAuth();
  const [mode,     setMode]     = useState('login'); // 'login' | 'signup'
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [nom,      setNom]      = useState('');
  const [prenom,   setPrenom]   = useState('');
  const [role,     setRole]     = useState('employe');
  const [error,    setError]    = useState('');
  const [success,  setSuccess]  = useState('');
  const [loading,  setLoading]  = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    const { error } = await signIn(email, password);
    if (error) setError(error.message === 'Invalid login credentials' ? 'Email ou mot de passe incorrect.' : error.message);
    setLoading(false);
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setError(''); setSuccess(''); setLoading(true);
    if (!nom.trim() || !prenom.trim()) { setError('Nom et prénom requis.'); setLoading(false); return; }
    if (password.length < 6) { setError('Mot de passe : 6 caractères minimum.'); setLoading(false); return; }
    const { error } = await signUp(email, password, nom, prenom, role);
    if (error) setError(error.message);
    else setSuccess('Compte créé ! Vérifie ta boîte mail pour confirmer.');
    setLoading(false);
  };

  return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={S.title}>{mode === 'login' ? 'Connexion' : 'Créer un compte'}</div>

        {error   && <div style={S.error}>{error}</div>}
        {success && <div style={S.success}>{success}</div>}

        <form onSubmit={mode === 'login' ? handleLogin : handleSignup}>
          {mode === 'signup' && (
            <>
              <div style={S.row}>
                <div>
                  <label style={S.label}>Prénom</label>
                  <input style={S.input} value={prenom} onChange={e=>setPrenom(e.target.value)} required />
                </div>
                <div>
                  <label style={S.label}>Nom</label>
                  <input style={S.input} value={nom} onChange={e=>setNom(e.target.value)} required />
                </div>
              </div>
              <label style={S.label}>Rôle</label>
              <select style={S.select} value={role} onChange={e=>setRole(e.target.value)}>
                <option value="employe">Employé</option>
                <option value="employeur">Employeur</option>
              </select>
            </>
          )}

          <label style={S.label}>Email</label>
          <input style={S.input} type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="email" />

          <label style={S.label}>Mot de passe</label>
          <input style={S.input} type="password" value={password} onChange={e=>setPassword(e.target.value)} required autoComplete={mode==='login'?'current-password':'new-password'} />

          <button style={S.btn} type="submit" disabled={loading}>
            {loading ? '…' : mode === 'login' ? 'Se connecter' : 'Créer le compte'}
          </button>
        </form>

        <button style={S.btnSec} onClick={()=>{ setMode(m=>m==='login'?'signup':'login'); setError(''); setSuccess(''); }}>
          {mode === 'login' ? 'Pas encore de compte ? Créer un compte' : 'Déjà un compte ? Se connecter'}
        </button>
      </div>
    </div>
  );
}
