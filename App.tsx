
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AppStep, User, UserRole, ProductionRecord, ProductionPause } from './types';
import { firebaseService, ActiveSession } from './services/firebaseService';
import { Html5Qrcode } from 'html5-qrcode';
import { 
  ClipboardCheck, 
  LogOut, 
  Play, 
  Square, 
  CheckCircle2, 
  UserPlus, 
  LogIn,
  LayoutDashboard,
  FileSpreadsheet, 
  PieChart, 
  ArrowLeft,
  Download,
  Search, 
  ArrowUpDown,
  Calendar,
  Sparkles,
  TrendingUp,
  Clock,
  User as UserIcon,
  Cloud,
  History,
  Target,
  Pause,
  AlertCircle,
  PlayCircle,
  ScanLine,
  X,
  RefreshCw,
  Zap,
  BrainCircuit
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { format, isSameDay, isWithinInterval, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer, 
  Cell,
  ComposedChart,
  Line
} from 'recharts';
import { GoogleGenAI } from "@google/genai";

const LOCAL_STORAGE_KEY = 'imek_active_session_v2';

// Fix for missing date-fns exports: Local fallbacks for parseISO and startOfDay
const parseISO = (s: string) => new Date(s);
const startOfDay = (d: Date | number) => {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  return date;
};

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

  // States for Admin Module & Filters
  const [records, setRecords] = useState<ProductionRecord[]>([]);
  const [tableStartDate, setTableStartDate] = useState(format(new Date(), 'yyyy-MM-01'));
  const [tableEndDate, setTableEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  // States for Enhanced Analysis
  const [analysisOperator, setAnalysisOperator] = useState('ALL');
  const [analysisStartDate, setAnalysisStartDate] = useState(format(new Date(), 'yyyy-MM-01'));
  const [analysisEndDate, setAnalysisEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [availableHoursPerDay, setAvailableHoursPerDay] = useState(8.8);

  // Production state
  const [prodData, setProdData] = useState<Partial<ProductionRecord>>({
    maquina: '', op: '', cp: '', durationSeconds: 0, setupDurationSeconds: 0, totalPauseSeconds: 0, pauses: [], quantity: 0, observation: ''
  });

  const [productionStartTime, setProductionStartTime] = useState<number | null>(null);
  const [productionEndTime, setProductionEndTime] = useState<number | null>(null);
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
        const allRecords = await firebaseService.getAllRecords();
        setRecords(allRecords);
        setStep(loggedUser.role === UserRole.ADMIN ? AppStep.ADMIN_MENU : AppStep.IDENTIFICATION);
      } else { setError('Usuário ou senha inválidos.'); }
    } catch (err) { setError('Erro ao conectar.'); } finally { setLoading(false); }
  };

  const startProduction = async (mode: 'setup' | 'direct') => {
    if (!prodData.maquina || !prodData.op || !prodData.cp) { setError('Preencha os campos.'); return; }
    setLoading(true); const now = Date.now();
    try {
      await persistSession({ maquina: prodData.maquina, op: prodData.op, cp: prodData.cp, startTime: now, isSetupMode: mode === 'setup', timestamp: now, isPaused: false, phasePauseMs: 0, totalPauseMs: 0, pauses: [] });
      setProductionStartTime(now); setIsSetupMode(mode === 'setup'); setTimerStartTime(now); setTimer(0); setIsPaused(false); setPhasePauseMs(0); setTotalPauseMs(0); setPausesList([]);
      await requestWakeLock(); setStep(AppStep.TIMER);
    } catch (err) { setError("Erro ao iniciar sessão."); } finally { setLoading(false); }
  };

  const finishProduction = () => { setProductionEndTime(Date.now()); releaseWakeLock(); setStep(AppStep.SUMMARY); };

  const handlePause = async () => {
    const now = Date.now(); setIsPaused(true); setPauseStartTime(now); setPauseReason(''); releaseWakeLock();
    await persistSession({ isPaused: true, pauseStartTime: now });
  };

  const handleResume = async () => {
    if (!pauseReason.trim()) { setError('Informe o motivo.'); return; }
    const now = Date.now(); const dur = pauseStartTime ? (now - pauseStartTime) : 0;
    const newPause = { reason: pauseReason.trim(), durationSeconds: Math.floor(dur / 1000), timestamp: now };
    const newList = [...pausesList, newPause]; const newPhase = phasePauseMs + dur; const newTotal = totalPauseMs + dur;
    setPhasePauseMs(newPhase); setTotalPauseMs(newTotal); setPausesList(newList); setIsPaused(false); setPauseStartTime(null); setPauseReason('');
    await requestWakeLock(); await persistSession({ isPaused: false, pauseStartTime: null, phasePauseMs: newPhase, totalPauseMs: newTotal, pauses: newList });
  };

  const saveRecord = async () => {
    setLoading(true);
    try {
      const rec: ProductionRecord = { operador: user?.username || '', maquina: prodData.maquina!, op: prodData.op!, cp: prodData.cp!, startTime: productionStartTime!, endTime: Date.now(), durationSeconds: timer, setupDurationSeconds: prodData.setupDurationSeconds || 0, totalPauseSeconds: Math.floor(totalPauseMs / 1000), pauses: pausesList, pauseReasons: pausesList.map(p => p.reason).join(' / '), quantity: prodData.quantity || 0, observation: prodData.observation || '', timestamp: Date.now() };
      await firebaseService.saveRecord(rec);
      if (user) { await firebaseService.deleteActiveSession(user.id); localStorage.removeItem(`${LOCAL_STORAGE_KEY}_${user.id}`); }
      setRecords(await firebaseService.getAllRecords()); setStep(AppStep.COMPLETED);
    } catch (err) { setError('Erro ao salvar.'); } finally { setLoading(false); }
  };

  const formatDuration = (s: number) => {
    const h = Math.floor(s / 3600).toString().padStart(2, '0');
    const m = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${h}:${m}:${sec}`;
  };

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
    const start = startOfDay(parseISO(analysisStartDate)).getTime();
    const end = endOfDay(parseISO(analysisEndDate)).getTime();
    const filtered = records.filter(r => {
      const isOperator = analysisOperator === 'ALL' || r.operador === analysisOperator;
      const isDate = r.timestamp >= start && r.timestamp <= end;
      return isOperator && isDate;
    });

    const daily: Record<string, any> = {};
    filtered.forEach(r => {
      const key = format(new Date(r.timestamp), 'dd/MM');
      if (!daily[key]) daily[key] = { date: key, quantity: 0, prodHours: 0, meta: availableHoursPerDay };
      daily[key].quantity += r.quantity;
      daily[key].prodHours += (r.durationSeconds + r.setupDurationSeconds) / 3600;
    });
    return Object.values(daily).sort((a,b) => a.date.localeCompare(b.date));
  }, [records, analysisOperator, analysisStartDate, analysisEndDate, availableHoursPerDay]);

  // Calculate daily statistics for the "Produção Hoje" view
  const dailyStats = useMemo(() => {
    const today = new Date();
    const todayRecords = records.filter(r => isSameDay(new Date(r.timestamp), today));
    const totalProducedHours = todayRecords.reduce((acc, r) => acc + (r.durationSeconds + r.setupDurationSeconds) / 3600, 0);
    const todayPercent = availableHoursPerDay > 0 ? Math.round((totalProducedHours / availableHoursPerDay) * 100) : 0;
    return { todayRecords, todayPercent };
  }, [records, availableHoursPerDay]);

  const generateAIInsights = async () => {
    setLoading(true); setAiInsights(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `Analise os dados de produção da IMEK e forneça 3 insights diretos em Português. Operador: ${analysisOperator}, Período: ${analysisStartDate} a ${analysisEndDate}. Dados Consolidados: ${JSON.stringify(analysisChartData)}`;
      const response = await ai.models.generateContent({ model: 'gemini-3-pro-preview', contents: prompt });
      setAiInsights(response.text || "Sem insights no momento.");
    } catch (err) { setError("Falha ao gerar insights com IA."); } finally { setLoading(false); }
  };

  const exportFilteredToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(filteredTableRecords.map(r => ({ Data: format(new Date(r.timestamp), 'dd/MM/yyyy'), Operador: r.operador, Máquina: r.maquina, OP: r.op, CP: r.cp, Qtde: r.quantity, Produção: formatDuration(r.durationSeconds), Setup: formatDuration(r.setupDurationSeconds), Pausas: formatDuration(r.totalPauseSeconds) })));
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Filtro_IMEK');
    XLSX.writeFile(wb, `IMEK_Filtro_${tableStartDate}_${tableEndDate}.xlsx`);
  };

  const ScannerOverlay = () => {
    useEffect(() => {
      const html5QrCode = new Html5Qrcode("scanner-reader");
      html5QrCode.start({ facingMode: "environment" }, { fps: 20, qrbox: { width: 320, height: 160 }, aspectRatio: 1.777778 }, (text) => { setProdData(p => ({ ...p, op: text })); setIsScanning(false); html5QrCode.stop(); }, undefined);
      return () => { if (html5QrCode.isScanning) html5QrCode.stop(); };
    }, []);
    return (
      <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center">
        <div className="w-full h-full relative" id="scanner-reader"></div>
        <button onClick={() => setIsScanning(false)} className="z-20 mt-12 bg-white/10 text-white px-10 py-4 rounded-2xl font-bold backdrop-blur-md">Cancelar</button>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      {isScanning && <ScannerOverlay />}
      <div className={`w-full ${[AppStep.SAVED_RECORDS, AppStep.ANALYSIS, AppStep.DAILY_VIEW].includes(step) ? 'max-w-6xl' : 'max-w-md'} bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100 transition-all duration-300`}>
        
        <div className="bg-white p-6 flex flex-col items-center border-b border-gray-100">
           <div className="bg-blue-600 p-3 rounded-2xl mb-2 shadow-lg shadow-blue-200"><ClipboardCheck className="text-white w-8 h-8" /></div>
           <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">IMEK SLEEVE</h1>
           <p className="text-gray-500 text-sm font-medium">Gestão Industrial</p>
        </div>

        <div className="p-8">
          {error && <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100 font-medium flex items-center gap-2"><AlertCircle size={16} /> {error}</div>}

          {step === AppStep.LOGIN && (
            <form onSubmit={handleLogin} className="space-y-4">
              <input type="text" value={username} onChange={e => setUsername(e.target.value)} className="w-full p-3 rounded-xl border border-gray-200 bg-gray-50" placeholder="Usuário" required />
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-3 rounded-xl border border-gray-200 bg-gray-50" placeholder="Senha" required />
              <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl shadow-lg">{loading ? 'Entrando...' : 'Entrar'}</button>
              <button type="button" onClick={() => setStep(AppStep.REGISTER)} className="w-full text-blue-600 text-sm font-bold">Cadastrar</button>
            </form>
          )}

          {step === AppStep.IDENTIFICATION && (
            <div className="space-y-6">
              <h2 className="text-lg font-bold">Passo 1: Máquina</h2>
              <select value={prodData.maquina} onChange={e => setProdData(p => ({ ...p, maquina: e.target.value }))} className="w-full p-3 rounded-xl border border-gray-200 bg-gray-50">
                <option value="">Selecione...</option>
                <option>Romi D1000</option><option>Veker Mvk 1050</option><option>Torno Cnc Cosmos</option><option>Torno Convencional</option><option>Torno Mascote</option><option>Fresadora Ferramenteira</option>
              </select>
              <button onClick={() => setStep(AppStep.DAILY_VIEW)} className="w-full border-2 border-blue-600 text-blue-600 font-bold py-3 rounded-xl flex items-center justify-center gap-2"><PieChart size={20} /> Diário</button>
              <button onClick={() => prodData.maquina ? setStep(AppStep.DETAILS) : setError('Selecione.')} className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl">Próximo</button>
            </div>
          )}

          {step === AppStep.DETAILS && (
            <div className="space-y-6">
              <h2 className="text-lg font-bold">Passo 2: OP</h2>
              <div className="flex gap-2">
                <input type="text" value={prodData.op} onChange={e => setProdData(p => ({ ...p, op: e.target.value }))} className="flex-1 p-3 rounded-xl border border-gray-200" placeholder="OP" />
                <button onClick={() => setIsScanning(true)} className="p-3 bg-blue-100 text-blue-600 rounded-xl"><ScanLine size={24} /></button>
              </div>
              <input type="text" value={prodData.cp} onChange={e => setProdData(p => ({ ...p, cp: e.target.value }))} className="w-full p-3 rounded-xl border border-gray-200" placeholder="CP" />
              <div className="flex gap-3">
                <button onClick={() => startProduction('setup')} className="flex-1 bg-green-600 text-white font-bold py-3 rounded-xl">Setup</button>
                <button onClick={() => startProduction('direct')} className="flex-1 bg-blue-600 text-white font-bold py-3 rounded-xl">Iniciar</button>
              </div>
              <button onClick={() => setStep(AppStep.IDENTIFICATION)} className="w-full text-gray-400 font-bold">Voltar</button>
            </div>
          )}

          {step === AppStep.TIMER && (
            <div className="space-y-6 text-center">
              <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold border mx-auto w-fit ${syncStatus === 'synced' ? 'bg-green-50 text-green-600 border-green-200' : 'bg-blue-50 text-blue-600 border-blue-200'}`}>
                {syncStatus === 'syncing' ? <RefreshCw size={12} className="animate-spin" /> : <Cloud size={12} />}
                <span>{syncStatus === 'synced' ? `SINCRONIZADO AS ${lastSyncTime}` : 'SALVANDO...'}</span>
              </div>
              <h2 className="text-xl font-bold">{isPaused ? 'PAUSADO' : (isSetupMode ? 'Setup' : 'Produção')}</h2>
              <div className={`p-8 rounded-3xl font-mono text-5xl border-4 ${isPaused ? 'bg-orange-50 text-orange-600' : 'bg-gray-900 text-green-400'}`}>{formatDuration(timer)}</div>
              {!isPaused ? (
                <div className="space-y-3">
                  <button onClick={handlePause} className="w-full bg-orange-500 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2"><Pause size={20} /> Pausar</button>
                  {isSetupMode ? <button onClick={() => { setIsSetupMode(false); setProdData(p => ({ ...p, setupDurationSeconds: timer })); setTimerStartTime(Date.now()); setTimer(0); persistSession({ isSetupMode: false, timestamp: Date.now() }); }} className="w-full bg-green-600 text-white font-bold py-4 rounded-2xl">Concluir Setup</button> : <button onClick={finishProduction} className="w-full bg-red-600 text-white font-bold py-4 rounded-2xl">Finalizar</button>}
                </div>
              ) : (
                <div className="space-y-3 text-left">
                  <label className="text-xs font-bold text-gray-400">Motivo:</label>
                  <textarea value={pauseReason} onChange={e => setPauseReason(e.target.value)} className="w-full p-3 rounded-xl border border-orange-300" placeholder="Ex: Manutenção..."/>
                  <button onClick={handleResume} disabled={!pauseReason.trim()} className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl">Retomar</button>
                </div>
              )}
            </div>
          )}

          {step === AppStep.ADMIN_MENU && (
            <div className="space-y-4">
               <h2 className="text-xl font-bold text-center mb-4">Módulo Administrativo</h2>
               <button onClick={() => setStep(AppStep.IDENTIFICATION)} className="w-full flex items-center gap-4 p-5 bg-blue-50 rounded-2xl border border-blue-100">
                 <div className="bg-blue-600 p-3 rounded-xl text-white"><ClipboardCheck size={24} /></div>
                 <div className="text-left"><span className="block font-bold">Novo Apontamento</span><span className="text-xs">Registrar produção</span></div>
               </button>
               <button onClick={() => setStep(AppStep.GESTÃO_PRODUCAO)} className="w-full flex items-center gap-4 p-5 bg-indigo-50 rounded-2xl border border-indigo-100">
                 <div className="bg-indigo-600 p-3 rounded-xl text-white"><LayoutDashboard size={24} /></div>
                 <div className="text-left"><span className="block font-bold">Gestão e Dashboards</span><span className="text-xs">Análise técnica</span></div>
               </button>
               <button onClick={() => {setUser(null); setStep(AppStep.LOGIN)}} className="w-full mt-4 flex items-center justify-center gap-2 text-gray-400 font-bold"><LogOut size={16} /> Sair</button>
            </div>
          )}

          {step === AppStep.GESTÃO_PRODUCAO && (
            <div className="space-y-4">
               <div className="flex items-center gap-2 mb-4"><button onClick={() => setStep(AppStep.ADMIN_MENU)} className="p-2 bg-gray-100 rounded-full"><ArrowLeft size={16} /></button><h2 className="text-xl font-bold">Módulo de Gestão</h2></div>
               <button onClick={() => setStep(AppStep.SAVED_RECORDS)} className="w-full flex items-center gap-4 p-5 bg-white rounded-2xl border border-gray-200">
                 <div className="bg-green-600 p-3 rounded-xl text-white"><FileSpreadsheet size={24} /></div>
                 <div className="text-left"><span className="block font-bold">Histórico Completo</span><span className="text-xs">Exportação e busca</span></div>
               </button>
               <button onClick={() => setStep(AppStep.ANALYSIS)} className="w-full flex items-center gap-4 p-5 bg-white rounded-2xl border border-gray-200">
                 <div className="bg-orange-500 p-3 rounded-xl text-white"><PieChart size={24} /></div>
                 <div className="text-left"><span className="block font-bold">Dashboard de Performance</span><span className="text-xs">Gráficos e IMEK AI</span></div>
               </button>
            </div>
          )}

          {step === AppStep.ANALYSIS && (
            <div className="space-y-8 animate-in fade-in duration-500">
              <div className="flex items-center gap-2"><button onClick={() => setStep(AppStep.GESTÃO_PRODUCAO)} className="p-2 bg-gray-100 rounded-full"><ArrowLeft size={16} /></button><h2 className="text-xl font-bold">Análise de Performance</h2></div>
              
              {/* Filtros Analíticos */}
              <div className="bg-gray-50 p-6 rounded-3xl border border-gray-200 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Operador</label>
                  <select value={analysisOperator} onChange={e => setAnalysisOperator(e.target.value)} className="w-full p-2 bg-white border border-gray-200 rounded-lg text-sm">
                    <option value="ALL">Todos os Operadores</option>
                    {uniqueOperators.map(op => <option key={op} value={op}>{op}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Data Inicial</label>
                  <input type="date" value={analysisStartDate} onChange={e => setAnalysisStartDate(e.target.value)} className="w-full p-2 bg-white border border-gray-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Data Final</label>
                  <input type="date" value={analysisEndDate} onChange={e => setAnalysisEndDate(e.target.value)} className="w-full p-2 bg-white border border-gray-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Meta Horas/Dia</label>
                  <input type="number" step="0.1" value={availableHoursPerDay} onChange={e => setAvailableHoursPerDay(Number(e.target.value))} className="w-full p-2 bg-white border border-gray-200 rounded-lg text-sm font-bold text-blue-600" />
                </div>
              </div>

              {/* Gráficos */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-left">
                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                  <h4 className="text-xs font-bold text-gray-400 uppercase mb-4 tracking-widest flex items-center gap-2"><TrendingUp size={14}/> Volume de Produção (Peças)</h4>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analysisChartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                        <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                        <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                        <Bar dataKey="quantity" name="Peças" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                  <h4 className="text-xs font-bold text-gray-400 uppercase mb-4 tracking-widest flex items-center gap-2"><Clock size={14}/> Ocupação vs Disponibilidade (Horas)</h4>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={analysisChartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                        <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                        <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                        <Bar dataKey="prodHours" name="Horas Produzidas" fill="#10b981" radius={[4, 4, 0, 0]} />
                        <Line type="monotone" dataKey="meta" name="Meta (Disponibilidade)" stroke="#f43f5e" strokeWidth={2} dot={false} strokeDasharray="5 5" />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* IMEK AI */}
              <div className="bg-gradient-to-br from-blue-600 via-indigo-700 to-blue-800 p-8 rounded-[2rem] text-white shadow-2xl relative overflow-hidden">
                <div className="relative z-10 text-left">
                  <div className="flex items-center gap-3 mb-4"><div className="bg-white/20 p-2 rounded-xl"><Sparkles size={24} className="text-blue-100" /></div><h3 className="text-xl font-bold">IMEK AI Insights</h3></div>
                  {!aiInsights ? (
                    <button onClick={generateAIInsights} disabled={loading} className="bg-white text-blue-700 font-bold px-8 py-4 rounded-2xl flex items-center gap-2 hover:bg-blue-50 transition-colors shadow-lg active:scale-95">
                      {loading ? <RefreshCw size={20} className="animate-spin" /> : <BrainCircuit size={20} />}
                      Analisar Tendências com IA
                    </button>
                  ) : (
                    <div className="p-6 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 text-sm leading-relaxed space-y-3 animate-in slide-in-from-bottom-4 duration-500">
                      {aiInsights.split('\n').map((line, i) => <p key={i}>{line}</p>)}
                      <button onClick={() => setAiInsights(null)} className="text-[10px] font-bold uppercase tracking-wider text-blue-200 mt-4 underline">Gerar nova análise</button>
                    </div>
                  )}
                </div>
                <div className="absolute top-0 right-0 p-10 opacity-10 pointer-events-none"><BrainCircuit size={120} /></div>
              </div>
            </div>
          )}

          {step === AppStep.SAVED_RECORDS && (
            <div className="space-y-6">
               <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                 <div className="flex items-center gap-4 text-left">
                   <button onClick={() => setStep(AppStep.GESTÃO_PRODUCAO)} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"><ArrowLeft size={16} /></button>
                   <div>
                     <h2 className="text-xl font-bold">Histórico de Produção</h2>
                     <p className="text-xs text-gray-400">{filteredTableRecords.length} registros no período</p>
                   </div>
                 </div>
                 
                 <div className="flex flex-wrap items-center gap-2">
                   <div className="bg-gray-50 p-2 rounded-xl border border-gray-200 flex items-center gap-2">
                     <Calendar size={14} className="text-gray-400 ml-1" />
                     <input type="date" value={tableStartDate} onChange={e => setTableStartDate(e.target.value)} className="bg-transparent text-xs font-bold outline-none" />
                     <span className="text-gray-300">|</span>
                     <input type="date" value={tableEndDate} onChange={e => setTableEndDate(e.target.value)} className="bg-transparent text-xs font-bold outline-none" />
                   </div>
                   <button onClick={exportFilteredToExcel} className="bg-green-600 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 text-sm font-bold shadow-lg hover:bg-green-700 transition-all active:scale-95"><Download size={16} /> Excel</button>
                 </div>
               </div>

               <div className="overflow-x-auto rounded-3xl border border-gray-200 text-left shadow-sm">
                 <table className="w-full text-left text-sm">
                   <thead className="bg-gray-100 text-gray-500 font-bold uppercase text-[10px]">
                     <tr><th className="px-6 py-5">Data</th><th className="px-6 py-5">Máquina</th><th className="px-6 py-5">OP</th><th className="px-6 py-5">Operador</th><th className="px-6 py-5 text-center">Qtde</th><th className="px-6 py-5">Produção</th></tr>
                   </thead>
                   <tbody className="divide-y divide-gray-100">
                     {filteredTableRecords.length > 0 ? filteredTableRecords.map(r => (
                       <tr key={r.id} className="hover:bg-blue-50/40 transition-colors group">
                         <td className="px-6 py-4 font-bold text-gray-500">{format(new Date(r.timestamp), 'dd/MM/yy')}</td>
                         <td className="px-6 py-4">{r.maquina}</td>
                         <td className="px-6 py-4 text-blue-600 font-bold">{r.op}</td>
                         <td className="px-6 py-4 text-xs font-medium text-gray-500">{r.operador}</td>
                         <td className="px-6 py-4 text-center"><span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full font-black">{r.quantity}</span></td>
                         <td className="px-6 py-4 font-bold text-green-600">{formatDuration(r.durationSeconds)}</td>
                       </tr>
                     )) : (
                       <tr><td colSpan={6} className="px-6 py-10 text-center text-gray-400 font-medium italic">Nenhum registro encontrado no período selecionado.</td></tr>
                     )}
                   </tbody>
                 </table>
               </div>
            </div>
          )}

          {step === AppStep.DAILY_VIEW && (
            <div className="space-y-6">
              <div className="flex items-center gap-2"><button onClick={() => setStep(AppStep.IDENTIFICATION)} className="p-2 bg-gray-100 rounded-full"><ArrowLeft size={16} /></button><h2 className="text-xl font-bold">Produção Hoje</h2></div>
              <div className="bg-blue-600 p-6 rounded-3xl text-white shadow-xl">
                <p className="text-xs font-bold uppercase opacity-60">Status de Ocupação</p>
                <p className="text-4xl font-black">{dailyStats.todayPercent}%</p>
                <div className="mt-4 bg-white/20 h-2 rounded-full"><div className="bg-white h-full rounded-full transition-all" style={{ width: `${Math.min(dailyStats.todayPercent, 100)}%` }}></div></div>
              </div>
              <div className="space-y-2">{dailyStats.todayRecords.map(r => (
                <div key={r.id} className="bg-white p-4 rounded-2xl border border-gray-100 flex justify-between items-center text-left">
                  <div><p className="font-bold text-gray-800">{r.maquina}</p><p className="text-[10px] text-gray-400">OP: {r.op}</p></div>
                  <div className="text-right"><p className="font-black text-blue-600">{r.quantity} un</p><p className="text-[10px] text-green-600">{formatDuration(r.durationSeconds + r.setupDurationSeconds)}</p></div>
                </div>
              ))}</div>
            </div>
          )}

          {step === AppStep.SUMMARY && (
            <div className="space-y-6 text-left">
              <h2 className="text-lg font-bold">Resumo da Sessão</h2>
              <div className="grid grid-cols-2 gap-3">
                 <div className="bg-blue-50 p-3 rounded-xl"><span className="text-[10px] text-blue-400 font-bold uppercase block">Produção</span><span className="text-lg font-black text-blue-700">{formatDuration(timer)}</span></div>
                 <div className="bg-orange-50 p-3 rounded-xl"><span className="text-[10px] text-orange-400 font-bold uppercase block">Pausas</span><span className="text-lg font-black text-orange-700">{formatDuration(Math.floor(totalPauseMs / 1000))}</span></div>
              </div>
              <input type="number" value={prodData.quantity} onChange={e => setProdData(prev => ({ ...prev, quantity: Number(e.target.value) }))} className="w-full p-4 rounded-xl border border-gray-200 bg-gray-50 text-xl font-black text-blue-600" placeholder="Quantidade Produzida" />
              <textarea value={prodData.observation} onChange={e => setProdData(prev => ({ ...prev, observation: e.target.value }))} className="w-full p-3 rounded-xl border border-gray-200 bg-gray-50 h-24 text-sm" placeholder="Observações..." />
              <button onClick={saveRecord} disabled={loading} className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl shadow-lg">{loading ? 'Salvando...' : 'Gravar'}</button>
            </div>
          )}

          {step === AppStep.COMPLETED && (
            <div className="text-center py-10 space-y-6">
              <div className="bg-green-100 p-8 rounded-full inline-block text-green-600"><CheckCircle2 size={70} /></div>
              <h2 className="text-3xl font-black text-gray-800">Concluído!</h2>
              <button onClick={() => setStep(user?.role === UserRole.ADMIN ? AppStep.ADMIN_MENU : AppStep.IDENTIFICATION)} className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl shadow-xl">Novo Apontamento</button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default App;
