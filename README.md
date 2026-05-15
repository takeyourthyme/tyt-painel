[![Untitled UI React](https://www.untitledui.com/react/untitled-ui-react-open-graph.jpg)](https://www.untitledui.com/react)

# Untitled UI React

[Untitled UI React](https://www.untitledui.com/react) is the world’s largest collection of open-source React components built with Tailwind CSS and React Aria. Everything you need to design and develop modern, beautiful interfaces—fast. Just copy, paste, and build.

Built with React 19.1, Tailwind CSS v4.1, TypeScript 5.8, and React Aria, Untitled UI React components deliver modern performance, type safety, and maintainability.

[Learn more](https://www.untitledui.com/react) • [Documentation](https://www.untitledui.com/react/docs/introduction) • [Figma](https://www.untitledui.com/figma) • [FAQs](https://www.untitledui.com/faqs)

## Documentation

Check out our documentation here → [untitledui.com/react/docs](https://www.untitledui.com/react/docs/introduction)

## Installation

Check out our installation guide here → [untitledui.com/react/docs/installation](https://www.untitledui.com/react/docs/installation)

## Resources

Untitled UI React is built on top of [Untitled UI Figma](https://www.untitledui.com/figma), the world's largest and most popular Figma UI kit and design system. Explore more:

**[Untitled UI Figma:](https://www.untitledui.com/figma)** The world's largest Figma UI kit and design system.
<br/>
**[Untitled UI Icons:](https://www.untitledui.com/icons)** A clean, consistent, and neutral icon library crafted specifically for modern UI design.
<br/>
**[Untitled UI file icons:](https://www.untitledui.com/resources/file-icons)** Free file format icons, designed specifically for modern web and UI design.
<br/>
**[Untitled UI flag icons:](https://www.untitledui.com/resources/flag-icons)** Free country flag icons, designed specifically for modern web and UI design.
<br/>
**[Untitled UI avatars:](https://www.untitledui.com/resources/avatars)** Free placeholder user avatars and profile pictures to use in your projects.
<br/>
**[Untitled UI logos:](https://www.untitledui.com/resources/logos)** Free fictional company logos to use in your projects.

## License

Untitled UI React open-source components are licensed under the MIT license, which means you can use them for free in unlimited commercial projects.

> [!NOTE]
> This license applies only to the components included in this open-source repository. [Untitled UI React PRO](https://www.untitledui.com/react) includes hundreds more advanced UI components and page examples and is subject to a separate [license agreement](https://www.untitledui.com/license).

[Untitled UI license agreement →](https://www.untitledui.com/license)

[Frequently asked questions →](https://www.untitledui.com/faqs)
# tyt-painel

## Dashboard (Painel TYT)

### APIs consumidas

| Área | Endpoint | Método | Auth | Query | Usado para |
| --- | --- | --- | --- | --- | --- |
| Chefs | `/api/chefs` | GET | Bearer token | `status` (opcional) | Indicador “Aprovações pendentes (Chefs)” e tendência |
| Serviços | `/api/kitchen-orders` | GET | Bearer token | `code` (opcional) | Indicadores e gráficos de serviços |

### Autenticação

- Header `Authorization: Bearer <token>`, usando o token salvo no `localStorage` (`tyt_access_token`).

### Formato de retorno esperado

- A tela aceita respostas no formato `T[]` (array) ou envelope com lista em `data`, `items` ou `results`.
- Campos lidos (quando existirem) para cálculo de métricas:
  - Chefs: `status`, `cadastro_aprovado` (ou variações), `createdAt`/`created_at`.
  - Kitchen Orders: `status`, `type`, `event_date`, `createdAt`/`created_at`, `updatedAt`/`updated_at`, `match_time_hours` (ou `matchTimeHours`).

### Regras de tratamento e cálculo

- Carregamento automático ao entrar na rota do dashboard, com chamadas paralelas para chefs e kitchen orders.
- Retry automático para falhas transitórias (HTTP `408`, `429`, `5xx` e erros de rede), com até 2 tentativas adicionais e backoff exponencial.
- Estados de UI:
  - Loading: indicador “Carregando dados...” no header.
  - Erro: banner amigável com resumo e botão “Tentar novamente”.
- Períodos:
  - “Mês atual”, “Mês anterior”, “Últimos 3 meses” e “Custom” (mês da data selecionada).
  - Tendência sempre comparada com o período imediatamente anterior equivalente.
# tyt-painel
# tyt-painel
# tyt-painel
# tyt-painel
