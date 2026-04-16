# Landing Page Redesign — Inspirations & Google Stitch Prompts

Your current landing page has: Navigation → Hero (one CTA) → Courses Carousel → Projects Carousel → Footer. It's technically solid but lacks the conversion psychology that makes users buy. Below are 6 landing pages that solve this problem, what to steal from each, and a Stitch prompt per inspiration.

---

## 1. Coursera — "Learn Without Limits"

**URL:** https://www.coursera.org

**Why it converts:**

- Hero has a clear value prop ("Learn without limits") + urgency ("Ends soon! Save 40%")
- Trust bar with 350+ partner logos (Google, Stanford, IBM, Microsoft, OpenAI)
- Stats-driven social proof: "91% of learners achieved a positive career outcome"
- Testimonials carousel with real photos, names, and specific outcomes
- "What brings you to Coursera today?" — user-intent segmentation section
- FAQ section that handles objections (accreditation, refunds, pricing)
- Multiple CTAs for different user stages ("Join for Free", "Try for Business")
- Course cards show: instructor, rating, student count, duration, difficulty level

**What to steal for Swavleba:**

- Partner/trust logo bar after hero
- Stats counters in hero (students, courses, success rate)
- Dual CTA (primary + ghost "Browse Courses")
- Testimonials with real outcomes
- FAQ section before footer
- Intent-based pathways ("I want to learn editing" / "I want to earn money")

### STITCH PROMPT — Coursera Style

```
Design a landing page for "Swavleba", a Georgian education platform, inspired by Coursera's conversion-focused layout. Material Design 3, dark theme primary, neutral seed color.

PAGE STRUCTURE (top to bottom):

1. NAVIGATION BAR — same as current (fixed, backdrop blur, logo left, links center, auth right)

2. HERO SECTION:
- Centered layout, max-width 720px
- Large display heading: "Learn To Earn Online" (display-large, 48-80px responsive, bold, white)
- Value proposition subtitle: "Master content creation, video editing, and web development with expert-led courses" (body-large, muted text, max-width 640px)
- Stats row (3 inline stat blocks with vertical dividers between them):
  - "500+" label "Students" (number in display-small bold white, label in body-small muted)
  - "10+" label "Courses" (same style)
  - "95%" label "Success Rate" (same style)
- Dual CTA row (centered, gap-16px):
  - Primary: "Sign Up" — MD3 FilledButton, pill shape, large padding, emerald-like primary color, arrow icon that shifts right on hover
  - Secondary: "Browse Courses" — MD3 OutlinedButton, pill shape, border matches primary, text matches primary, transparent background, hover fills with primary/10%
- Scroll-reveal: staggered fade-in (heading → subtitle → stats → CTAs)
- Subtle radial gradient halo behind content

3. TRUST BAR SECTION:
- Full-width strip, surface-container-low background, border-top and border-bottom (subtle)
- Centered row of 4 trust badges (icon + label pairs):
  - Shield icon + "Secure Payments"
  - Award icon + "Expert Instructors"
  - Clock icon + "Learn at Your Pace"
  - Users icon + "Active Community"
- Icons in primary color, labels in muted text (body-small)
- Horizontal scroll on mobile, flex-wrap on desktop
- Scroll-reveal animation

4. COURSES CAROUSEL — same as current (horizontal carousel, course cards with thumbnail, title, author, price, rating, type badge, enrollment button)

5. "WHY CHOOSE SWAVLEBA" SECTION:
- Section heading centered: "Why Choose Swavleba?" (headline-large, white)
- Subtitle: "Everything you need to build skills and earn online" (body-large, muted)
- 3-column grid (1-col mobile), each card:
  - MD3 Card (filled variant, surface-container background, rounded-2xl, padding 24px)
  - Icon at top (48x48, primary color, inside a primary/10% circle)
  - Title (title-medium, bold, white)
  - Description (body-medium, muted, 2-3 lines)
  - Cards:
    1. Play icon → "Learn at Your Own Pace" / "Access courses anytime, anywhere. Study on your schedule."
    2. Briefcase icon → "Real Projects, Real Money" / "Apply what you learn with hands-on projects and earn income."
    3. Star icon → "Expert Instructors" / "Learn from industry professionals with real-world experience."
- Scroll-reveal with stagger

6. USER INTENT SECTION (Coursera-style "What brings you here?"):
- Heading: "What Are You Looking For?" (headline-large, centered, white)
- 3 clickable pathway cards in a row (1-col mobile):
  - Card 1: Editing icon + "I want to learn editing" → links to /courses?filter=editing
  - Card 2: Camera icon + "I want to create content" → links to /courses?filter=content-creation
  - Card 3: Code icon + "I want to build websites" → links to /courses?filter=website-creation
- Each card: MD3 OutlinedCard, hover elevation increase, icon in primary color, title in white, arrow indicator on right
- Scroll-reveal

7. TESTIMONIALS SECTION:
- Section heading: "What Our Students Say" (headline-large, centered, white)
- Subtitle: "Join hundreds of satisfied learners" (body-medium, muted)
- 3 testimonial cards in a row (1-col mobile, horizontal scroll on tablet):
  - Each card: MD3 Card (filled, surface-container), rounded-2xl, padding 32px
  - Quote icon at top (primary color, small)
  - Quote text (body-large, white, italic)
  - Divider line
  - Avatar circle (48px) + Name (title-small, white) + Role/Course (body-small, muted)
  - Star rating row (5 stars, primary color)
- Scroll-reveal with stagger

8. ACTIVE PROJECTS CAROUSEL — same as current but simplified to flat horizontal carousel (no 3D)

9. FAQ SECTION:
- Heading: "Frequently Asked Questions" (headline-large, centered, white)
- Narrow container (max-width 768px, centered)
- 5-6 accordion items:
  - Each: question text (title-medium, white) + chevron icon that rotates on expand
  - Answer text (body-medium, muted) expands/collapses with animation
  - Border-bottom separator between items
- Questions: How do courses work? / What payment methods? / Can I get a refund? / How long do I have access? / How do I earn money on the platform? / Is there support?
- Scroll-reveal

10. FOOTER — Enhanced:
- 4-column grid (1-col mobile, 2-col tablet):
  - Column 1: Logo + description + social media icons row (Facebook, Instagram, TikTok, YouTube) — icons in muted, hover in primary
  - Column 2: Legal links (same as current)
  - Column 3: Company links + FAQ link
  - Column 4: "Stay Updated" heading + email input (MD3 OutlinedTextField, pill shape) + "Subscribe" button (MD3 FilledButton, small) + contact email below
- Copyright bar at bottom

DESIGN SYSTEM:
- MD3 dark theme, surface-dim background for page, surface-container for cards
- Primary color: emerald/teal family
- Typography: MD3 type scale (display, headline, title, body, label)
- All sections have generous vertical padding (96-128px)
- Scroll-reveal animations throughout with staggered delays
- Responsive: mobile-first, breakpoints at 600px (md) and 1024px (lg)
```

---

## 2. Domestika — Category Leader in Creative Courses

**URL:** https://www.domestika.org

**Why it converts:**

- Urgency banner with countdown timer ("This price won't last long...")
- Course cards show enrollment count prominently (e.g., "26,212 students")
- Rating percentages displayed on every card (97%, 99%)
- "Bestseller" and "New" badges create FOMO
- "Learn by Doing" section emphasizes practical outcomes
- "What to Expect" value prop section (8 benefits in card grid)
- Massive course catalog with category browsing
- Every card has a "Buy" CTA directly visible

**What to steal for Swavleba:**

- Countdown/urgency banner for promotions
- Student enrollment counts on course cards
- Prominent rating display
- "What to Expect" benefits section
- Direct "Buy" / "Enroll" CTA on every card (not hidden in modal)

### STITCH PROMPT — Domestika Style

```
Design a landing page for "Swavleba", a Georgian education platform, inspired by Domestika's conversion-heavy course marketplace. Material Design 3, dark theme primary, neutral seed color.

PAGE STRUCTURE (top to bottom):

1. PROMOTIONAL BANNER (full-width, above navigation):
- Accent/warning color background (amber or primary)
- Bold text: "Limited Time Offer — Enroll in any course at a special price!"
- Countdown timer: DD:HH:MM:SS in monospace font, each unit in a rounded box
- "View Courses" CTA button (small, contrasting)
- Dismissible with X button (sets cookie to hide)
- Animated pulse on the countdown timer

2. NAVIGATION BAR — same as current (fixed, backdrop blur)

3. HERO SECTION (compact, not full-screen):
- Shorter than typical hero — just enough to communicate value
- Heading: "Learn To Earn Online" (headline-large, 36-48px, bold, white, centered)
- One-line subtitle: "Courses in Editing, Content Creation, and Web Development" (body-large, muted)
- Single search bar (MD3 OutlinedTextField with search icon, max-width 480px, centered):
  - Placeholder: "Search courses..."
  - Opens search results or redirects to /courses?q=
- Below search: 3 category chips in a row:
  - "Editing" chip (purple tint)
  - "Content Creation" chip (cyan tint)
  - "Website Creation" chip (amber tint)
  - Each chip links to /courses?filter=X
- Minimal padding (64px top, 48px bottom) — get users to the courses fast

4. "POPULAR COURSES" SECTION (Domestika-style grid):
- Section heading: "Popular Courses" with fire icon + course count badge
- Horizontal carousel on desktop (3 visible), vertical stack on mobile
- ENHANCED COURSE CARD:
  - Thumbnail with overlay gradient at bottom
  - "Bestseller" ribbon badge (top-left, diagonal, primary color) if applicable
  - "New" chip badge (top-right) if recent
  - Student count badge on thumbnail: "500+ students" with users icon (bottom-right of thumbnail, semi-transparent dark background)
  - Card body:
    - Course title (title-medium, bold, white)
    - Author name (body-small, muted)
    - Rating: percentage display "98%" in a rounded pill (primary/10% background, primary text) + review count
    - Course type chip (colored by type)
  - Card footer:
    - Price: "₾XX" current price (title-large, bold, white) + "₾XX" original price (body-small, strikethrough, muted) if discounted
    - "Enroll Now" button (MD3 FilledTonalButton, full-width) — not hidden in a modal, directly visible
  - Hover: scale 1.02, elevation increase, glow on border

5. "WHAT TO EXPECT" VALUE PROPOSITION SECTION:
- Heading: "What You Get With Swavleba" (headline-large, centered, white)
- 2-row grid, 4 items per row on desktop (2-col tablet, 1-col mobile) = 8 value cards:
  - Each card: icon (primary, 32px) + title (title-small, white) + one-line description (body-small, muted)
  - Cards:
    1. Play icon → "Self-Paced Video Lessons"
    2. Laptop icon → "Hands-On Projects"
    3. Award icon → "Expert Instructors"
    4. Users icon → "Student Community"
    5. Chat icon → "Real-Time Chat Support"
    6. Wallet icon → "Earn While You Learn"
    7. Globe icon → "Georgian & English"
    8. Shield icon → "Secure Payments"
  - Cards are compact: surface-container background, rounded-xl, padding 16px
  - Scroll-reveal with stagger

6. COURSES BY CATEGORY:
- 3 horizontal rows, one per category:
  - Row heading: "Editing Courses" / "Content Creation Courses" / "Website Creation Courses"
  - Each row: 3-4 course cards in horizontal scroll
  - "View All" link at end of each row
- Same enhanced card style as section 4

7. ACTIVE PROJECTS SECTION — flat carousel (no 3D), same data as current

8. SOCIAL PROOF STRIP:
- Full-width, surface-container-high background
- Centered row of 3 large stats:
  - "500+" / "Students Enrolled"
  - "10+" / "Courses Available"
  - "95%" / "Student Satisfaction"
- Numbers in display-medium bold white, labels in body-medium muted
- Numbers animate counting up when section enters viewport

9. FOOTER — Enhanced with social links + newsletter signup (email input + subscribe button)

DESIGN SYSTEM:
- MD3 dark theme
- Primary: emerald/teal
- Emphasis on data: show numbers everywhere (students, ratings, prices)
- Cards should feel like a marketplace — browsable, information-dense
- Mobile: everything stacks vertically, carousels become scrollable rows
```

---

## 3. Foundr — Instructor-Led, Testimonial-Heavy

**URL:** https://foundr.com

**Why it converts:**

- Celebrity/expert instructor is the HERO — their face and name dominate
- Video testimonials with name + specific result achieved
- Multiple CTAs throughout (not just at top and bottom)
- "What You'll Learn" module breakdown creates transparency
- Results-driven copy: specific numbers ("grew to 100K followers in 6 months")
- Payment plans displayed directly (not hidden)
- Money-back guarantee badge prominently displayed

**What to steal for Swavleba:**

- Instructor spotlight section with photo + credentials
- Video testimonials showing real student results
- "What You'll Learn" section per course
- Money-back guarantee trust badge
- Multiple CTA placements throughout the page

### STITCH PROMPT — Foundr / Instructor-Led Style

```
Design a landing page for "Swavleba", a Georgian education platform, inspired by Foundr's instructor-focused, testimonial-heavy layout. Material Design 3, dark theme primary, neutral seed color.

PAGE STRUCTURE (top to bottom):

1. NAVIGATION BAR — same as current

2. HERO SECTION — Instructor-Focused:
- Split layout: Left side text, Right side instructor photo/video
- LEFT (60% width on desktop, full-width mobile):
  - Eyebrow text: "Online Education Platform" (label-large, primary color, uppercase, letter-spaced)
  - Main heading: "Learn To Earn Online" (display-medium, bold, white)
  - Subtitle: "Master content creation, editing, and web development from industry experts who've done it" (body-large, muted, max-width 480px)
  - Stats row: "500+ Students" • "10+ Courses" • "4.8★ Average Rating" (body-medium, muted, dot-separated)
  - Dual CTA:
    - Primary: "Start Learning Today" (FilledButton, large, primary)
    - Secondary: "Watch Introduction" (TextButton with play icon, muted)
  - Trust badges row below CTAs: Shield icon "Money-Back Guarantee" + Lock icon "Secure Payment" (body-small, muted, inline)
- RIGHT (40% width on desktop, hidden mobile):
  - Circular or rounded-3xl instructor photo/collage
  - Or: intro video thumbnail with large play button overlay
  - Subtle glow/gradient behind the image
- Scroll-reveal: left content slides in from left, image fades in from right

3. "AS FEATURED IN" TRUST BAR (if applicable, otherwise skip):
- Muted logos of any press/partnerships in a horizontal row
- Grayscale, hover reveals color
- Or replace with: "Trusted by 500+ students across Georgia"

4. INSTRUCTOR SPOTLIGHT SECTION:
- Heading: "Learn From The Best" (headline-large, centered, white)
- 2-3 instructor cards in a row (1-col mobile):
  - Each card: MD3 Card (filled, surface-container, rounded-2xl)
    - Large circular avatar photo (96px)
    - Instructor name (title-large, bold, white)
    - Title/expertise (body-medium, muted) — e.g., "Professional Video Editor, 10+ years experience"
    - Stats: "X courses" + "X students" (body-small, primary color)
    - "View Courses" text link with arrow
  - Cards hover: subtle lift + border glow

5. "WHAT YOU'LL LEARN" SECTION:
- Heading: "What You'll Master" (headline-large, centered, white)
- 3 course-type columns (1-col mobile):
  - Column header: Course type name + icon (e.g., "Video Editing" with scissors icon)
  - Bullet list of 4-5 skills/outcomes with checkmark icons:
    - "Professional video editing techniques"
    - "Color grading and audio mixing"
    - "Exporting for social media platforms"
    - "Building a portfolio"
  - "Explore Course" button at bottom of each column
- Each column is an MD3 Card with surface-container background

6. VIDEO TESTIMONIALS / SOCIAL PROOF SECTION:
- Heading: "Real Results From Real Students" (headline-large, centered, white)
- 3 testimonial cards (1-col mobile, horizontal scroll tablet):
  - Each card: MD3 Card, rounded-2xl, padding 24px
    - Large quote icon (primary, top-left)
    - Testimonial text (body-large, white, italic)
    - Result highlight: bold primary text for key outcome (e.g., "landed my first freelance client within 2 months")
    - Divider
    - Student info: avatar (40px) + name + course taken (body-small, muted)
    - 5-star rating
  - Optional: one card is a video testimonial — thumbnail with play button
- Scroll-reveal stagger

7. COURSES CAROUSEL — same course cards as current, but with enhanced info

8. MONEY-BACK GUARANTEE SECTION:
- Centered, narrow container (max-width 640px)
- Large shield/badge icon (primary, 64px)
- Heading: "100% Satisfaction Guarantee" (headline-medium, white)
- Body: "If you're not satisfied with your course within the first 7 days, we'll give you a full refund. No questions asked." (body-large, muted)
- "Learn More" link to /refund-policy

9. FINAL CTA SECTION:
- Full-width, primary/10% gradient background
- Centered:
  - Heading: "Ready to Start Learning?" (headline-large, white)
  - Subtitle: "Join 500+ students already building their skills" (body-large, muted)
  - Large CTA: "Sign Up Free" (FilledButton, extra-large, primary)

10. FOOTER — Enhanced with social links

DESIGN SYSTEM:
- MD3 dark theme, primary: emerald/teal
- Emphasis on people: instructor photos, student avatars, human stories
- Multiple CTA touchpoints (hero, after testimonials, final section)
- Trust signals woven throughout, not just in one place
```

---

## 4. ContentOS / Justin Welsh — Social Proof Powerhouse

**URL:** https://learn.justinwelsh.me/content

**Why it converts:**

- Massive social proof: "7,000+ reviews" displayed prominently
- Results-driven headline ("system for creating subscriber-worthy newsletter")
- Combination of video AND text testimonials
- Payment options shown directly (lump sum + installments)
- Clean, focused design — no distractions
- Specific outcome promise in every section

**What to steal for Swavleba:**

- Large review/enrollment count as a headline stat
- Mixed testimonial formats (video + text)
- Direct payment display with options
- Outcome-focused copy throughout

### STITCH PROMPT — Social Proof Powerhouse Style

```
Design a landing page for "Swavleba", a Georgian education platform, inspired by high-conversion creator course pages (Justin Welsh, Copyhackers). Focused on massive social proof and direct outcomes. Material Design 3, dark theme primary, neutral seed color.

PAGE STRUCTURE (top to bottom):

1. NAVIGATION BAR — minimal version:
- Logo left, single "Sign Up" button right
- No other links — this is a focused conversion page
- Fixed, backdrop blur, border-bottom

2. HERO SECTION — Outcome-Focused:
- Centered, max-width 800px
- Social proof badge above heading: "★ Rated 4.8/5 by 500+ students" in a pill/chip (primary/10% background, primary text, star icon)
- Main heading: "The Platform That Teaches You To Earn Online" (display-large, bold, white, centered)
- Subtitle: "Learn video editing, content creation, and web development from expert instructors — and start earning from day one" (body-large, muted, centered)
- Dual CTA centered:
  - Primary: "Start Learning — It's Free to Sign Up" (FilledButton, extra-large, primary, full-width max-width 400px)
  - Below button: "No credit card required" (label-medium, muted, centered)
- Below CTAs: Horizontal row of 3 mini-stats:
  - "500+ Students" • "10+ Courses" • "₾50K+ Earned by Students"
  - (body-small, muted, dot-separated)

3. SOCIAL PROOF WALL:
- Heading: "What Students Are Saying" (headline-medium, centered, white)
- Masonry grid of testimonial cards (3 columns desktop, 2 tablet, 1 mobile):
  - Mix of short and long testimonials
  - Each card: surface-container background, rounded-xl, padding 20px
    - Quote text (body-medium, white)
    - Key result in bold primary: "earned my first ₾500 from a project"
    - Author: name + avatar (small, 32px) + course name
    - Star rating (5 stars, primary)
  - Some cards are larger (span 2 rows) for featured testimonials
  - One card is a "video testimonial" — thumbnail with play button overlay
- "See All Reviews" link below grid
- Scroll-reveal with stagger

4. "HOW IT WORKS" SECTION:
- Heading: "How Swavleba Works" (headline-large, centered, white)
- 3 numbered steps in a horizontal row (vertical on mobile):
  - Step 1: "Choose Your Course" — icon: grid/courses, description: "Browse editing, content creation, and web development courses"
  - Step 2: "Learn From Experts" — icon: play/video, description: "Watch video lessons, complete projects, chat with classmates"
  - Step 3: "Start Earning" — icon: wallet/money, description: "Apply your skills to real paid projects on the platform"
- Each step: number circle (primary, 48px) + icon (32px, primary) + title (title-medium, white) + description (body-medium, muted)
- Connecting line/arrow between steps on desktop
- Scroll-reveal

5. FEATURED COURSES — NOT a carousel, but a clean grid:
- Heading: "Featured Courses" (headline-large, centered, white)
- 3 course cards in a row (1-col mobile):
  - Each card: large thumbnail (16:9), overlaid gradient at bottom
  - Course title over gradient (title-large, white, bold)
  - Author name (body-small, white/80%)
  - Below thumbnail: rating + students + price
  - "Enroll Now" full-width button
- "View All Courses →" link below

6. EARNINGS SHOWCASE:
- Heading: "Students Earning Real Money" (headline-large, centered, white)
- 3 stat cards:
  - "₾50K+" / "Total Earned by Students"
  - "100+" / "Completed Projects"
  - "₾500" / "Average First Earning"
- Numbers animate counting up on viewport entry
- Below stats: brief paragraph about the projects feature

7. FINAL CTA — Repeated hero CTA:
- Surface-container-high background section
- "Ready to Start Your Journey?" (headline-large, white, centered)
- "Join 500+ students learning and earning on Swavleba" (body-large, muted)
- Same CTA button as hero: "Start Learning — It's Free to Sign Up"
- Trust badges: Shield "Secure" + Refund "Money-Back" + Lock "Private"

8. FAQ SECTION:
- 5-6 accordion items (same as Coursera prompt above)
- Max-width 768px centered

9. FOOTER — Minimal: logo + legal links + social icons in one row

DESIGN SYSTEM:
- MD3 dark theme, primary: emerald/teal
- Ultra-focused on conversion — fewer sections, each one earns attention
- Social proof is THE strategy — reviews, numbers, results everywhere
- No distractions: minimal nav, clear hierarchy, one primary action
```

---

## 5. Ahrefs Academy — Free Value, Low Friction

**URL:** https://ahrefs.com/academy/seo-training-course

**Why it converts:**

- Prominent "$0" price tag — free content as top-of-funnel
- Detailed course outline with lesson count, topics, and duration
- Instructor bio with credentials builds authority
- Clean, professional design with strong branding
- CodeAcademy-style enrollment numbers (2.6M+ students)
- Low friction: no payment required to start

**What to steal for Swavleba:**

- Free intro content / preview as lead magnet
- Detailed course outline visible on landing page
- Enrollment counter prominent on each course
- Clean, professional aesthetic (not flashy)

### STITCH PROMPT — Clean Professional / Free Value Style

```
Design a landing page for "Swavleba", a Georgian education platform, inspired by Ahrefs Academy and Codecademy's clean professional style. Emphasis on course detail transparency and low-friction signup. Material Design 3, dark theme primary, neutral seed color.

PAGE STRUCTURE (top to bottom):

1. NAVIGATION BAR — same as current

2. HERO SECTION — Clean & Direct:
- Split layout: Left text (60%), Right illustration/mockup (40%)
- LEFT:
  - Small chip/badge: "Free to Sign Up" (primary/10% background, primary text)
  - Heading: "Learn To Earn Online" (display-medium, bold, white)
  - Subtitle (body-large, muted): "Professional courses in video editing, content creation, and web development. Start free, upgrade when you're ready."
  - Feature list (3 items with checkmark icons in primary color):
    - "Expert-led video courses"
    - "Real paid projects to practice on"
    - "Active student community with real-time chat"
  - CTA: "Create Free Account" (FilledButton, large, primary)
  - Below CTA: "Already have an account? Log in" (body-small, muted link)
- RIGHT:
  - Platform mockup screenshot or illustration showing the course interface
  - Floating badge overlays: "500+ Students", "4.8★ Rating"
  - Subtle shadow and rotation for depth

3. PLATFORM STATS BAR:
- Surface-container background strip
- 4 stats in a row (2x2 grid on mobile):
  - "500+" / "Active Students"
  - "10+" / "Professional Courses"
  - "28" / "Real Projects Completed"
  - "4.8/5" / "Student Rating"
- Clean typography, no animation needed — just clear data

4. COURSE CATALOG SECTION:
- Heading: "Explore Our Courses" (headline-large, centered, white)
- Filter tabs: "All" | "Editing" | "Content Creation" | "Website Creation" (MD3 SegmentedButton or FilterChips)
- Course list (NOT carousel — grid layout):
  - 3 columns desktop, 2 tablet, 1 mobile
  - Each card:
    - Thumbnail (16:9)
    - Course type chip (colored by type)
    - Title (title-medium, bold, white)
    - Author (body-small, muted)
    - Row: star rating + review count + "• X students"
    - Price in GEL with optional strikethrough original
    - "View Course" button (OutlinedButton, full-width)
  - Cards hover: subtle lift
- "View Full Catalog →" link

5. COURSE DETAIL PREVIEW (for featured/flagship course):
- Heading: "Featured Course" with chip badge
- Large card spanning full width:
  - Left side (60%): course thumbnail or intro video player
  - Right side (40%):
    - Course title (headline-medium, white)
    - Author with avatar
    - Description paragraph (body-medium, muted)
    - Course outline / module list (expandable accordion):
      - Module 1: "Introduction" — 3 lessons, 45 min
      - Module 2: "Core Skills" — 5 lessons, 2h
      - etc.
    - "Total: X lessons, Xh of content" summary
    - Price + "Enroll Now" button
- This gives users transparency about what they're buying

6. INSTRUCTOR CREDENTIALS SECTION:
- Heading: "Your Instructors" (headline-large, centered, white)
- Instructor cards (same as Foundr prompt): avatar, name, title, course count, student count
- Clean horizontal layout

7. TESTIMONIALS — Simple 3-card row (same format as Coursera prompt)

8. "GET STARTED" CTA SECTION:
- Clean centered section
- Heading: "Start Learning Today" (headline-large, white)
- Subtitle: "Create your free account in 30 seconds" (body-large, muted)
- CTA: "Sign Up Free" (FilledButton, large, primary)
- Below: "No credit card required. Cancel anytime." (label-medium, muted)

9. FOOTER — same as current with social links added

DESIGN SYSTEM:
- MD3 dark theme, primary: emerald/teal
- Clean, professional, not flashy — let the content speak
- Emphasis on course detail and transparency
- Grid layouts over carousels where possible (easier to scan)
- Low-friction messaging throughout ("free", "no credit card", "30 seconds")
```

---

## 6. Building a Second Brain / Better Lettering — Focused Course Seller

**URL:** https://buildingasecondbrain.com/foundation

**Why it converts:**

- Journey-based narrative: problem → solution → transformation
- Simplified payment directly on the landing page (lump sum + installments)
- Video introduction from the creator builds trust
- FAQ section handling every objection
- Clean design with strong whitespace
- Clear "before and after" transformation messaging

**What to steal for Swavleba:**

- Problem-agitation-solution narrative flow
- Payment options visible (not hidden in modal)
- Creator/founder video introduction
- Transformation messaging ("Before Swavleba" → "After Swavleba")

### STITCH PROMPT — Narrative/Transformation Style

```
Design a landing page for "Swavleba", a Georgian education platform, inspired by course creator pages like Building a Second Brain. Narrative-driven, problem→solution→transformation flow. Material Design 3, dark theme primary, neutral seed color.

PAGE STRUCTURE (top to bottom):

1. NAVIGATION BAR — minimal (logo + Sign Up button only)

2. HERO SECTION — Problem-Aware:
- Centered, max-width 720px
- Eyebrow: "For aspiring creators and freelancers" (label-large, primary, uppercase)
- Heading: "Stop Scrolling. Start Earning." (display-large, bold, white)
- Subtitle: "You know you could earn money online. You just need someone to show you how. Swavleba gives you expert-led courses, real projects, and a community to get you there." (body-large, muted, centered)
- CTA: "Begin Your Journey" (FilledButton, large, primary, arrow icon)
- Below CTA: small video thumbnail "Watch Our Story (2 min)" with play icon — clicking expands to video modal
- Scroll-reveal stagger

3. "THE PROBLEM" SECTION:
- Heading: "Sound Familiar?" (headline-large, centered, white)
- 3 problem cards in a row (1-col mobile):
  - Card 1: Clock icon + "You spend hours watching free tutorials but never finish anything"
  - Card 2: Puzzle icon + "You have skills but don't know how to turn them into income"
  - Card 3: Question icon + "You feel lost without a structured learning path"
- Cards: surface-container, rounded-2xl, padding 24px, icon in error/warning color (red/amber), text in white
- Subtle animation: cards have a slight red/amber tint border

4. "THE SOLUTION" SECTION:
- Heading: "Here's What Changes With Swavleba" (headline-large, centered, white)
- Before/After comparison layout:
  - Two columns (stacked on mobile):
  - LEFT column "Before" (surface-container with subtle red tint border):
    - X icon items in red/muted:
      - "Scattered free tutorials with no structure"
      - "No feedback or community"
      - "Skills but no income"
      - "No real projects to practice on"
  - RIGHT column "After" (surface-container with subtle primary/green tint border):
    - Checkmark icon items in primary/green:
      - "Structured courses from A to Z"
      - "Real-time chat with classmates & instructors"
      - "Paid projects where you earn while learning"
      - "A portfolio of real work"
  - Arrow or "→" between columns on desktop

5. "HOW IT WORKS" — 3 Steps (same as Social Proof prompt):
- Choose → Learn → Earn flow with numbered steps and icons

6. COURSES SECTION:
- Heading: "Your Learning Path" (headline-large, centered, white)
- 3 course cards (one per course type) in a clean grid
- Each shows: thumbnail, title, module count, duration estimate, price
- "View Curriculum" expandable section on each card showing module list
- Payment display directly on card:
  - "₾XX one-time" or "₾XX/month for 3 months"
  - This makes pricing transparent before clicking anything

7. TRANSFORMATION STORIES:
- Heading: "From Student to Earner" (headline-large, centered, white)
- 2-3 story cards (larger than typical testimonials):
  - Each: student photo + name + before/after narrative
  - "Before: I was watching random YouTube tutorials..."
  - "After: I completed the Editing course and earned ₾800 from my first project"
  - Star rating + course name
- Full-width cards, surface-container, generous padding

8. GUARANTEE + TRUST SECTION:
- Centered, max-width 640px
- Shield icon (64px, primary)
- "Our Promise To You" (headline-medium, white)
- "If you're not satisfied within 7 days, we'll refund your payment in full. We believe in our courses — and we want you to believe in them too." (body-large, muted)
- Link to refund policy

9. FINAL CTA:
- Primary/10% gradient background
- "Your Journey Starts Here" (headline-large, white)
- "Join 500+ students who chose to invest in themselves" (body-large, muted)
- "Create Your Free Account" (FilledButton, extra-large, primary)
- "Questions? Read our FAQ below" (body-small, muted link)

10. FAQ SECTION — 6 accordion items (same as Coursera prompt)

11. FOOTER — Minimal with legal links + social icons

DESIGN SYSTEM:
- MD3 dark theme, primary: emerald/teal
- Narrative flow: each section answers the next natural question
- Emotional design: problem sections use warm/red tones, solution sections use cool/green tones
- Generous whitespace and large text for readability
- Story-driven: emphasize human transformation over features
```

---

## Summary — Which Style to Pick

| #   | Style         | Best For                        | Key Strength                  |
| --- | ------------- | ------------------------------- | ----------------------------- |
| 1   | **Coursera**  | Full-featured platform feel     | Trust + variety + FAQ         |
| 2   | **Domestika** | Course marketplace with urgency | Numbers + FOMO + categories   |
| 3   | **Foundr**    | Instructor-driven courses       | People + testimonials + video |
| 4   | **ContentOS** | Conversion-focused single page  | Social proof wall + focus     |
| 5   | **Ahrefs**    | Professional, low-friction      | Transparency + clean design   |
| 6   | **BASB**      | Story-driven transformation     | Narrative + emotion + trust   |

**My recommendation:** Start with **#1 (Coursera style)** or **#4 (Social Proof Powerhouse)** — they're the most proven patterns for platforms with multiple courses. If your instructors are a strong selling point, go with **#3 (Foundr style)**. If you want urgency and marketplace feel, go **#2 (Domestika)**.

You can mix and match sections from different prompts. Each Stitch prompt is self-contained and ready to paste.
