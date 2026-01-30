# Swavleba

A modern, responsive landing page for a course platform with a clean navy + white theme.

## Features

- 🎨 Modern navy + white design theme
- 📱 Fully responsive (mobile, tablet, desktop)
- 🎬 Video thumbnail with play button
- 👥 Real-time student count display
- 🎯 Floating "Enroll Now" button
- 🌊 Abstract 3D background shapes
- 🔐 Supabase integration ready

## Tech Stack

- **Next.js 14** - React framework with App Router
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Supabase** - Backend services

## Getting Started

### Prerequisites

- Node.js 18+ installed
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. The Supabase configuration is already set up in `.env.local`

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Project Structure

```
├── app/
│   ├── layout.tsx       # Root layout
│   ├── page.tsx         # Home page
│   └── globals.css      # Global styles
├── components/
│   ├── Navigation.tsx   # Top navigation bar
│   ├── Hero.tsx         # Hero section
│   ├── VideoSection.tsx # Video thumbnail and enroll section
│   ├── FloatingButton.tsx # Floating enroll button
│   └── BackgroundShapes.tsx # Background decorative elements
├── lib/
│   └── supabase.ts      # Supabase client configuration
└── .env.local           # Environment variables (not in git)
```

## Environment Variables

Create a `.env.local` file with:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Email (Resend)

The project uses [Resend](https://resend.com) for transactional email.

### Environment Variables

Add to `.env.local`:
```
RESEND_API_KEY=your_resend_api_key_here
EMAIL_FROM="Swavleba <no-reply@swavleba.ge>"
EMAIL_REPLY_TO=support@swavleba.ge  # optional
```

### Usage

```typescript
import { sendEmail } from '@/lib/email';

await sendEmail({
  to: 'user@example.com',
  subject: 'Welcome!',
  html: '<p>Hello from Swavleba!</p>',
  text: 'Hello from Swavleba!',  // optional
});
```

### Testing

With the dev server running:
```bash
curl -X POST http://localhost:3000/api/notifications/test-email \
  -H "Content-Type: application/json" \
  -d '{"to":"your-email@example.com","subject":"Test","html":"<p>Test email</p>"}'
```

## Build for Production

```bash
npm run build
npm start
```

## License

MIT

# Swavleba















