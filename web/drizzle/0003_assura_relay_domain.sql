UPDATE "users"
SET "masked_inbox" = regexp_replace("masked_inbox", '@relay\.fineprint\.local$', '@relay.assura.local')
WHERE "masked_inbox" LIKE '%@relay.fineprint.local';
