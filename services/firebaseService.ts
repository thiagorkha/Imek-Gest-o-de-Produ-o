
// Fix: Use the correct import for initializeApp from firebase/app
import * as firebaseApp from 'firebase/app';
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

const firebaseConfig = {
  apiKey: "AIzaSyA0SQwMvqXRimhqLviCL0LfoD062gr2Jk0",
  authDomain: "imek-producao.firebaseapp.com",
  projectId: "imek-producao",
  storageBucket: "imek-producao.firebasestorage.app",
  messagingSenderId: "322626777818",
  appId: "1:322626777818:web:143135482fb05e93e02be3",
  measurementId: "G-3ZH7X7L00R"
};

// Use the explicit initializeApp from the star import to avoid named export resolution issues
const app = firebaseApp.initializeApp(firebaseConfig);
export const db = getFirestore(app);

export const firebaseService = {
  async registerUser(username: string, password: string): Promise<User> {
    try {
      const userRef = doc(db, 'users', username.toLowerCase());
      const newUser: User = {
        id: username.toLowerCase(),
        username,
        role: username.toLowerCase() === 'admin' ? UserRole.ADMIN : UserRole.OPERATOR
      };
      await setDoc(userRef, { ...newUser, password });
      return newUser;
    } catch (error) {
      console.error("Erro detalhado no registro:", error);
      throw error;
    }
  },

  async loginUser(username: string, password: string): Promise<User | null> {
    try {
      const snapshot = await getDocs(query(collection(db, 'users'), where('username', '==', username)));
      
      if (snapshot.empty) return null;
      
      const userData = snapshot.docs[0].data();
      if (userData.password !== password) return null;

      return {
        id: snapshot.docs[0].id,
        username: userData.username,
        role: userData.role
      };
    } catch (error) {
      console.error("Erro detalhado no login:", error);
      throw error;
    }
  },

  async saveRecord(record: ProductionRecord): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, 'production_records'), record);
      return docRef.id;
    } catch (error) {
      console.error("Erro ao salvar registro:", error);
      throw error;
    }
  },

  async getAllRecords(): Promise<ProductionRecord[]> {
    try {
      const q = query(collection(db, 'production_records'), orderBy('timestamp', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProductionRecord));
    } catch (error) {
      console.error("Erro ao buscar registros:", error);
      throw error;
    }
  }
};
