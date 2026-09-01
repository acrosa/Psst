-- Enabling RLS is safe only because the app connects as the tables' owner
-- (owners bypass RLS). If that ever stops being true, fail the deploy loudly
-- rather than silently returning zero rows to the live app.
DO $$
DECLARE
	owner text;
BEGIN
	SELECT tableowner INTO owner FROM pg_tables WHERE schemaname = 'public' AND tablename = 'users';
	IF owner IS NOT NULL AND NOT pg_has_role(current_user, owner, 'MEMBER') THEN
		RAISE EXCEPTION
			'Refusing to enable RLS: % does not own the tables (owner: %) and would be denied every row.',
			current_user, owner;
	END IF;
END
$$;--> statement-breakpoint
ALTER TABLE "accounts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "canvases" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "invites" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "item_assets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "item_comments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "item_reactions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "item_unfurls" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "push_devices" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "space_members" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "spaces" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "verifications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
-- Belt and braces: PostgREST reaches these tables as anon/authenticated, and
-- Supabase grants those roles table privileges by default. RLS already denies
-- them every row; this removes the privilege too. Guarded — the roles only
-- exist on Supabase.
DO $$
BEGIN
	IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
		REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
		REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
	END IF;
	IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
		REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;
		REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM authenticated;
	END IF;
END
$$;
