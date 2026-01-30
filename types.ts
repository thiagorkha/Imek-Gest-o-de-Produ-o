
export enum UserRole {
  OPERATOR = 'OPERATOR',
  ADMIN = 'ADMIN'
}

export interface User {
  id: string;
  username: string;
  role: UserRole;
}

export interface ProductionPause {
  reason: string;
  durationSeconds: number;
  timestamp: number;
}

export interface ProductionRecord {
  id?: string;
  operador: string;
  maquina: string;
  op: string;
  cp: string;
  startTime: number;
  endTime: number;
  durationSeconds: number;
  setupDurationSeconds: number;
  totalPauseSeconds: number;
  pauses: ProductionPause[];
  pauseReasons: string; // Motivos concatenados por "/"
  quantity: number;
  observation: string;
  timestamp: number;
}

export enum AppStep {
  LOGIN = 'LOGIN',
  REGISTER = 'REGISTER',
  ADMIN_MENU = 'ADMIN_MENU',
  IDENTIFICATION = 'IDENTIFICATION',
  DETAILS = 'DETAILS',
  TIMER = 'TIMER',
  SUMMARY = 'SUMMARY',
  COMPLETED = 'COMPLETED',
  GESTÃO_PRODUCAO = 'GESTÃO_PRODUCAO',
  SAVED_RECORDS = 'SAVED_RECORDS',
  ANALYSIS = 'ANALYSIS',
  DAILY_VIEW = 'DAILY_VIEW'
}
