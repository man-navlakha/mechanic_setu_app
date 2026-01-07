#!/usr/bin/env node

const fs = require('fs');
const { execSync } = require('child_process');

console.log('📦 Mechanic Setu - App Size Optimization Checklist\n');
console.log('='.repeat(60) + '\n');

const checks = [];

// Check 1: Images optimized
console.log('1️⃣  Checking image optimization...');
const optimizedImages = [
    'assets/logo-optimized.png',
    'assets/images/icon-optimized.png'
];
const imagesOptimized = optimizedImages.every(img => fs.existsSync(img));
checks.push({ name: 'Images optimized', status: imagesOptimized });
console.log(imagesOptimized ? '   ✅ Optimized images created' : '   ❌ Run: node optimize-images.js');

// Check 2: Web dependencies
console.log('\n2️⃣  Checking web dependencies...');
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const hasWebDeps = packageJson.dependencies['react-native-web'] || packageJson.dependencies['react-dom'];
checks.push({ name: 'Web deps removed', status: !hasWebDeps });
console.log(!hasWebDeps ? '   ✅ Web dependencies removed' : '   ⚠️  Consider removing: npm uninstall react-native-web react-dom');

// Check 3: ProGuard enabled
console.log('\n3️⃣  Checking ProGuard/R8 configuration...');
const buildGradlePath = 'android/app/build.gradle';
let proguardEnabled = false;
if (fs.existsSync(buildGradlePath)) {
    const buildGradle = fs.readFileSync(buildGradlePath, 'utf8');
    proguardEnabled = buildGradle.includes('minifyEnabled true');
}
checks.push({ name: 'ProGuard enabled', status: proguardEnabled });
console.log(proguardEnabled ? '   ✅ ProGuard enabled' : '   ⚠️  Enable ProGuard in android/app/build.gradle');

// Check 4: AAB build configured
console.log('\n4️⃣  Checking EAS build configuration...');
let aabConfigured = false;
if (fs.existsSync('eas.json')) {
    const easJson = JSON.parse(fs.readFileSync('eas.json', 'utf8'));
    aabConfigured = easJson.build?.production?.android?.buildType === 'app-bundle';
}
checks.push({ name: 'AAB build configured', status: aabConfigured });
console.log(aabConfigured ? '   ✅ AAB build configured' : '   ⚠️  Configure AAB in eas.json');

// Check 5: Console removal configured
console.log('\n5️⃣  Checking console.log removal...');
const babelConfigPath = 'babel.config.js';
let consoleRemovalConfigured = false;
if (fs.existsSync(babelConfigPath)) {
    const babelConfig = fs.readFileSync(babelConfigPath, 'utf8');
    consoleRemovalConfigured = babelConfig.includes('transform-remove-console');
}
checks.push({ name: 'Console removal', status: consoleRemovalConfigured });
console.log(consoleRemovalConfigured ? '   ✅ Console removal configured' : '   ⚠️  Install babel-plugin-transform-remove-console');

// Summary
console.log('\n' + '='.repeat(60));
console.log('\n📊 Summary:');
const completed = checks.filter(c => c.status).length;
const total = checks.length;
console.log(`   ${completed}/${total} optimizations completed (${Math.round(completed / total * 100)}%)\n`);

if (completed === total) {
    console.log('🎉 All optimizations complete! Your app is ready for a lean build.');
} else {
    console.log('📝 Next steps:');
    checks.forEach((check, i) => {
        if (!check.status) {
            console.log(`   ${i + 1}. ${check.name}`);
        }
    });
}

console.log('\n💡 Run "eas build --platform android" to create optimized build');
console.log('📖 Full guide: .agent/workflows/app-size-optimization.md\n');
