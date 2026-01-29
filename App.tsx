
import React, { useState, useEffect, useCallback } from 'react';
import { AppStep, User, UserRole, ProductionRecord } from './types';
import { firebaseService } from './services/firebaseService';
import { 
  ClipboardCheck, 
  History, 
  LogOut, 
  Settings, 
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
  Sparkles,
  RefreshCw
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
// Fix: Import ptBR locale directly from the locale path to resolve module member errors
import ptBR from 'date-fns/locale/pt-BR';
import { GoogleGenAI } from "@google/genai";

// Components
const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [step, setStep] = useState<AppStep>(AppStep.LOGIN);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Production State
  const [prodData, setProdData] = useState<Partial<ProductionRecord>>({
    maquina: '',
    op: '',
    cp: '',
    durationSeconds: 0,
    setupDurationSeconds: 0,
    quantity: 0,
    observation: ''
  });
  const [isSetupMode, setIsSetupMode] = useState(true);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [timer, setTimer] = useState(0);
  const [records, setRecords] = useState<ProductionRecord[]>([]);

  // AI Analysis State
  const [analysis, setAnalysis] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Timer logic
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
    } catch (err) {
      setError('Erro ao registrar usuário.');
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
    setIsSetupMode(mode === 'setup');
    setStartTime(Date.now());
    setTimer(0);
    setStep(AppStep.TIMER);
  };

  const finishSetupAndStartProd = () => {
    setProdData(prev => ({ ...prev, setupDurationSeconds: timer }));
    setStartTime(Date.now());
    setTimer(0);
    setIsSetupMode(false);
  };

  const finishProduction = () => {
    const totalDuration = timer;
    setProdData(prev => ({ ...prev, durationSeconds: totalDuration, endTime: Date.now() }));
    setStartTime(null);
    setStep(AppStep.SUMMARY);
  };

  const saveRecord = async () => {
    setLoading(true);
    try {
      const finalRecord: ProductionRecord = {
        operador: user?.username || '',
        maquina: prodData.maquina || '',
        op: prodData.op || '',
        cp: prodData.cp || '',
        startTime: prodData.startTime || 0,
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

  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(records.map(r => ({
      'Operador': r.operador,
      'Máquina': r.maquina,
      'OP': r.op,
      'CP': r.cp,
      'Início': format(r.startTime, 'dd/MM/yyyy HH:mm', { locale: ptBR }),
      'Fim': format(r.endTime, 'dd/MM/yyyy HH:mm', { locale: ptBR }),
      'Duração (Produção)': formatDuration(r.durationSeconds),
      'Duração (Setup)': formatDuration(r.setupDurationSeconds),
      'Quantidade': r.quantity,
      'Observação': r.observation
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Produção");
    XLSX.writeFile(wb, `IMEK_Producao_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const loadAdminRecords = async () => {
    setLoading(true);
    try {
      const data = await firebaseService.getAllRecords();
      setRecords(data);
    } catch (err) {
      setError('Erro ao carregar registros.');
    } finally {
      setLoading(false);
    }
  };

  // Implementing Gemini AI Analysis to replace the placeholder
  const generateAIAnalysis = async () => {
    setIsAnalyzing(true);
    setError('');
    try {
      const data = await firebaseService.getAllRecords();
      setRecords(data);

      if (data.length === 0) {
        setAnalysis('Ainda não há registros suficientes para realizar uma análise de desempenho.');
        setIsAnalyzing(false);
        return;
      }

      // Initialize Gemini with the required configuration
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const recentRecordsSummary = data.slice(0, 20).map(r => 
        `- OP: ${r.op}, Máquina: ${r.maquina}, Quantidade: ${r.quantity}, Setup: ${formatDuration(r.setupDurationSeconds)}, Produção: ${formatDuration(r.durationSeconds)}`
      ).join('\n');

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Analise o histórico de produção recente da IMEK SLEEVE fornecido abaixo. Identifique os 3 principais pontos de ineficiência (gargalos) e forneça recomendações acionáveis para otimizar o tempo de setup e a cadência produtiva. Responda em português (pt-BR) usando Markdown:\n\n${recentRecordsSummary}`,
        config: {
          systemInstruction: "Você é um consultor especialista em excelência operacional industrial e Lean Manufacturing.",
        }
      });

      setAnalysis(response.text || 'Ocorreu um erro ao gerar o conteúdo da análise.');
    } catch (err) {
      console.error(err);
      setError('Erro ao conectar com a Inteligência Artificial para gerar insights.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // UI RENDERING LOGIC
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100 glass-panel">
        
        {/* Header Logo */}
        <div className="bg-white p-6 flex flex-col items-center border-b border-gray-100">
           <div className="bg-blue-600 p-3 rounded-2xl mb-4 shadow-lg shadow-blue-200">
             <ClipboardCheck className="text-white w-8 h-8" />
           </div>
           <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">IMEK SLEEVE</h1>
           <p className="text-gray-500 text-sm font-medium">Controle de Produção</p>
        </div>

        <div className="p-8">
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100 font-medium">
              {error}
            </div>
          )}

          {/* STEP 0: LOGIN */}
          {step === AppStep.LOGIN && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Operador (Nome)</label>
                <input 
                  type="text" 
                  value={username} 
                  onChange={e => setUsername(e.target.value)}
                  className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-gray-50 transition-all"
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
                  className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-gray-50 transition-all"
                  placeholder="Sua senha"
                  required
                />
              </div>
              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-100 flex items-center justify-center gap-2"
              >
                {loading ? 'Entrando...' : <><LogIn size={18} /> Entrar</>}
              </button>
              <button 
                type="button"
                onClick={() => setStep(AppStep.REGISTER)}
                className="w-full text-blue-600 text-sm font-bold flex items-center justify-center gap-2"
              >
                <UserPlus size={16} /> Cadastrar Novo Usuário
              </button>
            </form>
          )}

          {/* STEP 0.1: REGISTER */}
          {step === AppStep.REGISTER && (
            <form onSubmit={handleRegister} className="space-y-4">
              <h2 className="text-lg font-bold text-center mb-4">Cadastro de Operador</h2>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Escolha um Nome</label>
                <input 
                  type="text" 
                  value={username} 
                  onChange={e => setUsername(e.target.value)}
                  className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 bg-gray-50"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Crie uma Senha</label>
                <input 
                  type="password" 
                  value={password} 
                  onChange={e => setPassword(e.target.value)}
                  className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 bg-gray-50"
                  required
                />
              </div>
              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-green-600 text-white font-bold py-3 rounded-xl hover:bg-green-700 transition-colors"
              >
                {loading ? 'Cadastrando...' : 'Finalizar Cadastro'}
              </button>
              <button 
                type="button"
                onClick={() => setStep(AppStep.LOGIN)}
                className="w-full text-gray-500 text-sm font-bold"
              >
                Voltar para Login
              </button>
            </form>
          )}

          {/* STEP: ADMIN MENU */}
          {step === AppStep.ADMIN_MENU && (
            <div className="space-y-4">
               <h2 className="text-xl font-bold text-gray-800 text-center mb-4">Menu Administrador</h2>
               <button 
                onClick={() => setStep(AppStep.IDENTIFICATION)}
                className="w-full flex items-center gap-4 p-5 bg-blue-50 rounded-2xl border border-blue-100 hover:bg-blue-100 transition-all text-left"
               >
                 <div className="bg-blue-600 p-3 rounded-xl text-white shadow-md">
                   <ClipboardCheck size={24} />
                 </div>
                 <div>
                   <span className="block font-bold text-blue-900">Apontamento de Produção</span>
                   <span className="text-xs text-blue-700">Registrar novo lote</span>
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
                   <span className="text-xs text-indigo-700">Relatórios e análises</span>
                 </div>
               </button>

               <button 
                 onClick={() => {setUser(null); setStep(AppStep.LOGIN)}} 
                 className="w-full mt-4 flex items-center justify-center gap-2 text-gray-500 font-bold"
               >
                 <LogOut size={16} /> Sair do Sistema
               </button>
            </div>
          )}

          {/* STEP: GESTÃO DE PRODUÇÃO (ADMIN) */}
          {step === AppStep.GESTÃO_PRODUCAO && (
            <div className="space-y-4">
               <div className="flex items-center gap-2 mb-4">
                 <button onClick={() => setStep(AppStep.ADMIN_MENU)} className="p-2 bg-gray-100 rounded-full">
                    <ArrowLeft size={16} />
                 </button>
                 <h2 className="text-xl font-bold text-gray-800">Gestão de Produção</h2>
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
                   <span className="text-xs text-gray-500">Ver tabela completa</span>
                 </div>
               </button>

               <button 
                onClick={() => { setStep(AppStep.ANALYSIS); if (!analysis) generateAIAnalysis(); }}
                className="w-full flex items-center gap-4 p-5 bg-white rounded-2xl border border-gray-200 hover:bg-gray-50 transition-all text-left"
               >
                 <div className="bg-orange-500 p-3 rounded-xl text-white shadow-md">
                   <PieChart size={24} />
                 </div>
                 <div>
                   <span className="block font-bold text-gray-900">Análise dos Apontamentos</span>
                   <span className="text-xs text-gray-500">Dashboards (IA)</span>
                 </div>
               </button>
            </div>
          )}

          {/* STEP: ANALYSIS (IA DASHBOARD) */}
          {step === AppStep.ANALYSIS && (
            <div className="space-y-6">
               <div className="flex items-center justify-between gap-2 mb-4">
                 <div className="flex items-center gap-2">
                   <button onClick={() => setStep(AppStep.GESTÃO_PRODUCAO)} className="p-2 bg-gray-100 rounded-full">
                      <ArrowLeft size={16} />
                   </button>
                   <h2 className="text-xl font-bold text-gray-800">Inteligência Industrial</h2>
                 </div>
                 <button 
                  onClick={generateAIAnalysis} 
                  disabled={isAnalyzing}
                  className="p-2 bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100 transition-colors"
                 >
                   <RefreshCw size={18} className={isAnalyzing ? 'animate-spin' : ''} />
                 </button>
               </div>

               {isAnalyzing ? (
                 <div className="text-center py-10 space-y-4">
                    <div className="bg-blue-100 p-6 rounded-full inline-block text-blue-600 animate-pulse">
                      <Sparkles size={48} />
                    </div>
                    <p className="text-gray-600 font-bold">Gerando insights com Gemini...</p>
                    <p className="text-xs text-gray-400">Processando métricas de eficiência e tempos de setup.</p>
                 </div>
               ) : (
                 <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm min-h-[300px]">
                    <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap leading-relaxed">
                      {analysis || "Nenhuma análise disponível. Clique no ícone de atualizar para processar os dados."}
                    </div>
                 </div>
               )}
               
               <p className="text-[10px] text-gray-400 text-center italic mt-4">
                 Análise automatizada baseada em IA Experimental. Valide as recomendações operacionalmente.
               </p>
            </div>
          )}

          {/* STEP: SAVED RECORDS (TABLE) */}
          {step === AppStep.SAVED_RECORDS && (
            <div className="w-full max-w-4xl -mx-4">
               <div className="flex justify-between items-center mb-6 px-4">
                 <button onClick={() => setStep(AppStep.GESTÃO_PRODUCAO)} className="flex items-center gap-2 text-gray-500 font-bold">
                    <ArrowLeft size={16} /> Voltar
                 </button>
                 <button 
                  onClick={exportToExcel}
                  className="bg-green-600 text-white px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-bold shadow-lg shadow-green-100"
                 >
                   <Download size={16} /> Exportar Excel
                 </button>
               </div>
               
               <div className="overflow-x-auto border-t border-b border-gray-100">
                 <table className="w-full text-left text-sm">
                   <thead className="bg-gray-50 text-gray-600 font-bold">
                     <tr>
                       <th className="px-4 py-3">Data</th>
                       <th className="px-4 py-3">OP</th>
                       <th className="px-4 py-3">Operador</th>
                       <th className="px-4 py-3">Qtd</th>
                       <th className="px-4 py-3">Duração</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-gray-100">
                     {loading ? (
                        <tr><td colSpan={5} className="text-center py-10">Carregando dados...</td></tr>
                     ) : records.length === 0 ? (
                        <tr><td colSpan={5} className="text-center py-10 text-gray-400">Nenhum registro encontrado.</td></tr>
                     ) : records.map(r => (
                       <tr key={r.id} className="hover:bg-gray-50">
                         <td className="px-4 py-3">{format(r.timestamp, 'dd/MM/yy', { locale: ptBR })}</td>
                         <td className="px-4 py-3 font-medium text-blue-600">{r.op}</td>
                         <td className="px-4 py-3">{r.operador}</td>
                         <td className="px-4 py-3 font-bold">{r.quantity}</td>
                         <td className="px-4 py-3">{formatDuration(r.durationSeconds)}</td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
            </div>
          )}

          {/* PRODUCTION WORKFLOW */}
          
          {/* STEP 1: IDENTIFICATION */}
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
            </div>
          )}

          {/* STEP 2: DETAILS */}
          {step === AppStep.DETAILS && (
            <div className="space-y-6">
              <h2 className="text-lg font-bold text-gray-800">Passo 2: Detalhes da Produção</h2>
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1">Ordem de Produção (OP)</label>
                <input 
                  type="text" 
                  value={prodData.op} 
                  onChange={e => setProdData({...prodData, op: e.target.value})}
                  className="w-full p-3 rounded-xl border border-gray-200 bg-gray-50"
                  placeholder="Ex: 2024-12345"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1">Código do Produto (CP)</label>
                <input 
                  type="text" 
                  value={prodData.cp} 
                  onChange={e => setProdData({...prodData, cp: e.target.value})}
                  className="w-full p-3 rounded-xl border border-gray-200 bg-gray-50"
                  placeholder="Ex: PROD-A01"
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

          {/* STEP 3: TIMER */}
          {step === AppStep.TIMER && (
            <div className="space-y-6 text-center">
              <h2 className="text-xl font-bold text-gray-800">
                {isSetupMode ? 'Setup em Curso' : 'Produção em Curso'}
              </h2>
              <div className="bg-gray-900 text-green-400 p-8 rounded-3xl shadow-2xl font-mono text-4xl tracking-widest border-4 border-gray-800">
                {formatDuration(timer)}
                <p className="text-[10px] text-gray-500 mt-2 uppercase tracking-normal">Tempo Decorrido</p>
              </div>
              <div className="bg-blue-50 p-4 rounded-xl text-left text-sm border border-blue-100">
                <p className="flex justify-between font-medium"><span>Máquina:</span> <span className="font-bold">{prodData.maquina}</span></p>
                <p className="flex justify-between font-medium"><span>OP:</span> <span className="font-bold">{prodData.op}</span></p>
              </div>
              {isSetupMode ? (
                <button 
                  onClick={finishSetupAndStartProd}
                  className="w-full bg-green-600 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-green-100"
                >
                  <Play size={20} /> Finalizar Setup e Iniciar Produção
                </button>
              ) : (
                <button 
                  onClick={finishProduction}
                  className="w-full bg-red-600 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-red-100"
                >
                  <Square size={20} /> Finalizar e Registrar
                </button>
              )}
            </div>
          )}

          {/* STEP 4: SUMMARY */}
          {step === AppStep.SUMMARY && (
            <div className="space-y-6">
              <h2 className="text-lg font-bold text-gray-800">Passo 4: Dados Finais</h2>
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 text-sm space-y-2">
                <p className="flex justify-between"><span className="text-gray-500">Duração Produção:</span> <span className="font-bold text-blue-600">{formatDuration(prodData.durationSeconds || 0)}</span></p>
                <p className="flex justify-between"><span className="text-gray-500">Duração Setup:</span> <span className="font-bold text-green-600">{formatDuration(prodData.setupDurationSeconds || 0)}</span></p>
                <p className="flex justify-between"><span className="text-gray-500">OP / CP:</span> <span className="font-bold">{prodData.op} / {prodData.cp}</span></p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1">Quantidade Produzida</label>
                <input 
                  type="number" 
                  value={prodData.quantity} 
                  onChange={e => setProdData({...prodData, quantity: parseInt(e.target.value) || 0})}
                  className="w-full p-3 rounded-xl border border-gray-200 bg-gray-50"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1">Observação</label>
                <textarea 
                  value={prodData.observation} 
                  onChange={e => setProdData({...prodData, observation: e.target.value})}
                  className="w-full p-3 rounded-xl border border-gray-200 bg-gray-50 h-24"
                  placeholder="Notas relevantes..."
                />
              </div>
              <button 
                onClick={saveRecord}
                disabled={loading}
                className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2"
              >
                {loading ? 'Salvando...' : 'Salvar Dados Finais'}
              </button>
            </div>
          )}

          {/* STEP 5: COMPLETED */}
          {step === AppStep.COMPLETED && (
            <div className="text-center py-6 space-y-6">
              <div className="bg-green-100 p-6 rounded-full inline-block text-green-600 mb-4 animate-bounce">
                <CheckCircle2 size={60} />
              </div>
              <h2 className="text-3xl font-extrabold text-gray-800">Concluído!</h2>
              <p className="text-gray-600 px-4">O registro foi salvo com sucesso no banco de dados. Seu foco fez a diferença.</p>
              <button 
                onClick={() => {
                  setProdData({maquina: prodData.maquina, operador: user?.username});
                  setStep(user?.role === UserRole.ADMIN ? AppStep.ADMIN_MENU : AppStep.IDENTIFICATION);
                }}
                className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl shadow-xl shadow-blue-100"
              >
                Iniciar Novo Registro
              </button>
            </div>
          )}
        </div>
      </div>
      
      {/* Install Button (PWA) */}
      <button 
        id="install-btn"
        className="mt-6 text-sm text-gray-500 font-bold border-b border-gray-400 hover:text-blue-600 hover:border-blue-600 transition-all flex items-center gap-2"
        onClick={() => {
          const promptEvent = (window as any).deferredPrompt;
          if (promptEvent) {
            promptEvent.prompt();
            promptEvent.userChoice.then((choiceResult: any) => {
              if (choiceResult.outcome === 'accepted') console.log('User accepted install');
              (window as any).deferredPrompt = null;
            });
          } else {
            alert('Este app já está instalado ou seu navegador não suporta instalação direta.');
          }
        }}
      >
        Instalar Aplicativo no Dispositivo
      </button>
    </div>
  );
};

export default App;