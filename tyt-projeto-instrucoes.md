# Manual do Projeto — Take Your Thyme (TyT)

Este documento centraliza as regras de negócio, especificações das APIs, rotas e tipos do **Take Your Thyme (TyT)** para servir como contexto a IAs no desenvolvimento dos portais de **Clientes** e **Chefs**.

---

## 1. Visão Geral do Projeto
O TyT conecta clientes a Personal Chefs parceiros. O ecossistema possui 3 pilares:
1. **Painel Admin (`tyt-painel`):** Gestão de cadastros (chefs, clientes), catálogo (pratos, insumos), pedidos e finanças.
2. **Visão Cliente:** Contratação de serviços, seleção de pratos, pagamento e avaliações.
3. **Visão Chef:** Perfil, disponibilidade semanal, aceitação de serviços e propostas de orçamento.

---

## 2. Fluxos e Regras de Negócio

### 2.1. Tipos de Serviço (Ordens de Cozinha)
*   **Meal Prep (Refeições Planejadas):** Cliente escolhe pratos prontos do cardápio e quantidades (`dishes` + `quantity`). Não há seleção de "Temas".
*   **Special Service (Get Together / Customizado):** Jantares/eventos privados. Cliente envia descrição livre (`client_request`). Sem pratos fixos iniciais.
    *   **Proposta (Special Service Proposal):** Administração/chef envia lista de itens customizados (descrição + valor). Status: `AWAITING_CLIENT` -> `ACCEPTED` (aprovado) ou `DECLINED` (recusado, permite reenvio).

### 2.2. Ciclo de Vida do Pedido (Kitchen Order Status)
*   `PENDING`: Aguardando match com chef disponível.
*   `IN_REVIEW`: Em análise (proposta em criação para Special Service) ou aguardando aceite (Meal Prep).
*   `CONFIRMED`: Chef aceitou, proposta aprovada (se houver) e pagamento processado.
*   `COMPLETED`: Serviço executado.
*   `DECLINED`: Chef recusou match. O pedido volta a buscar outro chef.
*   `CANCELLED`: Cancelado pelo cliente ou admin.
*   `CANCELLATION_REQUESTED`: Cliente solicitou cancelamento do pedido confirmado, aguardando estorno/admin.

### 2.3. Onboarding e Status dos Chefs
*   **Status (`ChefStatus`):** `cadastro` (ou `pending` na API) -> `analise` -> `entrevista` -> `documentacao` -> `ativo` (ou `active` na API, visível) | `inativo` (ou `inactive` na API).
*   **Perfil:** Foto, Instagram, Formação, idiomas, especialidades, tipos de serviços aceitos (`disponivel_para`), veículo e disponibilidade para viagem.
*   **Disponibilidade:** Por dia da semana (`dia_semana`: `segunda`, `terca`, `quarta`, `quinta`, `sexta`, `sabado`, `domingo`) e período (`manha`, `tarde`, `noite`).

### 2.4. Estrutura do Cardápio
*   `ativo`: Visibilidade no cardápio geral.
*   `destaque_site`: Exibição na página inicial institucional.
*   **Classificações:** Categorias de prato, tipos de cozinha, temas (apenas Get Together), ingredientes principais, preferências culinárias (tags) e ingredientes individuais (insumos).

---

## 3. Particularidades Críticas da API (Erros de Grafia)

> [!IMPORTANT]
> A API utiliza termos com erros de grafia históricos. **Use exatamente estas nomenclaturas nas integrações:**
> 1. **`meal_preap`** (com "a" extra): Para a modalidade "Meal Prep".
> 2. **`get_togheter`** (com "h" invertido): Para a modalidade "Get Together".

---

## 4. API Endpoints e Contratos de Dados

### 4.1. Configuração e Autenticação
*   **URL Base:** `NEXT_PUBLIC_TYT_API_URL` (produção: `https://tyt-api.vercel.app`).
*   **Autenticação:** Header `Authorization: Bearer <JWT>`.
*   **LocalStorage:** `tyt_access_token` (JWT) e `tyt_user` (JSON do usuário).

### 4.2. Endpoints da API (`tytEndpoints`)

| Módulo | Endpoint | Método | Descrição |
| :--- | :--- | :--- | :--- |
| **Auth** | `/api/auth/login` | `POST` | Login (retorna JWT e dados do usuário) |
| | `/api/auth/forgot-password` \| `/reset-password` | `POST` | Recuperação e redefinição de senha |
| | `/api/auth/change-password` | `POST` | Altera senha do usuário logado |
| **Users** | `/api/users` | `GET`/`POST` | Listagem geral e criação de usuário |
| | `/api/users/:id` | `GET`/`PUT` | Busca detalhada e edição cadastral |
| | `/api/users/:id/toggle-status` | `PUT` | Alterna status (ativo/inativo) |
| **Chefs** | `/api/chefs` | `GET` | Lista chefs (filtra por status) |
| | `/api/chefs/update-status` | `PUT` | Atualiza status e aprovação do chef |
| **Clientes** | `/api/clientes` | `GET` | Lista clientes cadastrados |
| **Insumos** | `/api/ingredientes` | `GET`/`POST` | Lista e cria ingredientes |
| | `/api/ingredientes/:id` | `GET`/`PUT`/`DELETE` | Consulta, edita e remove ingrediente |
| | `/api/ingredientes/:id/toggle-status` | `PUT` | Alterna status ativo/inativo |
| | `/api/ingredientes/upload` \| `/template/download` | `POST`/`GET` | Upload CSV em massa e download do modelo |
| **Catálogos**| `/api/ingredientes-categorias` | `GET`/`POST`/`PUT`/`DELETE`| CRUD de categorias de ingredientes |
| **Pratos** | `/api/pratos` | `GET`/`POST` | Lista e cria pratos |
| | `/api/pratos/:id` | `GET`/`PUT`/`DELETE` | Consulta, edita e deleta prato |
| **Catálogos**| `/api/pratos-categorias` \| `/api/tipos-cozinha` | `GET`/`POST`/`PUT`/`DELETE`| CRUD de categorias de prato e cozinhas |
| | `/api/temas` \| `/api/ingredientes-principais` | `GET`/`POST`/`PUT`/`DELETE`| CRUD de temas e ingredientes principais |
| | `/api/pref-culinarias` | `GET`/`POST`/`PUT`/`DELETE`| CRUD de preferências alimentares |
| **Orders** | `/api/kitchen-orders` | `GET`/`POST` | Lista ordens ou cria novo pedido |
| | `/api/kitchen-orders/:code` | `GET` | Detalhes do pedido pelo código |
| | `/api/kitchen-orders/:id/status` | `PUT` | Altera status do pedido |
| | `/api/kitchen-orders/:code/cancel` | `PUT` | Cancela pedido pelo código |
| | `/api/kitchen-orders/:code/assign-chef` | `PUT` | Vincula chef à ordem de serviço |
| | `/api/kitchen-orders/:code/special-service-proposal`| `PUT` | Atualiza proposta financeira (Special Service) |

### 4.3. Estrutura dos Contratos de Dados (TypeScript)

#### Usuário Base (`TytUser`)
```typescript
export type TytUser = {
    id: number;
    nome: string;
    cpf: string;
    data_nascimento: string; // YYYY-MM-DD
    whatsapp: string;
    email: string;
    cep: string;
    endereco: string;
    numero: string;
    complemento: string | null;
    bairro: string;
    cidade: string;
    estado: string;
    foto: string | null;
    tipo_usuario: "admin" | "chef" | "cliente";
    createdAt: string;
    usuario_cliente: TytUsuarioCliente | null;
    usuario_chef: TytUsuarioChef | null;
};
```

#### Perfil do Chef (`TytUsuarioChef`)
```typescript
export type TytUsuarioChef = {
    id: number;
    id_user: number;
    disponivel_viajar: boolean;
    tipo_transporte: string;
    instagram: string;
    cadastro_aprovado: boolean;
    status: string; // "cadastro" | "analise" | "entrevista" | "documentacao" | "ativo" | "inativo"
    escola_formacao: string;
    conte_sobre_voce: string;
    usuario_chef_idiomas: { idioma: string; active: boolean }[];
    usuario_chef_especialidades: { especialidade: string; active: boolean }[];
    usuario_chef_disponivel_para: { disponivel_para: string; active: boolean }[];
    usuario_chef_disponibilidade: {
        dia_semana: string; // "segunda", "terca", etc.
        manha: boolean;
        tarde: boolean;
        noite: boolean;
        active: boolean;
    }[];
};
```

#### Ordem de Cozinha (`KitchenOrder`)
```typescript
export type KitchenOrderListItem = {
    id: number;
    code: string; // Ex: "TYT-10293"
    type: "meal_preap" | "get_togheter"; // Nota: typos da API
    status: "PENDING" | "IN_REVIEW" | "CONFIRMED" | "COMPLETED" | "DECLINED" | "CANCELLED" | "CANCELLATION_REQUESTED";
    city: string;
    event_date: string; // YYYY-MM-DD
    people_quantity: number;
    createdAt: string;
    cliente: { id: number; nome: string; foto: string | null } | null;
    chef: { id: number; nome: string; foto: string | null } | null;
};

export type KitchenOrderDetails = {
    id: number;
    code: string;
    type: string;
    status: string;
    event_date: string;
    event_time: string; // Ex: "19:00"
    people_quantity: number;
    city: string;
    address: string;
    number: string;
    complement: string | null;
    district: string;
    observations: string | null;
    client_request: string | null; // Apenas no Special Service
    dishes: {
        dish: { id: number; nome_prato: string; foto1: string | null };
        quantity: number;
    }[];
    special_service_proposal: {
        id: number;
        status: "AWAITING_CLIENT" | "ACCEPTED" | "DECLINED";
        items: { description: string; price: number }[];
    } | null;
};
```

#### Formulário de Prato (`PratoFormFields`)
```typescript
export type PratoFormFields = {
    nome_prato: string;
    descricao: string;
    quantidade: number; // Porções padrão
    ativo: boolean;
    categorias: string; // IDs por vírgula. Ex: "1,3"
    tipos_cozinha: string; // IDs por vírgula.
    temas: string; // IDs por vírgula.
    ingredientes_principais: string; // IDs por vírgula.
    pref_culinarias: string; // IDs por vírgula.
    ingredientes: string; // IDs de insumos por vírgula.
    foto1?: File | null;
    foto2?: File | null;
    ficha_tecnica?: File | null;
    receita?: File | null;
    meal_preap: boolean; // Typo!
    get_togheter: boolean; // Typo!
    destaque_site: boolean;
};
```

---

## 5. Dicas de Integração para Prompts de IA

1. **Formatação de Dados:** Datas seguem o padrão ISO `YYYY-MM-DD`. Telefones usam máscara `(99) 99999-9999` no front-end, mas devem ser limpos conforme exigido pela API.
2. **Respeito aos Typos:** Garanta que a IA use os campos `meal_preap` e `get_togheter` nos formulários/objetos de pratos e ordens.
3. **Filtros Dinâmicos:** Carregue opções de filtros (categorias, tipos de cozinha, temas, etc.) dinamicamente a partir dos endpoints de catálogos.
4. **Sessão Expirada (401/403):** Se houver erro HTTP 401 ou 403, limpe `tyt_access_token` e `tyt_user` do `localStorage` e redirecione para `/login`.
