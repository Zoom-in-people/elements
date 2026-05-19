import { initializeApp, getApps, getApp } from "firebase/app";
import { getDatabase } from "firebase/database";

// .env.local 파일에서 환경 변수를 불러옵니다.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// 앱이 여러 번 초기화되어 에러가 나는 것을 방지합니다.
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// 실시간 데이터베이스(Realtime Database) 인스턴스를 내보냅니다.
export const db = getDatabase(app);