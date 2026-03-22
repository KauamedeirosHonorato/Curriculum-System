# Gerador de Currículos ATS-Friendly 

## Por que este projeto foi criado?
Milhares de candidatos qualificados são sumariamente rejeitados em processos seletivos simplesmente porque seus currículos não conseguem ser interpretados pelos sistemas ATS (Applicant Tracking Systems, ou "Robôs de RH" como Gupy, Kenoby, Workday). Muitos candidatos cometem o erro de criar currículos lindos em plataformas de design, cheios de colunas, ícones e gráficos radiais, mas os robôs leem apenas texto linear e acabam embaralhando toda a informação, resultando em pontuações baixas.

Este projeto resolve essa dor diretamente. Ele oferece uma interface interativa belíssima (*Dark Mode Premium*) para o candidato preencher confortavelmente os seus dados, enquanto renderiza e exporta, em tempo real, um arquivo PDF **100% legível e textualmente semântico**.

## O Pulo do Gato (Como Funciona)
Diferente da maioria dos geradores baseados em React que usam bibliotecas complexas para gerar o PDF (o que muitas vezes fragmenta o texto em imagens), este projeto utiliza uma técnica minimalista de **CSS `@media print`**.

Quando o usuário clica em "Gerar PDF", o navegador invoca uma versão de impressão especial. Nesse momento, o CSS intercepta a tela, esconde o tema escuro, oculta os menus, botões e qualquer ruído estético, isolando **somente o documento de papel virtual A4**, redimensionando-o para preencher o papel 100%, garantindo um texto fluente com hierarquia HTML pura. O resultado é um currículo tradicional de alto contraste que o recrutador adora e o robô entende.

## Características Principais
- **Zero Configuração/Login:** Abra, preencha, exporte. Tudo acontece locamente.
- **Auto-Save Local:** Seus dados são salvos automaticamente conforme você digita.
- **Score de Currículo (ATS):** Veja sua pontuação real e receba dicas de como melhorar o currículo para passar pelos robôs.
- **Copiar Texto Limpo:** Copie todo o conteúdo para colar direto em formulários de sites de vagas.
- **Templates Inteligentes:** Clássico, Moderno, Executivo e Tech.
- **Responsividade Total:** Desenvolvido pensando no mobile, use de qualquer lugar.
- **Exportação Imaculada:** PDFs de baixo peso, com texto 100% selecionável.
- **Rápido:** Vite + React + CSS Puro.

## Como Executar Em Sua Máquina
1. Acesse a pasta do diretório criado.
2. Instale as dependências: `npm install`
3. Inicie o servidor: `npm run dev`
4. Abra o navegador no Localhost indicado e comece!
