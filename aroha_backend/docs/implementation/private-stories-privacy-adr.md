# Private Stories privacy decision (30 September 2026)

Status: development validation includes private photo/video upload, bounded media reads, direct Story reporting, and a focused privacy suite. Media processing, cleanup, notifications, and rollout acceptance remain open.

## Existing contracts and boundary

`Match.status=ACTIVE` is a mutual connection. No approved follow relationship existed, so `PrivateFollow` records requester, owner, and pending/approved status. A Like, inactive Match, or unapproved follow never qualifies. The existing `Block` relation is checked in both directions at each read. `Scene` is a public 12-hour activity object and stays separate. Existing profile-photo/Scene storage uses signed object URLs; those paths are not reused for private Story text or media. Reports now accept an explicit Story target only after the reporter passes the same Story-read policy; a report opens the existing moderation case. Existing notification services do not receive Story events yet.

## Decision

`PrivateStory` contains optional text, optional private media reference, owner, fixed 24-hour server expiry, selected/all-approved rule, optional community filter and deletion timestamp. `PrivateStoryGrant` snapshots recipient IDs at publication or confirmed edit. `PrivateCommunityPreference` stores optional identity, connection interests, and affirmative Story-community opt-ins separately. None derives from `UserDiscoveryPreference.preferredGenders`. Grants are bounded to 100 per Story. A community filter intersects approved grants with private opt-ins; the opt-in is checked again when opening.

The private-stories module owns audience resolution and the effective read rule. HTTP authorization is required. For a recipient, read requires an active Story and both accounts active, no block in either direction, an active Match or approved incoming follow, a Story grant, and any community opt-in. Owner reads require an active owner account and active Story. Guessing an ID returns the same 404 as an absent Story. Feed rows use the same read rule; mobile displays no cached Story text until detail is rechecked. Audience preview returns only a count, never another person's labels. An all-approved audience is a publish-time snapshot. Audience expansion requires explicit confirmation, with grant replacement and Story edit in a serializable transaction. Approval and deletion are owner-scoped; follow removal has separate incoming and outgoing routes.

| Case | Access result |
| --- | --- |
| Owner, active Story | Read/edit/delete |
| Approved Match/follow and grant | Read while all other conditions remain true |
| Approved connection without grant | Deny |
| Grant without current approved relationship | Deny |
| Block either way, expired/deleted Story, inactive account | Deny |
| Community-filtered grant without current opt-in | Deny |
| Stranger, pending follower, past Match, guessed ID | Deny |

## Lifecycle and risks

Creation snapshots grants and sets expiry from server time. Edits replace grants; a removed viewer loses future reads immediately. Deletion is a soft delete and stops reads immediately. Already seen content cannot be recalled from memory or screenshots. A recipient could retain text from an already open system dialog; the next server read fails. Physical deletion after 30 days is the proposed retention policy and still needs a worker. Photo and video uploads use a ten-minute signed PUT to a private object bucket under an owner-scoped random key. Creation checks size, MIME, owner/token metadata and a basic file signature. A Story detail request checks the full viewer policy before issuing a 60-second signed GET; image previews use a 10-second URL after the same policy check and no-store response. An already issued detail URL may work for up to 60 seconds after a block, follow revocation, deletion or expiry. Existing uploaded image EXIF is not stripped, media is not transcoded/scanned/moderated, and orphan upload cleanup is not implemented. The media path remains behind the default-off flag and is not ready for broad rollout. Notification copy, if introduced, must be generic and must recheck access before dispatch. Direct Story reporting validates the target against a Story the reporter can read and opens a moderation case; durable evidence retention for moderators remains open.

The first migration adds three independent tables, indexes, uniqueness constraints and foreign keys. The second adds optional media metadata and permits a media Story with no caption without modifying `Scene`, `Match`, discovery gender settings, or existing content. The local database was backed up before migration. No public capability should be announced until private media, abuse/report handling, retention worker, focused race tests, and device accessibility acceptance are complete. A server rollout flag and disabled default are the intended release control. The current code is a development slice and should not be treated as a production launch.
