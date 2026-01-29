
// Fix: Import initializeApp from 'firebase/app' ensuring no trailing spaces or module resolution issues
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

// O Vite injeta variáveis de ambiente através de process.env se configurado no Render.
// O API_KEY deve ser obtido exclusivamente de process.env.API_KEY conforme as diretrizes.
const firebaseConfig = {
  apiKey: process.env.API_KEY,
  authDomain: "imek-producao.firebaseapp.com",
  projectId: "imek-producao",
  storageBucket: "imek-producao.firebasestorage.app",
  messagingSenderId: "322626777818",
  appId: "1:322626777818:web:143135482fb05e93e02be3",
  measurementId: "G-3ZH7X7L00R"
};

// Initialize Firebase
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
