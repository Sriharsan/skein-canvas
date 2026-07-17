
-- rate_limits: server-only bookkeeping for per-key request throttling.
-- No RLS policies are defined, so with RLS enabled anon/authenticated have
-- zero access; only service_role (which bypasses RLS) can touch this table.
CREATE TABLE public.rate_limits (
  key TEXT PRIMARY KEY,
  window_start TIMESTAMPTZ NOT NULL,
  count INT NOT NULL DEFAULT 0
);
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.rate_limits TO service_role;

-- Atomically increments the counter for the current fixed window and
-- returns the post-increment count, so callers can compare against a limit
-- without a separate read-then-write race.
CREATE OR REPLACE FUNCTION public.check_rate_limit(p_key TEXT, p_window_seconds INT)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_window_start TIMESTAMPTZ := to_timestamp(floor(extract(epoch FROM now()) / p_window_seconds) * p_window_seconds);
  v_count INT;
BEGIN
  INSERT INTO public.rate_limits (key, window_start, count)
  VALUES (p_key, v_window_start, 1)
  ON CONFLICT (key) DO UPDATE SET
    count = CASE WHEN public.rate_limits.window_start = v_window_start THEN public.rate_limits.count + 1 ELSE 1 END,
    window_start = v_window_start
  RETURNING count INTO v_count;
  RETURN v_count;
END; $$;
REVOKE EXECUTE ON FUNCTION public.check_rate_limit(TEXT, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(TEXT, INT) TO service_role;
