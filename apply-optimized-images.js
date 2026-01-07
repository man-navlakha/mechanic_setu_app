const fs = require('fs');
const path = require('path');

console.log('🔄 Applying optimized images...\n');

const replacements = [
    { original: 'assets/logo.png', optimized: 'assets/logo-optimized.png' },
    { original: 'assets/images/icon.png', optimized: 'assets/images/icon-optimized.png' },
    { original: 'assets/images/android-icon-background.png', optimized: 'assets/images/android-icon-background-optimized.png' },
    { original: 'assets/images/android-icon-foreground.png', optimized: 'assets/images/android-icon-foreground-optimized.png' },
    { original: 'assets/images/splash-icon.png', optimized: 'assets/images/splash-icon-optimized.png' }
];

let totalSaved = 0;

replacements.forEach(({ original, optimized }) => {
    if (fs.existsSync(optimized)) {
        const originalSize = fs.statSync(original).size;
        const optimizedSize = fs.statSync(optimized).size;
        const saved = originalSize - optimizedSize;
        totalSaved += saved;

        // Backup original
        const backupPath = original.replace('.png', '-backup.png');
        fs.copyFileSync(original, backupPath);

        // Replace with optimized
        fs.copyFileSync(optimized, original);

        console.log(`✅ ${path.basename(original)}: Saved ${(saved / 1024).toFixed(2)}KB`);
        console.log(`   Backup created: ${path.basename(backupPath)}`);
    }
});

console.log(`\n🎉 Total space saved: ${(totalSaved / 1024).toFixed(2)}KB`);
console.log('\n📝 Backups created with -backup.png suffix');
console.log('💡 If images look good, you can delete backup files');
