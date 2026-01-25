# Favicon Package

## Included Files

### Standard Favicons (PNG)
- `favicon-16x16.png` - Browser tab icon
- `favicon-32x32.png` - Browser tab icon
- `favicon-48x48.png` - Windows site icon
- `favicon-64x64.png` - Windows site icon
- `favicon-96x96.png` - Google TV icon
- `favicon-128x128.png` - Chrome Web Store icon
- `favicon-192x192.png` - Chrome for Android
- `favicon-256x256.png` - Opera Speed Dial icon
- `favicon-512x512.png` - PWA splash screen

### Apple Touch Icons (PNG)
- `apple-touch-icon.png` - Default (180x180)
- `apple-touch-icon-57x57.png` to `apple-touch-icon-180x180.png`

### Microsoft Tiles (PNG)
- `mstile-70x70.png`, `mstile-144x144.png`, `mstile-150x150.png`
- `mstile-310x150.png` (wide), `mstile-310x310.png` (large)

### Android Chrome (PNG)
- `android-chrome-192x192.png`, `android-chrome-512x512.png`

### Config Files
- `site.webmanifest` - Web app manifest
- `browserconfig.xml` - Microsoft browser config

## HTML Implementation

```html
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="msapplication-TileColor" content="#4CD964">
<meta name="theme-color" content="#4CD964">
```
