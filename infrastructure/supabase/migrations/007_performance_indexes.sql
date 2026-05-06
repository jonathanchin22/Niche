-- Performance indexes for hot read paths.
--
-- 1. review_comments — getReviewComments() filters by review_id and orders by
--    created_at desc. Without a covering index this is a sort over a full
--    range scan on every modal open.
-- 2. follows — primary key (follower_id, following_id) covers getFollowing
--    (filter on follower_id) but not getFollowers (filter on following_id).

create index if not exists review_comments_review_id_created_at_idx
  on review_comments(review_id, created_at desc);

create index if not exists follows_following_id_idx
  on follows(following_id);
