# Guide de déploiement — Heures Supplémentaires
## Vercel + Supabase

---

## ÉTAPE 1 — Créer le projet Supabase

1. Va sur https://supabase.com et crée un compte gratuit
2. Clique **New Project**, donne-lui un nom (ex: "heures-sup")
3. Choisis un mot de passe pour la base de données (note-le)
4. Attends 1-2 minutes que le projet se crée

### Configurer la base de données
5. Dans le menu gauche : **SQL Editor**
6. Clique **New query**
7. Copie-colle tout le contenu du fichier `supabase_schema.sql`
8. Clique **Run** (▶)
   → Tu dois voir "Success. No rows returned"

### Récupérer les clés API
9. Menu gauche : **Project Settings** → **API**
10. Note ces deux valeurs :
    - **Project URL** → ressemble à `https://abcdefgh.supabase.co`
    - **anon public key** → longue chaîne commençant par `eyJ...`

### Activer la confirmation email (optionnel)
11. **Authentication** → **Email** → tu peux désactiver "Confirm email" pour simplifier les tests

---

## ÉTAPE 2 — Configurer le projet

1. Dans le dossier du projet, copie le fichier d'exemple :
   ```
   cp .env.example .env.local
   ```

2. Ouvre `.env.local` et remplace les valeurs :
   ```
   REACT_APP_SUPABASE_URL=https://TONPROJET.supabase.co
   REACT_APP_SUPABASE_ANON_KEY=eyTACLEANONYME...
   ```

---

## ÉTAPE 3 — Déployer sur Vercel

### Option A — Via GitHub (recommandé)
1. Crée un compte sur https://github.com si tu n'en as pas
2. Crée un nouveau repository (bouton +)
3. Upload tous les fichiers du projet dedans
4. Va sur https://vercel.com et connecte-toi avec GitHub
5. Clique **Add New Project** → importe ton repository
6. Dans **Environment Variables**, ajoute :
   - `REACT_APP_SUPABASE_URL` = ton URL Supabase
   - `REACT_APP_SUPABASE_ANON_KEY` = ta clé anon
7. Clique **Deploy**
8. Vercel te donne une URL publique (ex: `heures-sup.vercel.app`)

### Option B — Via Vercel CLI
```bash
npm install -g vercel
cd heures-sup
vercel
# Suis les instructions, entre les variables d'environnement quand demandé
```

---

## ÉTAPE 4 — Créer les comptes

1. Ouvre l'URL de ton application
2. Clique **Pas encore de compte ? Créer un compte**
3. Crée d'abord le compte **Employeur** (rôle = Employeur)
4. Ensuite crée les comptes de chaque **Employé**
5. Partage l'URL avec tes collègues pour qu'ils créent leur compte

---

## RÉSUMÉ DES RÔLES

| Rôle | Ce qu'il voit |
|------|--------------|
| Employé | Ses propres heures uniquement |
| Employeur | Tableau de bord avec tous les employés |

---

## COÛTS

- **Supabase** : gratuit jusqu'à 500 MB de données et 50 000 utilisateurs actifs/mois
- **Vercel** : gratuit pour les projets personnels

Pour une petite équipe, tout reste gratuit.

---

## BESOIN D'AIDE ?

Si tu bloques sur une étape, note exactement où tu es et l'erreur affichée.
