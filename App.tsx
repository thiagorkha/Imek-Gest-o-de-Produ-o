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
  HardHat,
  Sparkles
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
// Fix: Import GoogleGenAI according to latest SDK standards
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

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
  const [analysis, setAnalysis] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

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

  // ESTADO CRÍTICO: Marco temporal isolado para garantir integridade do startTime
  const [productionStartTime, setProductionStartTime] = useState<number | null>(null);
  const [productionEndTime, setProductionEndTime] = useState<number | null>(null);
  
  const [isSetupMode, setIsSetupMode] = useState(true);
  const [timerStartTime, setTimerStartTime] = useState<number | null>(null);
  const [timer, setTimer] = useState(0);

  // Timer logic for visual feedback
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
    
    // Captura do marco inicial absoluto da atividade
    setProductionStartTime(now);
    
    setIsSetupMode(mode === 'setup');
    setTimerStartTime(now);
    setTimer(0);
    
    setStep(AppStep.TIMER);
  };

  const finishSetupAndStartProd = () => {
    const now = Date.now();
    // Armazena quanto tempo durou o setup
    setProdData(prev => ({ ...prev, setupDurationSeconds: timer }));
    
    // Reinicia o cronômetro para a fase de produção, mas o productionStartTime inicial é preservado
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
    // Validação de segurança final - Se productionStartTime for nulo, algo deu errado no fluxo
    if (!productionStartTime) {
      setError('Erro crítico: Horário de início não capturado. Por favor, reinicie o processo.');
      return;
    }

    setLoading(true);
    try {
      const finalRecord: ProductionRecord = {
        operador: user?.username || '',
        maquina: prodData.maquina || '',
        op: prodData.op || '',
        cp: prodData.cp || '',
        startTime: productionStartTime, // Usa o estado blindado
        endTime: productionEndTime || Date.now(),
        durationSeconds: prodData.durationSeconds || 0,
        setupDurationSeconds: prodData.setupDurationSeconds || 0,
        quantity: prodData.quantity || 0,
        observation: prodData.observation || '',
        timestamp: Date.now()
      };
      await firebaseService.saveRecord(finalRecord);
      setStep(AppStep.COMPLETED);
    } catch (err) {
      setError('Erro ao salvar registro no banco de dados.');
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

  // Refined: Implementation of Gemini analysis adhering to high-standard guidelines
  const generateAnalysis = async () => {
    setIsAnalyzing(true);
    setError('');
    setAnalysis('');
    try {
      let currentRecords = records;
      if (currentRecords.length === 0) {
        currentRecords = await firebaseService.getAllRecords();
        setRecords(currentRecords);
      }

      if (currentRecords.length === 0) {
        setError('Dados insuficientes para análise.');
        setIsAnalyzing(false);
        return;
      }

      // Fix: Create instance right before usage and use systemInstruction for better guidance
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: JSON.stringify(currentRecords.slice(0, 50)),
        config: { 
          systemInstruction: "Você é um consultor sênior de eficiência industrial da IMEK. Sua tarefa é analisar os dados de produção fornecidos e gerar um relatório executivo em Markdown. Identifique padrões de atraso, performance por máquina e sugira otimizações.",
          temperature: 0.7 
        }
      });

      // Fix: Access response text via the .text property (getter)
      if (response.text) {
        setAnalysis(response.text.trim());
      } else {
        setError('Falha ao gerar insights.');
      }
    } catch (err: any) {
      setError(`Erro na IA: ${err.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

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
    result.sort((a, b) => sortOrder === 'desc' ? b.timestamp - a.timestamp : a.timestamp - b.timestamp);
    return result;
  }, [records, filterText, sortOrder]);

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
      <div className={`w-full ${[AppStep.SAVED_RECORDS, AppStep.ANALYSIS].includes(step) ? 'max-w-4xl' : 'max-w-md'} bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100 glass-panel transition-all duration-300`}>
        
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
                <input 
                  type="text" 
                  value={username} 
                  onChange={e => setUsername(e.target.value)}
                  className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 bg-gray-50 outline-none"
                  placeholder="Seu nome"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Senha</label>
                <input 
                  type="password" 
                  value={password} 
                  onChange={e => setPassword(e.target.value)}
                  className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 bg-gray-50 outline-none"
                  placeholder="Sua senha"
                  required
                />
              </div>
              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-100 flex items-center justify-center gap-2"
              >
                {loading ? 'Autenticando...' : <><LogIn size={18} /> Entrar</>}
              </button>
              <button 
                type="button"
                onClick={() => setStep(AppStep.REGISTER)}
                className="w-full text-blue-600 text-sm font-bold flex items-center justify-center gap-2"
              >
                <UserPlus size={16} /> Novo Cadastro
              </button>
            </form>
          )}

          {step === AppStep.REGISTER && (
            <form onSubmit={handleRegister} className="space-y-4">
              <h2 className="text-lg font-bold text-center mb-4">Cadastro de Operador</h2>
              <input 
                type="text" 
                value={username} 
                onChange={e => setUsername(e.target.value)}
                className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 bg-gray-50"
                placeholder="Nome de Usuário"
                required
              />
              <input 
                type="password" 
                value={password} 
                onChange={e => setPassword(e.target.value)}
                className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 bg-gray-50"
                placeholder="Defina sua Senha"
                required
              />
              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-green-600 text-white font-bold py-3 rounded-xl hover:bg-green-700 transition-colors"
              >
                {loading ? 'Processando...' : 'Confirmar Cadastro'}
              </button>
              <button type="button" onClick={() => setStep(AppStep.LOGIN)} className="w-full text-gray-500 text-sm font-bold">Voltar</button>
            </form>
          )}

          {step === AppStep.ADMIN_MENU && (
            <div className="space-y-4">
               <h2 className="text-xl font-bold text-gray-800 text-center mb-4">Portal do Administrador</h2>
               <button 
                onClick={() => setStep(AppStep.IDENTIFICATION)}
                className="w-full flex items-center gap-4 p-5 bg-blue-50 rounded-2xl border border-blue-100 hover:bg-blue-100 transition-all text-left"
               >
                 <div className="bg-blue-600 p-3 rounded-xl text-white shadow-md">
                   <ClipboardCheck size={24} />
                 </div>
                 <div>
                   <span className="block font-bold text-blue-900">Apontamento de Produção</span>
                   <span className="text-xs text-blue-700">Registrar novas atividades</span>
                 </div>
               </button>
               <button 
                onClick={() => setStep(AppStep.GESTÃO_PRODUCAO)}
                className="w-full flex items-center gap-4 p-5 bg-indigo-50 rounded-2xl border border-indigo-100 hover:bg-indigo-100 transition-all text-left"
               >
                 <div className="bg-indigo-600 p-3 rounded-xl text-white shadow-md">
                   <LayoutDashboard size={24} />
                 </div>
                 <div>
                   <span className="block font-bold text-indigo-900">Gestão de Produção</span>
                   <span className="text-xs text-indigo-700">Relatórios e Consultas</span>
                 </div>
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
               <button 
                onClick={() => { loadAdminRecords(); setStep(AppStep.SAVED_RECORDS); }}
                className="w-full flex items-center gap-4 p-5 bg-white rounded-2xl border border-gray-200 hover:bg-gray-50 transition-all text-left"
               >
                 <div className="bg-green-600 p-3 rounded-xl text-white shadow-md"><FileSpreadsheet size={24} /></div>
                 <div><span className="block font-bold text-gray-900">Apontamentos Salvos</span><span className="text-xs text-gray-500">Listagem e filtros</span></div>
               </button>
               <button 
                onClick={() => { loadAdminRecords(); setStep(AppStep.ANALYSIS); }}
                className="w-full flex items-center gap-4 p-5 bg-white rounded-2xl border border-gray-200 hover:bg-gray-50 transition-all text-left"
               >
                 <div className="bg-orange-500 p-3 rounded-xl text-white shadow-md"><PieChart size={24} /></div>
                 <div><span className="block font-bold text-gray-900">Análise Inteligente (IA)</span><span className="text-xs text-gray-500">Insights avançados</span></div>
               </button>
            </div>
          )}

          {step === AppStep.ANALYSIS && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 mb-4">
                 <button onClick={() => setStep(AppStep.GESTÃO_PRODUCAO)} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"><ArrowLeft size={16} /></button>
                 <h2 className="text-xl font-bold text-gray-800">Análise de Produção</h2>
              </div>
              {!analysis && !isAnalyzing ? (
                <div className="text-center py-12 space-y-6">
                  <div className="bg-orange-100 p-8 rounded-full inline-block text-orange-600 mb-4 shadow-inner"><Sparkles size={60} className="animate-pulse" /></div>
                  <h2 className="text-2xl font-black text-gray-900">Relatório Estratégico</h2>
                  <p className="text-gray-600 px-8">O Gemini analisará seus registros para identificar gargalos.</p>
                  <button onClick={generateAnalysis} className="w-full bg-orange-600 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-orange-700 flex items-center justify-center gap-2"><Play size={18} /> Gerar Análise</button>
                </div>
              ) : isAnalyzing ? (
                <div className="text-center py-20 space-y-4">
                  <div className="w-16 h-16 border-4 border-orange-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                  <p className="text-gray-900 font-bold animate-pulse">Gemini está processando seus dados...</p>
                </div>
              ) : (
                <div className="bg-white rounded-3xl border border-gray-200 overflow-hidden shadow-lg">
                   <div className="bg-orange-50 p-4 border-b border-orange-100 flex justify-between items-center">
                     <span className="text-orange-900 font-bold text-sm flex items-center gap-2"><Sparkles size={16} /> Relatório IA</span>
                     <button onClick={() => setAnalysis('')} className="text-xs text-orange-600 font-bold hover:underline">Novo</button>
                   </div>
                   <div className="p-6 prose prose-sm max-w-none text-gray-800 whitespace-pre-wrap font-sans leading-relaxed">{analysis}</div>
                </div>
              )}
              <button onClick={() => setStep(AppStep.GESTÃO_PRODUCAO)} className="w-full text-gray-400 text-sm font-bold flex items-center justify-center gap-2 py-4">Voltar</button>
            </div>
          )}

          {step === AppStep.SAVED_RECORDS && (
            <div className="space-y-6">
               <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
                 <div className="flex items-center gap-2">
                    <button onClick={() => setStep(AppStep.GESTÃO_PRODUCAO)} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"><ArrowLeft size={16} /></button>
                    <h2 className="text-xl font-bold text-gray-800">Registros</h2>
                 </div>
                 <button onClick={exportToExcel} className="bg-green-600 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 text-sm font-bold shadow-lg hover:bg-green-700 transition-colors"><Download size={16} /> Excel</button>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input type="text" placeholder="Filtrar..." value={filterText} onChange={e => setFilterText(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none text-sm" />
                  </div>
                  <button onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')} className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-600">Data: {sortOrder === 'desc' ? 'Desc' : 'Asc'}</button>
               </div>
               <div className="overflow-x-auto rounded-2xl border border-gray-100">
                 <table className="w-full text-left text-sm">
                   <thead className="bg-gray-50 text-gray-600 font-bold uppercase text-[10px]">
                     <tr><th className="px-6 py-4">Data/Hora</th><th className="px-6 py-4">Máquina</th><th className="px-6 py-4">OP/CP</th><th className="px-6 py-4 text-center">Qtde</th><th className="px-6 py-4">Duração</th></tr>
                   </thead>
                   <tbody className="divide-y divide-gray-100">
                     {loading ? (<tr><td colSpan={5} className="text-center py-16 text-gray-500">Buscando...</td></tr>) : filteredAndSortedRecords.map(r => (
                       <tr key={r.id} className="hover:bg-blue-50/30 transition-colors">
                         <td className="px-6 py-4"><div className="font-bold text-gray-900">{format(r.startTime, 'dd/MM/yy', { locale: ptBR })}</div><div className="text-[10px] text-gray-400">{format(r.startTime, 'HH:mm')}</div></td>
                         <td className="px-6 py-4 text-gray-700">{r.maquina}</td>
                         <td className="px-6 py-4"><div className="text-blue-600 font-bold">{r.op}</div><div className="text-[10px] text-gray-400">{r.cp}</div></td>
                         <td className="px-6 py-4 text-center font-black text-lg">{r.quantity}</td>
                         <td className="px-6 py-4"><div className="text-green-600 font-bold">{formatDuration(r.durationSeconds)}</div><div className="text-[10px] text-gray-400">{formatDuration(r.setupDurationSeconds)} (setup)</div></td>
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
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1">Máquina / Linha</label>
                <select value={prodData.maquina} onChange={e => setProdData(prev => ({ ...prev, maquina: e.target.value }))} className="w-full p-3 rounded-xl border border-gray-200 bg-gray-50">
                  <option value="">Selecione...</option>
                  <option>Romi D1000</option><option>Veker Mvk 1050</option><option>Torno Cnc Cosmos</option><option>Torno Convencional</option><option>Torno Mascote</option><option>Fresadora Ferramenteira</option>
                </select>
              </div>
              <button onClick={() => prodData.maquina ? setStep(AppStep.DETAILS) : setError('Selecione a máquina.')} className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl">Prosseguir</button>
            </div>
          )}

          {step === AppStep.DETAILS && (
            <div className="space-y-6">
              <h2 className="text-lg font-bold text-gray-800">Passo 2: Detalhes</h2>
              <div className="space-y-4">
                <input type="text" value={prodData.op} onChange={e => setProdData(prev => ({ ...prev, op: e.target.value }))} className="w-full p-3 rounded-xl border border-gray-200 bg-gray-50" placeholder="OP" />
                <input type="text" value={prodData.cp} onChange={e => setProdData(prev => ({ ...prev, cp: e.target.value }))} className="w-full p-3 rounded-xl border border-gray-200 bg-gray-50" placeholder="CP" />
              </div>
              <div className="flex gap-3">
                <button onClick={() => startProduction('setup')} className="flex-1 bg-green-600 text-white font-bold py-3 rounded-xl text-sm">Setup</button>
                <button onClick={() => startProduction('direct')} className="flex-1 bg-blue-600 text-white font-bold py-3 rounded-xl text-sm">Direto</button>
              </div>
              <button onClick={() => setStep(AppStep.IDENTIFICATION)} className="w-full text-gray-400 text-sm font-bold">Voltar</button>
            </div>
          )}

          {step === AppStep.TIMER && (
            <div className="space-y-6 text-center">
              <h2 className="text-xl font-bold text-gray-800">{isSetupMode ? 'Setup em Andamento' : 'Produção em Andamento'}</h2>
              <div className="bg-gray-900 text-green-400 p-8 rounded-3xl font-mono text-4xl border-4 border-gray-800">{formatDuration(timer)}</div>
              {isSetupMode ? (
                <button onClick={finishSetupAndStartProd} className="w-full bg-green-600 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg"><Play size={20} /> Concluir Setup</button>
              ) : (
                <button onClick={finishProduction} className="w-full bg-red-600 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg"><Square size={20} /> Finalizar</button>
              )}
            </div>
          )}

          {step === AppStep.SUMMARY && (
            <div className="space-y-6">
              <h2 className="text-lg font-bold text-gray-800">Finalizar Apontamento</h2>
              <input type="number" value={prodData.quantity} onChange={e => setProdData(prev => ({ ...prev, quantity: parseInt(e.target.value) || 0 }))} className="w-full p-3 rounded-xl border border-gray-200 bg-gray-50" placeholder="Quantidade Produzida" />
              <textarea value={prodData.observation} onChange={e => setProdData(prev => ({ ...prev, observation: e.target.value }))} className="w-full p-3 rounded-xl border border-gray-200 bg-gray-50 h-24 text-sm" placeholder="Observações..." />
              <button onClick={saveRecord} disabled={loading} className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl shadow-lg">{loading ? 'Salvando...' : 'Confirmar e Gravar'}</button>
            </div>
          )}

          {step === AppStep.COMPLETED && (
            <div className="text-center py-6 space-y-6">
              <div className="bg-green-100 p-6 rounded-full inline-block text-green-600 animate-bounce"><CheckCircle2 size={60} /></div>
              <h2 className="text-3xl font-extrabold text-gray-800">Sucesso!</h2>
              <button onClick={() => { setProdData({ maquina: prodData.maquina, operador: user?.username }); setProductionStartTime(null); setProductionEndTime(null); setStep(user?.role === UserRole.ADMIN ? AppStep.ADMIN_MENU : AppStep.IDENTIFICATION); }} className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl">Novo Apontamento</button>
            </div>
          )}
        </div>
      </div>
      <button id="install-btn" className="mt-8 text-[10px] uppercase tracking-widest text-gray-400 font-black hover:text-blue-600 transition-all">Instalar Aplicativo (PWA)</button>
    </div>
  );
};

export default App;