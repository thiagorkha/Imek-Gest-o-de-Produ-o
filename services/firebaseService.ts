// Fixing the potential import issue where initializeApp was reported as missing from firebase/app
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  setDoc, 
  doc 
} from 'firebase/firestore';
import { ProductionRecord, User, UserRole } from '../types';

// NOTE: In a real scenario, these would be in environment variables.
// Using mock configuration structure as requested.
const firebaseConfig = {
  apiKey: "AIzaSyA0SQwMvqXRimhqLviCL0LfoD062gr2Jk0",
  authDomain: "imek-producao.firebaseapp.com",
  projectId: "imek-producao",
  storageBucket: "imek-producao.firebasestorage.app",
  messagingSenderId: "322626777818",
  appId: "1:322626777818:web:143135482fb05e93e02be3",
  measurementId: "G-3ZH7X7L00R"
};

// Initialize the Firebase application
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

export const firebaseService = {
  async registerUser(username: string, password: string): Promise<User> {
    const userRef = doc(db, 'users', username.toLowerCase());
    const newUser: User = {
      id: username.toLowerCase(),
      username,
      role: username.toLowerCase() === 'admin' ? UserRole.ADMIN : UserRole.OPERATOR
    };
    await setDoc(userRef, { ...newUser, password });
    return newUser;
  },

  async loginUser(username: string, password: string): Promise<User | null> {
    const userRef = doc(db, 'users', username.toLowerCase());
    const snapshot = await getDocs(query(collection(db, 'users'), where('username', '==', username)));
    
    if (snapshot.empty) return null;
    
    const userData = snapshot.docs[0].data();
    if (userData.password !== password) return null;

    return {
      id: snapshot.docs[0].id,
      username: userData.username,
      role: userData.role
    };
  },

  async saveRecord(record: ProductionRecord): Promise<string> {
    const docRef = await addDoc(collection(db, 'production_records'), record);
    return docRef.id;
  },

  async getAllRecords(): Promise<ProductionRecord[]> {
    const q = query(collection(db, 'production_records'), orderBy('timestamp', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProductionRecord));
  }
};
