-- ====================================================================
-- DPS65 - SCRIPT DE VÉRIFICATION DES PERMISSIONS SUPABASE
-- ====================================================================
-- Exécutez cette requête dans le SQL Editor de Supabase pour confirmer
-- que toutes les tables disposent des permissions requises pour anon,
-- authenticated et service_role.

-- 1. VÉRIFICATION DES PRIVILÈGES SUR LES 17 TABLES DU SCHÉMA PUBLIC
SELECT 
    table_name,
    grantee,
    string_agg(privilege_type, ', ' ORDER BY privilege_type) as granted_privileges
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND grantee IN ('anon', 'authenticated', 'service_role')
GROUP BY table_name, grantee
ORDER BY table_name, grantee;

-- 2. VÉRIFICATION DES TABLES ACCESSIBLES AU RÔLE ANON
-- Doit lister uniquement les tables publiques nécessaires : config, courses, documents, events, missions, news
SELECT 
    table_name,
    privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND grantee = 'anon'
ORDER BY table_name;

-- 3. VÉRIFICATION DES PRIVILÈGES SUR LES FONCTIONS RPC
SELECT 
    routine_name,
    grantee,
    privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
  AND grantee IN ('anon', 'authenticated', 'service_role')
ORDER BY routine_name, grantee;

-- 4. VÉRIFICATION DES DEFAULT PRIVILEGES POUR LES FUTURES TABLES
SELECT 
    pg_get_userbyid(defaclrole) AS grantor_role,
    CASE defaclobjtype
        WHEN 'r' THEN 'Tables'
        WHEN 'S' THEN 'Sequences'
        WHEN 'f' THEN 'Functions'
        WHEN 'T' THEN 'Types'
        WHEN 'n' THEN 'Schemas'
    END AS object_type,
    defaclacl AS default_permissions
FROM pg_default_acl
WHERE defaclnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
