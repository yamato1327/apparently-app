-- Restrict Realtime channel subscriptions to topics scoped to the user's own ID
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read own-topic realtime messages" ON realtime.messages;
CREATE POLICY "Authenticated users can read own-topic realtime messages"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() LIKE '%' || auth.uid()::text || '%'
);

DROP POLICY IF EXISTS "Authenticated users can send own-topic realtime messages" ON realtime.messages;
CREATE POLICY "Authenticated users can send own-topic realtime messages"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  realtime.topic() LIKE '%' || auth.uid()::text || '%'
);
