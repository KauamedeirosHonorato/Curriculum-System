# 📄 Gerador de Currículos ATS-Friendly

> Crie currículos 100% legíveis por robôs de RH — de graça, no navegador, sem login.

---

## 🎯 O Problema que Resolve

Milhares de candidatos qualificados são rejeitados em processos seletivos porque seus currículos **não passam pelo filtro automático dos ATSs** (Applicant Tracking Systems) como Gupy, Kenoby e Workday. Currículos bonitos feitos em Canva ou PowerPoint — cheios de colunas, ícones e gráficos — são completamente ilegíveis para esses robôs.

Este projeto resolve isso diretamente: uma interface **dark mode premium** para o candidato preencher seus dados, que gera um PDF **100% legível por qualquer ATS**, com hierarquia HTML pura e texto selecionável.

---

## ✨ Funcionalidades

| Feature | Descrição |
|---|---|
| 🎯 **Score ATS em tempo real** | Pontuação de 0–100% com checklist de critérios e dicas de melhoria |
| 🏷️ **Tags de Habilidades** | Sistema de chips interativos com 14+ sugestões para devs iniciantes |
| 💡 **Dicas para Iniciantes** | Banner rotativo com orientações para quem está entrando no mercado |
| 🪄 **Auto-preenchimento por PDF** | Extrai e-mail, telefone, LinkedIn e GitHub de um currículo antigo via PDF.js |
| 📤 **Exportar / Importar JSON** | Backup completo dos dados; restaure em qualquer dispositivo |
| 🖨️ **Exportação Anti-Robô** | PDF via `@media print` — texto 100% selecionável, sem imagens |
| 💾 **Auto-Save** | Dados salvos automaticamente no `localStorage` |
| 📋 **Copiar Texto Limpo** | Copia todo o conteúdo para colar em formulários de vagas |
| 🔴🟡🟢 **Badges ATS inline** | Indicador visual (✅/⚠️/❌) em cada seção do formulário |
| 🌐 **Portfólio e Instagram** | Campos separados com exibição no preview |
| 4 Templates | Clássico · Moderno · Executivo · Tech/Dev |

---

## 🛠️ Tecnologias e Ferramentas

### Core
![React](https://img.shields.io/badge/React_19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript_5.9-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite_8-646CFF?style=for-the-badge&logo=vite&logoColor=white)

### Estilização
![CSS3](https://img.shields.io/badge/CSS_Puro-1572B6?style=for-the-badge&logo=css3&logoColor=white)
![Google Fonts](https://img.shields.io/badge/Google_Fonts_(Inter)-4285F4?style=for-the-badge&logo=google&logoColor=white)

### Bibliotecas
| Biblioteca | Uso |
|---|---|
| **pdfjs-dist** `^5.5` | Extração de texto de PDFs enviados pelo usuário |
| **localStorage API** | Persistência de dados local sem backend |
| **Web File API** | Importar/exportar backup `.json` e upload de PDF |

### Dev & Build
| Ferramenta | Uso |
|---|---|
| **Vite** | Dev server com HMR e build otimizado |
| **ESLint** + **typescript-eslint** | Linting estático do código |
| **TypeScript** | Tipagem estática em todo o projeto |
| **Git + GitHub** | Versionamento e hospedagem do repositório |

---

## 💡 Como Funciona o PDF Anti-Robô

A técnica é minimalista: quando o usuário clica em **"Gerar PDF Anti-Robô"**, o navegador abre o diálogo de impressão nativo. O CSS intercepta com `@media print`:

- Esconde o tema dark, menus e botões
- Isola somente o **documento A4 virtual**
- Força escala 1:1 no papel
- Mantém **texto puro e selecionável** — sem imagens, sem fragmentação

O resultado é um currículo de texto semântico que o ATS lê linha a linha sem erros.

---

## 🚀 Como Rodar Localmente

```bash
# Clone o repositório
git clone https://github.com/KauamedeirosHonorato/Curriculum-System.git

# Instale as dependências
cd Curriculum-System
npm install

# Inicie o servidor de desenvolvimento
npm run dev
```

Abra o navegador em `http://localhost:5173` e comece a preencher!

---

## 📁 Estrutura do Projeto

```
src/
├── App.tsx        # Componente principal — todo o estado, lógica e JSX
├── index.css      # Design system completo (dark mode, A4, print, tags, badges)
└── main.tsx       # Entry point React
```

---

## 🎯 Feito Para

- **Devs iniciantes** que estão buscando o primeiro emprego
- Qualquer candidato que queira garantir que seu currículo **passe pelo filtro automático**
- Quem quer um currículo profissional sem depender de Canva ou Word

---

<p align="center">Feito com ❤️ para devs que querem conseguir sua vaga.</p>
