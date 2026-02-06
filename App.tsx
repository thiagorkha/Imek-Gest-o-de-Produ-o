
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { AppStep, User, UserRole, ProductionRecord, ProductionPause } from './types';
import { firebaseService, ActiveSession } from './services/firebaseService';
import { Html5Qrcode } from 'html5-qrcode';
import { 
  ClipboardCheck, 
  LogOut, 
  CheckCircle2, 
  LayoutDashboard,
  FileSpreadsheet, 
  PieChart, 
  ArrowLeft,
  Download,
  Calendar,
  Sparkles,
  TrendingUp,
  Clock,
  Cloud,
  Pause,
  AlertCircle,
  ScanLine,
  RefreshCw,
  BrainCircuit,
  Users,
  SearchX,
  Database
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { format, isSameDay, endOfDay, isWithinInterval } from 'date-fns';
import { GoogleGenAI } from "@google/genai";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  ComposedChart,
  Line,
  Legend
} from 'recharts';

// Helpers de Data
const parseISO = (dateString: string): Date => {
  if (!dateString) return new Date();
  const [year, month, day] = dateString.split('T')[0].split('-').map(Number);
  return new Date(year, month - 1, day);
};

const startOfDay = (date: Date | number): Date => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const LOCAL_STORAGE_KEY = 'imek_active_session_v2';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [step, setStep] = useState<AppStep>(AppStep.LOGIN);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'error'>('synced');
  const [lastSyncTime, setLastSyncTime] = useState<string>(format(new Date(), 'HH:mm:ss'));
  const [aiInsights, setAiInsights] = useState<string | null>(null);

  const wakeLockRef = useRef<any>(null);

  // Estados de Dados
  const [records, setRecords] = useState<ProductionRecord[]>([]);
  const [tableStartDate, setTableStartDate] = useState(format(startOfDay(new Date()), 'yyyy-MM-01'));
  const [tableEndDate, setTableEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  // Estados de Análise
  const [analysisOperator, setAnalysisOperator] = useState('ALL');
  const [analysisStartDate, setAnalysisStartDate] = useState(format(startOfDay(new Date()), 'yyyy-MM-01'));
  const [analysisEndDate, setAnalysisEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [availableHoursPerDay, setAvailableHoursPerDay] = useState(8.8);

  // Estados do Timer
  const [prodData, setProdData] = useState<Partial<ProductionRecord>>({
    maquina: '', op: '', cp: '', durationSeconds: 0, setupDurationSeconds: 0, totalPauseSeconds: 0, pauses: [], quantity: 0, observation: ''
  });
  const [productionStartTime, setProductionStartTime] = useState<number | null>(null);
  const [isSetupMode, setIsSetupMode] = useState(true);
  const [timerStartTime, setTimerStartTime] = useState<number | null>(null);
  const [timer, setTimer] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [pauseReason, setPauseReason] = useState('');
  const [pauseStartTime, setPauseStartTime] = useState<number | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [phasePauseMs, setPhasePauseMs] = useState(0); 
  const [totalPauseMs, setTotalPauseMs] = useState(0);
  const [pausesList, setPausesList] = useState<ProductionPause[]>([]);

  // Função centralizada para buscar registros
  const fetchRecords = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const allRecords = await firebaseService.getAllRecords();
      setRecords(allRecords);
      setSyncStatus('synced');
      setLastSyncTime(format(new Date(), 'HH:mm:ss'));
    } catch (err) {
      console.error("Erro ao buscar registros:", err);
      setSyncStatus('error');
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  // Sincronizar dados automaticamente ao mudar para telas de gestão
  useEffect(() => {
    if (user?.role === UserRole.ADMIN && [AppStep.GESTÃO_PRODUCAO, AppStep.ANALYSIS, AppStep.SAVED_RECORDS].includes(step)) {
      fetchRecords(records.length === 0); // Só mostra loading se estiver vazio
    }
  }, [step, user, fetchRecords, records.length]);

  const requestWakeLock = async () => {
    if ('wakeLock' in navigator) {
      try { wakeLockRef.current = await (navigator as any).wakeLock.request('screen'); } 
      catch (err) { console.error('WakeLock failed:', err); }
    }
  };

  const releaseWakeLock = () => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release();
      wakeLockRef.current = null;
    }
  };

  const persistSession = async (overrideParams: Partial<ActiveSession> = {}) => {
    if (!user) return;
    const currentTimestamp = overrideParams.timestamp || timerStartTime;
    if (!currentTimestamp) return;
    setSyncStatus('syncing');
    const session: ActiveSession = {
      maquina: overrideParams.maquina || prodData.maquina || '',
      op: overrideParams.op || prodData.op || '',
      cp: overrideParams.cp || prodData.cp || '',
      startTime: productionStartTime || Date.now(),
      isSetupMode: overrideParams.isSetupMode !== undefined ? overrideParams.isSetupMode : isSetupMode,
      setupDurationSeconds: overrideParams.setupDurationSeconds !== undefined ? overrideParams.setupDurationSeconds : (prodData.setupDurationSeconds || 0),
      timestamp: currentTimestamp,
      isPaused: overrideParams.isPaused !== undefined ? overrideParams.isPaused : isPaused,
      pauseStartTime: overrideParams.pauseStartTime !== undefined ? overrideParams.pauseStartTime : pauseStartTime,
      phasePauseMs: overrideParams.phasePauseMs !== undefined ? overrideParams.phasePauseMs : phasePauseMs,
      totalPauseMs: overrideParams.totalPauseMs !== undefined ? overrideParams.totalPauseMs : totalPauseMs,
      pauses: overrideParams.pauses || pausesList
    };
    try {
      localStorage.setItem(`${LOCAL_STORAGE_KEY}_${user.id}`, JSON.stringify({ ...session, clientTimestamp: Date.now() }));
      await firebaseService.saveActiveSession(user.id, session);
      setSyncStatus('synced');
      setLastSyncTime(format(new Date(), 'HH:mm:ss'));
    } catch (err) { setSyncStatus('error'); }
  };

  useEffect(() => {
    let heartbeat: any;
    if (timerStartTime && step === AppStep.TIMER) heartbeat = setInterval(() => persistSession(), 60000);
    return () => clearInterval(heartbeat);
  }, [timerStartTime, step, prodData, isPaused, pausesList]);

  useEffect(() => {
    const checkForActiveSession = async () => {
      if (user && user.role === UserRole.OPERATOR) {
        setLoading(true);
        try {
          const localData = localStorage.getItem(`${LOCAL_STORAGE_KEY}_${user.id}`);
          const firebaseSession = await firebaseService.getActiveSession(user.id);
          let session = firebaseSession || (localData ? JSON.parse(localData) : null);
          if (session) {
            setProdData({ maquina: session.maquina, op: session.op, cp: session.cp, setupDurationSeconds: session.setupDurationSeconds, operador: user.username });
            setProductionStartTime(session.startTime); setIsSetupMode(session.isSetupMode); setTimerStartTime(session.timestamp); 
            setIsPaused(session.isPaused); setPauseStartTime(session.pauseStartTime); setPhasePauseMs(session.phasePauseMs);
            setTotalPauseMs(session.totalPauseMs); setPausesList(session.pauses || []);
            const currentNet = session.isPaused && session.pauseStartTime ? Math.floor((session.pauseStartTime - session.timestamp - session.phasePauseMs) / 1000) : Math.floor((Date.now() - session.timestamp - session.phasePauseMs) / 1000);
            setTimer(Math.max(0, currentNet));
            if (!session.isPaused) requestWakeLock();
            setStep(AppStep.TIMER);
          }
        } catch (err) { console.error(err); } finally { setLoading(false); }
      }
    };
    checkForActiveSession();
  }, [user]);

  useEffect(() => {
    let interval: any;
    if (timerStartTime && !isPaused) {
      interval = setInterval(() => setTimer(Math.max(0, Math.floor((Date.now() - timerStartTime - phasePauseMs) / 1000))), 1000);
    }
    return () => clearInterval(interval);
  }, [timerStartTime, isPaused, phasePauseMs]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError('');
    try {
      const loggedUser = await firebaseService.loginUser(username, password);
      if (loggedUser) {
        setUser(loggedUser);
        await fetchRecords();
        setStep(loggedUser.role === UserRole.ADMIN ? AppStep.ADMIN_MENU : AppStep.IDENTIFICATION);
      } else { setError('Usuário ou senha inválidos.'); }
    } catch (err) { setError('Erro ao conectar.'); } finally { setLoading(false); }
  };

  const startProduction = async (mode: 'setup' | 'direct') => {
    if (!prodData.maquina || !prodData.op || !prodData.cp) { setError('Preencha os campos obrigatórios.'); return; }
    setLoading(true); const now = Date.now();
    try {
      await persistSession({ maquina: prodData.maquina, op: prodData.op, cp: prodData.cp, startTime: now, isSetupMode: mode === 'setup', timestamp: now, isPaused: false, phasePauseMs: 0, totalPauseMs: 0, pauses: [] });
      setProductionStartTime(now); setIsSetupMode(mode === 'setup'); setTimerStartTime(now); setTimer(0); setIsPaused(false); setPhasePauseMs(0); setTotalPauseMs(0); setPausesList([]);
      await requestWakeLock(); setStep(AppStep.TIMER);
    } catch (err) { setError("Erro ao iniciar sessão."); } finally { setLoading(false); }
  };

  const finishProduction = () => { releaseWakeLock(); setStep(AppStep.SUMMARY); };

  const handlePause = async () => {
    const now = Date.now(); setIsPaused(true); setPauseStartTime(now); setPauseReason(''); releaseWakeLock();
    await persistSession({ isPaused: true, pauseStartTime: now });
  };

  const handleResume = async () => {
    if (!pauseReason.trim()) { setError('Por favor, informe o motivo da pausa.'); return; }
    const now = Date.now(); const dur = pauseStartTime ? (now - pauseStartTime) : 0;
    const newPause = { reason: pauseReason.trim(), durationSeconds: Math.floor(dur / 1000), timestamp: now };
    const newList = [...pausesList, newPause]; const newPhase = phasePauseMs + dur; const newTotal = totalPauseMs + dur;
    setPhasePauseMs(newPhase); setTotalPauseMs(newTotal); setPausesList(newList); setIsPaused(false); setPauseStartTime(null); setPauseReason('');
    await requestWakeLock(); await persistSession({ isPaused: false, pauseStartTime: null, phasePauseMs: newPhase, totalPauseMs: newTotal, pauses: newList });
  };

  const saveRecord = async () => {
    if (!prodData.quantity || prodData.quantity <= 0) { setError("Informe a quantidade produzida."); return; }
    setLoading(true);
    try {
      const rec: ProductionRecord = { 
        operador: user?.username || '', 
        maquina: prodData.maquina!, 
        op: prodData.op!, 
        cp: prodData.cp!, 
        startTime: productionStartTime!, 
        endTime: Date.now(), 
        durationSeconds: timer, 
        setupDurationSeconds: prodData.setupDurationSeconds || 0, 
        totalPauseSeconds: Math.floor(totalPauseMs / 1000), 
        pauses: pausesList, 
        pauseReasons: pausesList.map(p => p.reason).join(' / '), 
        quantity: prodData.quantity || 0, 
        observation: prodData.observation || '', 
        timestamp: Date.now() 
      };
      await firebaseService.saveRecord(rec);
      if (user) { await firebaseService.deleteActiveSession(user.id); localStorage.removeItem(`${LOCAL_STORAGE_KEY}_${user.id}`); }
      await fetchRecords(); 
      setStep(AppStep.COMPLETED);
    } catch (err) { setError('Erro ao salvar registro.'); } finally { setLoading(false); }
  };

  const formatDuration = (s: number) => {
    const h = Math.floor(s / 3600).toString().padStart(2, '0');
    const m = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${h}:${m}:${sec}`;
  };

  // --- LOGICA DE FILTROS E GRAFICOS ---

  const filteredTableRecords = useMemo(() => {
    const start = startOfDay(parseISO(tableStartDate)).getTime();
    const end = endOfDay(parseISO(tableEndDate)).getTime();
    return records.filter(r => r.timestamp >= start && r.timestamp <= end);
  }, [records, tableStartDate, tableEndDate]);

  const uniqueOperators = useMemo(() => {
    const ops = new Set(records.map(r => r.operador));
    return Array.from(ops).sort();
  }, [records]);

  const analysisChartData = useMemo(() => {
    if (!records || records.length === 0) return [];
    
    const start = startOfDay(parseISO(analysisStartDate)).getTime();
    const end = endOfDay(parseISO(analysisEndDate)).getTime();
    const filtered = records.filter(r => {
      const isOperator = analysisOperator === 'ALL' || r.operador === analysisOperator;
      const isDate = r.timestamp >= start && r.timestamp <= end;
      return isOperator && isDate;
    });

    const dailyMap = new Map<string, { timestamp: number, dateLabel: string, quantity: number, prodHours: number, meta: number }>();
    
    filtered.forEach(r => {
      const d = startOfDay(new Date(r.timestamp));
      const key = format(d, 'yyyy-MM-dd');
      const existing = dailyMap.get(key) || { 
        timestamp: d.getTime(), 
        dateLabel: format(d, 'dd/MM'), 
        quantity: 0, 
        prodHours: 0, 
        meta: availableHoursPerDay 
      };
      
      existing.quantity += r.quantity;
      existing.prodHours += (r.durationSeconds + r.setupDurationSeconds) / 3600;
      dailyMap.set(key, existing);
    });

    return Array.from(dailyMap.values()).sort((a, b) => a.timestamp - b.timestamp);
  }, [records, analysisOperator, analysisStartDate, analysisEndDate, availableHoursPerDay]);

  const dailyStats = useMemo(() => {
    const today = startOfDay(new Date());
    const todayRecords = records.filter(r => isSameDay(new Date(r.timestamp), today));
    const totalHours = todayRecords.reduce((acc, r) => acc + (r.durationSeconds + r.setupDurationSeconds) / 3600, 0);
    const todayPercent = availableHoursPerDay > 0 ? Math.round((totalHours / availableHoursPerDay) * 100) : 0;
    return { todayRecords, todayPercent };
  }, [records, availableHoursPerDay]);

  const generateAIInsights = async () => {
    setLoading(true); setAiInsights(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `Como um consultor de produtividade industrial, analise os dados da IMEK SLEEVE:
                      Operador: ${analysisOperator === 'ALL' ? 'Todos' : analysisOperator}.
                      Período: ${analysisStartDate} a ${analysisEndDate}.
                      Disponibilidade Meta: ${availableHoursPerDay}h/dia.
                      Dados Diários (Peças e Horas): ${JSON.stringify(analysisChartData.map(d => ({ data: d.dateLabel, qtd: d.quantity, horas: d.prodHours.toFixed(1) })))}.
                      Forneça 3 sugestões críticas para melhorar a eficiência.`;
      
      const response = await ai.models.generateContent({ 
        model: 'gemini-3-pro-preview', 
        contents: prompt 
      });
      setAiInsights(response.text || "Dados insuficientes para análise no momento.");
    } catch (err) { 
      console.error(err);
      setError("Falha na inteligência artificial. Tente novamente."); 
    } finally { setLoading(false); }
  };

  const exportFilteredToExcel = () => {
    const data = filteredTableRecords.map(r => ({ 
      Data: format(new Date(r.timestamp), 'dd/MM/yyyy'), 
      Operador: r.operador, 
      Máquina: r.maquina, 
      OP: r.op, 
      CP: r.cp, 
      Qtde: r.quantity, 
      'Produção (h)': (r.durationSeconds / 3600).toFixed(2), 
      'Setup (h)': (r.setupDurationSeconds / 3600).toFixed(2), 
      'Pausas (h)': (r.totalPauseSeconds / 3600).toFixed(2),
      Motivos: r.pauseReasons,
      Observação: r.observation
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new(); 
    XLSX.utils.book_append_sheet(wb, ws, 'Relatorio_IMEK');
    XLSX.writeFile(wb, `IMEK_Producao_${tableStartDate}_ate_${tableEndDate}.xlsx`);
  };

  const EmptyState = ({ message }: { message: string }) => (
    <div className="flex flex-col items-center justify-center py-20 text-gray-400 space-y-4">
      <div className="bg-gray-100 p-6 rounded-full"><SearchX size={48} className="opacity-40" /></div>
      <p className="text-sm font-bold uppercase tracking-widest">{message}</p>
    </div>
  );

  const ScannerOverlay = () => {
    useEffect(() => {
      const html5QrCode = new Html5Qrcode("scanner-reader");
      html5QrCode.start(
        { facingMode: "environment" }, 
        { fps: 20, qrbox: { width: 280, height: 140 }, aspectRatio: 1.777 }, 
        (text) => { 
          if (navigator.vibrate) navigator.vibrate(50);
          setProdData(p => ({ ...p, op: text })); 
          setIsScanning(false); 
          html5QrCode.stop(); 
        }, 
        undefined
      ).catch(() => { setError("Câmera indisponível."); setIsScanning(false); });
      return () => { if (html5QrCode.isScanning) html5QrCode.stop(); };
    }, []);
    return (
      <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center animate-in fade-in duration-300">
        <div className="w-full h-full relative" id="scanner-reader"></div>
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div className="w-[280px] h-[140px] border-2 border-blue-500 rounded-3xl relative shadow-[0_0_50px_rgba(59,130,246,0.3)]">
            <div className="absolute top-0 left-0 w-full h-0.5 bg-blue-500 animate-pulse"></div>
          </div>
        </div>
        <button onClick={() => setIsScanning(false)} className="z-20 mt-12 bg-white/10 text-white px-12 py-4 rounded-full font-black backdrop-blur-xl border border-white/20 active:scale-95 transition-all">CANCELAR LEITURA</button>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      {isScanning && <ScannerOverlay />}
      <div className={`w-full ${[AppStep.SAVED_RECORDS, AppStep.ANALYSIS, AppStep.DAILY_VIEW].includes(step) ? 'max-w-6xl' : 'max-w-md'} bg-white rounded-[3rem] shadow-2xl overflow-hidden border border-gray-100 transition-all duration-500`}>
        
        {/* Header Superior */}
        <div className="bg-white p-8 flex flex-col items-center border-b border-gray-100">
           <div className="bg-blue-600 p-4 rounded-3xl mb-3 shadow-2xl shadow-blue-100"><ClipboardCheck className="text-white w-8 h-8" /></div>
           <h1 className="text-3xl font-black text-gray-900 tracking-tighter">IMEK SLEEVE</h1>
           <p className="text-gray-400 text-[10px] font-black uppercase tracking-[0.2em]">SISTEMA DE GESTÃO INDUSTRIAL</p>
        </div>

        <div className="p-8">
          {error && (
            <div className="mb-6 p-4 bg-red-50 text-red-600 text-sm rounded-2xl border border-red-100 font-bold flex items-center gap-3 animate-in slide-in-from-top-2">
              <AlertCircle size={18} /> {error}
            </div>
          )}

          {step === AppStep.LOGIN && (
            <form onSubmit={handleLogin} className="space-y-4">
              <input type="text" value={username} onChange={e => setUsername(e.target.value)} className="w-full p-4 rounded-2xl border border-gray-100 bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none font-medium transition-all" placeholder="Usuário" required />
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-4 rounded-2xl border border-gray-100 bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none font-medium transition-all" placeholder="Senha" required />
              <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all active:scale-95">{loading ? 'Autenticando...' : 'ENTRAR NO SISTEMA'}</button>
              <button type="button" onClick={() => setStep(AppStep.REGISTER)} className="w-full text-blue-600 text-[10px] font-black uppercase tracking-widest py-2">Solicitar Cadastro</button>
            </form>
          )}

          {step === AppStep.IDENTIFICATION && (
            <div className="space-y-6">
              <h2 className="text-xl font-black text-gray-800 flex items-center gap-2"><LayoutDashboard className="text-blue-600" size={20} /> PASSO 1: EQUIPAMENTO</h2>
              <select value={prodData.maquina} onChange={e => setProdData(p => ({ ...p, maquina: e.target.value }))} className="w-full p-4 rounded-2xl border border-gray-100 bg-gray-50 font-black text-gray-700 appearance-none cursor-pointer">
                <option value="">Selecione a Máquina...</option>
                <option>Romi D1000</option><option>Veker Mvk 1050</option><option>Torno Cnc Cosmos</option><option>Torno Convencional</option><option>Torno Mascote</option><option>Fresadora Ferramenteira</option>
              </select>
              <div className="grid grid-cols-1 gap-3">
                <button onClick={() => setStep(AppStep.DAILY_VIEW)} className="w-full border-2 border-blue-600 text-blue-600 font-black py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-blue-50 transition-all"><PieChart size={20} /> MEU RESUMO DIÁRIO</button>
                <button onClick={() => prodData.maquina ? setStep(AppStep.DETAILS) : setError('Selecione uma máquina.')} className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-blue-100 active:scale-95">PROSSEGUIR</button>
              </div>
            </div>
          )}

          {step === AppStep.DETAILS && (
            <div className="space-y-6">
              <h2 className="text-xl font-black text-gray-800 flex items-center gap-2"><ScanLine className="text-blue-600" size={20} /> PASSO 2: ORDEM</h2>
              <div className="flex gap-2">
                <input type="text" value={prodData.op} onChange={e => setProdData(p => ({ ...p, op: e.target.value }))} className="flex-1 p-4 rounded-2xl border border-gray-100 bg-gray-50 font-black" placeholder="OP (Nº da Ordem)" />
                <button onClick={() => setIsScanning(true)} className="p-4 bg-blue-100 text-blue-600 rounded-2xl hover:bg-blue-200 transition-all shadow-inner"><ScanLine size={24} /></button>
              </div>
              <input type="text" value={prodData.cp} onChange={e => setProdData(p => ({ ...p, cp: e.target.value }))} className="w-full p-4 rounded-2xl border border-gray-100 bg-gray-50 font-black" placeholder="CP (Código do Produto)" />
              <div className="flex gap-4">
                <button onClick={() => startProduction('setup')} className="flex-1 bg-green-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-green-100 active:scale-95">MODO SETUP</button>
                <button onClick={() => startProduction('direct')} className="flex-1 bg-blue-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-blue-100 active:scale-95">PRODUÇÃO</button>
              </div>
              <button onClick={() => setStep(AppStep.IDENTIFICATION)} className="w-full text-gray-400 font-black text-[10px] uppercase tracking-widest">Voltar</button>
            </div>
          )}

          {step === AppStep.TIMER && (
            <div className="space-y-6 text-center">
              <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-[10px] font-black border mx-auto w-fit ${syncStatus === 'synced' ? 'bg-green-50 text-green-600 border-green-200' : 'bg-blue-50 text-blue-600 border-blue-200'}`}>
                {syncStatus === 'syncing' ? <RefreshCw size={12} className="animate-spin" /> : <Cloud size={12} />}
                <span>{syncStatus === 'synced' ? `SINCRO: ${lastSyncTime}` : 'SINCRONIZANDO...'}</span>
              </div>
              <h2 className={`text-2xl font-black tracking-tight ${isPaused ? 'text-orange-500' : 'text-gray-800'}`}>{isPaused ? 'PAUSADO' : (isSetupMode ? 'SETUP EM CURSO' : 'EM PRODUÇÃO')}</h2>
              <div className={`p-10 rounded-[3rem] font-mono text-6xl border-4 transition-all duration-500 shadow-2xl ${isPaused ? 'bg-orange-50 text-orange-600 border-orange-200' : 'bg-gray-900 text-green-400 border-gray-800 shadow-blue-100'}`}>{formatDuration(timer)}</div>
              
              {!isPaused ? (
                <div className="space-y-4">
                  <button onClick={handlePause} className="w-full bg-orange-500 text-white font-black py-5 rounded-3xl flex items-center justify-center gap-3 shadow-xl active:scale-95"><Pause size={20} /> PAUSAR OPERAÇÃO</button>
                  {isSetupMode ? (
                    <button onClick={() => { setIsSetupMode(false); setProdData(p => ({ ...p, setupDurationSeconds: timer })); setTimerStartTime(Date.now()); setTimer(0); persistSession({ isSetupMode: false, timestamp: Date.now(), setupDurationSeconds: timer }); }} className="w-full bg-green-600 text-white font-black py-5 rounded-3xl shadow-xl active:scale-95">CONCLUIR SETUP</button>
                  ) : (
                    <button onClick={finishProduction} className="w-full bg-red-600 text-white font-black py-5 rounded-3xl shadow-xl active:scale-95">FINALIZAR OP</button>
                  )}
                </div>
              ) : (
                <div className="space-y-4 text-left animate-in slide-in-from-top-4">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Motivo do Intervalo:</label>
                  <textarea value={pauseReason} onChange={e => setPauseReason(e.target.value)} className="w-full p-5 rounded-3xl border border-orange-200 bg-orange-50/50 font-bold focus:ring-2 focus:ring-orange-500 outline-none h-28" placeholder="Descreva o motivo da pausa..."/>
                  <button onClick={handleResume} className="w-full bg-blue-600 text-white font-black py-5 rounded-3xl shadow-xl active:scale-95">RETOMAR AGORA</button>
                </div>
              )}
            </div>
          )}

          {step === AppStep.ADMIN_MENU && (
            <div className="space-y-4">
               <h2 className="text-2xl font-black text-center mb-6 text-gray-800">CENTRAL DO GESTOR</h2>
               <button onClick={() => setStep(AppStep.IDENTIFICATION)} className="w-full flex items-center gap-5 p-6 bg-blue-50 rounded-[2rem] border border-blue-100 group active:scale-95 transition-all">
                 <div className="bg-blue-600 p-4 rounded-2xl text-white shadow-lg group-hover:rotate-12 transition-transform"><ClipboardCheck size={28} /></div>
                 <div className="text-left"><span className="block font-black text-gray-800">NOVO APONTAMENTO</span><span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Chão de Fábrica</span></div>
               </button>
               <button onClick={() => setStep(AppStep.GESTÃO_PRODUCAO)} className="w-full flex items-center gap-5 p-6 bg-indigo-50 rounded-[2rem] border border-indigo-100 group active:scale-95 transition-all">
                 <div className="bg-indigo-600 p-4 rounded-2xl text-white shadow-lg group-hover:-rotate-12 transition-transform"><LayoutDashboard size={28} /></div>
                 <div className="text-left"><span className="block font-black text-gray-800">MÓDULO DE GESTÃO</span><span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">BI & Dashboards</span></div>
               </button>
               <button onClick={() => {setUser(null); setStep(AppStep.LOGIN)}} className="w-full mt-8 flex items-center justify-center gap-2 text-gray-400 font-black text-[10px] tracking-[0.3em]"><LogOut size={16} /> ENCERRAR SESSÃO</button>
            </div>
          )}

          {step === AppStep.GESTÃO_PRODUCAO && (
            <div className="space-y-4">
               <div className="flex items-center gap-4 mb-6"><button onClick={() => setStep(AppStep.ADMIN_MENU)} className="p-3 bg-gray-100 rounded-2xl hover:bg-gray-200"><ArrowLeft size={18} /></button><h2 className="text-2xl font-black text-gray-800">BI INDUSTRIAL</h2></div>
               <button onClick={() => setStep(AppStep.SAVED_RECORDS)} className="w-full flex items-center gap-5 p-6 bg-white rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-md transition-all active:scale-95">
                 <div className="bg-green-600 p-4 rounded-2xl text-white"><FileSpreadsheet size={28} /></div>
                 <div className="text-left"><span className="block font-black text-gray-800">RELATÓRIOS COMPLETOS</span><span className="text-[10px] font-bold text-green-600 uppercase">Exportação & Filtros</span></div>
               </button>
               <button onClick={() => setStep(AppStep.ANALYSIS)} className="w-full flex items-center gap-5 p-6 bg-white rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-md transition-all active:scale-95">
                 <div className="bg-orange-500 p-4 rounded-2xl text-white"><PieChart size={28} /></div>
                 <div className="text-left"><span className="block font-black text-gray-800">KPIs DE PERFORMANCE</span><span className="text-[10px] font-bold text-orange-500 uppercase">Gráficos & IA</span></div>
               </button>
            </div>
          )}

          {step === AppStep.ANALYSIS && (
            <div className="space-y-8 animate-in fade-in duration-500 text-left">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button onClick={() => setStep(AppStep.GESTÃO_PRODUCAO)} className="p-3 bg-gray-100 rounded-2xl"><ArrowLeft size={18} /></button>
                  <h2 className="text-2xl font-black text-gray-800">ANÁLISE E INDICADORES</h2>
                </div>
                <button onClick={() => fetchRecords()} className="p-3 bg-blue-50 text-blue-600 rounded-2xl hover:bg-blue-100 flex items-center gap-2 text-xs font-black uppercase tracking-widest transition-all">
                  <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> ATUALIZAR
                </button>
              </div>
              
              {/* Painel de Filtros Analíticos */}
              <div className="bg-gray-50 p-6 rounded-[2.5rem] border border-gray-200 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 shadow-inner">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1"><Users size={12}/> Operador</label>
                  <select value={analysisOperator} onChange={e => setAnalysisOperator(e.target.value)} className="w-full p-3 bg-white border border-gray-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500">
                    <option value="ALL">Todos os Operadores</option>
                    {uniqueOperators.map(op => <option key={op} value={op}>{op}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1"><Calendar size={12}/> Início</label>
                  <input type="date" value={analysisStartDate} onChange={e => setAnalysisStartDate(e.target.value)} className="w-full p-3 bg-white border border-gray-200 rounded-xl text-xs font-bold" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1"><Calendar size={12}/> Fim</label>
                  <input type="date" value={analysisEndDate} onChange={e => setAnalysisEndDate(e.target.value)} className="w-full p-3 bg-white border border-gray-200 rounded-xl text-xs font-bold" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1"><Clock size={12}/> Meta Horas/Dia</label>
                  <input type="number" step="0.1" value={availableHoursPerDay} onChange={e => setAvailableHoursPerDay(Number(e.target.value))} className="w-full p-3 bg-white border border-gray-200 rounded-xl text-xs font-black text-blue-600" />
                </div>
              </div>

              {loading && records.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-40 space-y-4">
                  <RefreshCw size={48} className="text-blue-500 animate-spin opacity-20" />
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">Carregando base de dados...</p>
                </div>
              ) : (
                <>
                  {/* Gráficos de Resultados */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm min-h-[400px]">
                      <h4 className="text-[10px] font-black text-gray-400 uppercase mb-6 tracking-[0.2em] flex items-center gap-2"><TrendingUp size={14} className="text-blue-500"/> Volume de Peças por Dia</h4>
                      <div className="h-64 w-full">
                        {analysisChartData.length > 0 ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={analysisChartData}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                              <XAxis dataKey="dateLabel" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700}} />
                              <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700}} />
                              <Tooltip contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)'}} cursor={{fill: '#f8fafc'}} />
                              <Bar dataKey="quantity" name="Peças" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        ) : <EmptyState message="Nenhum dado encontrado para este volume" />}
                      </div>
                    </div>

                    <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm min-h-[400px]">
                      <h4 className="text-[10px] font-black text-gray-400 uppercase mb-6 tracking-[0.2em] flex items-center gap-2"><Clock size={14} className="text-green-500"/> Eficiência Produtiva (Horas)</h4>
                      <div className="h-64 w-full">
                        {analysisChartData.length > 0 ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={analysisChartData}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                              <XAxis dataKey="dateLabel" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700}} />
                              <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700}} />
                              <Tooltip contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)'}} cursor={{fill: '#f8fafc'}} />
                              <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{fontSize: '10px', fontWeight: 700, paddingBottom: '20px'}} />
                              <Bar dataKey="prodHours" name="Horas Reais" fill="#10b981" radius={[6, 6, 0, 0]} />
                              <Line type="monotone" dataKey="meta" name="Meta (Disponibilidade)" stroke="#ef4444" strokeWidth={2} dot={false} strokeDasharray="8 4" />
                            </ComposedChart>
                          </ResponsiveContainer>
                        ) : <EmptyState message="Nenhuma hora produtiva registrada" />}
                      </div>
                    </div>
                  </div>

                  {/* IMEK AI Insights */}
                  <div className="bg-gradient-to-br from-gray-900 via-blue-900 to-indigo-900 p-10 rounded-[3rem] text-white shadow-2xl relative overflow-hidden group">
                    <div className="relative z-10">
                      <div className="flex items-center gap-4 mb-6">
                        <div className="bg-blue-500/30 p-3 rounded-2xl backdrop-blur-md border border-blue-400/20"><Sparkles size={28} className="text-blue-200" /></div>
                        <h3 className="text-2xl font-black tracking-tight">IMEK AI INSIGHTS</h3>
                      </div>
                      {!aiInsights ? (
                        <button onClick={generateAIInsights} disabled={loading || analysisChartData.length === 0} className="bg-white text-gray-900 font-black px-10 py-5 rounded-2xl flex items-center gap-3 hover:bg-blue-50 transition-all shadow-xl active:scale-95 disabled:opacity-50">
                          {loading ? <RefreshCw size={20} className="animate-spin" /> : <BrainCircuit size={20} />}
                          GERAR DIAGNÓSTICO INTELIGENTE
                        </button>
                      ) : (
                        <div className="p-8 rounded-3xl bg-white/5 backdrop-blur-2xl border border-white/10 text-sm leading-relaxed space-y-4 animate-in slide-in-from-bottom-5 duration-700">
                          <div className="prose prose-invert max-w-none text-blue-50 font-medium">
                            {aiInsights.split('\n').map((line, i) => <p key={i} className="mb-2">{line}</p>)}
                          </div>
                          <button onClick={() => setAiInsights(null)} className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-400 mt-6 block hover:text-white transition-colors">Nova Análise</button>
                        </div>
                      )}
                    </div>
                    <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none group-hover:scale-110 transition-transform duration-1000"><BrainCircuit size={180} /></div>
                  </div>
                </>
              )}
            </div>
          )}

          {step === AppStep.SAVED_RECORDS && (
            <div className="space-y-6 text-left">
               <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                 <div className="flex items-center gap-4">
                   <button onClick={() => setStep(AppStep.GESTÃO_PRODUCAO)} className="p-4 bg-gray-100 rounded-2xl hover:bg-gray-200"><ArrowLeft size={18} /></button>
                   <div>
                     <h2 className="text-2xl font-black text-gray-800 tracking-tight">HISTÓRICO DE PRODUÇÃO</h2>
                     <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">{filteredTableRecords.length} REGISTROS ENCONTRADOS</p>
                   </div>
                 </div>
                 
                 <div className="flex flex-wrap items-center gap-3">
                   <div className="bg-gray-100 p-2 rounded-2xl border border-gray-200 flex items-center gap-3">
                     <div className="flex flex-col px-2 border-r border-gray-300">
                       <span className="text-[8px] font-black text-gray-400 uppercase">Início</span>
                       <input type="date" value={tableStartDate} onChange={e => setTableStartDate(e.target.value)} className="bg-transparent text-[10px] font-black outline-none w-24" />
                     </div>
                     <div className="flex flex-col px-2">
                       <span className="text-[8px] font-black text-gray-400 uppercase">Término</span>
                       <input type="date" value={tableEndDate} onChange={e => setTableEndDate(e.target.value)} className="bg-transparent text-[10px] font-black outline-none w-24" />
                     </div>
                   </div>
                   <button onClick={exportFilteredToExcel} className="bg-green-600 text-white px-8 py-4 rounded-2xl flex items-center gap-2 text-xs font-black shadow-lg shadow-green-100 hover:bg-green-700 transition-all active:scale-95"><Download size={18} /> EXPORTAR EXCEL</button>
                   <button onClick={() => fetchRecords()} className="p-4 bg-blue-50 text-blue-600 rounded-2xl shadow-sm"><RefreshCw size={18} className={loading ? 'animate-spin' : ''} /></button>
                 </div>
               </div>

               <div className="overflow-x-auto rounded-[2.5rem] border border-gray-100 shadow-xl shadow-gray-200/50 bg-white min-h-[400px]">
                 {loading && records.length === 0 ? (
                   <div className="flex flex-col items-center justify-center py-40">
                      <RefreshCw size={32} className="animate-spin text-blue-500 mb-4" />
                      <p className="text-[10px] font-black text-gray-300 tracking-widest">SINCRO FIREBASE...</p>
                   </div>
                 ) : (
                   <table className="w-full text-left text-xs">
                     <thead className="bg-gray-50/80 text-gray-400 font-black uppercase text-[9px] tracking-[0.15em]">
                       <tr>
                         <th className="px-8 py-6">Data</th>
                         <th className="px-6 py-6">Equipamento</th>
                         <th className="px-6 py-6">Ordem (OP)</th>
                         <th className="px-6 py-6">Operador</th>
                         <th className="px-6 py-6 text-center">Qtde</th>
                         <th className="px-8 py-6 text-right">Tempo Total</th>
                       </tr>
                     </thead>
                     <tbody className="divide-y divide-gray-50">
                       {filteredTableRecords.length > 0 ? filteredTableRecords.map(r => (
                         <tr key={r.id} className="hover:bg-blue-50/50 transition-colors group">
                           <td className="px-8 py-5 font-bold text-gray-400">{format(new Date(r.timestamp), 'dd/MM/yy')}</td>
                           <td className="px-6 py-5 font-black text-gray-700 uppercase">{r.maquina}</td>
                           <td className="px-6 py-5 text-blue-600 font-black">{r.op}</td>
                           <td className="px-6 py-5 text-[10px] font-bold text-gray-500 uppercase">{r.operador}</td>
                           <td className="px-6 py-5 text-center"><span className="bg-blue-50 text-blue-700 px-4 py-2 rounded-xl font-black">{r.quantity}</span></td>
                           <td className="px-8 py-5 text-right font-black text-green-600">{formatDuration(r.durationSeconds + r.setupDurationSeconds)}</td>
                         </tr>
                       )) : (
                         <tr><td colSpan={6}><EmptyState message="Nenhum registro para este período." /></td></tr>
                       )}
                     </tbody>
                   </table>
                 )}
               </div>
            </div>
          )}

          {step === AppStep.DAILY_VIEW && (
            <div className="space-y-8 text-left">
              <div className="flex items-center gap-4">
                <button onClick={() => setStep(AppStep.IDENTIFICATION)} className="p-4 bg-gray-100 rounded-2xl hover:bg-gray-200"><ArrowLeft size={18} /></button>
                <h2 className="text-2xl font-black text-gray-800">MEU DESEMPENHO HOJE</h2>
              </div>
              
              <div className="bg-blue-600 p-8 rounded-[2.5rem] text-white shadow-2xl shadow-blue-200 relative overflow-hidden">
                <div className="relative z-10">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">Percentual de Ocupação</p>
                  <p className="text-5xl font-black mt-1">{dailyStats.todayPercent}%</p>
                  <div className="mt-6 bg-white/20 h-4 rounded-full overflow-hidden border border-white/10 shadow-inner">
                    <div className="bg-white h-full rounded-full transition-all duration-1000 ease-out shadow-[0_0_20px_rgba(255,255,255,0.5)]" style={{ width: `${Math.min(dailyStats.todayPercent, 100)}%` }}></div>
                  </div>
                </div>
                <div className="absolute top-0 right-0 p-8 opacity-10"><TrendingUp size={100} /></div>
              </div>

              <div className="space-y-3">
                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Lista de Apontamentos</h3>
                {dailyStats.todayRecords.length > 0 ? dailyStats.todayRecords.map(r => (
                  <div key={r.id} className="bg-white p-6 rounded-3xl border border-gray-100 flex justify-between items-center group hover:border-blue-200 transition-all shadow-sm">
                    <div className="text-left">
                      <p className="font-black text-gray-800 uppercase tracking-tight">{r.maquina}</p>
                      <p className="text-[10px] font-bold text-gray-400 uppercase">OP: {r.op} | CP: {r.cp}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-blue-600 text-lg">{r.quantity} un</p>
                      <p className="text-[9px] font-black text-green-600 uppercase tracking-tighter">{formatDuration(r.durationSeconds + r.setupDurationSeconds)} TOTAL</p>
                    </div>
                  </div>
                )) : (
                  <div className="p-10 text-center text-gray-400 bg-gray-50 rounded-3xl border border-dashed border-gray-200 font-bold">Nenhum trabalho iniciado hoje.</div>
                )}
              </div>
            </div>
          )}

          {step === AppStep.SUMMARY && (
            <div className="space-y-6 text-left animate-in slide-in-from-bottom-5">
              <h2 className="text-2xl font-black text-gray-800 tracking-tight">RESUMO DA OPERAÇÃO</h2>
              <div className="grid grid-cols-2 gap-4">
                 <div className="bg-blue-50 p-6 rounded-[2rem] border border-blue-100">
                    <span className="text-[9px] text-blue-400 font-black uppercase tracking-widest block mb-2">TEMPO DE PRODUÇÃO</span>
                    <span className="text-2xl font-black text-blue-700">{formatDuration(timer)}</span>
                 </div>
                 <div className="bg-orange-50 p-6 rounded-[2rem] border border-orange-100">
                    <span className="text-[9px] text-orange-400 font-black uppercase tracking-widest block mb-2">TEMPO DE PAUSAS</span>
                    <span className="text-2xl font-black text-orange-700">{formatDuration(Math.floor(totalPauseMs / 1000))}</span>
                 </div>
              </div>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Quantidade Fabricada:</label>
                  <input type="number" value={prodData.quantity} onChange={e => setProdData(prev => ({ ...prev, quantity: Number(e.target.value) }))} className="w-full p-6 rounded-3xl border border-blue-200 bg-blue-50/30 text-3xl font-black text-blue-600 focus:ring-4 focus:ring-blue-100 outline-none transition-all" placeholder="0" />
                </div>
                
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Observações Técnicas:</label>
                  <textarea value={prodData.observation} onChange={e => setProdData(prev => ({ ...prev, observation: e.target.value }))} className="w-full p-5 rounded-3xl border border-gray-200 bg-gray-50 font-bold h-28 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Ocorrências, detalhes da peça, etc..." />
                </div>
              </div>

              <button onClick={saveRecord} disabled={loading} className="w-full bg-blue-600 text-white font-black py-5 rounded-3xl shadow-2xl shadow-blue-200 active:scale-95 transition-all flex items-center justify-center gap-3">
                {loading ? <RefreshCw className="animate-spin" /> : <CheckCircle2 />}
                {loading ? 'PROCESSANDO...' : 'FINALIZAR E GRAVAR'}
              </button>
            </div>
          )}

          {step === AppStep.COMPLETED && (
            <div className="text-center py-10 space-y-8 animate-in zoom-in-95 duration-500">
              <div className="relative inline-block">
                <div className="bg-green-100 p-12 rounded-full text-green-600 shadow-inner"><CheckCircle2 size={80} /></div>
                <div className="absolute -top-2 -right-2 bg-blue-600 text-white p-3 rounded-full shadow-lg"><Sparkles size={20} /></div>
              </div>
              <div className="space-y-2">
                <h2 className="text-4xl font-black text-gray-900 tracking-tighter">SUCESSO!</h2>
                <p className="text-gray-400 font-bold uppercase text-[10px] tracking-widest">Os dados foram salvos e sincronizados.</p>
              </div>
              <button onClick={() => setStep(user?.role === UserRole.ADMIN ? AppStep.ADMIN_MENU : AppStep.IDENTIFICATION)} className="w-full bg-blue-600 text-white font-black py-5 rounded-3xl shadow-2xl shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95">NOVO APONTAMENTO</button>
            </div>
          )}

        </div>
      </div>
      
      {/* Rodapé informativo */}
      <div className="mt-8 text-center text-gray-400 font-black text-[9px] uppercase tracking-[0.3em]">
        IMEK SLEEVE v1.10.2 • POWERED BY GEMINI 3 PRO
      </div>
    </div>
  );
};

export default App;
