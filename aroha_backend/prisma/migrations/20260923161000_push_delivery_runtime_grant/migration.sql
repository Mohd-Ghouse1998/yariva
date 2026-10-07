-- PushDelivery was introduced after the runtime role's baseline table grants.
-- Mirror Notification's SELECT grantees without hard-coding an environment-
-- specific application role. Run schema migrations with the table-owner role.
DO $$
DECLARE
  runtime_role text;
BEGIN
  FOR runtime_role IN
    SELECT DISTINCT grantee
    FROM information_schema.role_table_grants
    WHERE table_schema = 'public'
      AND table_name = 'Notification'
      AND privilege_type = 'SELECT'
      AND grantee <> 'PUBLIC'
  LOOP
    EXECUTE format(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I.%I TO %I',
      'public',
      'PushDelivery',
      runtime_role
    );
  END LOOP;
END $$;
