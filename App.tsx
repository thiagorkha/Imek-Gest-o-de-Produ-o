
import React, { useState, useEffect, useMemo } from 'react';
import { AppStep, User, UserRole, ProductionRecord } from './types';
import { firebaseService } from './services/firebaseService';
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
  User as UserIcon
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { format, isWithinInterval, startOfDay, endOfDay, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import { GoogleGenAI } from "@google/genai";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer, 
  Line, 
  ComposedChart 
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
  const [analysis, setAnalysis] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
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
    quantity: 0,
    observation: ''
  });

  const [productionStartTime, setProductionStartTime] = useState<number | null>(null);
  const [productionEndTime, setProductionEndTime] = useState<number | null>(null);
  const [isSetupMode, setIsSetupMode] = useState(true);
  const [timerStartTime, setTimerStartTime] = useState<number | null>(null);
  const [timer, setTimer] = useState(0);

  useEffect(() => {
    let interval: any;
    if (timerStartTime) {
      interval = setInterval(() => {
        setTimer(Math.floor((Date.now() - timerStartTime) / 1000));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timerStartTime]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const loggedUser = await firebaseService.loginUser(username, password);
      if (loggedUser) {
        setUser(loggedUser);
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

  const startProduction = (mode: 'setup' | 'direct') => {
    if (!prodData.op || !prodData.cp) {
      setError('Preencha OP e CP antes de iniciar.');
      return;
    }
    setError('');
    const now = Date.now();
    setProductionStartTime(now);
    sessionStorage.setItem('imek_start_time', now.toString());
    setIsSetupMode(mode === 'setup');
    setTimerStartTime(now);
    setTimer(0);
    setStep(AppStep.TIMER);
  };

  const finishSetupAndStartProd = () => {
    const now = Date.now();
    setProdData(prev => ({ ...prev, setupDurationSeconds: timer }));
    setTimerStartTime(now);
    setTimer(0);
    setIsSetupMode(false);
  };

  const finishProduction = () => {
    const now = Date.now();
    setProductionEndTime(now);
    setProdData(prev => ({ ...prev, durationSeconds: timer }));
    setTimerStartTime(null);
    setStep(AppStep.SUMMARY);
  };

  const saveRecord = async () => {
    let finalStartTime = productionStartTime;
    if (!finalStartTime || finalStartTime === 0) {
      const stored = sessionStorage.getItem('imek_start_time');
      if (stored) finalStartTime = parseInt(stored);
    }

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
        quantity: prodData.quantity || 0,
        observation: prodData.observation || '',
        timestamp: Date.now()
      };
      await firebaseService.saveRecord(finalRecord);
      sessionStorage.removeItem('imek_start_time');
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

  // --- ANALYSIS LOGIC ---

  const operatorsList = useMemo(() => {
    const ops = new Set(records.map(r => r.operador));
    return ['ALL', ...Array.from(ops)];
  }, [records]);

  const filteredAnalysisRecords = useMemo(() => {
    let r = [...records];
    if (analysisOperator !== 'ALL') {
      r = r.filter(item => item.operador === analysisOperator);
    }
    const start = analysisStartDate ? startOfDay(parseISO(analysisStartDate)).getTime() : 0;
    const end = analysisEndDate ? endOfDay(parseISO(analysisEndDate)).getTime() : Infinity;
    return r.filter(item => item.timestamp >= start && item.timestamp <= end);
  }, [records, analysisOperator, analysisStartDate, analysisEndDate]);

  const chartData = useMemo(() => {
    const dailyData: Record<string, { date: string, quantity: number, prodHours: number, meta: number }> = {};
    
    filteredAnalysisRecords.forEach(record => {
      const dateKey = format(record.timestamp, 'dd/MM');
      if (!dailyData[dateKey]) {
        dailyData[dateKey] = { date: dateKey, quantity: 0, prodHours: 0, meta: availableHoursPerDay };
      }
      dailyData[dateKey].quantity += record.quantity;
      dailyData[dateKey].prodHours += record.durationSeconds / 3600;
    });

    return Object.values(dailyData).sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredAnalysisRecords, availableHoursPerDay]);

  const generateAnalysis = async () => {
    setIsAnalyzing(true);
    setError('');
    setAnalysis('');
    setShowAnalysisResult(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `Analise estes dados de produção da IMEK. Meta de horas diárias: ${availableHoursPerDay}h. Filtros: Operador ${analysisOperator}, Período ${analysisStartDate} a ${analysisEndDate}. Dados formatados: ${JSON.stringify(chartData)}`,
        config: { 
          systemInstruction: "Você é um consultor sênior de eficiência industrial da IMEK. Analise os gráficos e dados fornecidos. Fale sobre o cumprimento da meta de horas e o volume de peças. Gere insights acionáveis em Markdown.",
          temperature: 0.7 
        }
      });

      if (response.text) {
        setAnalysis(response.text.trim());
      } else {
        setError('Falha ao gerar insights da IA.');
      }
    } catch (err: any) {
      setError(`Erro na IA: ${err.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // --- TABLE FILTERING ---
  const filteredAndSortedRecords = useMemo(() => {
    let result = [...records];
    
    // Filtro de Texto
    if (filterText) {
      const lowFilter = filterText.toLowerCase();
      result = result.filter(r => 
        r.op.toLowerCase().includes(lowFilter) || 
        r.operador.toLowerCase().includes(lowFilter) || 
        r.maquina.toLowerCase().includes(lowFilter) ||
        r.cp.toLowerCase().includes(lowFilter)
      );
    }

    // Filtro de Data
    if (tableStartDate || tableEndDate) {
      const start = tableStartDate ? startOfDay(parseISO(tableStartDate)).getTime() : 0;
      const end = tableEndDate ? endOfDay(parseISO(tableEndDate)).getTime() : Infinity;
      result = result.filter(r => r.timestamp >= start && r.timestamp <= end);
    }

    result.sort((a, b) => sortOrder === 'desc' ? b.timestamp - a.timestamp : a.timestamp - b.timestamp);
    return result;
  }, [records, filterText, sortOrder, tableStartDate, tableEndDate]);

  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(filteredAndSortedRecords.map(r => ({
      'Data': format(r.timestamp, 'dd/MM/yyyy', { locale: ptBR }),
      'Hora Início': format(r.startTime, 'HH:mm:ss', { locale: ptBR }),
      'Hora Fim': format(r.endTime, 'HH:mm:ss', { locale: ptBR }),
      'Operador': r.operador,
      'Máquina': r.maquina,
      'OP': r.op,
      'CP': r.cp,
      'Duração Produção': formatDuration(r.durationSeconds),
      'Duração Setup': formatDuration(r.setupDurationSeconds),
      'Quantidade': r.quantity,
      'Observação': r.observation
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Produção");
    XLSX.writeFile(wb, `IMEK_Relatorio_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className={`w-full ${[AppStep.SAVED_RECORDS, AppStep.ANALYSIS].includes(step) ? 'max-w-6xl' : 'max-w-md'} bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100 transition-all duration-300`}>
        
        <div className="bg-white p-6 flex flex-col items-center border-b border-gray-100">
           <div className="bg-blue-600 p-3 rounded-2xl mb-4 shadow-lg shadow-blue-200">
             <ClipboardCheck className="text-white w-8 h-8" />
           </div>
           <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">IMEK SLEEVE</h1>
           <p className="text-gray-500 text-sm font-medium">Sistema de Gestão Industrial</p>
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
                {loading ? 'Autenticando...' : <><LogIn size={18} /> Entrar</>}
              </button>
              <button type="button" onClick={() => setStep(AppStep.REGISTER)} className="w-full text-blue-600 text-sm font-bold flex items-center justify-center gap-2"><UserPlus size={16} /> Novo Cadastro</button>
            </form>
          )}

          {step === AppStep.REGISTER && (
            <form onSubmit={handleRegister} className="space-y-4">
              <h2 className="text-lg font-bold text-center mb-4">Cadastro de Operador</h2>
              <input type="text" value={username} onChange={e => setUsername(e.target.value)} className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 bg-gray-50" placeholder="Nome de Usuário" required />
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 bg-gray-50" placeholder="Defina sua Senha" required />
              <button type="submit" disabled={loading} className="w-full bg-green-600 text-white font-bold py-3 rounded-xl hover:bg-green-700 transition-colors">{loading ? 'Processando...' : 'Confirmar Cadastro'}</button>
              <button type="button" onClick={() => setStep(AppStep.LOGIN)} className="w-full text-gray-500 text-sm font-bold">Voltar</button>
            </form>
          )}

          {step === AppStep.ADMIN_MENU && (
            <div className="space-y-4">
               <h2 className="text-xl font-bold text-gray-800 text-center mb-4">Portal do Administrador</h2>
               <button onClick={() => setStep(AppStep.IDENTIFICATION)} className="w-full flex items-center gap-4 p-5 bg-blue-50 rounded-2xl border border-blue-100 hover:bg-blue-100 transition-all text-left">
                 <div className="bg-blue-600 p-3 rounded-xl text-white shadow-md"><ClipboardCheck size={24} /></div>
                 <div><span className="block font-bold text-blue-900">Apontamento de Produção</span><span className="text-xs text-blue-700">Registrar novas atividades</span></div>
               </button>
               <button onClick={() => setStep(AppStep.GESTÃO_PRODUCAO)} className="w-full flex items-center gap-4 p-5 bg-indigo-50 rounded-2xl border border-indigo-100 hover:bg-indigo-100 transition-all text-left">
                 <div className="bg-indigo-600 p-3 rounded-xl text-white shadow-md"><LayoutDashboard size={24} /></div>
                 <div><span className="block font-bold text-indigo-900">Gestão de Produção</span><span className="text-xs text-indigo-700">Relatórios e Consultas</span></div>
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
                 <div><span className="block font-bold text-gray-900">Apontamentos Salvos</span><span className="text-xs text-gray-500">Listagem e filtros avançados</span></div>
               </button>
               <button onClick={() => { loadAdminRecords(); setStep(AppStep.ANALYSIS); setShowAnalysisResult(false); }} className="w-full flex items-center gap-4 p-5 bg-white rounded-2xl border border-gray-200 hover:bg-gray-50 transition-all text-left">
                 <div className="bg-orange-500 p-3 rounded-xl text-white shadow-md"><PieChart size={24} /></div>
                 <div><span className="block font-bold text-gray-900">Análise Inteligente (IA)</span><span className="text-xs text-gray-500">Dashboard de Performance Industrial</span></div>
               </button>
            </div>
          )}

          {step === AppStep.ANALYSIS && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 mb-4">
                 <button onClick={() => setStep(AppStep.GESTÃO_PRODUCAO)} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"><ArrowLeft size={16} /></button>
                 <h2 className="text-xl font-bold text-gray-800">Inteligência de Produção</h2>
              </div>

              {!showAnalysisResult ? (
                <div className="bg-gray-50 p-6 rounded-3xl border border-gray-200 space-y-6">
                  <h3 className="text-lg font-bold text-gray-700 flex items-center gap-2"><Sparkles className="text-orange-500" /> Configurar Análise</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">Operador</label>
                      <select value={analysisOperator} onChange={e => setAnalysisOperator(e.target.value)} className="w-full p-2.5 rounded-xl border border-gray-300 bg-white text-sm focus:ring-2 focus:ring-blue-500">
                        {operatorsList.map(op => <option key={op} value={op}>{op === 'ALL' ? 'Todos Operadores' : op}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">De (Data)</label>
                      <input type="date" value={analysisStartDate} onChange={e => setAnalysisStartDate(e.target.value)} className="w-full p-2.5 rounded-xl border border-gray-300 bg-white text-sm focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">Até (Data)</label>
                      <input type="date" value={analysisEndDate} onChange={e => setAnalysisEndDate(e.target.value)} className="w-full p-2.5 rounded-xl border border-gray-300 bg-white text-sm focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">Horas Disp./Dia</label>
                      <input type="number" value={availableHoursPerDay} onChange={e => setAvailableHoursPerDay(parseFloat(e.target.value))} className="w-full p-2.5 rounded-xl border border-gray-300 bg-white text-sm focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>
                  <button onClick={generateAnalysis} className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-blue-700 flex items-center justify-center gap-2 transition-all transform hover:scale-[1.01]">
                    <TrendingUp size={20} /> Processar Dados e Analisar
                  </button>
                </div>
              ) : (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  {/* Dashboard Metrics */}
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

                  {/* Charts */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                      <h4 className="text-sm font-bold text-gray-400 uppercase mb-4 tracking-widest">Produção Diária (Peças)</h4>
                      <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="date" axisLine={false} tickLine={false} />
                            <YAxis axisLine={false} tickLine={false} />
                            <Tooltip contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}} />
                            <Bar dataKey="quantity" name="Peças" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                      <h4 className="text-sm font-bold text-gray-400 uppercase mb-4 tracking-widest">Eficiência vs Horas Disponíveis</h4>
                      <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="date" axisLine={false} tickLine={false} />
                            <YAxis axisLine={false} tickLine={false} />
                            <Tooltip contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}} />
                            <Legend verticalAlign="top" height={36} />
                            <Bar dataKey="prodHours" name="Horas Reais" fill="#10B981" radius={[4, 4, 0, 0]} />
                            <Line type="monotone" dataKey="meta" name="Meta (H. Disp)" stroke="#EF4444" strokeWidth={3} dot={{ r: 4 }} />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  {/* IA Analysis Result */}
                  <div className="bg-white rounded-3xl border border-orange-100 overflow-hidden shadow-xl shadow-orange-50">
                    <div className="bg-orange-500 p-4 flex justify-between items-center text-white">
                      <span className="font-bold flex items-center gap-2"><Sparkles size={18} /> Análise Estratégica Gemini</span>
                      <button onClick={() => setAnalysis('')} className="text-xs bg-white/20 px-3 py-1 rounded-full font-bold hover:bg-white/30 transition-colors">Recalcular</button>
                    </div>
                    <div className="p-8">
                      {isAnalyzing ? (
                        <div className="flex flex-col items-center justify-center py-12 space-y-4">
                          <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                          <p className="text-gray-500 font-medium animate-pulse">Sintetizando insights industriais...</p>
                        </div>
                      ) : (
                        <div className="prose prose-blue max-w-none text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
                          {analysis || "Clique em 'Processar Dados e Analisar' para gerar o relatório de IA."}
                        </div>
                      )}
                    </div>
                  </div>
                  <button onClick={() => setShowAnalysisResult(false)} className="w-full text-gray-400 text-sm font-bold hover:text-blue-600 transition-colors py-4">Alterar Filtros da Análise</button>
                </div>
              )}
            </div>
          )}

          {step === AppStep.SAVED_RECORDS && (
            <div className="space-y-6">
               <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
                 <div className="flex items-center gap-2">
                    <button onClick={() => setStep(AppStep.GESTÃO_PRODUCAO)} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"><ArrowLeft size={16} /></button>
                    <h2 className="text-xl font-bold text-gray-800">Histórico de Apontamentos</h2>
                 </div>
                 <button onClick={exportToExcel} className="bg-green-600 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 text-sm font-bold shadow-lg hover:bg-green-700 transition-colors transform active:scale-95"><Download size={16} /> Exportar Excel</button>
               </div>

               {/* Filtros Avançados Tabela */}
               <div className="bg-gray-50 p-4 rounded-3xl border border-gray-200 space-y-4 shadow-inner">
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                      <input type="text" placeholder="Filtrar por OP, Máquina..." value={filterText} onChange={e => setFilterText(e.target.value)} className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-300 rounded-xl outline-none text-sm focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div className="flex items-center gap-2 bg-white px-3 py-1 rounded-xl border border-gray-300">
                      <Calendar size={14} className="text-gray-400" />
                      <span className="text-[10px] font-bold text-gray-400 uppercase">De</span>
                      <input type="date" value={tableStartDate} onChange={e => setTableStartDate(e.target.value)} className="text-xs border-none outline-none flex-1" />
                    </div>
                    <div className="flex items-center gap-2 bg-white px-3 py-1 rounded-xl border border-gray-300">
                      <Calendar size={14} className="text-gray-400" />
                      <span className="text-[10px] font-bold text-gray-400 uppercase">Até</span>
                      <input type="date" value={tableEndDate} onChange={e => setTableEndDate(e.target.value)} className="text-xs border-none outline-none flex-1" />
                    </div>
                 </div>
                 <div className="flex justify-between items-center px-1">
                    <button onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')} className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2 hover:text-blue-600 transition-colors">
                      <ArrowUpDown size={12} /> Ordenar por Data: {sortOrder === 'desc' ? 'Mais recente' : 'Mais antigo'}
                    </button>
                    {(tableStartDate || tableEndDate || filterText) && (
                      <button onClick={() => {setTableStartDate(''); setTableEndDate(''); setFilterText('');}} className="text-[10px] font-bold text-red-500 uppercase hover:underline">Limpar Filtros</button>
                    )}
                 </div>
               </div>

               <div className="overflow-x-auto rounded-3xl border border-gray-200 shadow-sm">
                 <table className="w-full text-left text-sm border-collapse">
                   <thead className="bg-gray-100 text-gray-500 font-bold uppercase text-[10px] tracking-widest border-b border-gray-200">
                     <tr><th className="px-6 py-5">Data/Hora</th><th className="px-6 py-5">Equipamento</th><th className="px-6 py-5">OP/CP</th><th className="px-6 py-5 text-center">Qtde</th><th className="px-6 py-5">Duração Real</th></tr>
                   </thead>
                   <tbody className="divide-y divide-gray-100 bg-white">
                     {loading ? (<tr><td colSpan={5} className="text-center py-24 text-gray-400 animate-pulse font-medium">Sincronizando registros...</td></tr>) : 
                      filteredAndSortedRecords.length === 0 ? (<tr><td colSpan={5} className="text-center py-24 text-gray-400 italic">Nenhum registro encontrado para este filtro.</td></tr>) :
                      filteredAndSortedRecords.map(r => (
                       <tr key={r.id} className="hover:bg-blue-50/50 transition-colors group">
                         <td className="px-6 py-4">
                           <div className="font-bold text-gray-900">{format(r.startTime, 'dd/MM/yy', { locale: ptBR })}</div>
                           <div className="text-[10px] text-gray-400 font-medium">{format(r.startTime, 'HH:mm')}</div>
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

          {/* ... Outros passos (IDENTIFICATION, DETAILS, TIMER, SUMMARY, COMPLETED) permanecem idênticos ... */}
          {step === AppStep.IDENTIFICATION && (
            <div className="space-y-6">
              <h2 className="text-lg font-bold text-gray-800">Passo 1: Identificação</h2>
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1">Máquina / Linha</label>
                <select value={prodData.maquina} onChange={e => setProdData(prev => ({ ...prev, maquina: e.target.value }))} className="w-full p-3 rounded-xl border border-gray-200 bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none">
                  <option value="">Selecione...</option>
                  <option>Romi D1000</option><option>Veker Mvk 1050</option><option>Torno Cnc Cosmos</option><option>Torno Convencional</option><option>Torno Mascote</option><option>Fresadora Ferramenteira</option>
                </select>
              </div>
              <button onClick={() => prodData.maquina ? setStep(AppStep.DETAILS) : setError('Selecione a máquina.')} className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl shadow-lg hover:bg-blue-700 transition-all">Prosseguir</button>
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
                <button onClick={() => startProduction('direct')} className="flex-1 bg-blue-600 text-white font-bold py-3 rounded-xl text-sm shadow-md hover:bg-blue-700 transition-colors">Direto</button>
              </div>
              <button onClick={() => setStep(AppStep.IDENTIFICATION)} className="w-full text-gray-400 text-sm font-bold">Voltar</button>
            </div>
          )}

          {step === AppStep.TIMER && (
            <div className="space-y-6 text-center">
              <h2 className="text-xl font-bold text-gray-800">{isSetupMode ? 'Setup em Andamento' : 'Produção em Andamento'}</h2>
              <div className="bg-gray-900 text-green-400 p-8 rounded-3xl font-mono text-5xl border-4 border-gray-800 shadow-2xl tracking-tighter">{formatDuration(timer)}</div>
              <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 text-left text-xs text-blue-800 font-medium">
                Em execução na <span className="font-bold underline">{prodData.maquina}</span> para a <span className="font-bold underline">OP {prodData.op}</span>.
              </div>
              {isSetupMode ? (
                <button onClick={finishSetupAndStartProd} className="w-full bg-green-600 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg hover:bg-green-700"><Play size={20} /> Concluir Setup & Produzir</button>
              ) : (
                <button onClick={finishProduction} className="w-full bg-red-600 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg hover:bg-red-700"><Square size={20} /> Finalizar Ciclo</button>
              )}
            </div>
          )}

          {step === AppStep.SUMMARY && (
            <div className="space-y-6">
              <h2 className="text-lg font-bold text-gray-800">Finalizar Apontamento</h2>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-widest">Quantidade Produzida</label>
                <input type="number" value={prodData.quantity} onChange={e => setProdData(prev => ({ ...prev, quantity: parseInt(e.target.value) || 0 }))} className="w-full p-4 rounded-xl border border-gray-200 bg-gray-50 text-xl font-black text-blue-600 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="0" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-widest">Observações do Turno</label>
                <textarea value={prodData.observation} onChange={e => setProdData(prev => ({ ...prev, observation: e.target.value }))} className="w-full p-3 rounded-xl border border-gray-200 bg-gray-50 h-24 text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ocorrências, pausas ou detalhes técnicos..." />
              </div>
              <button onClick={saveRecord} disabled={loading} className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-blue-700 active:scale-[0.98] transition-all">{loading ? 'Transmitindo dados...' : 'Confirmar e Gravar Apontamento'}</button>
            </div>
          )}

          {step === AppStep.COMPLETED && (
            <div className="text-center py-10 space-y-6 animate-in zoom-in duration-300">
              <div className="bg-green-100 p-8 rounded-full inline-block text-green-600 shadow-inner"><CheckCircle2 size={70} /></div>
              <h2 className="text-3xl font-black text-gray-800">Registrado!</h2>
              <p className="text-gray-500 font-medium">Os dados foram sincronizados com sucesso no banco de dados da IMEK.</p>
              <button onClick={() => { setProdData({ maquina: prodData.maquina, operador: user?.username }); setProductionStartTime(null); setProductionEndTime(null); sessionStorage.removeItem('imek_start_time'); setStep(user?.role === UserRole.ADMIN ? AppStep.ADMIN_MENU : AppStep.IDENTIFICATION); }} className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl shadow-xl hover:bg-blue-700 transition-all">Iniciar Novo Apontamento</button>
            </div>
          )}
        </div>
      </div>
      <button id="install-btn" className="mt-8 text-[10px] uppercase tracking-widest text-gray-400 font-black hover:text-blue-600 transition-all">Instalar Aplicativo de Produção (PWA)</button>
    </div>
  );
};

export default App;
