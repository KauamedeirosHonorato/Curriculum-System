import { useState, useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';
import './index.css';

// Configurando o Worker do PDF.js resolvido localmente pelo Vite
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const STORAGE_KEY = 'ats_resume_draft';

// Dicas rotativas para devs iniciantes
const JUNIOR_TIPS = [
  '💡 Sem emprego formal? Projetos pessoais, cursos e freelances contam! Coloque tudo.',
  '💡 Copie o título EXATO da vaga no campo Cargo — ATS busca correspondência de palavras.',
  '💡 GitHub ativo vale muito! Repositórios com README detalhado mostram seus projetos.',
  '💡 Descreva projetos dizendo qual problema resolvem, não apenas as tecnologias usadas.',
  '💡 Soft skills também importam! Adicione Comunicação e Trabalho em Equipe nas habilidades.',
  '💡 Alcance 80-120 palavras no Resumo. Seja direto e mencione sua stack principal.',
  '💡 Certificados gratuitos como DIO, Alura e Coursera somam pontos mesmo sem diploma.',
  '💡 Currículo em PT para empresas BR, em EN para startups ou vagas internacionais.',
];

// Sugestões de habilidades pré-definidas para devs iniciantes
const SKILL_SUGGESTIONS = [
  'React', 'Node.js', 'TypeScript', 'JavaScript', 'Python', 'HTML/CSS',
  'Git', 'PostgreSQL', 'MySQL', 'Docker', 'REST APIs', 'Next.js',
  'Vue.js', 'Express', 'MongoDB', 'Figma', 'Linux',
  'Comunicação', 'Trabalho em equipe', 'Resolução de problemas',
];

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

// ─── SECTION BADGE (ATS inline) ───────────────────────────────────────────────
function SectionBadge({ ok, empty }: { ok: boolean; empty?: boolean }) {
  if (empty) return <span className="section-badge section-badge--empty">❌</span>;
  return <span className={`section-badge ${ok ? 'section-badge--ok' : 'section-badge--warn'}`}>{ok ? '✅' : '⚠️'}</span>;
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
  const importInputRef = useRef<HTMLInputElement>(null);
  const [tipIndex] = useState(() => Math.floor(Math.random() * JUNIOR_TIPS.length));
  const [skillInput, setSkillInput] = useState('');

  const [personalInfo, setPersonalInfo] = useState(() =>
    loadFromStorage('personalInfo', {
      name: '', role: '', email: '', phone: '', location: '', summary: '', linkedin: '', github: '', instagram: '', portfolio: ''
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
    loadFromStorage<string[]>('skills', []).filter((s: string) => s.trim() !== '')
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

  // ─── SKILL TAGS ───────────────────────────────────────────────────────────
  const addSkill = (value: string) => {
    const trimmed = value.trim().replace(/,+$/, '').trim();
    if (trimmed.length > 0 && !skills.includes(trimmed)) setSkills(prev => [...prev, trimmed]);
    setSkillInput('');
  };
  const removeSkill = (index: number) => setSkills(skills.filter((_, i) => i !== index));
  const handleSkillKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addSkill(skillInput); }
    if (e.key === 'Backspace' && skillInput === '' && skills.length > 0) setSkills(skills.slice(0, -1));
  };
  const availableSuggestions = SKILL_SUGGESTIONS.filter(s => !skills.includes(s));
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
    setPersonalInfo({ name: '', role: '', email: '', phone: '', location: '', summary: '', linkedin: '', github: '', instagram: '', portfolio: '' });
    setExperiences([{ company: '', position: '', period: '', description: '' }]);
    setEducations([{ institution: '', course: '', period: '' }]);
    setSkills([]);
    setProjects([{ name: '', tech: '', link: '', description: '' }]);
    setLanguages([{ name: '', level: 'Básico' }]);
    setCertifications([{ name: '', issuer: '', year: '' }]);
    setTemplate('classic');
  };

  // ─── EXPORT / IMPORT JSON ─────────────────────────────────────────────────
  const exportJSON = () => {
    const data = { template, personalInfo, experiences, educations, skills, projects, languages, certifications };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'curriculo-backup.json'; a.click();
    URL.revokeObjectURL(url);
  };

  const importJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (data.personalInfo) setPersonalInfo({ name: '', role: '', email: '', phone: '', location: '', summary: '', linkedin: '', github: '', instagram: '', portfolio: '', ...data.personalInfo });
        if (data.experiences) setExperiences(data.experiences);
        if (data.educations) setEducations(data.educations);
        if (data.skills) setSkills(data.skills);
        if (data.projects) setProjects(data.projects);
        if (data.languages) setLanguages(data.languages);
        if (data.certifications) setCertifications(data.certifications);
        if (data.template) setTemplate(data.template);
      } catch { alert('Arquivo inválido. Importe apenas backups gerados por este sistema.'); }
    };
    reader.readAsText(file);
    e.target.value = '';
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span className={`save-badge ${savedBadge ? 'save-badge--visible' : ''}`}>💾 Salvo!</span>
            <button type="button" onClick={copyToClipboard} className="btn-secondary-sm">📋 Copiar</button>
            <button type="button" onClick={exportJSON} className="btn-secondary-sm">📤 Exportar</button>
            <button type="button" onClick={() => importInputRef.current?.click()} className="btn-secondary-sm">📥 Importar</button>
            <input ref={importInputRef} type="file" accept=".json" onChange={importJSON} style={{ display: 'none' }} />
            <button type="button" onClick={clearDraft} className="btn-danger-sm">🗑 Limpar</button>
          </div>
        </div>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
          Preencha os dados e escolha um modelo. O PDF ficará 100% legível por robôs.
        </p>

        {/* BANNER DICA PARA INICIANTES */}
        <div className="tip-banner">
          <span className="tip-banner-label">🎯 Dica para iniciantes</span>
          <span className="tip-banner-text">{JUNIOR_TIPS[tipIndex]}</span>
        </div>

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
              <label>Cargo Desejado <Tip text="Copie o título EXATO da vaga. Ex: se a vaga diz 'Dev Júnior React', escreva isso. O ATS busca correspondência precisa de palavras." /></label>
              <input type="text" value={personalInfo.role} onChange={e => setPersonalInfo({...personalInfo, role: e.target.value})} placeholder="Ex: Desenvolvedor Júnior React" />
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
            <div>
              <label>LinkedIn <Tip text="Recrutadores checam o LinkedIn antes da entrevista. Se não tem, crie agora! linkedin.com" /></label>
              <input type="text" value={personalInfo.linkedin} onChange={e => setPersonalInfo({...personalInfo, linkedin: e.target.value})} placeholder="linkedin.com/in/seu_perfil" />
            </div>
            <div>
              <label>GitHub <Tip text="Essencial para dev! Deixe o perfil público e coloque seus projetos com README bem feito." /></label>
              <input type="text" value={personalInfo.github} onChange={e => setPersonalInfo({...personalInfo, github: e.target.value})} placeholder="github.com/seu_usuario" />
            </div>
            <div>
              <label>Portfólio <Tip text="Link do seu site pessoal ou projeto principal. Ex: meusite.vercel.app. Deixe em branco se não tiver." /></label>
              <input type="text" value={personalInfo.portfolio ?? ''} onChange={e => setPersonalInfo({...personalInfo, portfolio: e.target.value})} placeholder="meuportfolio.vercel.app" />
            </div>
            <div>
              <label>Instagram (opcional)</label>
              <input type="text" value={personalInfo.instagram} onChange={e => setPersonalInfo({...personalInfo, instagram: e.target.value})} placeholder="instagram.com/seu_usuario" />
            </div>
          </div>
            <label style={{marginTop: '1rem'}}>Resumo Profissional <Tip text="Sem experiência? Fale sua stack, projetos pessoais que você criou e o que quer aprender. Seja honesto e direto." /></label>
          <textarea rows={4} value={personalInfo.summary} onChange={e => setPersonalInfo({...personalInfo, summary: e.target.value})} placeholder="Desenvolvedor em formação com foco em React e Node.js. Construí projetos como [X] e [Y], disponíveis no GitHub. Busco primeira oportunidade como Dev Júnior para evoluir com times experientes." />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '-0.75rem', marginBottom: '0.5rem' }}>
            <span className={`word-counter ${summaryWordCount > 120 ? 'word-counter--over' : summaryWordCount >= 60 ? 'word-counter--good' : ''}`}>
              {summaryWordCount} palavra{summaryWordCount !== 1 ? 's' : ''} {summaryWordCount >= 60 && summaryWordCount <= 120 ? '✅' : summaryWordCount > 120 ? '⚠️ curto ideal: 80-120' : '(ideal: 80-120)'}
            </span>
          </div>
        </section>

        <section style={{ marginTop: '2rem' }}>
          <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem', color: 'var(--accent-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            3. Experiência Profissional
            <SectionBadge ok={experiences.filter(e => e.company.trim()).length >= 2} empty={!experiences.some(e => e.company.trim())} />
            <Tip text="Sem emprego formal? Coloque projetos pessoais, freelances ou qualquer trabalho voluntário. ATS não diferencia!" />
          </h2>
          {experiences.map((exp, index) => (
            <div key={index} style={{ marginBottom: '1.5rem', padding: '1.5rem', backgroundColor: 'var(--bg-surface)', borderRadius: '8px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ gridColumn: 'span 2' }}>
                  <label>Empresa <Tip text="Sem empresa? Use 'Projeto Pessoal', 'Freelancer' ou o nome do projeto mesmo." /></label>
                  <input type="text" value={exp.company} onChange={e => updateExp(index, 'company', e.target.value)} placeholder="Empresa ou 'Projeto Pessoal'" />
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
                  <label>Descrição e Conquistas <Tip text='Use verbos: "Desenvolvi uma API que...", "Implementei autenticação JWT...", "Reduzi o carregamento em 30%..."' /></label>
                  <textarea rows={3} value={exp.description} onChange={e => updateExp(index, 'description', e.target.value)} placeholder='Ex: Desenvolvi uma aplicação full-stack com React e Node.js. Implementei autenticação JWT e integrei com PostgreSQL.' />
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
          <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem', color: 'var(--accent-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            4. Formação Acadêmica
            <SectionBadge ok={educations.some(e => e.institution.trim())} empty={!educations.some(e => e.institution.trim())} />
          </h2>
          {educations.map((edu, index) => (
            <div key={index} style={{ marginBottom: '1.5rem', padding: '1.5rem', backgroundColor: 'var(--bg-surface)', borderRadius: '8px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ gridColumn: 'span 2' }}>
                  <label>Instituição <Tip text="FATEC, ETEC, bootcamp, curso técnico — tudo conta! Não precisa ter faculdade tradional." /></label>
                  <input type="text" value={edu.institution} onChange={e => updateEdu(index, 'institution', e.target.value)} placeholder="Ex: FATEC, Rocketseat, DIO..." />
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
          <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem', color: 'var(--accent-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            5. Habilidades
            <SectionBadge ok={skills.filter(s => s.trim()).length >= 5} empty={skills.length === 0} />
            <Tip text="Inclua tecnologias que domina E as listadas na vaga. Soft skills também contam!" />
          </h2>

          {/* TAG INPUT */}
          <div className="skill-tags-container">
            {skills.map((skill, index) => (
              <span key={index} className="skill-tag">
                {skill}
                <button type="button" className="skill-tag-remove" onClick={() => removeSkill(index)} aria-label={`Remover ${skill}`}>×</button>
              </span>
            ))}
            <input
              className="skill-tag-input"
              type="text"
              value={skillInput}
              onChange={e => setSkillInput(e.target.value)}
              onKeyDown={handleSkillKeyDown}
              onBlur={() => skillInput.trim() && addSkill(skillInput)}
              placeholder={skills.length === 0 ? 'Digite e pressione Enter para adicionar...' : 'Adicionar mais...'}
            />
          </div>

          {/* SUGESTÕES */}
          {availableSuggestions.length > 0 && (
            <div className="skill-suggestions">
              <span className="skill-suggestions-label">💡 Sugestões:</span>
              {availableSuggestions.slice(0, 14).map(s => (
                <button key={s} type="button" className="skill-suggestion-btn" onClick={() => addSkill(s)}>{s}</button>
              ))}
            </div>
          )}
        </section>

        {/* =========== SEÇÃO 6: PROJETOS =========== */}
        <section style={{ marginTop: '2rem' }}>
          <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem', color: 'var(--accent-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            6. 📦 Projetos / Portfólio
            <SectionBadge ok={projects.some(p => p.name.trim())} empty={!projects.some(p => p.name.trim())} />
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem', padding: '0.75rem', backgroundColor: 'var(--bg-surface)', borderRadius: '6px' }}>
            💡 <strong>Para iniciantes:</strong> projetos pessoais são seu maior diferencial! Clone do Twitter, To-do list, APIs REST — tudo conta.
          </p>
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
          <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem', color: 'var(--accent-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            7. 🌎 Idiomas
            <SectionBadge ok={languages.some(l => l.name.trim())} empty={!languages.some(l => l.name.trim())} />
          </h2>
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
          <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem', color: 'var(--accent-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            8. 🏅 Certificações
            <SectionBadge ok={certifications.some(c => c.name.trim())} empty={!certifications.some(c => c.name.trim())} />
            <Tip text="DIO, Alura, Rocketseat, Coursera, freeCodeCamp — todos valem! Anote cada certificado que fizer." />
          </h2>
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
                          {personalInfo.linkedin && (
                            <div className="tech-contact-item">
                              <span className="social-icon">in</span> {safeDecodeURI(personalInfo.linkedin.replace(/^(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\//i, '').replace(/\/$/, ''))}
                            </div>
                          )}
                          {personalInfo.github && (
                            <div className="tech-contact-item">
                              <span className="social-icon">gh</span> {safeDecodeURI(personalInfo.github.replace(/^(?:https?:\/\/)?(?:www\.)?github\.com\//i, '').replace(/\/$/, ''))}
                            </div>
                          )}
                          {personalInfo.portfolio && (
                            <div className="tech-contact-item">
                              <span className="social-icon">🌐</span> {safeDecodeURI(personalInfo.portfolio.replace(/^(?:https?:\/\/)?(?:www\.)?/i, ''))}
                            </div>
                          )}
                          {personalInfo.instagram && (
                            <div className="tech-contact-item">
                              <span className="social-icon">ig</span> {safeDecodeURI(personalInfo.instagram.replace(/^(?:https?:\/\/)?(?:www\.)?(?:instagram\.com\/)([^\s/?#]+).*/i, '$1'))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <h1>{personalInfo.name || 'SEU NOME'}</h1>
                      <div className="contact-info">
                        <strong>{personalInfo.role}</strong>
                        <div className="contact-details">
                          {[personalInfo.email, personalInfo.phone, personalInfo.location].filter(Boolean).join(' • ')}
                        </div>
                        <div className="social-links">
                          {personalInfo.linkedin && (
                            <span className="social-item">
                              <svg className="icon" viewBox="0 0 24 24" fill="currentColor"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
                              {safeDecodeURI(personalInfo.linkedin.replace(/^(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\//i, '').replace(/\/$/, ''))}
                            </span>
                          )}
                          {personalInfo.github && (
                            <span className="social-item">
                              <svg className="icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.235c-3.338.726-4.042-1.416-4.042-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                              {safeDecodeURI(personalInfo.github.replace(/^(?:https?:\/\/)?(?:www\.)?github\.com\//i, '').replace(/\/$/, ''))}
                            </span>
                          )}
                          {personalInfo.portfolio && (
                            <span className="social-item">
                              <svg className="icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93V18h2v1.93c-2.75-.28-5-2.56-5.18-5.29l1.86-.62c.16 1.79 1.38 3.28 3.32 3.92zm4-1.86l-1.86.62C12.98 16.91 11.76 16 11 16v-2c1.66 0 3 1.34 3 3l1-.5v1.57zM18 12h-2c0-2.21-1.79-4-4-4V6c3.31 0 6 2.69 6 6z"/></svg>
                              {safeDecodeURI(personalInfo.portfolio.replace(/^(?:https?:\/\/)?(?:www\.)?/i, ''))}
                            </span>
                          )}
                          {personalInfo.instagram && (
                            <span className="social-item">
                              <svg className="icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.266.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.048.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.21-.07 4.849-.07zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.791-4-4s1.791-4 4-4 4 1.791 4 4-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                              {safeDecodeURI(personalInfo.instagram.replace(/^(?:https?:\/\/)?(?:www\.)?(?:instagram\.com\/|portfolio\.|)([^\s/?#]+).*/i, '$1'))}
                            </span>
                          )}
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
