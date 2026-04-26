-- Enable RLS on realtime.messages to control who can subscribe to Realtime channels
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

-- Deny all anonymous access to realtime channels
CREATE POLICY "Deny anonymous realtime access"
ON realtime.messages
AS RESTRICTIVE
FOR SELECT
TO anon
USING (false);

CREATE POLICY "Deny anonymous realtime inserts"
ON realtime.messages
AS RESTRICTIVE
FOR INSERT
TO anon
WITH CHECK (false);

-- Allow authenticated users to subscribe/receive on channels.
-- This permits postgres_changes subscriptions (which still respect each table's own RLS),
-- while ensuring anonymous users cannot subscribe at all.
CREATE POLICY "Authenticated can read realtime messages"
ON realtime.messages
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated can send realtime messages"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (true);