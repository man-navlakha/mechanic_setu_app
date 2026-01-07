---
description: Optimize app for both mobile and web deployment
---

# Mobile + Web Optimization Strategy

## 🎯 Goal: Keep Mobile App Lite + Run as Website

Since you want to run this app as BOTH a mobile app AND a website, we need a **platform-specific optimization strategy**.

---

## 📱 Strategy Overview

### Mobile Build (APK/AAB)
- **Minimize size** using ProGuard, AAB, and code splitting
- **Remove web-specific code** during build (tree shaking)
- **Target**: 40-60% size reduction

### Web Build
- **Optimize for web** with code splitting and lazy loading
- **Use CDN** for assets
- **Progressive Web App (PWA)** for better performance
- **Target**: Fast load times (<3s)

---

## 🚀 Step 1: Configure Platform-Specific Builds

### Update `metro.config.js` for Better Tree Shaking

```javascript
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Enable tree shaking for better optimization
config.transformer = {
  ...config.transformer,
  minifierConfig: {
    keep_classnames: false,
    keep_fnames: false,
    mangle: {
      keep_classnames: false,
      keep_fnames: false,
    },
    compress: {
      drop_console: true, // Remove console.logs in production
      drop_debugger: true,
      pure_funcs: ['console.log', 'console.info', 'console.debug'],
    },
  },
};

module.exports = config;
```

---

## 🌐 Step 2: Optimize Web Build

### Create `webpack.config.js` for Web Optimization

```javascript
const createExpoWebpackConfigAsync = require('@expo/webpack-config');

module.exports = async function (env, argv) {
  const config = await createExpoWebpackConfigAsync(
    {
      ...env,
      babel: {
        dangerouslyAddModulePathsToTranspile: ['@expo/vector-icons'],
      },
    },
    argv
  );

  // Enable code splitting
  config.optimization = {
    ...config.optimization,
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          priority: 10,
        },
        common: {
          minChunks: 2,
          priority: 5,
          reuseExistingChunk: true,
        },
      },
    },
  };

  return config;
};
```

---

## 📦 Step 3: Platform-Specific Code

### Use Platform Detection for Conditional Features

```javascript
import { Platform } from 'react-native';

// Example: Use different map libraries for web vs mobile
const MapComponent = Platform.select({
  web: () => require('./components/WebMap').default,
  default: () => require('./components/NativeMap').default,
})();

// Example: Disable features on web
const useNativeFeature = () => {
  if (Platform.OS === 'web') {
    return null; // Skip native-only features
  }
  // Native implementation
};
```

---

## 🎨 Step 4: Optimize Assets for Both Platforms

### Image Strategy

1. **For Mobile**: Use optimized PNGs/WebP
2. **For Web**: Use responsive images with srcset

```javascript
// In your components
import { Image } from 'expo-image';

<Image
  source={require('./assets/logo-optimized.png')}
  style={{ width: 100, height: 100 }}
  contentFit="contain"
  // expo-image handles optimization automatically
/>
```

### Update `app.json` for Web

```json
{
  "expo": {
    "web": {
      "output": "static",
      "favicon": "./assets/logo-optimized.png",
      "bundler": "metro",
      "build": {
        "babel": {
          "include": ["@expo/vector-icons"]
        }
      }
    }
  }
}
```

---

## 🔧 Step 5: Build Configuration

### For Mobile (Keep it Lite)

**Android** - Update `android/app/build.gradle`:

```gradle
android {
    buildTypes {
        release {
            // Enable ProGuard
            minifyEnabled true
            shrinkResources true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
            
            // Additional optimizations
            ndk {
                abiFilters 'armeabi-v7a', 'arm64-v8a'
            }
        }
    }
    
    // Split APKs by architecture
    splits {
        abi {
            enable true
            reset()
            include 'armeabi-v7a', 'arm64-v8a'
            universalApk false
        }
    }
}
```

### For Web (Optimize Load Time)

**Update `package.json` scripts**:

```json
{
  "scripts": {
    "web": "expo start --web",
    "web:build": "expo export:web",
    "web:serve": "npx serve web-build",
    "android:build": "eas build --platform android --profile production",
    "ios:build": "eas build --platform ios --profile production"
  }
}
```

---

## 🌍 Step 6: Deploy Web Version

### Option 1: Vercel (Recommended - Free & Fast)

```bash
# Install Vercel CLI
npm i -g vercel

# Build web version
npm run web:build

# Deploy
cd web-build
vercel
```

### Option 2: Netlify

```bash
# Build
npm run web:build

# Deploy via Netlify CLI
npx netlify-cli deploy --dir=web-build --prod
```

### Option 3: GitHub Pages

```bash
# Install gh-pages
npm install --save-dev gh-pages

# Add to package.json
{
  "scripts": {
    "deploy:web": "expo export:web && gh-pages -d web-build"
  }
}

# Deploy
npm run deploy:web
```

---

## 🎯 Step 7: Progressive Web App (PWA)

### Make Your Web App Installable

**Update `app.json`**:

```json
{
  "expo": {
    "web": {
      "output": "static",
      "favicon": "./assets/logo-optimized.png",
      "themeColor": "#10b981",
      "backgroundColor": "#ffffff",
      "display": "standalone",
      "orientation": "portrait",
      "startUrl": "/",
      "splash": {
        "image": "./assets/logo-optimized.png",
        "backgroundColor": "#ffffff"
      }
    }
  }
}
```

This will generate a `manifest.json` and service worker automatically!

---

## 📊 Performance Optimization Checklist

### Mobile App
- [x] Images optimized (68% reduction on logo)
- [x] Web dependencies included (but tree-shaken in mobile build)
- [ ] ProGuard enabled
- [ ] AAB build configured
- [ ] Console.logs removed in production

### Web App
- [ ] Code splitting enabled
- [ ] Lazy loading for routes
- [ ] PWA configured
- [ ] Assets on CDN (optional)
- [ ] Gzip/Brotli compression

---

## 🚀 Quick Commands

```bash
# Development
npm start              # Choose platform
npm run web           # Web only
npm run android       # Android only

# Production Builds
npm run web:build     # Build web version
npm run android:build # Build Android APK/AAB

# Deploy Web
vercel                # Deploy to Vercel
# or
npm run deploy:web    # Deploy to GitHub Pages
```

---

## 📈 Expected Results

### Mobile App Size
- **Before**: ~50-80 MB
- **After**: ~20-40 MB (40-60% reduction)
- **Download Size (AAB)**: 15-25 MB

### Web App Performance
- **First Load**: <3 seconds
- **Subsequent Loads**: <1 second (with caching)
- **Lighthouse Score**: 90+

---

## 🔍 Platform-Specific Features to Handle

### Features that DON'T work on Web:
1. **Push Notifications** - Use web notifications API instead
2. **Native Maps** - Use MapLibre GL JS or Google Maps JS API
3. **Haptics** - Disable on web
4. **Secure Storage** - Use localStorage/sessionStorage
5. **Native Camera** - Use HTML5 camera API

### Example: Platform-Specific Implementation

```javascript
// utils/storage.js
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export const storage = {
  async setItem(key, value) {
    if (Platform.OS === 'web') {
      localStorage.setItem(key, value);
    } else {
      await SecureStore.setItemAsync(key, value);
    }
  },
  
  async getItem(key) {
    if (Platform.OS === 'web') {
      return localStorage.getItem(key);
    } else {
      return await SecureStore.getItemAsync(key);
    }
  },
};
```

---

## 🎨 Responsive Design for Web

### Add Media Queries for Web

```javascript
// utils/responsive.js
import { Platform, Dimensions } from 'react-native';

export const useResponsive = () => {
  const { width } = Dimensions.get('window');
  
  return {
    isMobile: width < 768,
    isTablet: width >= 768 && width < 1024,
    isDesktop: width >= 1024,
    isWeb: Platform.OS === 'web',
  };
};
```

### Use in Components

```javascript
import { useResponsive } from './utils/responsive';

function DashboardScreen() {
  const { isWeb, isDesktop } = useResponsive();
  
  return (
    <View style={[
      styles.container,
      isDesktop && styles.desktopContainer
    ]}>
      {/* Your content */}
    </View>
  );
}
```

---

## 🎯 Summary

### Your App Will Have:

1. **Mobile App** (Android/iOS)
   - Optimized size (~20-40 MB)
   - Native performance
   - All native features

2. **Web App** (Progressive Web App)
   - Fast load times (<3s)
   - Installable on desktop/mobile
   - Works offline (with service worker)
   - Responsive design

3. **Shared Codebase**
   - ~95% code reuse
   - Platform-specific optimizations
   - Conditional feature loading

---

## 🚀 Next Steps

1. **Test web build**: `npm run web`
2. **Configure ProGuard** for mobile
3. **Set up deployment** (Vercel/Netlify)
4. **Test on both platforms**
5. **Deploy!**

---

## 📚 Resources

- [Expo Web Docs](https://docs.expo.dev/workflow/web/)
- [React Native Web](https://necolas.github.io/react-native-web/)
- [PWA Guide](https://web.dev/progressive-web-apps/)
- [Vercel Deployment](https://vercel.com/docs)
