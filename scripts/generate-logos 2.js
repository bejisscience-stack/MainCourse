const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '..', 'public');
const appDir = path.join(__dirname, '..', 'app');
const svgPath = path.join(publicDir, 'wavleba-logo.svg');

// Read SVG content
const svgContent = fs.readFileSync(svgPath, 'utf8');

// Favicon sizes to generate
const faviconSizes = [16, 32, 48, 64, 96, 128, 192, 256, 512];
const appleTouchSizes = [57, 60, 72, 76, 114, 120, 144, 152, 180];
const androidSizes = [192, 512];
const mstileSizes = [70, 144, 150, 310];

// Create icon-only SVG for favicons (just the green square with $ sign - Cash App style)
const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 90 90" fill="none">
  <rect x="0" y="0" width="90" height="90" rx="18" fill="#5CB85C"/>
  <g transform="translate(45, 45)">
    <path d="M12 -22 C12 -22, 10 -26, 0 -26 C-12 -26, -14 -18, -14 -14 C-14 -6, -6 -2, 0 0 C8 2, 14 6, 14 14 C14 20, 10 26, 0 26 C-10 26, -12 22, -12 22"
          stroke="white" stroke-width="8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <line x1="0" y1="-32" x2="0" y2="32" stroke="white" stroke-width="6" stroke-linecap="round"/>
  </g>
</svg>`;

async function generateImages() {
  console.log('Starting image generation...\n');

  // Generate main logo PNG
  console.log('Generating main logo PNG...');
  await sharp(Buffer.from(svgContent))
    .resize(1200, null, { fit: 'inside' })
    .png()
    .toFile(path.join(publicDir, 'wavleba-logo.png'));
  console.log('  ✓ wavleba-logo.png');

  // Generate favicons
  console.log('\nGenerating favicons...');
  for (const size of faviconSizes) {
    await sharp(Buffer.from(iconSvg))
      .resize(size, size)
      .png()
      .toFile(path.join(publicDir, `favicon-${size}x${size}.png`));
    console.log(`  ✓ favicon-${size}x${size}.png`);
  }

  // Generate Apple touch icons
  console.log('\nGenerating Apple touch icons...');
  for (const size of appleTouchSizes) {
    const filename = size === 180
      ? 'apple-touch-icon.png'
      : `apple-touch-icon-${size}x${size}.png`;
    await sharp(Buffer.from(iconSvg))
      .resize(size, size)
      .png()
      .toFile(path.join(publicDir, filename));
    console.log(`  ✓ ${filename}`);
  }

  // Generate Android Chrome icons
  console.log('\nGenerating Android Chrome icons...');
  for (const size of androidSizes) {
    await sharp(Buffer.from(iconSvg))
      .resize(size, size)
      .png()
      .toFile(path.join(publicDir, `android-chrome-${size}x${size}.png`));
    console.log(`  ✓ android-chrome-${size}x${size}.png`);
  }

  // Generate MS tiles
  console.log('\nGenerating MS tiles...');
  for (const size of mstileSizes) {
    const filename = size === 310 ? 'mstile-310x310.png' : `mstile-${size}x${size}.png`;
    await sharp(Buffer.from(iconSvg))
      .resize(size, size)
      .png()
      .toFile(path.join(publicDir, filename));
    console.log(`  ✓ ${filename}`);
  }

  // Generate favicon.ico (using 32x32 PNG as base)
  console.log('\nGenerating favicon.ico...');
  await sharp(Buffer.from(iconSvg))
    .resize(32, 32)
    .png()
    .toFile(path.join(appDir, 'favicon.ico'));
  console.log('  ✓ favicon.ico');

  console.log('\n✅ All images generated successfully!');
}

generateImages().catch(err => {
  console.error('Error generating images:', err);
  process.exit(1);
});
