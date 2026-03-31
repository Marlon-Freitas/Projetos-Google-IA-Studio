import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  Trophy, 
  LayoutGrid, 
  Play, 
  Plus, 
  Trash2, 
  Shuffle, 
  Save, 
  Download, 
  ChevronRight,
  Medal,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { cn, shuffle } from './utils';
import { 
  Participant, 
  Group, 
  Match, 
  Standing, 
  KnockoutPair, 
  KnockoutMatch 
} from './types';

type Tab = 'participantes' | 'grupos' | 'eliminatorias';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('participantes');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [knockoutPairs, setKnockoutPairs] = useState<KnockoutPair[]>([]);
  const [knockoutMatches, setKnockoutMatches] = useState<KnockoutMatch[]>([]);
  const [newParticipantName, setNewParticipantName] = useState('');
  const [numGroups, setNumGroups] = useState(4);

  // Load from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('bt_tournament_data');
    if (saved) {
      const data = JSON.parse(saved);
      setParticipants(data.participants || []);
      setGroups(data.groups || []);
      setMatches(data.matches || []);
      setKnockoutPairs(data.knockoutPairs || []);
      setKnockoutMatches(data.knockoutMatches || []);
    }
  }, []);

  // Save to localStorage
  useEffect(() => {
    const data = { participants, groups, matches, knockoutPairs, knockoutMatches };
    localStorage.setItem('bt_tournament_data', JSON.stringify(data));
  }, [participants, groups, matches, knockoutPairs, knockoutMatches]);

  const addParticipant = () => {
    if (!newParticipantName.trim()) return;
    const newP: Participant = {
      id: crypto.randomUUID(),
      name: newParticipantName.trim()
    };
    setParticipants([...participants, newP]);
    setNewParticipantName('');
  };

  const removeParticipant = (id: string) => {
    setParticipants(participants.filter(p => p.id !== id));
  };

  const generateGroups = () => {
    if (participants.length < numGroups * 2) {
      alert('Participantes insuficientes para o número de grupos.');
      return;
    }

    const shuffled: Participant[] = shuffle(participants);
    const newGroups: Group[] = [];
    const newMatches: Match[] = [];

    for (let i = 0; i < numGroups; i++) {
      newGroups.push({
        id: `group-${i + 1}`,
        name: `Grupo ${i + 1}`,
        participantIds: []
      });
    }

    // Distribute participants
    shuffled.forEach((p: Participant, idx: number) => {
      newGroups[idx % numGroups].participantIds.push(p.id);
    });

    // Generate rotating partner (Americano) matches for each group
    newGroups.forEach(group => {
      const pIds = group.participantIds;
      if (pIds.length < 4) return; // Need at least 4 for doubles

      // Standard 4-player Americano: 3 matches
      // (1,2) vs (3,4), (1,3) vs (2,4), (1,4) vs (2,3)
      // For more than 4, we'll just do the first 3 combinations for simplicity 
      // or implement a more robust rotation if needed.
      // Let's assume groups of 4 as per standard practice.
      
      if (pIds.length === 4) {
        newMatches.push({
          id: crypto.randomUUID(),
          groupId: group.id,
          p1Id: pIds[0], p2Id: pIds[1],
          p3Id: pIds[2], p4Id: pIds[3],
          score1: 0, score2: 0, isCompleted: false
        });
        newMatches.push({
          id: crypto.randomUUID(),
          groupId: group.id,
          p1Id: pIds[0], p2Id: pIds[2],
          p3Id: pIds[1], p4Id: pIds[3],
          score1: 0, score2: 0, isCompleted: false
        });
        newMatches.push({
          id: crypto.randomUUID(),
          groupId: group.id,
          p1Id: pIds[0], p2Id: pIds[3],
          p3Id: pIds[1], p4Id: pIds[2],
          score1: 0, score2: 0, isCompleted: false
        });
      } else {
        // Fallback for non-4 groups: just pair them up sequentially
        for (let i = 0; i < pIds.length; i += 4) {
          if (i + 3 < pIds.length) {
            newMatches.push({
              id: crypto.randomUUID(),
              groupId: group.id,
              p1Id: pIds[i], p2Id: pIds[i+1],
              p3Id: pIds[i+2], p4Id: pIds[i+3],
              score1: 0, score2: 0, isCompleted: false
            });
          }
        }
      }
    });

    setGroups(newGroups);
    setMatches(newMatches);
    setKnockoutPairs([]);
    setKnockoutMatches([]);
    setActiveTab('grupos');
  };

  const updateMatchScore = (matchId: string, s1: number, s2: number, completed: boolean) => {
    setMatches(prev => prev.map(m => 
      m.id === matchId ? { ...m, score1: s1, score2: s2, isCompleted: completed } : m
    ));
  };

  const toggleManualQualifier = (groupId: string, participantId: string) => {
    setGroups(prev => prev.map(g => {
      if (g.id === groupId) {
        const current = g.manualQualifierIds || [];
        if (current.includes(participantId)) {
          return { ...g, manualQualifierIds: current.filter(id => id !== participantId) };
        } else {
          if (current.length >= 2) {
            alert('Você só pode selecionar 2 classificados por grupo.');
            return g;
          }
          return { ...g, manualQualifierIds: [...current, participantId] };
        }
      }
      return g;
    }));
  };

  const calculateStandings = (groupId: string): Standing[] => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return [];

    const groupMatches = matches.filter(m => m.groupId === groupId);
    const standings: Record<string, Standing> = {};

    group.participantIds.forEach(pId => {
      const p = participants.find(p => p.id === pId);
      standings[pId] = {
        participantId: pId,
        name: p?.name || '?',
        wins: 0,
        gamesWon: 0,
        gamesLost: 0,
        netGames: 0
      };
    });

    groupMatches.forEach(m => {
      if (!m.isCompleted) return;
      
      const s1 = standings[m.p1Id];
      const s2 = standings[m.p2Id];
      const s3 = standings[m.p3Id];
      const s4 = standings[m.p4Id];

      if (s1 && s2 && s3 && s4) {
        // Team A (P1+P2)
        s1.gamesWon += m.score1;
        s1.gamesLost += m.score2;
        s2.gamesWon += m.score1;
        s2.gamesLost += m.score2;

        // Team B (P3+P4)
        s3.gamesWon += m.score2;
        s3.gamesLost += m.score1;
        s4.gamesWon += m.score2;
        s4.gamesLost += m.score1;

        if (m.score1 > m.score2) {
          s1.wins += 1;
          s2.wins += 1;
        } else if (m.score2 > m.score1) {
          s3.wins += 1;
          s4.wins += 1;
        }
      }
    });

    return Object.values(standings).map(s => ({
      ...s,
      netGames: s.gamesWon - s.gamesLost
    })).sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      return b.netGames - a.netGames;
    });
  };

  const generateKnockout = () => {
    const groupResults = groups.map(g => {
      const autoStandings = calculateStandings(g.id);
      let qualifiers = autoStandings.slice(0, 2);

      // Override with manual selection if 2 are selected
      if (g.manualQualifierIds && g.manualQualifierIds.length === 2) {
        const q1 = autoStandings.find(s => s.participantId === g.manualQualifierIds![0]);
        const q2 = autoStandings.find(s => s.participantId === g.manualQualifierIds![1]);
        if (q1 && q2) {
          // Sort manual qualifiers by their auto-rank to maintain 1st/2nd logic
          qualifiers = [q1, q2].sort((a, b) => {
            const idxA = autoStandings.findIndex(s => s.participantId === a.participantId);
            const idxB = autoStandings.findIndex(s => s.participantId === b.participantId);
            return idxA - idxB;
          });
        }
      }

      return {
        groupId: g.id,
        qualifiers
      };
    });

    // Check if all matches are completed
    if (matches.some(m => !m.isCompleted)) {
      if (!confirm('Algumas partidas da fase de grupos não foram concluídas. Deseja continuar?')) return;
    }

    const pairs: KnockoutPair[] = [];
    
    // Logic: 1st G1 + 2nd G2, 1st G2 + 2nd G1, 1st G3 + 2nd G4, etc.
    for (let i = 0; i < groups.length; i += 2) {
      const g1 = groupResults[i];
      const g2 = groupResults[i + 1];

      if (g1 && g2) {
        const p1_1 = g1.qualifiers[0];
        const p1_2 = g1.qualifiers[1];
        const p2_1 = g2.qualifiers[0];
        const p2_2 = g2.qualifiers[1];

        if (p1_1 && p2_2) {
          pairs.push({
            id: crypto.randomUUID(),
            p1Id: p1_1.participantId,
            p2Id: p2_2.participantId,
            name: `${p1_1.name} / ${p2_2.name}`
          });
        }
        if (p2_1 && p1_2) {
          pairs.push({
            id: crypto.randomUUID(),
            p1Id: p2_1.participantId,
            p2Id: p1_2.participantId,
            name: `${p2_1.name} / ${p1_2.name}`
          });
        }
      }
    }

    setKnockoutPairs(pairs);

    // Initial knockout matches (Round of X)
    const initialMatches: KnockoutMatch[] = [];
    const roundName = pairs.length === 16 ? 'oitavas' : pairs.length === 8 ? 'quartas' : pairs.length === 4 ? 'semi' : 'final';
    
    for (let i = 0; i < pairs.length; i += 2) {
      initialMatches.push({
        id: crypto.randomUUID(),
        round: roundName as any,
        pair1Id: pairs[i].id,
        pair2Id: pairs[i + 1]?.id || null,
        score1: 0,
        score2: 0,
        winnerPairId: null,
        isCompleted: false
      });
    }

    setKnockoutMatches(initialMatches);
    setActiveTab('eliminatorias');
  };

  const updateKnockoutScore = (matchId: string, s1: number, s2: number, completed: boolean) => {
    setKnockoutMatches(prev => {
      const updated = prev.map(m => {
        if (m.id === matchId) {
          const winnerId = completed ? (s1 > s2 ? m.pair1Id : m.pair2Id) : null;
          return { ...m, score1: s1, score2: s2, isCompleted: completed, winnerPairId: winnerId };
        }
        return m;
      });

      // Find the match that was just updated
      const currentMatch = updated.find(m => m.id === matchId);
      if (!currentMatch || !completed || !currentMatch.winnerPairId) return updated;

      // Determine next round
      let nextRound: 'quartas' | 'semi' | 'final' | null = null;
      if (currentMatch.round === 'oitavas') nextRound = 'quartas';
      else if (currentMatch.round === 'quartas') nextRound = 'semi';
      else if (currentMatch.round === 'semi') nextRound = 'final';

      if (!nextRound) return updated;

      // Find or create the next match
      const currentRoundMatches = updated.filter(m => m.round === currentMatch.round);
      const matchIndex = currentRoundMatches.findIndex(m => m.id === matchId);
      const nextMatchIndex = Math.floor(matchIndex / 2);
      const isFirstInPair = matchIndex % 2 === 0;

      const nextRoundMatches = updated.filter(m => m.round === nextRound);
      
      // If next round matches don't exist yet, we might need to create them
      // But usually we generate them all at once or as needed.
      // Let's ensure they exist.
      let finalUpdated = [...updated];
      
      const existingNextMatch = nextRoundMatches[nextMatchIndex];
      if (existingNextMatch) {
        finalUpdated = finalUpdated.map(m => {
          if (m.id === existingNextMatch.id) {
            return {
              ...m,
              [isFirstInPair ? 'pair1Id' : 'pair2Id']: currentMatch.winnerPairId
            };
          }
          return m;
        });
      } else {
        // Create next round matches if they don't exist
        const numNextMatches = currentRoundMatches.length / 2;
        for (let i = 0; i < numNextMatches; i++) {
          const id = `next-${nextRound}-${i}`;
          if (!finalUpdated.find(m => m.id === id)) {
            finalUpdated.push({
              id,
              round: nextRound,
              pair1Id: i === nextMatchIndex && isFirstInPair ? currentMatch.winnerPairId : null,
              pair2Id: i === nextMatchIndex && !isFirstInPair ? currentMatch.winnerPairId : null,
              score1: 0,
              score2: 0,
              winnerPairId: null,
              isCompleted: false
            });
          }
        }
      }

      return finalUpdated;
    });
  };

  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();
    
    // Standings Sheet
    const standingsData = groups.flatMap(g => {
      const s = calculateStandings(g.id);
      return s.map((item, idx) => ({
        Grupo: g.name,
        Posição: idx + 1,
        Nome: item.name,
        Vitórias: item.wins,
        Games_Ganhos: item.gamesWon,
        Games_Perdidos: item.gamesLost,
        Saldo_Games: item.netGames
      }));
    });
    const wsStandings = XLSX.utils.json_to_sheet(standingsData);
    XLSX.utils.book_append_sheet(wb, wsStandings, "Classificação");

    // Matches Sheet
    const matchesData = matches.map(m => ({
      Grupo: groups.find(g => g.id === m.groupId)?.name,
      Time_1_Jogador_1: participants.find(p => p.id === m.p1Id)?.name,
      Time_1_Jogador_2: participants.find(p => p.id === m.p2Id)?.name,
      Time_2_Jogador_1: participants.find(p => p.id === m.p3Id)?.name,
      Time_2_Jogador_2: participants.find(p => p.id === m.p4Id)?.name,
      Placar_1: m.score1,
      Placar_2: m.score2,
      Status: m.isCompleted ? 'Concluído' : 'Pendente'
    }));
    const wsMatches = XLSX.utils.json_to_sheet(matchesData);
    XLSX.utils.book_append_sheet(wb, wsMatches, "Jogos Grupos");

    // Knockout Sheet
    const koData = knockoutMatches.map(m => ({
      Rodada: m.round,
      Dupla_1: knockoutPairs.find(p => p.id === m.pair1Id)?.name,
      Dupla_2: knockoutPairs.find(p => p.id === m.pair2Id)?.name,
      Placar_1: m.score1,
      Placar_2: m.score2,
      Vencedor: knockoutPairs.find(p => p.id === m.winnerPairId)?.name
    }));
    const wsKO = XLSX.utils.json_to_sheet(koData);
    XLSX.utils.book_append_sheet(wb, wsKO, "Eliminatórias");

    XLSX.writeFile(wb, "Torneio_Beach_Tennis.xlsx");
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#1A1A1A] font-sans">
      {/* Header */}
      <header className="bg-white border-b border-[#E5E7EB] py-6 px-8 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-[#FF6321] p-2 rounded-lg">
              <Trophy className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Beach Tennis Tour</h1>
              <p className="text-xs text-[#6B7280] uppercase tracking-widest font-semibold">Gestor de Torneio</p>
            </div>
          </div>
          
          <nav className="flex bg-[#F3F4F6] p-1 rounded-xl">
            {(['participantes', 'grupos', 'eliminatorias'] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "px-6 py-2 rounded-lg text-sm font-medium transition-all duration-200 capitalize",
                  activeTab === tab 
                    ? "bg-white text-[#1A1A1A] shadow-sm" 
                    : "text-[#6B7280] hover:text-[#1A1A1A]"
                )}
              >
                {tab}
              </button>
            ))}
          </nav>

          <button 
            onClick={exportToExcel}
            className="flex items-center gap-2 bg-[#1A1A1A] text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-opacity-90 transition-all"
          >
            <Download size={18} />
            Exportar Excel
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-8">
        <AnimatePresence mode="wait">
          {activeTab === 'participantes' && (
            <motion.div
              key="participantes"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-8"
            >
              <div className="lg:col-span-1 space-y-6">
                <div className="bg-white p-6 rounded-2xl border border-[#E5E7EB] shadow-sm">
                  <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <Plus size={20} className="text-[#FF6321]" />
                    Novo Participante
                  </h2>
                  <div className="space-y-4">
                    <input
                      type="text"
                      placeholder="Nome do jogador"
                      value={newParticipantName}
                      onChange={(e) => setNewParticipantName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addParticipant()}
                      className="w-full px-4 py-3 rounded-xl border border-[#E5E7EB] focus:outline-none focus:ring-2 focus:ring-[#FF6321] focus:border-transparent transition-all"
                    />
                    <button
                      onClick={addParticipant}
                      className="w-full bg-[#FF6321] text-white py-3 rounded-xl font-bold hover:bg-opacity-90 transition-all shadow-lg shadow-[#FF6321]/20"
                    >
                      Adicionar
                    </button>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-[#E5E7EB] shadow-sm">
                  <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <Shuffle size={20} className="text-[#FF6321]" />
                    Configurar Grupos
                  </h2>
                  <div className="space-y-4">
                    <label className="block text-sm font-medium text-[#6B7280]">Quantidade de Grupos</label>
                    <select 
                      value={numGroups}
                      onChange={(e) => setNumGroups(Number(e.target.value))}
                      className="w-full px-4 py-3 rounded-xl border border-[#E5E7EB] focus:outline-none focus:ring-2 focus:ring-[#FF6321]"
                    >
                      {[2, 4, 8, 16].map(n => (
                        <option key={n} value={n}>{n} Grupos</option>
                      ))}
                    </select>
                    <p className="text-xs text-[#6B7280]">
                      Total de participantes: <span className="font-bold text-[#1A1A1A]">{participants.length}</span>
                    </p>
                    <button
                      onClick={generateGroups}
                      disabled={participants.length < numGroups * 2}
                      className="w-full border-2 border-[#1A1A1A] text-[#1A1A1A] py-3 rounded-xl font-bold hover:bg-[#1A1A1A] hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Sortear Grupos
                    </button>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-2">
                <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-[#E5E7EB] flex justify-between items-center">
                    <h2 className="text-lg font-bold flex items-center gap-2">
                      <Users size={20} className="text-[#FF6321]" />
                      Lista de Inscritos
                    </h2>
                    <span className="bg-[#F3F4F6] text-[#6B7280] px-3 py-1 rounded-full text-xs font-bold">
                      {participants.length} Jogadores
                    </span>
                  </div>
                  <div className="divide-y divide-[#E5E7EB] max-h-[600px] overflow-y-auto">
                    {participants.length === 0 ? (
                      <div className="p-12 text-center text-[#6B7280]">
                        Nenhum participante adicionado ainda.
                      </div>
                    ) : (
                      participants.map((p, idx) => (
                        <div key={p.id} className="p-4 flex justify-between items-center hover:bg-[#F9FAFB] transition-colors group">
                          <div className="flex items-center gap-4">
                            <span className="text-xs font-mono text-[#9CA3AF] w-6">{idx + 1}.</span>
                            <div className="flex flex-col">
                              <span className="font-medium">{p.name}</span>
                            </div>
                          </div>
                          <button
                            onClick={() => removeParticipant(p.id)}
                            className="text-[#EF4444] opacity-0 group-hover:opacity-100 p-2 hover:bg-[#FEE2E2] rounded-lg transition-all"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'grupos' && (
            <motion.div
              key="grupos"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-12"
            >
              {groups.length === 0 ? (
                <div className="bg-white p-20 rounded-3xl border border-dashed border-[#E5E7EB] text-center">
                  <LayoutGrid size={48} className="mx-auto text-[#D1D5DB] mb-4" />
                  <h3 className="text-xl font-bold mb-2">Fase de Grupos não iniciada</h3>
                  <p className="text-[#6B7280] mb-6">Adicione participantes e realize o sorteio para começar.</p>
                  <button 
                    onClick={() => setActiveTab('participantes')}
                    className="bg-[#1A1A1A] text-white px-8 py-3 rounded-xl font-bold"
                  >
                    Voltar para Participantes
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-end">
                    <div>
                      <h2 className="text-3xl font-black tracking-tight uppercase italic">Fase de Grupos</h2>
                      <p className="text-[#6B7280]">Clique nos jogadores para definir manualmente os classificados (opcional).</p>
                    </div>
                    <button
                      onClick={generateKnockout}
                      className="bg-[#FF6321] text-white px-8 py-4 rounded-2xl font-black uppercase italic tracking-tighter hover:scale-105 transition-transform shadow-xl shadow-[#FF6321]/30 flex items-center gap-2"
                    >
                      Gerar Eliminatórias
                      <ChevronRight size={20} />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-12">
                    {groups.map(group => {
                      const standings = calculateStandings(group.id);
                      const groupMatches = matches.filter(m => m.groupId === group.id);

                      return (
                        <div key={group.id} className="space-y-6">
                          <div className="bg-white rounded-3xl border border-[#E5E7EB] shadow-sm overflow-hidden">
                            <div className="bg-[#1A1A1A] p-6 flex justify-between items-center">
                              <h3 className="text-white font-black text-xl uppercase italic">{group.name}</h3>
                              <div className="flex gap-2">
                                <div className="w-2 h-2 rounded-full bg-[#FF6321]" />
                                <div className="w-2 h-2 rounded-full bg-white/20" />
                              </div>
                            </div>
                            
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                                    <th className="px-6 py-4 text-left font-bold text-[#6B7280] uppercase text-[10px] tracking-widest">Pos</th>
                                    <th className="px-6 py-4 text-left font-bold text-[#6B7280] uppercase text-[10px] tracking-widest">Jogador</th>
                                    <th className="px-6 py-4 text-center font-bold text-[#6B7280] uppercase text-[10px] tracking-widest">V</th>
                                    <th className="px-6 py-4 text-center font-bold text-[#6B7280] uppercase text-[10px] tracking-widest">G+</th>
                                    <th className="px-6 py-4 text-center font-bold text-[#6B7280] uppercase text-[10px] tracking-widest">G-</th>
                                    <th className="px-6 py-4 text-center font-bold text-[#6B7280] uppercase text-[10px] tracking-widest">Saldo</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-[#E5E7EB]">
                                  {standings.map((s, idx) => {
                                    const isManual = group.manualQualifierIds?.includes(s.participantId);
                                    const isAuto = (!group.manualQualifierIds || group.manualQualifierIds.length === 0) && idx < 2;
                                    const isQualified = isManual || isAuto;

                                    return (
                                      <tr 
                                        key={s.participantId} 
                                        onClick={() => toggleManualQualifier(group.id, s.participantId)}
                                        className={cn(
                                          "hover:bg-[#F9FAFB] transition-colors cursor-pointer",
                                          isQualified ? "bg-green-50/30" : ""
                                        )}
                                      >
                                        <td className="px-6 py-4 font-mono font-bold text-[#9CA3AF]">{idx + 1}</td>
                                        <td className="px-6 py-4">
                                          <div className="flex items-center gap-2">
                                            <span className="font-bold">{s.name}</span>
                                            {isQualified && <CheckCircle2 size={14} className="text-green-500" />}
                                          </div>
                                        </td>
                                        <td className="px-6 py-4 text-center font-bold">{s.wins}</td>
                                        <td className="px-6 py-4 text-center text-[#6B7280]">{s.gamesWon}</td>
                                        <td className="px-6 py-4 text-center text-[#6B7280]">{s.gamesLost}</td>
                                        <td className={cn(
                                          "px-6 py-4 text-center font-black",
                                          s.netGames > 0 ? "text-green-600" : s.netGames < 0 ? "text-red-600" : "text-[#1A1A1A]"
                                        )}>
                                          {s.netGames > 0 ? `+${s.netGames}` : s.netGames}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>

                          <div className="bg-white rounded-3xl border border-[#E5E7EB] shadow-sm p-6">
                            <h4 className="text-xs font-black uppercase tracking-[0.2em] text-[#9CA3AF] mb-6">Jogos do Grupo</h4>
                            <div className="space-y-4">
                              {groupMatches.map(m => {
                                const p1 = participants.find(p => p.id === m.p1Id);
                                const p2 = participants.find(p => p.id === m.p2Id);
                                const p3 = participants.find(p => p.id === m.p3Id);
                                const p4 = participants.find(p => p.id === m.p4Id);
                                return (
                                  <div key={m.id} className="flex flex-col gap-3 p-4 rounded-2xl border border-[#F3F4F6] hover:border-[#E5E7EB] transition-all">
                                    <div className="flex items-center justify-between gap-4">
                                      <div className="flex-1 text-right">
                                        <div className="font-bold text-sm truncate">{p1?.name}</div>
                                        <div className="font-bold text-sm truncate">{p2?.name}</div>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <input
                                          type="number"
                                          value={m.score1}
                                          onChange={(e) => updateMatchScore(m.id, Number(e.target.value), m.score2, true)}
                                          className="w-12 h-12 text-center bg-[#F3F4F6] rounded-xl font-black text-lg focus:ring-2 focus:ring-[#FF6321] outline-none"
                                        />
                                        <span className="text-[#D1D5DB] font-bold">x</span>
                                        <input
                                          type="number"
                                          value={m.score2}
                                          onChange={(e) => updateMatchScore(m.id, m.score1, Number(e.target.value), true)}
                                          className="w-12 h-12 text-center bg-[#F3F4F6] rounded-xl font-black text-lg focus:ring-2 focus:ring-[#FF6321] outline-none"
                                        />
                                      </div>
                                      <div className="flex-1 text-left">
                                        <div className="font-bold text-sm truncate">{p3?.name}</div>
                                        <div className="font-bold text-sm truncate">{p4?.name}</div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </motion.div>
          )}

          {activeTab === 'eliminatorias' && (
            <motion.div
              key="eliminatorias"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-12 pb-24"
            >
              {knockoutMatches.length === 0 ? (
                <div className="bg-white p-20 rounded-3xl border border-dashed border-[#E5E7EB] text-center">
                  <Trophy size={48} className="mx-auto text-[#D1D5DB] mb-4" />
                  <h3 className="text-xl font-bold mb-2">Eliminatórias não geradas</h3>
                  <p className="text-[#6B7280] mb-6">Conclua a fase de grupos para gerar o chaveamento.</p>
                  <button 
                    onClick={() => setActiveTab('grupos')}
                    className="bg-[#1A1A1A] text-white px-8 py-3 rounded-xl font-bold"
                  >
                    Ir para Grupos
                  </button>
                </div>
              ) : (
                <>
                  <div className="text-center space-y-2">
                    <h2 className="text-4xl font-black tracking-tighter uppercase italic">Fase Eliminatória</h2>
                    <p className="text-[#6B7280]">Oitavas, Quartas, Semi e a grande Final.</p>
                  </div>

                  <div className="flex flex-col items-center gap-16">
                    {(['oitavas', 'quartas', 'semi', 'final'] as const).map(round => {
                      const roundMatches = knockoutMatches.filter(m => m.round === round);
                      if (roundMatches.length === 0) return null;

                      return (
                        <div key={round} className="w-full space-y-8">
                          <h3 className="text-center text-xs font-black uppercase tracking-[0.3em] text-[#9CA3AF] border-b border-[#E5E7EB] pb-4">
                            {round === 'oitavas' ? 'Oitavas de Final' : 
                             round === 'quartas' ? 'Quartas de Final' : 
                             round === 'semi' ? 'Semi-Final' : 'Grande Final'}
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 justify-center">
                            {roundMatches.map(m => {
                              const pair1 = knockoutPairs.find(p => p.id === m.pair1Id);
                              const pair2 = knockoutPairs.find(p => p.id === m.pair2Id);
                              return (
                                <div key={m.id} className="bg-white rounded-3xl border border-[#E5E7EB] shadow-lg overflow-hidden w-full transition-all hover:shadow-xl">
                                  <div className="bg-[#F9FAFB] p-4 border-b border-[#E5E7EB] flex justify-between items-center">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF]">Jogo {m.id.slice(-4)}</span>
                                    {m.isCompleted && <Medal size={16} className="text-[#FFD700]" />}
                                  </div>
                                  <div className="p-6 space-y-4">
                                    <div className={cn(
                                      "flex justify-between items-center p-3 rounded-2xl transition-all",
                                      m.winnerPairId === m.pair1Id ? "bg-green-50 ring-1 ring-green-200" : "bg-[#F3F4F6]"
                                    )}>
                                      <span className="font-bold text-sm truncate pr-2">{pair1?.name || 'A definir'}</span>
                                      <input
                                        type="number"
                                        value={m.score1}
                                        onChange={(e) => updateKnockoutScore(m.id, Number(e.target.value), m.score2, true)}
                                        className="w-10 h-10 text-center bg-white rounded-lg font-black focus:ring-2 focus:ring-[#FF6321] outline-none"
                                      />
                                    </div>
                                    <div className="flex justify-center">
                                      <span className="text-[10px] font-black text-[#D1D5DB]">VS</span>
                                    </div>
                                    <div className={cn(
                                      "flex justify-between items-center p-3 rounded-2xl transition-all",
                                      m.winnerPairId === m.pair2Id ? "bg-green-50 ring-1 ring-green-200" : "bg-[#F3F4F6]"
                                    )}>
                                      <span className="font-bold text-sm truncate pr-2">{pair2?.name || 'A definir'}</span>
                                      <input
                                        type="number"
                                        value={m.score2}
                                        onChange={(e) => updateKnockoutScore(m.id, m.score1, Number(e.target.value), true)}
                                        className="w-10 h-10 text-center bg-white rounded-lg font-black focus:ring-2 focus:ring-[#FF6321] outline-none"
                                      />
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer Info */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E5E7EB] py-3 px-8 text-center text-[10px] text-[#9CA3AF] uppercase tracking-widest font-bold">
        Beach Tennis Tournament System &copy; 2026 • Marlongf
      </footer>
    </div>
  );
}
