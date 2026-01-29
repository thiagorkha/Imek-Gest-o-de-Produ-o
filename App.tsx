
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
// Fix: Use correct import for GoogleGenAI as per strict guidelines
import { GoogleGenAI } from "@google/genai";

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [step, setStep] = useState<AppStep>(AppStep.LOGIN);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [records, setRecords] = useState<ProductionRecord[]>([]);
  const [filterText, setFilterText] = useState('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  const [analysis, setAnalysis] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const [prodData, setProdData] = useState<Partial<ProductionRecord>>({
    maquina: '',
    op: '',
    cp: '',
    durationSeconds: 0,
    setupDurationSeconds: 0,
    quantity: 0,
    observation: '',
    startTime: 0 // Inicializado explicitamente
  });
  
  const [isSetupMode, setIsSetupMode] = useState(true);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [timer, setTimer] = useState(0);

  useEffect(() => {
    let interval: any;
    if (startTime) {
      interval = setInterval(() => {
        setTimer(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [startTime]);

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
      setError('Preencha OP e CP.');
      return;
    }
    setError('');
    const now = Date.now();
    
    setIsSetupMode(mode === 'setup');
    setStartTime(now);
    setTimer(0);
    
    // Captura o momento exato do clique inicial e salva permanentemente no estado do registro
    setProdData(prev => ({ 
      ...prev, 
      startTime: now,
      setupDurationSeconds: 0,
      durationSeconds: 0
    }));
    
    setStep(AppStep.TIMER);
  };

  const finishSetupAndStartProd = () => {
    const now = Date.now();
    // Salva a duração do setup mas mantém o startTime original do clique lá no Passo 2
    setProdData(prev => ({ 
      ...prev, 
      setupDurationSeconds: timer
    }));
    // Reinicia o cronômetro visual para a fase de produção real
    setStartTime(now);
    setTimer(0);
    setIsSetupMode(false);
  };

  const finishProduction = () => {
    const now = Date.now();
    setProdData(prev => ({ 
      ...prev, 
      durationSeconds: timer, 
      endTime: now 
    }));
    setStartTime(null);
    setStep(AppStep.SUMMARY);
  };

  const saveRecord = async () => {
    if (!prodData.startTime) {
      setError('Erro de integridade de dados: horário de início não detectado.');
      return;
    }

    setLoading(true);
    try {
      const finalRecord: ProductionRecord = {
        operador: user?.username || '',
        maquina: prodData.maquina || '',
        op: prodData.op || '',
        cp: prodData.cp || '',
        startTime: prodData.startTime, // Usa o valor capturado exatamente no clique
        endTime: prodData.endTime || Date.now(),
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
        setError('Não há registros suficientes para realizar uma análise.');
        setIsAnalyzing(false);
        return;
      }

      // Fix: Follow guidelines by creating the instance right before the call and using correct model
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `Você é um consultor sênior de produtividade industrial especializado em otimização de linhas de produção.
        Analise os seguintes registros de produção da empresa IMEK SLEEVE e gere um relatório técnico em Markdown.
        
        Sua análise deve conter:
        1. Desempenho Operacional: Resumo da produtividade atual.
        2. Eficiência de Setup: Identificação de tempos de preparação excessivos.
        3. Gargalos e Ineficiências: Onde a produção está perdendo tempo.
        4. Sugestões de Otimização: 3 recomendações concretas para melhorar os processos.
        
        Dados de Produção:
        ${JSON.stringify(currentRecords.slice(0, 50), null, 2)}`,
        config: {
          temperature: 0.7,
        }
      });

      // Fix: Extract text directly from response property as per guidelines
      if (response.text) {
        setAnalysis(response.text);
      } else {
        setError('A IA não conseguiu gerar insights no momento.');
      }
    } catch (err: any) {
      console.error("Erro na análise IA:", err);
      setError(`Falha ao conectar com o serviço de IA: ${err.message}`);
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

    result.sort((a, b) => {
      return sortOrder === 'desc' 
        ? b.timestamp - a.timestamp 
        : a.timestamp - b.timestamp;
    });

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
              <button 
                type="button"
                onClick={() => setStep(AppStep.LOGIN)}
                className="w-full text-gray-500 text-sm font-bold"
              >
                Voltar
              </button>
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

               <button 
                 onClick={() => {setUser(null); setStep(AppStep.LOGIN)}} 
                 className="w-full mt-4 flex items-center justify-center gap-2 text-gray-500 font-bold hover:text-red-500 transition-colors"
               >
                 <LogOut size={16} /> Sair
               </button>
            </div>
          )}

          {step === AppStep.GESTÃO_PRODUCAO && (
            <div className="space-y-4">
               <div className="flex items-center gap-2 mb-4">
                 <button onClick={() => setStep(AppStep.ADMIN_MENU)} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors">
                    <ArrowLeft size={16} />
                 </button>
                 <h2 className="text-xl font-bold text-gray-800">Módulo de Gestão</h2>
               </div>

               <button 
                onClick={() => { loadAdminRecords(); setStep(AppStep.SAVED_RECORDS); }}
                className="w-full flex items-center gap-4 p-5 bg-white rounded-2xl border border-gray-200 hover:bg-gray-50 transition-all text-left"
               >
                 <div className="bg-green-600 p-3 rounded-xl text-white shadow-md">
                   <FileSpreadsheet size={24} />
                 </div>
                 <div>
                   <span className="block font-bold text-gray-900">Apontamentos Salvos</span>
                   <span className="text-xs text-gray-500">Listagem detalhada e filtros</span>
                 </div>
               </button>

               <button 
                onClick={() => { loadAdminRecords(); setStep(AppStep.ANALYSIS); }}
                className="w-full flex items-center gap-4 p-5 bg-white rounded-2xl border border-gray-200 hover:bg-gray-50 transition-all text-left"
               >
                 <div className="bg-orange-500 p-3 rounded-xl text-white shadow-md">
                   <PieChart size={24} />
                 </div>
                 <div>
                   <span className="block font-bold text-gray-900">Análise Inteligente (IA)</span>
                   <span className="text-xs text-gray-500">Insights avançados do Gemini</span>
                 </div>
               </button>
            </div>
          )}

          {step === AppStep.ANALYSIS && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 mb-4">
                 <button onClick={() => setStep(AppStep.GESTÃO_PRODUCAO)} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors">
                    <ArrowLeft size={16} />
                 </button>
                 <h2 className="text-xl font-bold text-gray-800">Análise de Produção com IA</h2>
              </div>

              {!analysis && !isAnalyzing ? (
                <div className="text-center py-12 space-y-6">
                  <div className="bg-orange-100 p-8 rounded-full inline-block text-orange-600 mb-4 shadow-inner">
                    <Sparkles size={60} className="animate-pulse" />
                  </div>
                  <h2 className="text-2xl font-black text-gray-900">Relatório Estratégico</h2>
                  <p className="text-gray-600 px-8">O Gemini analisará seus registros de produção para identificar gargalos e oportunidades de otimização automática.</p>
                  <button 
                    onClick={generateAnalysis}
                    className="w-full bg-orange-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-orange-100 hover:bg-orange-700 transition-all flex items-center justify-center gap-2"
                  >
                    <Play size={18} /> Gerar Análise Agora
                  </button>
                </div>
              ) : isAnalyzing ? (
                <div className="text-center py-20 space-y-4">
                  <div className="w-16 h-16 border-4 border-orange-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                  <p className="text-gray-900 font-bold animate-pulse">Gemini está processando seus dados industriais...</p>
                  <p className="text-xs text-gray-400">Extraindo insights de performance e setup.</p>
                </div>
              ) : (
                <div className="bg-white rounded-3xl border border-gray-200 overflow-hidden shadow-lg">
                   <div className="bg-orange-50 p-4 border-b border-orange-100 flex justify-between items-center">
                     <span className="text-orange-900 font-bold text-sm flex items-center gap-2">
                       <Sparkles size={16} /> Relatório Gerado pela IA
                     </span>
                     <button onClick={() => setAnalysis('')} className="text-xs text-orange-600 font-bold hover:underline">Novo Relatório</button>
                   </div>
                   <div className="p-6 prose prose-sm max-w-none text-gray-800 whitespace-pre-wrap font-sans leading-relaxed bg-gray-50/20">
                     {analysis}
                   </div>
                </div>
              )}

              <button 
                onClick={() => setStep(AppStep.GESTÃO_PRODUCAO)}
                className="w-full text-gray-400 text-sm font-bold flex items-center justify-center gap-2 py-4"
              >
                Voltar para Gestão
              </button>
            </div>
          )}

          {step === AppStep.SAVED_RECORDS && (
            <div className="space-y-6">
               <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
                 <div className="flex items-center gap-2">
                    <button onClick={() => setStep(AppStep.GESTÃO_PRODUCAO)} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors">
                      <ArrowLeft size={16} />
                    </button>
                    <h2 className="text-xl font-bold text-gray-800">Registros de Produção</h2>
                 </div>
                 <button 
                  onClick={exportToExcel}
                  className="bg-green-600 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 text-sm font-bold shadow-lg shadow-green-100 hover:bg-green-700 transition-colors"
                 >
                   <Download size={16} /> Exportar Excel
                 </button>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input 
                      type="text"
                      placeholder="Filtrar por OP, Máquina ou Operador..."
                      value={filterText}
                      onChange={e => setFilterText(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                    />
                  </div>
                  <button 
                    onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    <ArrowUpDown size={16} />
                    Data: {sortOrder === 'desc' ? 'Mais recente' : 'Mais antigo'}
                  </button>
               </div>
               
               <div className="overflow-x-auto rounded-2xl border border-gray-100 shadow-sm">
                 <table className="w-full text-left text-sm">
                   <thead className="bg-gray-50 text-gray-600 font-bold uppercase tracking-wider text-[10px]">
                     <tr>
                       <th className="px-6 py-4">Data / Hora</th>
                       <th className="px-6 py-4">Equipamento</th>
                       <th className="px-6 py-4">OP / CP</th>
                       <th className="px-6 py-4 text-center">Quantidade</th>
                       <th className="px-6 py-4">Duração</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-gray-100">
                     {loading ? (
                        <tr><td colSpan={5} className="text-center py-16 text-gray-500">Sincronizando com banco de dados...</td></tr>
                     ) : filteredAndSortedRecords.length === 0 ? (
                        <tr><td colSpan={5} className="text-center py-16 text-gray-400 font-medium">Nenhum registro encontrado para os filtros aplicados.</td></tr>
                     ) : filteredAndSortedRecords.map(r => (
                       <tr key={r.id} className="hover:bg-blue-50/30 transition-colors">
                         <td className="px-6 py-4">
                           <div className="font-bold text-gray-900">{format(r.timestamp, 'dd/MM/yy', { locale: ptBR })}</div>
                           <div className="text-[10px] text-gray-400">{format(r.timestamp, 'HH:mm')}</div>
                         </td>
                         <td className="px-6 py-4 text-gray-700 font-medium">{r.maquina}</td>
                         <td className="px-6 py-4">
                           <div className="text-blue-600 font-bold">{r.op}</div>
                           <div className="text-[10px] text-gray-400">{r.cp}</div>
                         </td>
                         <td className="px-6 py-4 text-center font-black text-gray-900 text-lg">{r.quantity}</td>
                         <td className="px-6 py-4">
                           <div className="flex items-center gap-1 text-green-600 font-bold"><Play size={10} /> {formatDuration(r.durationSeconds)}</div>
                           <div className="flex items-center gap-1 text-gray-400 text-[10px]"><Square size={10} /> {formatDuration(r.setupDurationSeconds)} (setup)</div>
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
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <ClipboardCheck className="text-blue-600" /> Passo 1: Identificação
              </h2>
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1">Máquina / Linha</label>
                <select 
                  value={prodData.maquina} 
                  onChange={e => setProdData({...prodData, maquina: e.target.value})}
                  className="w-full p-3 rounded-xl border border-gray-200 bg-gray-50"
                >
                  <option value="">Selecione...</option>
                  <option>Romi D1000</option>
                  <option>Veker Mvk 1050</option>
                  <option>Torno Cnc Cosmos</option>
                  <option>Torno Convencional</option>
                  <option>Torno Mascote</option>
                  <option>Fresadora Ferramenteira</option>
                </select>
              </div>
              <button 
                onClick={() => prodData.maquina ? setStep(AppStep.DETAILS) : setError('Selecione a máquina.')}
                className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl"
              >
                Prosseguir
              </button>
              {user?.role === UserRole.ADMIN && (
                <button onClick={() => setStep(AppStep.ADMIN_MENU)} className="w-full text-gray-400 text-sm font-bold mt-2">Voltar ao Menu Admin</button>
              )}
            </div>
          )}

          {step === AppStep.DETAILS && (
            <div className="space-y-6">
              <h2 className="text-lg font-bold text-gray-800">Passo 2: Detalhes da Produção</h2>
              <div className="space-y-4">
                <input 
                  type="text" 
                  value={prodData.op} 
                  onChange={e => setProdData({...prodData, op: e.target.value})}
                  className="w-full p-3 rounded-xl border border-gray-200 bg-gray-50"
                  placeholder="Ordem de Produção (OP)"
                />
                <input 
                  type="text" 
                  value={prodData.cp} 
                  onChange={e => setProdData({...prodData, cp: e.target.value})}
                  className="w-full p-3 rounded-xl border border-gray-200 bg-gray-50"
                  placeholder="Código do Produto (CP)"
                />
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => startProduction('setup')}
                  className="flex-1 bg-green-600 text-white font-bold py-3 rounded-xl text-sm"
                >
                  Iniciar Setup
                </button>
                <button 
                  onClick={() => startProduction('direct')}
                  className="flex-1 bg-blue-600 text-white font-bold py-3 rounded-xl text-sm"
                >
                  Iniciar Produção
                </button>
              </div>
              <button onClick={() => setStep(AppStep.IDENTIFICATION)} className="w-full text-gray-400 text-sm font-bold">Voltar</button>
            </div>
          )}

          {step === AppStep.TIMER && (
            <div className="space-y-6 text-center">
              <h2 className="text-xl font-bold text-gray-800">
                {isSetupMode ? 'Cronômetro: Setup' : 'Cronômetro: Produção'}
              </h2>
              <div className="bg-gray-900 text-green-400 p-8 rounded-3xl shadow-2xl font-mono text-4xl tracking-widest border-4 border-gray-800">
                {formatDuration(timer)}
                <p className="text-[10px] text-gray-500 mt-2 uppercase tracking-normal">Tempo em Tempo Real</p>
              </div>
              <div className="bg-blue-50 p-4 rounded-xl text-left text-xs border border-blue-100 flex flex-col gap-1">
                <p className="flex justify-between font-medium"><span>Máquina:</span> <span className="font-bold">{prodData.maquina}</span></p>
                <p className="flex justify-between font-medium"><span>OP / CP:</span> <span className="font-bold">{prodData.op} / {prodData.cp}</span></p>
              </div>
              {isSetupMode ? (
                <button 
                  onClick={finishSetupAndStartProd}
                  className="w-full bg-green-600 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-green-100"
                >
                  <Play size={20} /> Concluir Setup & Iniciar Produção
                </button>
              ) : (
                <button 
                  onClick={finishProduction}
                  className="w-full bg-red-600 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-red-100"
                >
                  <Square size={20} /> Encerrar e Registrar Dados
                </button>
              )}
            </div>
          )}

          {step === AppStep.SUMMARY && (
            <div className="space-y-6">
              <h2 className="text-lg font-bold text-gray-800">Finalização do Apontamento</h2>
              <div className="bg-gray-50 p-5 rounded-2xl border border-gray-200 text-xs space-y-3">
                <div className="flex justify-between border-b pb-2"><span className="text-gray-500">Produção:</span> <span className="font-bold text-blue-600">{formatDuration(prodData.durationSeconds || 0)}</span></div>
                <div className="flex justify-between border-b pb-2"><span className="text-gray-500">Setup:</span> <span className="font-bold text-green-600">{formatDuration(prodData.setupDurationSeconds || 0)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">OP / CP:</span> <span className="font-bold">{prodData.op} / {prodData.cp}</span></div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1">Total Produzido (Unidades)</label>
                <input 
                  type="number" 
                  value={prodData.quantity} 
                  onChange={e => setProdData({...prodData, quantity: parseInt(e.target.value) || 0})}
                  className="w-full p-3 rounded-xl border border-gray-200 bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1">Notas / Ocorrências</label>
                <textarea 
                  value={prodData.observation} 
                  onChange={e => setProdData({...prodData, observation: e.target.value})}
                  className="w-full p-3 rounded-xl border border-gray-200 bg-gray-50 h-24 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  placeholder="Descreva observações relevantes..."
                />
              </div>
              <button 
                onClick={saveRecord}
                disabled={loading}
                className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-blue-100"
              >
                {loading ? 'Sincronizando...' : 'Confirmar e Gravar'}
              </button>
            </div>
          )}

          {step === AppStep.COMPLETED && (
            <div className="text-center py-6 space-y-6">
              <div className="bg-green-100 p-6 rounded-full inline-block text-green-600 mb-4 animate-bounce">
                <CheckCircle2 size={60} />
              </div>
              <h2 className="text-3xl font-extrabold text-gray-800">Sucesso!</h2>
              <p className="text-gray-600 px-4">Os dados foram transmitidos e armazenados com segurança.</p>
              <button 
                onClick={() => {
                  setProdData({maquina: prodData.maquina, operador: user?.username, startTime: 0});
                  setStep(user?.role === UserRole.ADMIN ? AppStep.ADMIN_MENU : AppStep.IDENTIFICATION);
                }}
                className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all"
              >
                Novo Apontamento
              </button>
            </div>
          )}
        </div>
      </div>
      
      <button 
        id="install-btn"
        className="mt-8 text-[10px] uppercase tracking-widest text-gray-400 font-black hover:text-blue-600 transition-all"
        onClick={() => {
          const promptEvent = (window as any).deferredPrompt;
          if (promptEvent) {
            promptEvent.prompt();
            promptEvent.userChoice.then((choiceResult: any) => {
              if (choiceResult.outcome === 'accepted') console.log('PWA Installed');
              (window as any).deferredPrompt = null;
            });
          } else {
            alert('Utilize as opções do seu navegador para Instalar como Aplicativo (Adicionar à Tela Inicial).');
          }
        }}
      >
        Instalar como Aplicativo (PWA)
      </button>
    </div>
  );
};

export default App;
