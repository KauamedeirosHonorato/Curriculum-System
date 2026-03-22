import { useState, useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';
import './index.css';

// Configurando o Worker do PDF.js resolvido localmente pelo Vite
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const STORAGE_KEY = 'ats_resume_draft';

// Decodifica URLs com %C3%A3 e similares para exibição limpa
function safeDecodeURI(str: string): string {
  try { return decodeURIComponent(str); } catch { return str; }
}

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed[key] ?? fallback;
  } catch {
    return fallback;
  }
}

// ─── TOOLTIP COMPONENT ────────────────────────────────────────────────────────
function Tip({ text }: { text: string }) {
  return (
    <span className="tip-wrapper">
      <span className="tip-icon">ℹ</span>
      <span className="tip-box">{text}</span>
    </span>
  );
}

// ─── ATS SCORE ────────────────────────────────────────────────────────────────
interface ScoreItem { label: string; ok: boolean; points: number; max: number; hint: string; }
interface ATSResult  { score: number; color: string; tier: string; items: ScoreItem[]; }

function calcATSScore(
  info: { name:string; role:string; email:string; phone:string; location:string; summary:string; linkedin:string; github:string },
  exps: { company:string; description:string }[],
  skills: string[],
  projs: { name:string }[],
  langs: { name:string }[],
  certs: { name:string }[]
): ATSResult {
  const wordCount = info.summary.trim().split(/\s+/).filter(Boolean).length;
  const filledExps = exps.filter(e => e.company.trim());
  const filledSkills = skills.filter(s => s.trim());
  const hasKwInDesc = filledExps.some(e =>
    /\b(desenvolv|implement|gerenci|lider|reduz|aument|melhor|cri|otimiz)\w*/i.test(e.description)
  );

  const items: ScoreItem[] = [
    { label: 'Nome completo',       ok: info.name.trim().split(/\s+/).length >= 2,  points: 10, max: 10, hint: 'Use nome e sobrenome completos.' },
    { label: 'Cargo desejado',      ok: !!info.role.trim(),                          points: 8,  max: 8,  hint: 'Informe o cargo exato da vaga que pleiteia.' },
    { label: 'E-mail e telefone',   ok: !!info.email && !!info.phone,               points: 10, max: 10, hint: 'Ambos são obrigatórios para contato pelo recrutador.' },
    { label: 'Resumo (80-120 pal.)',ok: wordCount >= 60 && wordCount <= 140,         points: 15, max: 15, hint: 'Resumos muito curtos ou longos prejudicam a leitura do ATS.' },
    { label: 'Verbos de ação',      ok: hasKwInDesc,                               points: 12, max: 12, hint: 'Use verbos como "Desenvolvi", "Implementei", "Reduzi" nas experiências.' },
    { label: '≥ 2 experiências',    ok: filledExps.length >= 2,                     points: 15, max: 15, hint: 'Quanto mais experiências documentadas, melhor a pontuação.' },
    { label: '≥ 5 habilidades',     ok: filledSkills.length >= 5,                   points: 15, max: 15, hint: 'Liste tecnologias, frameworks e soft skills relevantes à vaga.' },
    { label: 'LinkedIn preenchido', ok: !!info.linkedin.trim(),                      points: 8,  max: 8,  hint: 'Recrutadores verificam o LinkedIn antes de chamar para entrevista.' },
    { label: 'Projetos / Portfólio',ok: projs.some(p => p.name.trim()),             points: 4,  max: 4,  hint: 'Projetos no GitHub provam habilidade na prática.' },
    { label: 'Idiomas / Certs.',    ok: langs.some(l => l.name.trim()) || certs.some(c => c.name.trim()), points: 3, max: 3, hint: 'Idiomas e certificações são diferenciais valiosos.' },
  ];

  const earned  = items.reduce((s, i) => s + (i.ok ? i.points : 0), 0);
  const total   = items.reduce((s, i) => s + i.max, 0);
  const score   = Math.round((earned / total) * 100);
  const color   = score >= 80 ? '#4ade80' : score >= 55 ? '#facc15' : '#f87171';
  const tier    = score >= 80 ? 'Excelente ✅' : score >= 55 ? 'Regular ⚠️' : 'Fraco ❌';

  return { score, color, tier, items };
}

export default function App() {

  const [template, setTemplate] = useState<string>(() =>
    loadFromStorage('template', 'classic')
  );
  const [isParsing, setIsParsing] = useState(false);
  const [savedBadge, setSavedBadge] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [personalInfo, setPersonalInfo] = useState(() =>
    loadFromStorage('personalInfo', {
      name: '', role: '', email: '', phone: '', location: '', summary: '', linkedin: '', github: '', instagram: ''
    })
  );

  const [experiences, setExperiences] = useState(() =>
    loadFromStorage('experiences', [
      { company: '', position: '', period: '', description: '' }
    ])
  );
  const [educations, setEducations] = useState(() =>
    loadFromStorage('educations', [
      { institution: '', course: '', period: '' }
    ])
  );
  const [skills, setSkills] = useState<string[]>(() =>
    loadFromStorage('skills', [''])
  );
  const [projects, setProjects] = useState(() =>
    loadFromStorage('projects', [{ name: '', tech: '', link: '', description: '' }])
  );
  const [languages, setLanguages] = useState(() =>
    loadFromStorage('languages', [{ name: '', level: 'Básico' }])
  );
  const [certifications, setCertifications] = useState(() =>
    loadFromStorage('certifications', [{ name: '', issuer: '', year: '' }])
  );

  // AUTO-SAVE: persiste no localStorage sempre que qualquer dado mudar
  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          template, personalInfo, experiences, educations, skills, projects, languages, certifications
        }));
        setSavedBadge(true);
        setTimeout(() => setSavedBadge(false), 2000);
      } catch {
        // quota exceeded — silent fallback
      }
    }, 600);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [template, personalInfo, experiences, educations, skills, projects, languages, certifications]);

  const handlePrint = () => {
    window.print();
  };

  // -------------------------------------------------------------------
  // FUNÇÃO MÁGICA DE LEITURA DE PDF (HEURÍSTICAS)
  // -------------------------------------------------------------------
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsing(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = '';

      // Tenta extrair o texto de todas as páginas
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        // @ts-ignore - Pela tipagem do getTextContent
        const pageText = textContent.items.map((item) => item.str).join(' ');
        fullText += pageText + '\n';
      }

      // Regex Mágicos
      const emailMatch = fullText.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/i);
      const phoneMatch = fullText.match(/(\(?[0-9]{2}\)?\s?[0-9]{4,5}-?\s?[0-9]{4})/i);
      const linkedinMatch = fullText.match(/linkedin\.com\/in\/([^\s]+)/i);
      const githubMatch = fullText.match(/github\.com\/([^\s]+)/i);
      const instagramMatch = fullText.match(/instagram\.com\/([^\s]+)/i);

      // Tentar chutar o nome (frequentemente as primeiras 2 a 3 palavras grandes do PDF)
      const cleanWords = fullText.trim().split(/\s+/).filter(w => w.length > 2);
      const possibleName = cleanWords.slice(0, 3).join(' ').replace(/[^a-zA-ZÀ-ÿ\s]/g, '');

      // Heurística Mágica para o Resumo Profissional
      const extractSummaryText = (text: string) => {
        const lower = text.toLowerCase();
        const startKeywords = ['resumo profissional', 'sobre mim', 'perfil profissional', 'resumo', 'summary', 'profile'];
        let startIdx = -1;
        let keywordLen = 0;
        
        for (const kw of startKeywords) {
          const idx = lower.indexOf(kw);
          if (idx !== -1 && (startIdx === -1 || idx < startIdx)) {
            startIdx = idx;
            keywordLen = kw.length;
          }
        }
        
        if (startIdx === -1) return '';
        
        const afterStart = text.substring(startIdx + keywordLen).replace(/^[:\- \n]+/, '');
        
        const endRegex = /\n\s*(experiência|histórico|formação|educação|education|experience|habilidades|competências|skills)/i;
        const endMatch = afterStart.match(endRegex);
        
        if (endMatch && endMatch.index !== undefined) {
          return afterStart.substring(0, endMatch.index).trim();
        }
        
        return afterStart.substring(0, 600).trim();
      };

      const extractedSummary = extractSummaryText(fullText);

      setPersonalInfo(prev => ({
        ...prev,
        name: prev.name || (possibleName.length < 40 ? possibleName : ''),
        summary: extractedSummary ? extractedSummary : prev.summary,
        email: emailMatch ? emailMatch[1] : prev.email,
        phone: phoneMatch ? phoneMatch[1] : prev.phone,
        linkedin: linkedinMatch ? `linkedin.com/in/${linkedinMatch[1]}` : prev.linkedin,
        github: githubMatch ? `github.com/${githubMatch[1]}` : prev.github,
        instagram: instagramMatch ? `instagram.com/${instagramMatch[1]}` : prev.instagram,
      }));

    } catch (err) {
      console.error("Erro ao ler PDF:", err);
      alert("Houve um erro ao ler o seu PDF antigo. Ele pode estar corrompido ou protegido.");
    } finally {
      setIsParsing(false);
    }
  };


  // -------------------------------------------------------------------
  // ATUALIZAÇÃO DE ARRAYS
  // -------------------------------------------------------------------
  const updateExp = (index: number, field: string, value: string) => {
    const newArray = [...experiences];
    newArray[index] = { ...newArray[index], [field]: value };
    setExperiences(newArray);
  };

  const updateEdu = (index: number, field: string, value: string) => {
    const newArray = [...educations];
    newArray[index] = { ...newArray[index], [field]: value };
    setEducations(newArray);
  };

  const updateSkill = (index: number, value: string) => {
    const newArray = [...skills];
    newArray[index] = value;
    setSkills(newArray);
  };
  const updateProject = (index: number, field: string, value: string) => {
    const a = [...projects]; a[index] = { ...a[index], [field]: value }; setProjects(a);
  };
  const updateLanguage = (index: number, field: string, value: string) => {
    const a = [...languages]; a[index] = { ...a[index], [field]: value }; setLanguages(a);
  };
  const updateCert = (index: number, field: string, value: string) => {
    const a = [...certifications]; a[index] = { ...a[index], [field]: value }; setCertifications(a);
  };

  const summaryWordCount = personalInfo.summary.trim().split(/\s+/).filter(Boolean).length;
  const [atsOpen, setAtsOpen] = useState(true);
  const ats = calcATSScore(personalInfo, experiences, skills, projects, languages, certifications);

  const clearDraft = () => {
    if (!confirm('Tem certeza? Isso apagará todos os dados preenchidos.')) return;
    localStorage.removeItem(STORAGE_KEY);
    setPersonalInfo({ name: '', role: '', email: '', phone: '', location: '', summary: '', linkedin: '', github: '', instagram: '' });
    setExperiences([{ company: '', position: '', period: '', description: '' }]);
    setEducations([{ institution: '', course: '', period: '' }]);
    setSkills(['']);
    setProjects([{ name: '', tech: '', link: '', description: '' }]);
    setLanguages([{ name: '', level: 'Básico' }]);
    setCertifications([{ name: '', issuer: '', year: '' }]);
    setTemplate('classic');
  };

  const copyToClipboard = () => {
    const text = `
${personalInfo.name.toUpperCase()}
${personalInfo.role}
${[personalInfo.email, personalInfo.phone, personalInfo.location].filter(Boolean).join(' | ')}
LinkedIn: ${personalInfo.linkedin} | GitHub: ${personalInfo.github}

RESUMO PROFISSIONAL
${personalInfo.summary}

EXPERIÊNCIA PROFISSIONAL
${experiences.filter(e => e.company).map(e => `${e.position} na ${e.company} (${e.period})\n${e.description}`).join('\n\n')}

FORMAÇÃO ACADÊMICA
${educations.filter(e => e.institution).map(e => `${e.course} - ${e.institution} (${e.period})`).join('\n')}

HABILIDADES
${skills.filter(s => s.trim()).join(', ')}

PROJETOS
${projects.filter(p => p.name).map(p => `${p.name} - ${p.tech}\n${p.description}`).join('\n\n')}

IDIOMAS
${languages.filter(l => l.name).map(l => `${l.name} (${l.level})`).join('\n')}

CERTIFICAÇÕES
${certifications.filter(c => c.name).map(c => `${c.name} - ${c.issuer} (${c.year})`).join('\n')}
    `.trim();

    navigator.clipboard.writeText(text);
    alert('Texto pronto para colar no ATS!');
  };

  return (
    <div className="app-container">
      <div className="editor-panel">
        <form
          autoComplete="off"
          spellCheck={false}
          onSubmit={e => e.preventDefault()}
          style={{ all: 'unset', display: 'contents' }}
        >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>

          <h1 style={{ margin: 0, color: 'white' }}>Gerador ATS-Friendly</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span className={`save-badge ${savedBadge ? 'save-badge--visible' : ''}`}>💾 Salvo!</span>
            <button onClick={copyToClipboard} className="btn-secondary-sm">📋 Copiar Texto</button>
            <button onClick={clearDraft} className="btn-danger-sm">🗑 Limpar</button>
          </div>
        </div>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
          Preencha os dados e escolha um modelo. O PDF ficará 100% legível por robôs.
        </p>

        {/* MÓDULO DE AUTO PREENCHIMENTO */}
        <section style={{ marginBottom: '2rem', padding: '1.5rem', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--accent-color)', borderRadius: '8px' }}>
          <h2 style={{ fontSize: '1.2rem', marginBottom: '0.5rem', color: 'var(--accent-color)' }}>🪄 Auto-preenchimento (PDF)</h2>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            Envie seu currículo antigo em PDF. Vamos auto-preencher seu Contato e Redes Sociais usando Regex! (Experiências devem ser preenchidas manualmente abaixo).
          </p>
          <input type="file" accept="application/pdf" onChange={handleFileUpload} style={{ marginBottom: 0 }} />
          {isParsing && <p style={{ fontSize: '0.9rem', color: 'var(--accent-color)', marginTop: '0.5rem' }}>Lendo o arquivo, aguarde...</p>}
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem', color: 'var(--accent-color)' }}>1. Modelo Visual</h2>
          <select value={template} onChange={e => setTemplate(e.target.value)}>
            <option value="classic">Clássico (Tradicional e Seguro)</option>
            <option value="modern">Moderno (Alinhamento Limpo)</option>
            <option value="executive">Executivo (Elegante com Serifas)</option>
            <option value="tech">💻 Tech/Dev (Stack em Destaque)</option>
          </select>
        </section>

        <section>
          <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem', color: 'var(--accent-color)' }}>
            2. Dados Pessoais e Redes Sociais
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div style={{ gridColumn: 'span 2' }}>
              <label>Nome Completo <Tip text="Use ao menos dois nomes completos. O ATS usa isso para cadastrar o candidato." /></label>
              <input type="text" value={personalInfo.name} onChange={e => setPersonalInfo({...personalInfo, name: e.target.value})} placeholder="Ex: Kauã Medeiros Honorato" />
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label>Cargo Desejado <Tip text="Coloque o título exato que aparece no anuncio da vaga para aumentar o match." /></label>
              <input type="text" value={personalInfo.role} onChange={e => setPersonalInfo({...personalInfo, role: e.target.value})} placeholder="Ex: Desenvolvedor Backend" />
            </div>
            <div>
              <label>E-mail</label>
              <input type="email" value={personalInfo.email} onChange={e => setPersonalInfo({...personalInfo, email: e.target.value})} placeholder="kaua@email.com" />
            </div>
            <div>
              <label>Telefone</label>
              <input type="text" value={personalInfo.phone} onChange={e => setPersonalInfo({...personalInfo, phone: e.target.value})} placeholder="(11) 99999-9999" />
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label>Localização</label>
              <input type="text" value={personalInfo.location} onChange={e => setPersonalInfo({...personalInfo, location: e.target.value})} placeholder="Maringá, PR" />
            </div>
            
            {/* CAMPOS NOVOS DE REDES SOCIAIS / TECH */}
            <div>
              <label>LinkedIn</label>
              <input type="text" value={personalInfo.linkedin} onChange={e => setPersonalInfo({...personalInfo, linkedin: e.target.value})} placeholder="linkedin.com/in/seu_perfil" />
            </div>
            <div>
              <label>GitHub</label>
              <input type="text" value={personalInfo.github} onChange={e => setPersonalInfo({...personalInfo, github: e.target.value})} placeholder="github.com/seu_usuario" />
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label>Instagram ou Portfólio</label>
              <input type="text" value={personalInfo.instagram} onChange={e => setPersonalInfo({...personalInfo, instagram: e.target.value})} placeholder="Link do seu Portfólio" />
            </div>
          </div>
            <label style={{marginTop: '1rem'}}>Resumo Profissional <Tip text="Escreva entre 80 e 120 palavras. Mencione sua área de atuação, principais tecnologias e objetivo profissional." /></label>
          <textarea rows={4} value={personalInfo.summary} onChange={e => setPersonalInfo({...personalInfo, summary: e.target.value})} placeholder="Breve resumo sobre sua carreira e objetivos." />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '-0.75rem', marginBottom: '0.5rem' }}>
            <span className={`word-counter ${summaryWordCount > 120 ? 'word-counter--over' : summaryWordCount >= 60 ? 'word-counter--good' : ''}`}>
              {summaryWordCount} palavra{summaryWordCount !== 1 ? 's' : ''} {summaryWordCount >= 60 && summaryWordCount <= 120 ? '✅' : summaryWordCount > 120 ? '⚠️ curto ideal: 80-120' : '(ideal: 80-120)'}
            </span>
          </div>
        </section>

        <section style={{ marginTop: '2rem' }}>
          <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem', color: 'var(--accent-color)' }}>
            3. Experiência Profissional <Tip text="ATS valoriza descrições que mostram impacto econômico ou técnico (ex: Reduzi tempo de resposta em 30%)." />
          </h2>
          {experiences.map((exp, index) => (
            <div key={index} style={{ marginBottom: '1.5rem', padding: '1.5rem', backgroundColor: 'var(--bg-surface)', borderRadius: '8px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ gridColumn: 'span 2' }}>
                  <label>Empresa</label>
                  <input type="text" value={exp.company} onChange={e => updateExp(index, 'company', e.target.value)} placeholder="Nome da empresa" />
                </div>
                <div>
                  <label>Cargo</label>
                  <input type="text" value={exp.position} onChange={e => updateExp(index, 'position', e.target.value)} placeholder="Seu cargo" />
                </div>
                <div>
                  <label>Período</label>
                  <input type="text" value={exp.period} onChange={e => updateExp(index, 'period', e.target.value)} placeholder="Ex: Jan 2020 - Atual" />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label>Descrição e Conquistas</label>
                  <textarea rows={3} value={exp.description} onChange={e => updateExp(index, 'description', e.target.value)} placeholder="Descreva suas responsabilidades." />
                </div>
              </div>
              {experiences.length > 1 && (
                <button onClick={() => setExperiences(experiences.filter((_, i) => i !== index))} style={{ color: '#ef4444', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, marginTop: '0.5rem' }}>Remover</button>
              )}
            </div>
          ))}
          <button onClick={() => setExperiences([...experiences, { company: '', position: '', period: '', description: '' }])} style={{ color: 'var(--accent-color)', background: 'transparent', border: '1px dashed var(--accent-color)', padding: '0.75rem', borderRadius: '6px', width: '100%', cursor: 'pointer' }}>+ Adicionar Experiência</button>
        </section>

        <section style={{ marginTop: '2rem' }}>
          <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem', color: 'var(--accent-color)' }}>4. Formação Acadêmica</h2>
          {educations.map((edu, index) => (
            <div key={index} style={{ marginBottom: '1.5rem', padding: '1.5rem', backgroundColor: 'var(--bg-surface)', borderRadius: '8px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ gridColumn: 'span 2' }}>
                  <label>Instituição</label>
                  <input type="text" value={edu.institution} onChange={e => updateEdu(index, 'institution', e.target.value)} placeholder="Ex: Universidade XYZ" />
                </div>
                <div>
                  <label>Curso</label>
                  <input type="text" value={edu.course} onChange={e => updateEdu(index, 'course', e.target.value)} placeholder="Ex: Análise de Sistemas" />
                </div>
                <div>
                  <label>Período</label>
                  <input type="text" value={edu.period} onChange={e => updateEdu(index, 'period', e.target.value)} placeholder="Ex: 2024" />
                </div>
              </div>
              {educations.length > 1 && (
                <button onClick={() => setEducations(educations.filter((_, i) => i !== index))} style={{ color: '#ef4444', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, marginTop: '0.5rem' }}>Remover</button>
              )}
            </div>
          ))}
          <button onClick={() => setEducations([...educations, { institution: '', course: '', period: '' }])} style={{ color: 'var(--accent-color)', background: 'transparent', border: '1px dashed var(--accent-color)', padding: '0.75rem', borderRadius: '6px', width: '100%', cursor: 'pointer' }}>+ Adicionar Formação</button>
        </section>

        <section style={{ marginTop: '2rem' }}>
          <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem', color: 'var(--accent-color)' }}>
            5. Habilidades <Tip text="Inclua tanto as tecnologias que domina quanto as listadas na vaga desejada." />
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
            {skills.map((skill, index) => (
              <div key={index} style={{ display: 'flex', gap: '0.5rem' }}>
                <input style={{ marginBottom: 0 }} type="text" value={skill} onChange={e => updateSkill(index, e.target.value)} placeholder="Ex: React, Node.js, Comunicação..." />
                {skills.length > 1 && (
                  <button onClick={() => setSkills(skills.filter((_, i) => i !== index))} style={{ padding: '0 1rem', background: '#374151', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>X</button>
                )}
              </div>
            ))}
          </div>
          <button onClick={() => setSkills([...skills, ''])} style={{ color: 'var(--accent-color)', background: 'transparent', border: '1px dashed var(--accent-color)', padding: '0.75rem', borderRadius: '6px', width: '100%', cursor: 'pointer', marginTop: '1rem' }}>+ Adicionar Habilidade</button>
        </section>

        {/* =========== SEÇÃO 6: PROJETOS =========== */}
        <section style={{ marginTop: '2rem' }}>
          <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem', color: 'var(--accent-color)' }}>6. 📦 Projetos / Portfólio</h2>
          {projects.map((proj, index) => (
            <div key={index} style={{ marginBottom: '1.5rem', padding: '1.5rem', backgroundColor: 'var(--bg-surface)', borderRadius: '8px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ gridColumn: 'span 2' }}>
                  <label>Nome do Projeto</label>
                  <input type="text" value={proj.name} onChange={e => updateProject(index, 'name', e.target.value)} placeholder="Ex: API de Gestão de Tarefas" />
                </div>
                <div>
                  <label>Tecnologias</label>
                  <input type="text" value={proj.tech} onChange={e => updateProject(index, 'tech', e.target.value)} placeholder="Ex: Node.js, PostgreSQL, Docker" />
                </div>
                <div>
                  <label>Link (GitHub / Demo)</label>
                  <input type="text" value={proj.link} onChange={e => updateProject(index, 'link', e.target.value)} placeholder="github.com/user/repo" />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label>Descrição breve</label>
                  <textarea rows={2} value={proj.description} onChange={e => updateProject(index, 'description', e.target.value)} placeholder="O que o projeto faz e qual problema resolve." />
                </div>
              </div>
              {projects.length > 1 && (
                <button onClick={() => setProjects(projects.filter((_, i) => i !== index))} style={{ color: '#ef4444', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, marginTop: '0.5rem' }}>Remover</button>
              )}
            </div>
          ))}
          <button onClick={() => setProjects([...projects, { name: '', tech: '', link: '', description: '' }])} style={{ color: 'var(--accent-color)', background: 'transparent', border: '1px dashed var(--accent-color)', padding: '0.75rem', borderRadius: '6px', width: '100%', cursor: 'pointer' }}>+ Adicionar Projeto</button>
        </section>

        {/* =========== SEÇÃO 7: IDIOMAS =========== */}
        <section style={{ marginTop: '2rem' }}>
          <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem', color: 'var(--accent-color)' }}>7. 🌎 Idiomas</h2>
          {languages.map((lang, index) => (
            <div key={index} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '1rem', alignItems: 'end', marginBottom: '0.75rem' }}>
              <div>
                <label>Idioma</label>
                <input style={{ marginBottom: 0 }} type="text" value={lang.name} onChange={e => updateLanguage(index, 'name', e.target.value)} placeholder="Ex: Inglês" />
              </div>
              <div>
                <label>Nível</label>
                <select style={{ marginBottom: 0 }} value={lang.level} onChange={e => updateLanguage(index, 'level', e.target.value)}>
                  <option>Básico</option>
                  <option>Intermediário</option>
                  <option>Avançado</option>
                  <option>Fluente</option>
                  <option>Nativo</option>
                </select>
              </div>
              {languages.length > 1 && (
                <button onClick={() => setLanguages(languages.filter((_, i) => i !== index))} style={{ color: '#ef4444', background: 'transparent', border: 'none', cursor: 'pointer', padding: '0 0.5rem', marginBottom: '1rem' }}>X</button>
              )}
            </div>
          ))}
          <button onClick={() => setLanguages([...languages, { name: '', level: 'Básico' }])} style={{ color: 'var(--accent-color)', background: 'transparent', border: '1px dashed var(--accent-color)', padding: '0.75rem', borderRadius: '6px', width: '100%', cursor: 'pointer', marginTop: '0.5rem' }}>+ Adicionar Idioma</button>
        </section>

        {/* =========== SEÇÃO 8: CERTIFICAÇÕES =========== */}
        <section style={{ marginTop: '2rem' }}>
          <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem', color: 'var(--accent-color)' }}>8. 🏅 Certificações</h2>
          {certifications.map((cert, index) => (
            <div key={index} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px', gap: '1rem', alignItems: 'end', marginBottom: '0.75rem' }}>
              <div>
                <label>Nome do Certificado</label>
                <input style={{ marginBottom: 0 }} type="text" value={cert.name} onChange={e => updateCert(index, 'name', e.target.value)} placeholder="Ex: AWS Certified Developer" />
              </div>
              <div>
                <label>Emitido por</label>
                <input style={{ marginBottom: 0 }} type="text" value={cert.issuer} onChange={e => updateCert(index, 'issuer', e.target.value)} placeholder="Ex: Amazon, Alura, DIO" />
              </div>
              <div>
                <label>Ano</label>
                <input style={{ marginBottom: 0 }} type="text" value={cert.year} onChange={e => updateCert(index, 'year', e.target.value)} placeholder="2024" />
              </div>
              {certifications.length > 1 && (
                <button onClick={() => setCertifications(certifications.filter((_, i) => i !== index))} style={{ gridColumn: 'span 3', color: '#ef4444', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}>Remover</button>
              )}
            </div>
          ))}
          <button onClick={() => setCertifications([...certifications, { name: '', issuer: '', year: '' }])} style={{ color: 'var(--accent-color)', background: 'transparent', border: '1px dashed var(--accent-color)', padding: '0.75rem', borderRadius: '6px', width: '100%', cursor: 'pointer', marginTop: '0.5rem' }}>+ Adicionar Certificação</button>
        </section>

        {/* =========== SEÇÃO 9: ATS SCORE (PONTUAÇÃO) =========== */}
        <section style={{ marginTop: '2.5rem', padding: '1.5rem', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
          <div 
            onClick={() => setAtsOpen(!atsOpen)} 
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
          >
            <h2 style={{ fontSize: '1.2rem', margin: 0, color: 'white' }}>🚩 Score do Currículo (ATS)</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
               <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: ats.color }}>{ats.score}%</span>
               <span style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>{atsOpen ? '▲' : '▼'}</span>
            </div>
          </div>

          {atsOpen && (
            <div style={{ marginTop: '1.5rem' }}>
              <div style={{ height: '8px', width: '100%', backgroundColor: '#1f2937', borderRadius: '4px', marginBottom: '1rem', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${ats.score}%`, backgroundColor: ats.color, transition: 'width 0.5s ease-out' }}></div>
              </div>
              <p style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '1.5rem', color: ats.color }}>Status: {ats.tier}</p>
              
              <div style={{ display: 'grid', gap: '0.75rem' }}>
                {ats.items.map((item, i) => (
                  <div key={i} style={{ display: 'flex', gap: '0.75rem', fontSize: '0.9rem' }}>
                    <span>{item.ok ? '✅' : '❌'}</span>
                    <div style={{ flex: 1 }}>
                      <strong style={{ color: item.ok ? 'white' : 'var(--text-secondary)' }}>{item.label}</strong>
                      {!item.ok && <p style={{ fontSize: '0.85rem', color: '#9ca3af', marginTop: '2px' }}>{item.hint}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <div style={{ marginTop: '3rem' }}>
          <button className="btn-primary" onClick={handlePrint}>
            Gerar PDF Anti-Robô
          </button>
        </div>
        </form>
      </div>

      <div className="preview-panel">
        <div className="a4-wrapper">
          <div className={`a4-document template-${template}`}>
            {!personalInfo.name && !personalInfo.role ? (
              <div style={{ textAlign: 'center', color: '#94a3b8', marginTop: '100px', fontFamily: 'sans-serif' }}>
                <h2 style={{border: 'none'}}>Seu currículo aparecerá aqui</h2>
                <p>O texto se adaptará perfeitamente ao formato escolhido.</p>
              </div>
            ) : (
              <>
                 <div className="resume-header">
                  {template === 'tech' ? (
                    <div className="tech-header">
                       <div className="tech-header-main">
                         <h1>{personalInfo.name || 'SEU NOME'}</h1>
                         <div className="tech-role">{personalInfo.role || 'CARGO DESEJADO'}</div>
                         <div className="tech-summary-short">{personalInfo.summary.substring(0, 180)}...</div>
                       </div>
                       <div className="tech-header-sidebar">
                          {[personalInfo.email, personalInfo.phone, personalInfo.location].map((text, i) => (
                            text && <div key={i} className="tech-contact-item">{text}</div>
                          ))}
                          <div className="tech-social-list">
                            {[
                              personalInfo.linkedin && `in/${safeDecodeURI(personalInfo.linkedin.replace(/^(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\//i, ''))}`,
                              personalInfo.github   && `gh/${safeDecodeURI(personalInfo.github.replace(/^(?:https?:\/\/)?(?:www\.)?github\.com\//i, ''))}`
                            ].filter(Boolean).map((link, i) => <div key={i}>{link}</div>)}
                          </div>
                       </div>
                    </div>
                  ) : (
                    <>
                      <h1>{personalInfo.name || 'SEU NOME'}</h1>
                      <div className="contact-info">
                        <strong>{personalInfo.role}</strong>
                        <div style={{ marginTop: '4px' }}>
                          {[personalInfo.email, personalInfo.phone, personalInfo.location].filter(Boolean).join(' • ')}
                        </div>
                        <div style={{ marginTop: '4px', fontSize: '10pt', color: '#64748b' }}>
                          {[
                            personalInfo.linkedin && `in/${safeDecodeURI(personalInfo.linkedin.replace(/^(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\//i, ''))}`,
                            personalInfo.github   && `gh/${safeDecodeURI(personalInfo.github.replace(/^(?:https?:\/\/)?(?:www\.)?github\.com\//i, ''))}`,
                            personalInfo.instagram && `ig/${safeDecodeURI(personalInfo.instagram.replace(/^(?:https?:\/\/)?(?:www\.)?instagram\.com\//i, ''))}`
                          ].filter(Boolean).join(' | ')}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {personalInfo.summary && (
                  <div className="resume-section">
                    <h2 className="section-title">Resumo Profissional</h2>
                    <p style={{ whiteSpace: 'pre-wrap' }}>{personalInfo.summary}</p>
                  </div>
                )}

                {experiences.some(exp => exp.company) && (
                  <div className="resume-section">
                    <h2 className="section-title">Experiência Profissional</h2>
                    {experiences.filter(exp => exp.company).map((exp, index) => (
                      <div key={index} className="experience-item" style={{ marginBottom: '12pt' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                          <strong style={{ fontSize: '11.5pt' }}>{exp.position}</strong>
                          <span style={{ fontSize: '10pt', color: '#333' }}>{exp.period}</span>
                        </div>
                        <div style={{ fontSize: '11pt', fontWeight: 'bold', color: '#444', marginBottom: '4pt' }}>
                          {exp.company}
                        </div>
                        <p style={{ fontSize: '10.5pt', margin: 0, whiteSpace: 'pre-wrap' }}>
                          {exp.description}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {educations.some(edu => edu.institution) && (
                  <div className="resume-section">
                    <h2 className="section-title">Formação Acadêmica</h2>
                    {educations.filter(edu => edu.institution).map((edu, index) => (
                      <div key={index} className="education-item" style={{ marginBottom: '8pt' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                          <strong style={{ fontSize: '11.5pt' }}>{edu.course}</strong>
                          <span style={{ fontSize: '10pt', color: '#333' }}>{edu.period}</span>
                        </div>
                        <div style={{ fontSize: '11pt' }}>
                          {edu.institution}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {skills.some(skill => skill.trim() !== '') && (
                  <div className="resume-section">
                    <h2 className="section-title">Habilidades e Competências</h2>
                    <ul style={{ margin: 0, paddingLeft: '20pt', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4pt' }}>
                      {skills.filter(s => s.trim() !== '').map((skill, index) => (
                        <li key={index} style={{ fontSize: '11pt' }}>{skill}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {projects.some(p => p.name.trim()) && (
                  <div className="resume-section">
                    <h2 className="section-title">Projetos</h2>
                    {projects.filter(p => p.name.trim()).map((proj, index) => (
                      <div key={index} style={{ marginBottom: '10pt' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                          <strong style={{ fontSize: '11.5pt' }}>{proj.name}</strong>
                          {proj.link && <span style={{ fontSize: '9.5pt', color: '#555' }}>{proj.link}</span>}
                        </div>
                        {proj.tech && <div style={{ fontSize: '10pt', color: '#444', marginBottom: '3pt' }}><em>Stack: {proj.tech}</em></div>}
                        {proj.description && <p style={{ fontSize: '10.5pt', margin: 0, whiteSpace: 'pre-wrap' }}>{proj.description}</p>}
                      </div>
                    ))}
                  </div>
                )}

                {languages.some(l => l.name.trim()) && (
                  <div className="resume-section">
                    <h2 className="section-title">Idiomas</h2>
                    <ul style={{ margin: 0, paddingLeft: '20pt', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4pt' }}>
                      {languages.filter(l => l.name.trim()).map((lang, index) => (
                        <li key={index} style={{ fontSize: '11pt' }}>{lang.name} — {lang.level}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {certifications.some(c => c.name.trim()) && (
                  <div className="resume-section">
                    <h2 className="section-title">Certificações</h2>
                    {certifications.filter(c => c.name.trim()).map((cert, index) => (
                      <div key={index} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5pt' }}>
                        <span style={{ fontSize: '11pt' }}>{cert.name}{cert.issuer ? ` — ${cert.issuer}` : ''}</span>
                        {cert.year && <span style={{ fontSize: '10pt', color: '#444' }}>{cert.year}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
