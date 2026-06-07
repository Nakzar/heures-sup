-- ============================================================
-- SCHÉMA BASE DE DONNÉES — Heures Supplémentaires
-- À coller et exécuter dans Supabase > SQL Editor
-- ============================================================

-- 1. Table des profils utilisateurs (complète auth.users)
CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nom         TEXT NOT NULL,
  prenom      TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'employe' CHECK (role IN ('employe', 'employeur')),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Table des périodes de paie (une par utilisateur par mois)
CREATE TABLE periodes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  debut        DATE NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)  -- une seule période active par utilisateur
);

-- 3. Table des créneaux horaires
CREATE TABLE creneaux (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date       DATE NOT NULL,
  type_id    TEXT NOT NULL,
  debut      TIME,
  fin        TIME,
  ordre      INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Table des types d'activité personnalisés
CREATE TABLE types_activite (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  label      TEXT NOT NULL,
  is_pause   BOOLEAN NOT NULL DEFAULT FALSE,
  is_favori  BOOLEAN NOT NULL DEFAULT FALSE,
  ordre      INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SÉCURITÉ : Row Level Security (chacun ne voit que ses données)
-- ============================================================

ALTER TABLE profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE periodes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE creneaux       ENABLE ROW LEVEL SECURITY;
ALTER TABLE types_activite ENABLE ROW LEVEL SECURITY;

-- Profiles : chacun voit le sien, l'employeur voit tout
CREATE POLICY "profil_self" ON profiles
  FOR ALL USING (auth.uid() = id);

CREATE POLICY "profil_employeur" ON profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'employeur')
  );

-- Créneaux : chacun gère les siens, l'employeur lit tout
CREATE POLICY "creneaux_self" ON creneaux
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "creneaux_employeur" ON creneaux
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'employeur')
  );

-- Périodes : idem
CREATE POLICY "periodes_self" ON periodes
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "periodes_employeur" ON periodes
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'employeur')
  );

-- Types : chacun gère les siens
CREATE POLICY "types_self" ON types_activite
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- FONCTION : création automatique du profil à l'inscription
-- ============================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, nom, prenom, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nom', 'Inconnu'),
    COALESCE(NEW.raw_user_meta_data->>'prenom', 'Inconnu'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'employe')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
