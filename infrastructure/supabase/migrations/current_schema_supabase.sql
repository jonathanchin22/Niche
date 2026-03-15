-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.app_memberships (
  user_id uuid NOT NULL,
  app_id USER-DEFINED NOT NULL,
  joined_at timestamp with time zone NOT NULL DEFAULT now(),
  xp integer NOT NULL DEFAULT 0,
  badges jsonb NOT NULL DEFAULT '[]'::jsonb,
  CONSTRAINT app_memberships_pkey PRIMARY KEY (user_id, app_id),
  CONSTRAINT app_memberships_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.coffee_drink_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  drink_name text NOT NULL,
  cafe text NOT NULL,
  origin_roast text,
  rating smallint NOT NULL CHECK (rating >= 1 AND rating <= 5),
  tasting_notes ARRAY NOT NULL DEFAULT '{}'::text[],
  notes text,
  photo_main_url text,
  photo_detail1_url text,
  photo_detail2_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT coffee_drink_logs_pkey PRIMARY KEY (id),
  CONSTRAINT coffee_drink_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.follows (
  follower_id uuid NOT NULL,
  following_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT follows_pkey PRIMARY KEY (follower_id, following_id),
  CONSTRAINT follows_follower_id_fkey FOREIGN KEY (follower_id) REFERENCES public.profiles(id),
  CONSTRAINT follows_following_id_fkey FOREIGN KEY (following_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  type USER-DEFINED NOT NULL,
  actor_id uuid,
  review_id uuid,
  comment_id uuid,
  badge_id text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT notifications_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.profiles(id),
  CONSTRAINT notifications_review_id_fkey FOREIGN KEY (review_id) REFERENCES public.reviews(id),
  CONSTRAINT notifications_comment_id_fkey FOREIGN KEY (comment_id) REFERENCES public.review_comments(id)
);
CREATE TABLE public.places (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  app_id USER-DEFINED NOT NULL,
  name text NOT NULL,
  address text NOT NULL,
  city text NOT NULL,
  state text NOT NULL,
  country text NOT NULL DEFAULT 'US'::text,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  location USER-DEFINED DEFAULT (st_point(lng, lat))::geography,
  google_place_id text,
  foursquare_id text,
  cover_image_url text,
  avg_score numeric,
  review_count integer NOT NULL DEFAULT 0,
  fts tsvector DEFAULT to_tsvector('english'::regconfig, ((((name || ' '::text) || COALESCE(city, ''::text)) || ' '::text) || COALESCE(state, ''::text))),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  latitude double precision,
  longitude double precision,
  CONSTRAINT places_pkey PRIMARY KEY (id)
);
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  email text NOT NULL UNIQUE,
  username text NOT NULL UNIQUE CHECK (char_length(username) >= 2 AND char_length(username) <= 30),
  display_name text NOT NULL,
  avatar_url text,
  bio text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  location text,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.review_comments (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  review_id uuid NOT NULL,
  user_id uuid NOT NULL,
  body text NOT NULL CHECK (char_length(body) >= 1 AND char_length(body) <= 500),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT review_comments_pkey PRIMARY KEY (id),
  CONSTRAINT review_comments_review_id_fkey FOREIGN KEY (review_id) REFERENCES public.reviews(id),
  CONSTRAINT review_comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.review_votes (
  review_id uuid NOT NULL,
  user_id uuid NOT NULL,
  vote smallint NOT NULL CHECK (vote = ANY (ARRAY[1, '-1'::integer])),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT review_votes_pkey PRIMARY KEY (review_id, user_id),
  CONSTRAINT review_votes_review_id_fkey FOREIGN KEY (review_id) REFERENCES public.reviews(id),
  CONSTRAINT review_votes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.reviews (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  app_id USER-DEFINED NOT NULL,
  user_id uuid NOT NULL,
  place_id uuid NOT NULL,
  score numeric NOT NULL CHECK (score >= 0::numeric AND score <= 10::numeric),
  category text,
  item_name text,
  note text,
  tags ARRAY NOT NULL DEFAULT '{}'::text[],
  image_urls ARRAY NOT NULL DEFAULT '{}'::text[],
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  body text,
  taste_attributes jsonb,
  customizations ARRAY NOT NULL DEFAULT '{}'::text[],
  toppings ARRAY NOT NULL DEFAULT '{}'::text[],
  quality_signals jsonb,
  visit_context text CHECK (visit_context IS NULL OR (visit_context = ANY (ARRAY['solo'::text, 'date'::text, 'group'::text, 'work'::text, 'takeout'::text, 'delivery'::text]))),
  revisit_intent boolean,
  price_paid numeric,
  CONSTRAINT reviews_pkey PRIMARY KEY (id),
  CONSTRAINT reviews_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT reviews_place_id_fkey FOREIGN KEY (place_id) REFERENCES public.places(id)
);
CREATE TABLE public.spatial_ref_sys (
  srid integer NOT NULL CHECK (srid > 0 AND srid <= 998999),
  auth_name character varying,
  auth_srid integer,
  srtext character varying,
  proj4text character varying,
  CONSTRAINT spatial_ref_sys_pkey PRIMARY KEY (srid)
);