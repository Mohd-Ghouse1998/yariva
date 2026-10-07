# Indian demo profiles and portrait assets

Four fictional adult Hyderabad profiles: Aarav (28), Vihaan (26), Ishita (27), Kavya (29). Names carry a Demo suffix and bios explicitly identify fictional people and AI-generated portraits. They are unverified demo profiles, not real members.

The built-in image-generation tool created one distinct portrait per profile. The original 1086×1448 PNGs are stored here and uploaded to the existing private local profile-photo bucket. No real person's photograph was scraped, and no phone screenshots were captured for this work.

Run from the backend directory:

    npm run prisma:seed:indian-demo

This additive seed reuses the existing complete-profile builder. It is guarded to the local aroha_live database and local storage/Redis services, and refuses production. It upserts only the four reserved demo accounts, uploads their seed-owned media, commits profile changes atomically, and invalidates only the configured demo viewer's discovery snapshot. Existing conversations, matches, profiles and viewer preferences are preserved. Do not substitute the full demo seed: that script also resets demo conversations.

The current signed-in demo viewer filters for women. Kavya and Ishita are discoverable under those preferences; men are available when matching preferences permit. The daily curated limit remains eight.

## Generation prompt set

Shared specification used for each standalone image:

> Create ONE standalone vertical photorealistic portrait for a fictional local dating-app demo profile. Entirely synthetic person; do not resemble a celebrity or identifiable real person. Clearly adult. Natural everyday photograph, realistic skin texture and proportions, modern but approachable; no glamour retouching, no beauty filter. Single person only, face unobstructed near upper center with ample crop-safe margins. Portrait 3:4 composition. No text, watermark, badge, logo or collage.

Individual subject descriptions inserted after the first sentence:

- aarav.png: An original fictional Indian man, age 28, medium brown skin, short textured black hair, light stubble, friendly natural smile, navy cotton overshirt. Waist-up candid portrait outdoors on a shaded Hyderabad cafe terrace, soft daylight, subtle green background, subject looking toward camera.
- vihaan.png: An original fictional Indian man, age 26, deep brown skin, clean shaven, curly black hair, round eyeglasses, warm relaxed smile, olive linen shirt. Waist-up candid portrait in a leafy urban park in Hyderabad, gentle afternoon daylight, subject looking toward camera.
- ishita.png: An original fictional Indian woman, age 27, medium brown skin, shoulder-length wavy black hair, minimal natural makeup, warm relaxed smile, cream casual top and small earrings. Waist-up candid portrait at a contemporary Hyderabad outdoor cafe, soft daylight, subject looking toward camera.
- kavya.png: An original fictional Indian woman, age 29, deep brown skin, long black hair tied loosely, expressive natural smile, simple teal cotton kurta and small earrings. Waist-up candid portrait in a leafy public park in Hyderabad, soft golden afternoon light, subject looking toward camera.

## Verification — 29 September 2026

- Seed modules compile on import without executing either seed; backend TypeScript/lint passed.
- Two live seed runs resulted in exactly four profiles and one portrait per profile, with stable user and photo IDs.
- Existing messages, original demo profiles and existing discovery preferences matched their pre-seed fingerprints after the first run.
- All four public-profile APIs and signed private photo downloads returned successfully.
- Wireless Samsung live Discover displayed Kavya as one of three available profiles; API feed included Kavya and Ishita. No screenshots used for device inspection.
- Local pre-seed backup: /tmp/yariva-before-indian-demo-20260929.dump.
