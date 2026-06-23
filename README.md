# 🐷 Cofre do Mano

Site interativo para controlar o dinheiro que seu irmão poupa com você: ele te manda um
Pix do que ganha, você guarda, e devolve quando ele precisa. O app mostra com clareza
**quanto do dinheiro dele está com você**, gráficos da evolução, um simulador de metas e
gamificação (ofensiva, cofrinho e medalhas).

Funciona em dois modos:

- **Modo demo** (padrão): dados só no navegador (`localStorage`). Abre e funciona na hora,
  sem configurar nada. Ótimo para testar. Já vem com dados de exemplo.
- **Modo nuvem** (Supabase): sincroniza em tempo real entre o seu celular e o do seu irmão.

---

## 1. Rodar localmente (modo demo)

Como usa módulos ES, precisa servir por HTTP (abrir o arquivo direto não funciona):

```bash
cd cofre-mano
python -m http.server 8000
# abra http://localhost:8000
```

> Sem Python? Use a extensão **Live Server** do VS Code, ou `npx serve`.

Para limpar os dados de exemplo, abra o console do navegador e rode `__cofre.resetDemo()`.

---

## 2. Publicar no GitHub Pages

1. Crie um repositório no GitHub e suba esta pasta:
   ```bash
   git init && git add . && git commit -m "Cofre do Mano"
   git branch -M main
   git remote add origin https://github.com/SEU_USUARIO/SEU_REPO.git
   git push -u origin main
   ```
2. No GitHub: **Settings → Pages → Source: Deploy from a branch → `main` / root**.
3. Em ~1 min o site fica em `https://SEU_USUARIO.github.io/SEU_REPO/`.

Sem mais nada, já funciona em **modo demo** (cada aparelho com seus próprios dados).

---

## 3. Ligar a sincronização (Supabase) — opcional, recomendado

Assim os dois veem o mesmo cofre, cada um no seu celular.

1. Crie uma conta grátis em [supabase.com](https://supabase.com) e um **New project**.
2. **SQL Editor → New query**: cole todo o `supabase/schema.sql`, **troque os dois e-mails**
   no bloco SEED pelos que vocês vão usar para entrar, e clique em **Run**.
3. **Project Settings → API**: copie a **Project URL** e a **anon public key**.
4. Cole as duas em `js/config.js`:
   ```js
   export const SUPABASE_URL = "https://xxxx.supabase.co";
   export const SUPABASE_ANON_KEY = "eyJ...";
   ```
5. (Opcional) Em **Authentication → URL Configuration**, adicione a URL do seu GitHub Pages
   em *Redirect URLs* para o link de e-mail voltar certo.
6. Faça commit/push do `config.js`. Pronto — agora o site pede login por e-mail e sincroniza.

> A `anon key` é **pública por design** no Supabase; quem protege os dados são as políticas
> de Row Level Security do `schema.sql` (só os e-mails cadastrados acessam o cofre).

### Login
Cada um entra com o próprio e-mail (link mágico, sem senha). O link chega no e-mail e deve
ser aberto **no mesmo aparelho**. A sessão fica salva — só precisa logar uma vez por aparelho.

---

## Como o saldo é calculado

- **Enviei pra poupar** (`deposit`) → **soma** ao saldo do cofre.
- **Devolução** (`withdrawal`) → **subtrai** do saldo.
- **Gastei** (`spend`) → **não** mexe no saldo (é o dinheiro dele que não foi poupado).
  Serve para medir a **taxa de poupança** e a disciplina.

**Saldo no cofre = total enviado − total devolvido.**

---

## Estrutura

```
cofre-mano/
├─ index.html            # telas e navegação
├─ css/styles.css        # tema escuro fintech
├─ js/
│  ├─ config.js          # chaves do Supabase (vazio = modo demo)
│  ├─ data.js            # camada de dados (localStorage / Supabase)
│  ├─ calc.js            # cálculos (saldo, séries, taxas)
│  ├─ charts.js          # gráficos (Chart.js)
│  ├─ simulator.js       # simulador de metas
│  ├─ gamification.js    # ofensiva, medalhas, cofrinho
│  ├─ format.js          # moeda BRL e datas
│  └─ app.js             # orquestrador
└─ supabase/schema.sql   # tabelas + segurança (RLS) + seed
```

Sem build, sem dependências instaladas: bibliotecas (Chart.js e supabase-js) vêm por CDN.
