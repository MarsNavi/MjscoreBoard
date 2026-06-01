import sharp from 'sharp';

async function run() {
  try {
    const input = 'android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.webp';
    
    // First, resize the original 192x192 to 512x512
    const resized = await sharp(input)
      .resize(512, 512)
      .toBuffer();
      
    // Now extend it to 1024x1024 by copying edges (256px on each side)
    await sharp(resized)
      .extend({
        top: 256, bottom: 256, left: 256, right: 256,
        extendWith: 'copy'
      })
      .toFile('assets/icon.png');
      
    console.log('Perfect padded icon generated!');
  } catch(e) {
    console.error('Failed:', e.message);
  }
}
run();
