# Split 3: Video Download & Screen Recording Protection

## Goal

Prevent users from downloading or screen-recording course lecture videos, similar to Udemy's approach. Implement every browser-level protection available without requiring DRM licensing.

## Current State

- Videos served via signed URLs (1-hour expiry) from private Supabase bucket
- Standard HTML5 `<video>` player in `components/VideoPlayer.tsx`
- No download prevention, no screen capture deterrents

## Files to Modify

### 1. `components/VideoPlayer.tsx`

Add the following protections to the video player:

**a) Disable native download/save:**

```tsx
<video
  controlsList="nodownload noremoteplayback"
  disablePictureInPicture
  onContextMenu={(e) => e.preventDefault()}
  // ... existing props
/>
```

**b) CSS overlay to block screen capture tools:**

```css
/* Overlay that appears on top of the video to interfere with screen recorders */
.video-protection-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none; /* Allow clicks through to video controls */
  z-index: 1;
}
```

**c) Visibility API - pause when tab is hidden or screen sharing detected:**

```tsx
useEffect(() => {
  const handleVisibilityChange = () => {
    if (document.hidden && videoRef.current) {
      videoRef.current.pause();
    }
  };
  document.addEventListener("visibilitychange", handleVisibilityChange);
  return () =>
    document.removeEventListener("visibilitychange", handleVisibilityChange);
}, []);
```

**d) Disable keyboard shortcuts for saving:**

```tsx
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    // Block Ctrl+S, Cmd+S (save), Ctrl+Shift+I (devtools)
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
    }
  };
  document.addEventListener("keydown", handleKeyDown);
  return () => document.removeEventListener("keydown", handleKeyDown);
}, []);
```

**e) Detect Screen Capture API and pause video:**

```tsx
// Use navigator.mediaDevices.getDisplayMedia detection
// When the page detects a display capture session, pause playback
useEffect(() => {
  if ("getDisplayMedia" in navigator.mediaDevices) {
    const origGetDisplayMedia = navigator.mediaDevices.getDisplayMedia;
    navigator.mediaDevices.getDisplayMedia = async function (constraints) {
      // Pause video when screen sharing starts
      if (videoRef.current) videoRef.current.pause();
      return origGetDisplayMedia.call(this, constraints);
    };
  }
}, []);
```

**f) CSS to prevent drag-and-drop saving:**

```css
video {
  -webkit-user-drag: none;
  user-select: none;
  -webkit-touch-callout: none;
}
```

**g) Blob URL approach (convert signed URL to blob):**

- Fetch the signed URL content as a blob
- Create a blob URL (`URL.createObjectURL(blob)`)
- Set the video `src` to the blob URL
- This prevents URL inspection/copying from browser dev tools
- Revoke the blob URL on unmount with `URL.revokeObjectURL()`
- Show loading state while blob is being fetched

### 2. `hooks/useSignedVideoUrl.ts`

- After fetching the signed URL, also fetch the video content as a blob
- Return `blobUrl` instead of the raw signed URL
- Add cleanup logic to revoke blob URLs
- Handle loading states during blob fetch
- IMPORTANT: Only do this for course lecture videos, NOT for intro/public videos
  - Check if the URL requires auth (signed URL) vs public URL
  - If public URL (intro video), use directly without blob conversion

## DO NOT Touch

- `components/chat/MessageInput.tsx` or `Message.tsx` (Agent 1)
- `lib/keepz.ts` or payment files (Agent 2)
- `app/payment/` pages (Agent 4)
- Any admin/balance/withdrawal files (Agent 5)
- `components/VideoSection.tsx` (public intro video, no protection needed)
- `components/CourseCreationModal.tsx` (upload, not playback)

## Important Notes

- True DRM (Widevine/FairPlay) requires licensing and CDN integration — this is noted as a future enhancement
- These protections deter casual downloading/recording but cannot stop determined users with professional tools
- The blob URL approach is the most effective browser-level protection
- Keep all existing video player functionality (play/pause, speed, fullscreen, progress bar)
- Performance: Blob fetch adds initial load time — show a spinner/skeleton while loading

## Validation

1. Run `npm run build` — must pass with zero errors
2. Verify video player still works with all controls
3. Verify right-click is disabled on video
4. Commit with message: "feat: add video download and screen recording protection"
5. Output DONE when build passes.
