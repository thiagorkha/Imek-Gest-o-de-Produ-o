
// Fix: Use standard modular import for initializeApp from firebase/app
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
  doc,
  getDoc,
  deleteDoc
} from 'firebase/firestore';
import { ProductionRecord, User, UserRole } from '../types';

// Standard Firebase configuration for the project
const firebaseConfig = {
  apiKey: "AIzaSyA0SQwMvqXRimhqLviCL0LfoD062gr2Jk0",
  authDomain: "imek-producao.firebaseapp.com",
  projectId: "imek-producao",
  storageBucket: "imek-producao.firebasestorage.app",
  messagingSenderId: "322626777818",
  appId: "1:322626777818:web:143135482fb05e93e02be3",
  measurementId: "G-3ZH7X7L00R"
};

// Initialize Firebase with the modular SDK entry point.
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

export interface ActiveSession {
  maquina: string;
  op: string;
  cp: string;
  startTime: number;
  isSetupMode: boolean;
  setupDurationSeconds: number;
  timestamp: number;
}

export const firebaseService = {
  async registerUser(username: string, password: string): Promise<User> {
    try {
      const lowerUsername = username.toLowerCase();
      const userRef = doc(db, 'users', lowerUsername);
      
      const isAdmin = ['admin', 'master'].includes(lowerUsername);
      
      const newUser: User = {
        id: lowerUsername,
        username,
        role: isAdmin ? UserRole.ADMIN : UserRole.OPERATOR
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
  },

  // Gerenciamento de Sessão Ativa (Cronômetro)
  async saveActiveSession(userId: string, session: ActiveSession): Promise<void> {
    const sessionRef = doc(db, 'active_sessions', userId);
    await setDoc(sessionRef, session);
  },

  async getActiveSession(userId: string): Promise<ActiveSession | null> {
    const sessionRef = doc(db, 'active_sessions', userId);
    const snapshot = await getDoc(sessionRef);
    if (snapshot.exists()) {
      return snapshot.data() as ActiveSession;
    }
    return null;
  },

  async deleteActiveSession(userId: string): Promise<void> {
    const sessionRef = doc(db, 'active_sessions', userId);
    await deleteDoc(sessionRef);
  }
};
