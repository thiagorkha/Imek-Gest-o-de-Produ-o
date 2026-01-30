
import React, { useState, useEffect, useMemo } from 'react';
import { AppStep, User, UserRole, ProductionRecord, ProductionPause } from './types';
import { firebaseService, ActiveSession } from './services/firebaseService';
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
  AlertCircle
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { format, startOfDay, endOfDay, parseISO, subDays, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
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

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [step, setStep] = useState<AppStep>(AppStep.LOGIN);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // States for Admin Module
  const [records, setRecords] = useState<ProductionRecord[]>([]);
  const [filterText, setFilterText] = useState('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  
  // Filtros de Data da Tabela
  const [tableStartDate, setTableStartDate] = useState('');
  const [tableEndDate, setTableEndDate] = useState('');

  // States for Enhanced Analysis
  const [analysisOperator, setAnalysisOperator] = useState('ALL');
  const [analysisStartDate, setAnalysisStartDate] = useState(format(new Date(new Date().setDate(new Date().getDate() - 7)), 'yyyy-MM-dd'));
  const [analysisEndDate, setAnalysisEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [availableHoursPerDay, setAvailableHoursPerDay] = useState(8);
  const [showAnalysisResult, setShowAnalysisResult] = useState(false);

  // --- PRODUCTION STATE MANAGEMENT ---
  const [prodData, setProdData] = useState<Partial<ProductionRecord>>({
    maquina: '',
    op: '',
    cp: '',
    durationSeconds: 0,
    setupDurationSeconds: 0,
    totalPauseSeconds: 0,
    pauses: [],
    quantity: 0,
    observation: ''
  });

  const [productionStartTime, setProductionStartTime] = useState<number | null>(null);
  const [productionEndTime, setProductionEndTime] = useState<number | null>(null);
  const [isSetupMode, setIsSetupMode] = useState(true);
  const [timerStartTime, setTimerStartTime] = useState<number | null>(null);
  const [timer, setTimer] = useState(0);

  // Estados de Pausa
  const [isPaused, setIsPaused] = useState(false);
  const [pauseReason, setPauseReason] = useState('');
  const [pauseStartTime, setPauseStartTime] = useState<number | null>(null);
  const [accumulatedPauseSeconds, setAccumulatedPauseSeconds] = useState(0);
  const [pausesList, setPausesList] = useState<ProductionPause[]>([]);

  // Helper para horas disponíveis por dia da semana
  const getAvailableHoursByDate = (date: Date) => {
    const day = date.getDay(); // 0 (Dom) a 6 (Sab)
    switch(day) {
      case 1: case 2: case 3: case 4: return 9; // Seg a Qui
      case 5: return 8; // Sex
      case 6: return 4; // Sab
      default: return 0; // Dom
    }
  };

  // Recuperar sessão ativa ao carregar usuário
  useEffect(() => {
    const checkForActiveSession = async () => {
      if (user && user.role === UserRole.OPERATOR) {
        setLoading(true);
        try {
          const session = await firebaseService.getActiveSession(user.id);
          if (session) {
            setProdData(prev => ({
              ...prev,
              maquina: session.maquina,
              op: session.op,
              cp: session.cp,
              setupDurationSeconds: session.setupDurationSeconds,
              operador: user.username
            }));
            setProductionStartTime(session.startTime);
            setIsSetupMode(session.isSetupMode);
            setTimerStartTime(session.timestamp); 
            
            // Recuperar estados de pausa
            setIsPaused(session.isPaused);
            setPauseStartTime(session.pauseStartTime);
            setAccumulatedPauseSeconds(session.accumulatedPauseSeconds);
            setPausesList(session.pauses || []);

            if (session.isPaused && session.pauseStartTime) {
              // Se estava pausado, o timer fica parado no tempo líquido na hora da pausa
              const netTimeAtPause = Math.floor((session.pauseStartTime - session.timestamp - session.accumulatedPauseSeconds) / 1000);
              setTimer(netTimeAtPause);
            } else {
              // Se estava rodando, calcula o tempo líquido atual
              const elapsedNet = Math.floor((Date.now() - session.timestamp - session.accumulatedPauseSeconds) / 1000);
              setTimer(elapsedNet);
            }
            
            setStep(AppStep.TIMER);
          }
        } catch (err) {
          console.error("Erro ao recuperar sessão:", err);
        } finally {
          setLoading(false);
        }
      }
    };
    checkForActiveSession();
  }, [user]);

  // Cronômetro principal
  useEffect(() => {
    let interval: any;
    if (timerStartTime && !isPaused) {
      interval = setInterval(() => {
        // Tempo Líquido = (Agora - Início - Pausas Acumuladas)
        const currentNet = Math.floor((Date.now() - timerStartTime - accumulatedPauseSeconds) / 1000);
        setTimer(currentNet);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timerStartTime, isPaused, accumulatedPauseSeconds]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const loggedUser = await firebaseService.loginUser(username, password);
      if (loggedUser) {
        setUser(loggedUser);
        const allRecords = await firebaseService.getAllRecords();
        setRecords(allRecords);
        
        if (loggedUser.role === UserRole.ADMIN) {
          setStep(AppStep.ADMIN_MENU);
        } else {
          setProdData(prev => ({ ...prev, operador: loggedUser.username }));
          setStep(AppStep.IDENTIFICATION);
        }
      } else {
        setError('Usuário ou senha inválidos.');
      }
    } catch (err) {
      setError('Erro ao conectar com o servidor.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const newUser = await firebaseService.registerUser(username, password);
      setUser(newUser);
      setProdData(prev => ({ ...prev, operador: newUser.username }));
      setStep(AppStep.IDENTIFICATION);
    } catch (err: any) {
      setError(`Erro ao registrar: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // --- LÓGICA DE PERSISTÊNCIA DE SESSÃO ---
  const persistSession = async (overrideParams: Partial<ActiveSession> = {}) => {
    if (!user || !timerStartTime) return;
    const session: ActiveSession = {
      maquina: prodData.maquina || '',
      op: prodData.op || '',
      cp: prodData.cp || '',
      startTime: productionStartTime || Date.now(),
      isSetupMode,
      setupDurationSeconds: prodData.setupDurationSeconds || 0,
      timestamp: timerStartTime,
      isPaused,
      pauseStartTime,
      accumulatedPauseSeconds,
      pauses: pausesList,
      ...overrideParams
    };
    await firebaseService.saveActiveSession(user.id, session);
  };

  const startProduction = async (mode: 'setup' | 'direct') => {
    if (!prodData.maquina || !prodData.op || !prodData.cp) {
      setError('Preencha todos os campos antes de iniciar.');
      return;
    }
    setError('');
    const now = Date.now();
    setProductionStartTime(now);
    setIsSetupMode(mode === 'setup');
    setTimerStartTime(now);
    setTimer(0);
    setIsPaused(false);
    setAccumulatedPauseSeconds(0);
    setPausesList([]);

    await persistSession({
      startTime: now,
      isSetupMode: mode === 'setup',
      timestamp: now,
      isPaused: false,
      accumulatedPauseSeconds: 0,
      pauses: []
    });

    setStep(AppStep.TIMER);
  };

  const handlePause = async () => {
    const now = Date.now();
    setIsPaused(true);
    setPauseStartTime(now);
    setPauseReason('');
    await persistSession({ isPaused: true, pauseStartTime: now });
  };

  const handleResume = async () => {
    if (!pauseReason.trim()) {
      setError('Por favor, informe o motivo da pausa antes de retomar.');
      return;
    }
    setError('');
    const now = Date.now();
    const pauseDuration = pauseStartTime ? Math.floor((now - pauseStartTime) / 1000) : 0;
    
    const newPause: ProductionPause = {
      reason: pauseReason,
      durationSeconds: pauseDuration,
      timestamp: now
    };

    const newAccumulated = accumulatedPauseSeconds + (pauseDuration * 1000);
    const newList = [...pausesList, newPause];

    setAccumulatedPauseSeconds(newAccumulated);
    setPausesList(newList);
    setIsPaused(false);
    setPauseStartTime(null);
    setPauseReason('');

    await persistSession({ 
      isPaused: false, 
      pauseStartTime: null, 
      accumulatedPauseSeconds: newAccumulated,
      pauses: newList
    });
  };

  const finishSetupAndStartProd = async () => {
    const now = Date.now();
    const setupDuration = timer;
    setProdData(prev => ({ ...prev, setupDurationSeconds: setupDuration }));
    setTimerStartTime(now);
    setTimer(0);
    setIsSetupMode(false);
    setAccumulatedPauseSeconds(0); // Reiniciar acumulador para a fase de produção propriamente dita
    setPausesList([]); // Limpar pausas do setup para o registro de produção (ou manter se quiser total)

    await persistSession({
      isSetupMode: false,
      setupDurationSeconds: setupDuration,
      timestamp: now,
      accumulatedPauseSeconds: 0,
      pauses: []
    });
  };

  const finishProduction = async () => {
    const now = Date.now();
    setProductionEndTime(now);
    setProdData(prev => ({ 
      ...prev, 
      durationSeconds: timer,
      totalPauseSeconds: Math.floor(accumulatedPauseSeconds / 1000),
      pauses: pausesList
    }));
    setTimerStartTime(null);
    setStep(AppStep.SUMMARY);
  };

  const saveRecord = async () => {
    let finalStartTime = productionStartTime;
    const MIN_VALID_TIMESTAMP = 1704067200000;
    
    if (!finalStartTime || finalStartTime < MIN_VALID_TIMESTAMP) {
      setError('Erro de Sincronização. Reinicie o apontamento.');
      return;
    }

    setLoading(true);
    try {
      const finalRecord: ProductionRecord = {
        operador: user?.username || '',
        maquina: prodData.maquina || '',
        op: prodData.op || '',
        cp: prodData.cp || '',
        startTime: finalStartTime, 
        endTime: productionEndTime || Date.now(),
        durationSeconds: prodData.durationSeconds || 0,
        setupDurationSeconds: prodData.setupDurationSeconds || 0,
        totalPauseSeconds: prodData.totalPauseSeconds || 0,
        pauses: prodData.pauses || [],
        quantity: prodData.quantity || 0,
        observation: prodData.observation || '',
        timestamp: Date.now()
      };
      await firebaseService.saveRecord(finalRecord);
      
      if (user) {
        await firebaseService.deleteActiveSession(user.id);
      }
      
      const updatedRecords = await firebaseService.getAllRecords();
      setRecords(updatedRecords);
      
      setStep(AppStep.COMPLETED);
    } catch (err) {
      setError('Erro ao salvar registro.');
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (s: number) => {
    const h = Math.floor(s / 3600).toString().padStart(2, '0');
    const m = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${h}:${m}:${sec}`;
  };

  const loadAdminRecords = async () => {
    setLoading(true);
    try {
      const data = await firebaseService.getAllRecords();
      setRecords(data);
      return data;
    } catch (err) {
      setError('Erro ao carregar registros.');
      return [];
    } finally {
      setLoading(false);
    }
  };

  // --- LOGICA DE PRODUÇÃO DIÁRIA (OPERADOR) ---
  const dailyStats = useMemo(() => {
    if (!user) return { todayPercent: 0, yesterdayPercent: 0, todayHours: 0, yesterdayHours: 0, todayRecords: [], goalToday: 0 };

    const today = new Date();
    const yesterday = subDays(today, 1);
    
    const goalToday = getAvailableHoursByDate(today);
    const goalYesterday = getAvailableHoursByDate(yesterday);

    const userRecords = records.filter(r => r.operador === user.username);
    
    const todayRecords = userRecords.filter(r => isSameDay(new Date(r.timestamp), today));
    const yesterdayRecords = userRecords.filter(r => isSameDay(new Date(r.timestamp), yesterday));

    // Soma tempo líquido + tempo de setup
    const todaySecs = todayRecords.reduce((acc, curr) => acc + curr.durationSeconds + curr.setupDurationSeconds, 0);
    const yesterdaySecs = yesterdayRecords.reduce((acc, curr) => acc + curr.durationSeconds + curr.setupDurationSeconds, 0);

    const todayHours = todaySecs / 3600;
    const yesterdayHours = yesterdaySecs / 3600;

    const todayPercent = goalToday > 0 ? (todayHours / goalToday) * 100 : 0;
    const yesterdayPercent = goalYesterday > 0 ? (yesterdayHours / goalYesterday) * 100 : 0;

    return {
      todayPercent: Math.round(todayPercent),
      yesterdayPercent: Math.round(yesterdayPercent),
      todayHours: todayHours.toFixed(1),
      yesterdayHours: yesterdayHours.toFixed(1),
      todayRecords,
      goalToday
    };
  }, [records, user]);

  const dailyChartData = [
    { name: 'Meta', horas: dailyStats.goalToday, fill: '#e2e8f0' },
    { name: 'Realizado', horas: parseFloat(dailyStats.todayHours), fill: '#3b82f6' }
  ];

  const operatorsList = useMemo(() => {
    const ops = new Set(records.map(r => r.operador));
    return ['ALL', ...Array.from(ops)];
  }, [records]);

  const filteredAnalysisRecords = useMemo(() => {
    let r = [...records];
    if (analysisOperator !== 'ALL') {
      r = r.filter(item => item.operador === analysisOperator);
    }
    // Fix: Explicitly cast analysisStartDate/EndDate to string for parseISO
    const start = analysisStartDate ? startOfDay(parseISO(analysisStartDate as string)).getTime() : 0;
    const end = analysisEndDate ? endOfDay(parseISO(analysisEndDate as string)).getTime() : Infinity;
    return r.filter(item => item.timestamp >= start && item.timestamp <= end);
  }, [records, analysisOperator, analysisStartDate, analysisEndDate]);

  const chartData = useMemo(() => {
    const dailyData: Record<string, { date: string, quantity: number, prodHours: number, meta: number }> = {};
    
    filteredAnalysisRecords.forEach(record => {
      const dateKey = format(new Date(record.timestamp), 'dd/MM');
      if (!dailyData[dateKey]) {
        dailyData[dateKey] = { date: dateKey, quantity: 0, prodHours: 0, meta: availableHoursPerDay };
      }
      dailyData[dateKey].quantity += record.quantity;
      dailyData[dateKey].prodHours += (record.durationSeconds + record.setupDurationSeconds) / 3600;
    });

    return Object.values(dailyData).sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredAnalysisRecords, availableHoursPerDay]);

  const filteredAndSortedRecords = useMemo(() => {
    let result = [...records];
    if (filterText) {
      const lowFilter = filterText.toLowerCase();
      result = result.filter(r => 
        r.op.toLowerCase().includes(lowFilter) || 
        r.operador.toLowerCase().includes(lowFilter) || 
        r.maquina.toLowerCase().includes(lowFilter) ||
        r.cp.toLowerCase().includes(lowFilter)
      );
    }
    if (tableStartDate || tableEndDate) {
      // Fix: Explicitly cast tableStartDate/EndDate to string for parseISO
      const start = tableStartDate ? startOfDay(parseISO(tableStartDate as string)).getTime() : 0;
      const end = tableEndDate ? endOfDay(parseISO(tableEndDate as string)).getTime() : Infinity;
      result = result.filter(r => r.timestamp >= start && r.timestamp <= end);
    }
    result.sort((a, b) => sortOrder === 'desc' ? b.timestamp - a.timestamp : a.timestamp - b.timestamp);
    return result;
  }, [records, filterText, sortOrder, tableStartDate, tableEndDate]);

  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(filteredAndSortedRecords.map(r => ({
      'Data': format(new Date(r.timestamp), 'dd/MM/yyyy', { locale: ptBR }),
      'Hora Início': format(new Date(r.startTime), 'HH:mm:ss', { locale: ptBR }),
      'Hora Fim': format(new Date(r.endTime), 'HH:mm:ss', { locale: ptBR }),
      'Operador': r.operador,
      'Máquina': r.maquina,
      'OP': r.op,
      'CP': r.cp,
      'Duração Produção': formatDuration(r.durationSeconds),
      'Duração Setup': formatDuration(r.setupDurationSeconds),
      'Duração Pausas': formatDuration(r.totalPauseSeconds),
      'Quantidade': r.quantity,
      'Observação': r.observation
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Produção");
    XLSX.writeFile(wb, `IMEK_Relatorio_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className={`w-full ${[AppStep.SAVED_RECORDS, AppStep.ANALYSIS, AppStep.DAILY_VIEW].includes(step) ? 'max-w-6xl' : 'max-w-md'} bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100 transition-all duration-300`}>
        
        <div className="bg-white p-6 flex flex-col items-center border-b border-gray-100">
           <div className="bg-blue-600 p-3 rounded-2xl mb-4 shadow-lg shadow-blue-200">
             <ClipboardCheck className="text-white w-8 h-8" />
           </div>
           <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">IMEK SLEEVE</h1>
           <p className="text-gray-500 text-sm font-medium">Gestão Industrial</p>
        </div>

        <div className="p-8">
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100 font-medium">
              {error}
            </div>
          )}

          {step === AppStep.LOGIN && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Operador (Nome)</label>
                <input type="text" value={username} onChange={e => setUsername(e.target.value)} className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 bg-gray-50 outline-none" placeholder="Seu nome" required />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Senha</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 bg-gray-50 outline-none" placeholder="Sua senha" required />
              </div>
              <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-100 flex items-center justify-center gap-2">
                {loading ? 'Entrando...' : <><LogIn size={18} /> Entrar</>}
              </button>
              <button type="button" onClick={() => setStep(AppStep.REGISTER)} className="w-full text-blue-600 text-sm font-bold flex items-center justify-center gap-2"><UserPlus size={16} /> Novo Cadastro</button>
            </form>
          )}

          {step === AppStep.DAILY_VIEW && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center gap-2">
                 <button onClick={() => setStep(AppStep.IDENTIFICATION)} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"><ArrowLeft size={16} /></button>
                 <h2 className="text-xl font-bold text-gray-800">Minha Produção Diária</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm relative overflow-hidden">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-bold text-gray-400 uppercase">Hoje</p>
                    <div className="bg-blue-50 p-2 rounded-xl text-blue-600"><Clock size={20} /></div>
                  </div>
                  <p className="text-3xl font-black text-gray-900">{dailyStats.todayPercent}%</p>
                  <p className="text-xs text-gray-500 font-medium">{dailyStats.todayHours}h de {dailyStats.goalToday}h meta</p>
                  <div className="absolute bottom-0 left-0 h-1 bg-blue-600 transition-all duration-1000" style={{ width: `${Math.min(dailyStats.todayPercent, 100)}%` }}></div>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-bold text-gray-400 uppercase">Ontem</p>
                    <div className="bg-indigo-50 p-2 rounded-xl text-indigo-600"><History size={20} /></div>
                  </div>
                  <p className="text-3xl font-black text-gray-900">{dailyStats.yesterdayPercent}%</p>
                  <div className={`flex items-center gap-1 text-xs font-bold ${dailyStats.todayPercent >= dailyStats.yesterdayPercent ? 'text-green-500' : 'text-red-500'}`}>
                    <TrendingUp size={12} className={dailyStats.todayPercent < dailyStats.yesterdayPercent ? 'rotate-180' : ''} />
                    {dailyStats.todayPercent - dailyStats.yesterdayPercent}% em relação a ontem
                  </div>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm flex flex-col">
                  <h4 className="text-[10px] font-bold text-gray-400 uppercase mb-4 flex items-center gap-2"><Target size={12}/> Gráfico de Ocupação</h4>
                  <div className="h-24 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart layout="vertical" data={dailyChartData}>
                        <XAxis type="number" hide domain={[0, dailyStats.goalToday > 0 ? dailyStats.goalToday : 9]} />
                        <YAxis type="category" dataKey="name" hide />
                        <Tooltip cursor={{fill: 'transparent'}} contentStyle={{fontSize: '10px', borderRadius: '8px'}} />
                        <Bar dataKey="horas" radius={[0, 4, 4, 0]} barSize={20}>
                          {dailyChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-bold text-gray-700 uppercase tracking-widest px-1">Registros de Hoje</h3>
                <div className="overflow-x-auto rounded-3xl border border-gray-200 bg-white">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 text-gray-400 font-bold uppercase text-[10px] tracking-wider border-b border-gray-100">
                      <tr><th className="px-6 py-4">Equipamento</th><th className="px-6 py-4">OP/CP</th><th className="px-6 py-4 text-center">Qtde</th><th className="px-6 py-4">Duração</th></tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {dailyStats.todayRecords.length === 0 ? (
                        <tr><td colSpan={4} className="text-center py-10 text-gray-400 italic font-medium">Nenhum apontamento hoje.</td></tr>
                      ) : (
                        dailyStats.todayRecords.map(r => (
                          <tr key={r.id} className="hover:bg-blue-50/20 transition-colors">
                            <td className="px-6 py-4 font-bold text-gray-800">{r.maquina}</td>
                            <td className="px-6 py-4"><span className="text-blue-600 font-black">{r.op}</span><span className="text-[10px] text-gray-400 ml-2">{r.cp}</span></td>
                            <td className="px-6 py-4 text-center font-black text-gray-900">{r.quantity}</td>
                            <td className="px-6 py-4 font-bold text-green-600">{formatDuration(r.durationSeconds + r.setupDurationSeconds)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {step === AppStep.REGISTER && (
            <form onSubmit={handleRegister} className="space-y-4">
              <h2 className="text-lg font-bold text-center mb-4">Cadastro de Operador</h2>
              <input type="text" value={username} onChange={e => setUsername(e.target.value)} className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 bg-gray-50" placeholder="Nome de Usuário" required />
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 bg-gray-50" placeholder="Senha" required />
              <button type="submit" disabled={loading} className="w-full bg-green-600 text-white font-bold py-3 rounded-xl hover:bg-green-700 transition-colors">{loading ? '...' : 'Salvar Cadastro'}</button>
              <button type="button" onClick={() => setStep(AppStep.LOGIN)} className="w-full text-gray-500 text-sm font-bold">Voltar</button>
            </form>
          )}

          {step === AppStep.ADMIN_MENU && (
            <div className="space-y-4">
               <h2 className="text-xl font-bold text-gray-800 text-center mb-4">Administrador</h2>
               <button onClick={() => setStep(AppStep.IDENTIFICATION)} className="w-full flex items-center gap-4 p-5 bg-blue-50 rounded-2xl border border-blue-100 hover:bg-blue-100 transition-all text-left">
                 <div className="bg-blue-600 p-3 rounded-xl text-white shadow-md"><ClipboardCheck size={24} /></div>
                 <div><span className="block font-bold text-blue-900">Novo Apontamento</span><span className="text-xs text-blue-700">Registrar produção</span></div>
               </button>
               <button onClick={() => setStep(AppStep.GESTÃO_PRODUCAO)} className="w-full flex items-center gap-4 p-5 bg-indigo-50 rounded-2xl border border-indigo-100 hover:bg-indigo-100 transition-all text-left">
                 <div className="bg-indigo-600 p-3 rounded-xl text-white shadow-md"><LayoutDashboard size={24} /></div>
                 <div><span className="block font-bold text-indigo-900">Gestão e Dashboards</span><span className="text-xs text-indigo-700">Análise e Histórico</span></div>
               </button>
               <button onClick={() => {setUser(null); setStep(AppStep.LOGIN)}} className="w-full mt-4 flex items-center justify-center gap-2 text-gray-500 font-bold hover:text-red-500 transition-colors"><LogOut size={16} /> Sair</button>
            </div>
          )}

          {step === AppStep.GESTÃO_PRODUCAO && (
            <div className="space-y-4">
               <div className="flex items-center gap-2 mb-4">
                 <button onClick={() => setStep(AppStep.ADMIN_MENU)} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"><ArrowLeft size={16} /></button>
                 <h2 className="text-xl font-bold text-gray-800">Módulo de Gestão</h2>
               </div>
               <button onClick={() => { loadAdminRecords(); setStep(AppStep.SAVED_RECORDS); }} className="w-full flex items-center gap-4 p-5 bg-white rounded-2xl border border-gray-200 hover:bg-gray-50 transition-all text-left">
                 <div className="bg-green-600 p-3 rounded-xl text-white shadow-md"><FileSpreadsheet size={24} /></div>
                 <div><span className="block font-bold text-gray-900">Histórico Completo</span><span className="text-xs text-gray-500">Listagem com filtros de data</span></div>
               </button>
               <button onClick={() => { loadAdminRecords(); setStep(AppStep.ANALYSIS); setShowAnalysisResult(false); }} className="w-full flex items-center gap-4 p-5 bg-white rounded-2xl border border-gray-200 hover:bg-gray-50 transition-all text-left">
                 <div className="bg-orange-500 p-3 rounded-xl text-white shadow-md"><PieChart size={24} /></div>
                 <div><span className="block font-bold text-gray-900">Dashboard de Performance</span><span className="text-xs text-gray-500">Gráficos de Produção</span></div>
               </button>
            </div>
          )}

          {step === AppStep.ANALYSIS && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 mb-4">
                 <button onClick={() => setStep(AppStep.GESTÃO_PRODUCAO)} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"><ArrowLeft size={16} /></button>
                 <h2 className="text-xl font-bold text-gray-800">Análise de Desempenho</h2>
              </div>

              {!showAnalysisResult ? (
                <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-5">
                  <h3 className="text-lg font-bold text-gray-700 flex items-center gap-2">Configuração da Análise</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">Filtrar Operador</label>
                      <select value={analysisOperator} onChange={e => setAnalysisOperator(e.target.value)} className="w-full p-2.5 rounded-xl border border-gray-300 bg-white text-sm focus:ring-2 focus:ring-blue-500">
                        {operatorsList.map(op => <option key={op} value={op}>{op === 'ALL' ? 'Todos' : op}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">Horas Disponíveis/Dia</label>
                      <input type="number" value={availableHoursPerDay} onChange={e => setAvailableHoursPerDay(parseFloat(e.target.value))} className="w-full p-2.5 rounded-xl border border-gray-300 bg-white text-sm focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">Data Inicial</label>
                      <input type="date" value={analysisStartDate} onChange={e => setAnalysisStartDate(e.target.value)} className="w-full p-2.5 rounded-xl border border-gray-300 bg-white text-sm focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">Data Final</label>
                      <input type="date" value={analysisEndDate} onChange={e => setAnalysisEndDate(e.target.value)} className="w-full p-2.5 rounded-xl border border-gray-300 bg-white text-sm focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>
                  <button onClick={() => setShowAnalysisResult(true)} className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-blue-700 flex items-center justify-center gap-2">
                    <TrendingUp size={20} /> Ver Resultados
                  </button>
                </div>
              ) : (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 flex items-center gap-4">
                      <div className="bg-blue-600 p-3 rounded-xl text-white"><TrendingUp size={24} /></div>
                      <div>
                        <p className="text-xs text-blue-600 font-bold uppercase">Total Peças</p>
                        <p className="text-2xl font-black text-blue-900">{chartData.reduce((acc, curr) => acc + curr.quantity, 0)}</p>
                      </div>
                    </div>
                    <div className="bg-green-50 p-4 rounded-2xl border border-green-100 flex items-center gap-4">
                      <div className="bg-green-600 p-3 rounded-xl text-white"><Clock size={24} /></div>
                      <div>
                        <p className="text-xs text-green-600 font-bold uppercase">Total Horas</p>
                        <p className="text-2xl font-black text-green-900">{chartData.reduce((acc, curr) => acc + curr.prodHours, 0).toFixed(1)}h</p>
                      </div>
                    </div>
                    <div className="bg-purple-50 p-4 rounded-2xl border border-purple-100 flex items-center gap-4">
                      <div className="bg-purple-600 p-3 rounded-xl text-white"><UserIcon size={24} /></div>
                      <div>
                        <p className="text-xs text-purple-600 font-bold uppercase">Operador</p>
                        <p className="text-xl font-black text-purple-900 truncate">{analysisOperator === 'ALL' ? 'Múltiplos' : analysisOperator}</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                      <h4 className="text-sm font-bold text-gray-400 uppercase mb-4 tracking-widest flex items-center gap-2"><TrendingUp size={16}/> Peças Produzidas / Dia</h4>
                      <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                            <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                            <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                            <Bar dataKey="quantity" name="Peças" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                      <h4 className="text-sm font-bold text-gray-400 uppercase mb-4 tracking-widest flex items-center gap-2"><Clock size={16}/> Horas Reais vs Disponíveis</h4>
                      <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                            <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                            <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                            <Legend iconType="circle" verticalAlign="top" height={36} />
                            <Bar dataKey="prodHours" name="Horas Reais" fill="#10b981" radius={[4, 4, 0, 0]} />
                            <Line type="monotone" dataKey="meta" name="Disponível (Meta)" stroke="#ef4444" strokeWidth={2} dot={{r: 4, fill: "#ef4444"}} />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                  <button onClick={() => setShowAnalysisResult(false)} className="w-full py-4 text-gray-400 text-sm font-bold hover:text-blue-600 transition-colors">Voltar para Filtros</button>
                </div>
              )}
            </div>
          )}

          {step === AppStep.SAVED_RECORDS && (
            <div className="space-y-6">
               <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
                 <div className="flex items-center gap-2">
                    <button onClick={() => setStep(AppStep.GESTÃO_PRODUCAO)} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"><ArrowLeft size={16} /></button>
                    <h2 className="text-xl font-bold text-gray-800">Apontamentos Salvos</h2>
                 </div>
                 <button onClick={exportToExcel} className="bg-green-600 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 text-sm font-bold shadow-lg hover:bg-green-700 transition-colors"><Download size={16} /> Exportar Excel</button>
               </div>
               <div className="bg-gray-50 p-5 rounded-3xl border border-gray-200 space-y-4">
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                      <input type="text" placeholder="OP, CP, Máquina..." value={filterText} onChange={e => setFilterText(e.target.value)} className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-300 rounded-xl outline-none text-sm focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-gray-300">
                      <Calendar size={14} className="text-gray-400" />
                      <span className="text-[10px] font-bold text-gray-400 uppercase">De</span>
                      <input type="date" value={tableStartDate} onChange={e => setTableStartDate(e.target.value)} className="text-xs border-none outline-none flex-1" />
                    </div>
                    <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-gray-300">
                      <Calendar size={14} className="text-gray-400" />
                      <span className="text-[10px] font-bold text-gray-400 uppercase">Até</span>
                      <input type="date" value={tableEndDate} onChange={e => setTableEndDate(e.target.value)} className="text-xs border-none outline-none flex-1" />
                    </div>
                 </div>
                 <div className="flex justify-between items-center px-1">
                    <button onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')} className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2 hover:text-blue-600">
                      <ArrowUpDown size={12} /> Data: {sortOrder === 'desc' ? 'Novos' : 'Antigos'}
                    </button>
                    {(tableStartDate || tableEndDate || filterText) && (
                      <button onClick={() => {setTableStartDate(''); setTableEndDate(''); setFilterText('');}} className="text-[10px] font-bold text-red-500 uppercase hover:underline">Limpar</button>
                    )}
                 </div>
               </div>
               <div className="overflow-x-auto rounded-3xl border border-gray-200">
                 <table className="w-full text-left text-sm">
                   <thead className="bg-gray-100 text-gray-500 font-bold uppercase text-[10px] tracking-wider border-b border-gray-200">
                     <tr><th className="px-6 py-5">Data/Hora</th><th className="px-6 py-5">Equipamento</th><th className="px-6 py-5">OP/CP</th><th className="px-6 py-5 text-center">Qtde</th><th className="px-6 py-5">Duração</th></tr>
                   </thead>
                   <tbody className="divide-y divide-gray-100 bg-white">
                     {loading ? (<tr><td colSpan={5} className="text-center py-20 text-gray-400 animate-pulse font-medium">Carregando...</td></tr>) : 
                      filteredAndSortedRecords.length === 0 ? (<tr><td colSpan={5} className="text-center py-20 text-gray-400 italic">Nenhum registro.</td></tr>) :
                      filteredAndSortedRecords.map(r => (
                       <tr key={r.id} className="hover:bg-blue-50/40 transition-colors">
                         <td className="px-6 py-4">
                           <div className="font-bold text-gray-900">{format(new Date(r.startTime), 'dd/MM/yy', { locale: ptBR })}</div>
                           <div className="text-[10px] text-gray-400 font-medium">{format(new Date(r.startTime), 'HH:mm')}</div>
                         </td>
                         <td className="px-6 py-4">
                           <div className="text-gray-800 font-semibold">{r.maquina}</div>
                           <div className="text-[10px] text-gray-400">Op: {r.operador}</div>
                         </td>
                         <td className="px-6 py-4"><div className="text-blue-600 font-black">{r.op}</div><div className="text-[10px] text-gray-400 font-medium">{r.cp}</div></td>
                         <td className="px-6 py-4 text-center">
                           <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full font-black text-lg">{r.quantity}</span>
                         </td>
                         <td className="px-6 py-4">
                           <div className="text-green-600 font-bold flex items-center gap-1"><Play size={10}/> {formatDuration(r.durationSeconds)}</div>
                           <div className="text-[10px] text-gray-400 flex items-center gap-1 font-medium"><Square size={10}/> {formatDuration(r.setupDurationSeconds)} setup</div>
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
            </div>
          )}

          {step === AppStep.IDENTIFICATION && (
            <div className="space-y-6">
              <h2 className="text-lg font-bold text-gray-800">Passo 1: Identificação</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-600 mb-1">Máquina / Linha</label>
                  <select value={prodData.maquina} onChange={e => setProdData(prev => ({ ...prev, maquina: e.target.value }))} className="w-full p-3 rounded-xl border border-gray-200 bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none">
                    <option value="">Selecione...</option>
                    <option>Romi D1000</option><option>Veker Mvk 1050</option><option>Torno Cnc Cosmos</option><option>Torno Convencional</option><option>Torno Mascote</option><option>Fresadora Ferramenteira</option>
                  </select>
                </div>
                
                <button onClick={() => setStep(AppStep.DAILY_VIEW)} className="w-full bg-white border-2 border-blue-600 text-blue-600 font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-blue-50 transition-all">
                  <PieChart size={20} /> Produção Diária
                </button>
              </div>
              
              <button onClick={() => prodData.maquina ? setStep(AppStep.DETAILS) : setError('Selecione a máquina.')} className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl shadow-lg hover:bg-blue-700 transition-all">Prosseguir</button>
              
              <button onClick={() => {setUser(null); setStep(AppStep.LOGIN)}} className="w-full mt-4 flex items-center justify-center gap-2 text-gray-400 font-bold hover:text-red-500 transition-colors text-sm"><LogOut size={14} /> Sair do Sistema</button>
            </div>
          )}

          {step === AppStep.DETAILS && (
            <div className="space-y-6">
              <h2 className="text-lg font-bold text-gray-800">Passo 2: Detalhes</h2>
              <div className="space-y-4">
                <input type="text" value={prodData.op} onChange={e => setProdData(prev => ({ ...prev, op: e.target.value }))} className="w-full p-3 rounded-xl border border-gray-200 bg-gray-50 outline-none focus:ring-2 focus:ring-blue-500" placeholder="Número da OP" />
                <input type="text" value={prodData.cp} onChange={e => setProdData(prev => ({ ...prev, cp: e.target.value }))} className="w-full p-3 rounded-xl border border-gray-200 bg-gray-50 outline-none focus:ring-2 focus:ring-blue-500" placeholder="Código do Produto (CP)" />
              </div>
              <div className="flex gap-3">
                <button onClick={() => startProduction('setup')} className="flex-1 bg-green-600 text-white font-bold py-3 rounded-xl text-sm shadow-md hover:bg-green-700 transition-colors">Setup</button>
                <button onClick={() => startProduction('direct')} className="flex-1 bg-blue-600 text-white font-bold py-3 rounded-xl text-sm shadow-md hover:bg-blue-700 transition-colors">Iniciar</button>
              </div>
              <button onClick={() => setStep(AppStep.IDENTIFICATION)} className="w-full text-gray-400 text-sm font-bold">Voltar</button>
            </div>
          )}

          {step === AppStep.TIMER && (
            <div className="space-y-6 text-center">
              <div className="flex justify-center mb-2">
                <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[10px] font-bold border border-blue-100">
                  <Cloud size={12} /> SESSÃO SINCRONIZADA
                </div>
              </div>
              
              <h2 className={`text-xl font-bold ${isPaused ? 'text-orange-600' : 'text-gray-800'}`}>
                {isPaused ? 'PRODUÇÃO PAUSADA' : (isSetupMode ? 'Setup em Andamento' : 'Produção em Andamento')}
              </h2>
              
              <div className={`p-8 rounded-3xl font-mono text-5xl border-4 shadow-2xl tracking-tighter transition-all ${isPaused ? 'bg-orange-50 text-orange-600 border-orange-200' : 'bg-gray-900 text-green-400 border-gray-800'}`}>
                {formatDuration(timer)}
              </div>

              {!isPaused ? (
                <div className="space-y-4">
                   <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 text-left text-xs text-blue-800 font-medium">
                    Em execução na <span className="font-bold underline">{prodData.maquina}</span> para a <span className="font-bold underline">OP {prodData.op}</span>.
                  </div>
                  
                  <button onClick={handlePause} className="w-full bg-orange-500 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg hover:bg-orange-600">
                    <Pause size={20} /> Pausar Produção
                  </button>

                  {isSetupMode ? (
                    <button onClick={finishSetupAndStartProd} className="w-full bg-green-600 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg hover:bg-green-700"><Play size={20} /> Concluir Setup</button>
                  ) : (
                    <button onClick={finishProduction} className="w-full bg-red-600 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg hover:bg-red-700"><Square size={20} /> Finalizar</button>
                  )}
                </div>
              ) : (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                  <div className="bg-orange-50 p-5 rounded-3xl border border-orange-200 text-left space-y-3">
                    <div className="flex items-center gap-2 text-orange-800 font-bold text-sm">
                      <AlertCircle size={18} /> Informe o Motivo da Pausa:
                    </div>
                    <textarea 
                      value={pauseReason} 
                      onChange={e => setPauseReason(e.target.value)}
                      className="w-full p-3 rounded-xl border border-orange-300 bg-white text-sm focus:ring-2 focus:ring-orange-500 outline-none h-24 placeholder-orange-200"
                      placeholder="Ex: Manutenção, Falta de material, Almoço..."
                    />
                    <button onClick={handleResume} className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg hover:bg-blue-700 transition-all">
                      <Play size={20} /> Retomar Produção
                    </button>
                  </div>
                </div>
              )}

              <div className="pt-2">
                 <button onClick={() => {setUser(null); setStep(AppStep.LOGIN)}} className="text-gray-400 text-xs font-bold hover:text-red-500 flex items-center justify-center gap-1 mx-auto">
                   <LogOut size={12} /> Sair do App
                 </button>
              </div>
            </div>
          )}

          {step === AppStep.SUMMARY && (
            <div className="space-y-6">
              <h2 className="text-lg font-bold text-gray-800">Finalizar Apontamento</h2>
              <div className="grid grid-cols-2 gap-3">
                 <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                    <span className="text-[10px] text-gray-400 font-bold uppercase block">Tempo Líquido</span>
                    <span className="text-lg font-black text-green-600">{formatDuration(prodData.durationSeconds || 0)}</span>
                 </div>
                 <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                    <span className="text-[10px] text-gray-400 font-bold uppercase block">Tempo de Pausas</span>
                    <span className="text-lg font-black text-orange-600">{formatDuration(prodData.totalPauseSeconds || 0)}</span>
                 </div>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-widest">Quantidade Produzida</label>
                <input type="number" value={prodData.quantity} onChange={e => setProdData(prev => ({ ...prev, quantity: parseInt(e.target.value) || 0 }))} className="w-full p-4 rounded-xl border border-gray-200 bg-gray-50 text-xl font-black text-blue-600 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="0" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-widest">Observações Finais</label>
                <textarea value={prodData.observation} onChange={e => setProdData(prev => ({ ...prev, observation: e.target.value }))} className="w-full p-3 rounded-xl border border-gray-200 bg-gray-50 h-24 text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="Alguma ocorrência extra durante o turno?" />
              </div>
              <button onClick={saveRecord} disabled={loading} className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-blue-700 active:scale-[0.98] transition-all">{loading ? 'Salvando...' : 'Gravar Apontamento'}</button>
            </div>
          )}

          {step === AppStep.COMPLETED && (
            <div className="text-center py-10 space-y-6 animate-in zoom-in duration-300">
              <div className="bg-green-100 p-8 rounded-full inline-block text-green-600 shadow-inner"><CheckCircle2 size={70} /></div>
              <h2 className="text-3xl font-black text-gray-800">Sucesso!</h2>
              <p className="text-gray-500 font-medium">Os dados foram sincronizados com o banco de dados da IMEK.</p>
              <button onClick={() => { 
                setProdData({ 
                  maquina: prodData.maquina, 
                  operador: user?.username,
                  pauses: [],
                  durationSeconds: 0,
                  totalPauseSeconds: 0
                }); 
                setProductionStartTime(null); 
                setProductionEndTime(null); 
                setPausesList([]);
                setAccumulatedPauseSeconds(0);
                setStep(user?.role === UserRole.ADMIN ? AppStep.ADMIN_MENU : AppStep.IDENTIFICATION); 
              }} className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl shadow-xl hover:bg-blue-700 transition-all">Novo Apontamento</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;