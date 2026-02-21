const sharp = require('sharp');
const path = require('path');

const inputPath = path.join(__dirname, '..', 'ChatGPT Image Jan 26, 2026, 08_40_18 PM.png');
const publicDir = path.join(__dirname, '..', 'public');
const appDir = path.join(__dirname, '..', 'app');

async function processLogo() {
  console.log('Processing logo image...\n');

  // Read the original image
  const image = sharp(inputPath);
  const metadata = await image.metadata();
  console.log(`Original image: ${metadata.width}x${metadata.height}`);

  // Remove white/light background by making it transparent
  // Extract the image and process it
  const processedBuffer = await image
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { data, info } = processedBuffer;
  const pixelArray = new Uint8Array(data);

  // Make white/near-white pixels transparent
  for (let i = 0; i < pixelArray.length; i += 4) {
    const r = pixelArray[i];
    const g = pixelArray[i + 1];
    const b = pixelArray[i + 2];

    // If pixel is white or very light (threshold ~240), make it transparent
    if (r > 240 && g > 240 && b > 240) {
      pixelArray[i + 3] = 0; // Set alpha to 0 (transparent)
    }
  }

  // Create the transparent PNG
  const transparentLogo = await sharp(Buffer.from(pixelArray), {
    raw: {
      width: info.width,
      height: info.height,
      channels: 4
    }
  })
    .png()
    .toBuffer();

  // Save as main logo PNG
  await sharp(transparentLogo)
    .toFile(path.join(publicDir, 'wavleba-logo.png'));
  console.log('✓ Saved wavleba-logo.png (transparent background)');

  // Create icon-only version (crop to just the green square)
  // The icon is roughly the left portion of the image
  const iconSize = Math.min(info.width, info.height);
  const iconBuffer = await sharp(transparentLogo)
    .extract({ left: 0, top: 0, width: Math.floor(iconSize * 0.35), height: iconSize })
    .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  // Generate favicons from icon
  const faviconSizes = [16, 32, 48, 64, 96, 128, 192, 256, 512];
  console.log('\nGenerating favicons...');
  for (const size of faviconSizes) {
    await sharp(iconBuffer)
      .resize(size, size)
      .png()
      .toFile(path.join(publicDir, `favicon-${size}x${size}.png`));
    console.log(`  ✓ favicon-${size}x${size}.png`);
  }

  // Generate Apple touch icons
  const appleTouchSizes = [57, 60, 72, 76, 114, 120, 144, 152, 180];
  console.log('\nGenerating Apple touch icons...');
  for (const size of appleTouchSizes) {
    const filename = size === 180 ? 'apple-touch-icon.png' : `apple-touch-icon-${size}x${size}.png`;
    await sharp(iconBuffer)
      .resize(size, size)
      .png()
      .toFile(path.join(publicDir, filename));
    console.log(`  ✓ ${filename}`);
  }

  // Generate Android Chrome icons
  console.log('\nGenerating Android Chrome icons...');
  for (const size of [192, 512]) {
    await sharp(iconBuffer)
      .resize(size, size)
      .png()
      .toFile(path.join(publicDir, `android-chrome-${size}x${size}.png`));
    console.log(`  ✓ android-chrome-${size}x${size}.png`);
  }

  // Generate MS tiles
  console.log('\nGenerating MS tiles...');
  for (const size of [70, 144, 150, 310]) {
    await sharp(iconBuffer)
      .resize(size, size)
      .png()
      .toFile(path.join(publicDir, `mstile-${size}x${size}.png`));
    console.log(`  ✓ mstile-${size}x${size}.png`);
  }

  // Generate favicon.ico
  console.log('\nGenerating favicon.ico...');
  await sharp(iconBuffer)
    .resize(32, 32)
    .png()
    .toFile(path.join(appDir, 'favicon.ico'));
  console.log('  ✓ favicon.ico');

  console.log('\n✅ All images processed successfully!');
}

processLogo().catch(err => {
  console.error('Error processing logo:', err);
  process.exit(1);
});
