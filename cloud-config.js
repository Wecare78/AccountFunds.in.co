/**
 * Independent Cloud Sync Configuration (100% Standalone — No AI Studio Dependency)
 *
 * By default, Account Funds runs completely standalone in the browser and works
 * directly on GitHub Pages ("Deploy from branch") with zero external dependencies.
 *
 * Optional Cross-Device Sync (Phone <-> PC on GitHub Pages):
 * Create a free Firebase Realtime Database (in Test Mode) in your own Firebase Console
 * and paste its URL below, OR configure it directly inside Admin Panel -> "Cloud Sync".
 * Example: rtdbUrl: "https://your-project-default-rtdb.firebaseio.com"
 */
const CLOUD_CONFIG = {
  mode: 'standalone', // 'standalone' | 'rtdb' | 'firestore'
  rtdbUrl: '',
  namespace: 'af_p2',
  firestoreConfig: null,
};

export default CLOUD_CONFIG;
