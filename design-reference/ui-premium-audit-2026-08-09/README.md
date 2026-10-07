# Aroha UI/UX audit and premium polish

## Audit scope

- Core mobile dating journey: welcome, sign-in, Discover, full profile, Connections, Date Plans, Chats, Profile, Settings, and Appearance.
- Responsive checkpoints: 320×568 and 390×844.
- Themes: system dark and explicit light.
- Evidence was captured from the running Expo web build during this audit.

## User goal and accessibility target

People should understand what to do without instruction, scan a curated profile feed comfortably, open a complete profile before expressing interest, and move from a mutual match to a safe public Date Plan. Controls should remain legible and usable at compact phone widths, with 44px targets and useful accessible names.

## Overall verdict

The product already had a warm, adult visual foundation. Chats, profile detail, Connections, and Date Plans were the strongest surfaces. The main Discover screen felt more like a long catalog because explanatory copy delayed the first profile. Dark-mode theme conflicts also hid the welcome headline and Profile edit label in specific states.

After the changes, Aroha has a more familiar editorial/social-feed rhythm without becoming an endless engagement feed. The daily set remains capped at eight and full-profile review remains the primary decision path.

## Numbered flow review

1. **Welcome — healthy after fix.** The value proposition, portraits, and primary/secondary actions have strong hierarchy. The background now respects dark mode, so the headline remains visible.
2. **Sign-in and account creation — healthy.** Forms are short and predictable. The Aroha wordmark now anchors sign-in, and shared fields expose their visible labels to assistive technology.
3. **Discover — healthy after redesign.** The first profile appears much sooner. A compact identity row, full-width square image, overlaid fit signal, short compatibility reason, and lightweight footer create the requested Instagram-familiar rhythm while keeping Aroha intentional.
4. **Full profile — healthy.** Strong photo hierarchy, a persistent decision bar, clear intent badges, and safety framing make the next action obvious.
5. **Connections — healthy.** Incoming interest and mutual matches are clearly separated. Density is appropriate and rows remain easy to scan.
6. **Date Plans — healthy.** Status, public-venue handling, budget, length, and safety states are unusually clear for a dating product.
7. **Chats — healthy.** Conversation hierarchy, safety guidance, date-planning shortcut, and message composer are familiar without feeling generic.
8. **Profile, Settings, and Appearance — healthy after fix.** Quick actions are well grouped. The dark-mode Edit control is now visible, and light/system/dark themes were checked.

## Before evidence

- `before/01-login-390x844.png`
- `before/02-discover-390x844.png`
- `before/03-profile-detail-390x844.png`
- `before/04-connections-390x844.png`
- `before/05-matches-390x844.png`
- `before/06-date-plans-390x844.png`
- `before/07-date-plan-detail-390x844.png`
- `before/08-chats-390x844.png`
- `before/09-conversation-390x844.png`
- `before/10-my-profile-390x844.png`
- `before/11-discover-320x568.png`
- `before/12-welcome-dark-theme-contrast.png`

## Final evidence

- `after/01-discover-feed-320x568.png`
- `after/02-discover-feed-390x844.png`
- `after/03-discover-scroll-390x844.png`
- `after/04-profile-edit-fixed-390x844.png`
- `after/05-welcome-dark-fixed-390x844.png`
- `after/06-login-390x844.png`
- `after/07-signup-390x844.png`
- `after/08-appearance-light-390x844.png`
- `after/09-discover-light-390x844.png`
- `after/10-discover-light-320x568.png`
- `after/11-discover-dark-final-390x844.png`

## Changes made

- Reworked Discover into a compact, premium editorial feed.
- Moved profile identity above the image and compatibility fit onto the media.
- Reduced introductory copy and vertical delay before the first profile.
- Kept the eight-profile daily cap visible.
- Improved compact bottom-navigation labeling and prevented truncation at 320px.
- Fixed dark-mode Welcome and Profile Edit contrast issues.
- Gave every Aroha SVG mark a unique gradient id so hidden router screens cannot break visible logos on web.
- Associated shared input labels and helper/error text with their text fields.

## Evidence limits

Screenshots and browser interaction can verify responsive layout, visible hierarchy, labels, focus visibility, navigation, and representative form behavior. They do not establish full WCAG compliance. Native VoiceOver/TalkBack reading order, dynamic type at extreme sizes, device haptics, reduced motion, camera/photo permissions, and native WebRTC call presentation still require testing on physical iOS and Android devices.
