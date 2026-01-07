const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function optimizeImage(inputPath, outputPath, quality = 80) {
    try {
        const info = await sharp(inputPath)
            .png({ quality, compressionLevel: 9, effort: 10 })
            .toFile(outputPath);

        const originalSize = fs.statSync(inputPath).size;
        const newSize = info.size;
        const savings = ((originalSize - newSize) / originalSize * 100).toFixed(2);

        console.log(`✅ ${path.basename(inputPath)}: ${(originalSize / 1024).toFixed(2)}KB → ${(newSize / 1024).toFixed(2)}KB (${savings}% reduction)`);
    } catch (error) {
        console.error(`❌ Error optimizing ${inputPath}:`, error.message);
    }
}

async function main() {
    console.log('🚀 Starting image optimization...\n');

    // Optimize logo
    await optimizeImage(
        'assets/logo.png',
        'assets/logo-optimized.png',
        80
    );

    // Optimize icon
    await optimizeImage(
        'assets/images/icon.png',
        'assets/images/icon-optimized.png',
        80
    );

    // Optimize other images
    const imagesToOptimize = [
        'assets/images/android-icon-background.png',
        'assets/images/android-icon-foreground.png',
        'assets/images/splash-icon.png'
    ];

    for (const img of imagesToOptimize) {
        if (fs.existsSync(img)) {
            const outputPath = img.replace('.png', '-optimized.png');
            await optimizeImage(img, outputPath, 80);
        }
    }

    console.log('\n✨ Image optimization complete!');
    console.log('\n📝 Next steps:');
    console.log('1. Review the optimized images');
    console.log('2. Replace original files with optimized versions if satisfied');
    console.log('3. Update app.json to use optimized images');
}

main();
