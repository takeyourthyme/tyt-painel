import type {
    ChefDisponibilidadeInput,
    ChefProfileFields,
    CreateUserChefFields,
    CreateUserClienteFields,
    PratoFormFields,
    TemaFormFields,
    UserFormBaseFields,
} from "./types";

function appendIfDefined(fd: FormData, key: string, value: string | Blob | File | boolean | number | undefined | null) {
    if (value === undefined || value === null) return;
    if (value instanceof Blob) {
        fd.append(key, value);
        return;
    }
    fd.append(key, String(value));
}

function appendUserBase(fd: FormData, fields: UserFormBaseFields) {
    appendIfDefined(fd, "nome", fields.nome);
    appendIfDefined(fd, "cpf", fields.cpf);
    appendIfDefined(fd, "senha", fields.senha);
    appendIfDefined(fd, "email", fields.email);
    appendIfDefined(fd, "data_nascimento", fields.data_nascimento);
    appendIfDefined(fd, "whatsapp", fields.whatsapp);
    appendIfDefined(fd, "cep", fields.cep);
    appendIfDefined(fd, "endereco", fields.endereco);
    appendIfDefined(fd, "numero", fields.numero);
    appendIfDefined(fd, "complemento", fields.complemento);
    appendIfDefined(fd, "bairro", fields.bairro);
    appendIfDefined(fd, "cidade", fields.cidade);
    appendIfDefined(fd, "estado", fields.estado);
    appendIfDefined(fd, "tipo_usuario", fields.tipo_usuario);
    if (fields.foto) appendIfDefined(fd, "foto", fields.foto);
}

function appendChefProfile(fd: FormData, fields: ChefProfileFields) {
    appendIfDefined(fd, "disponivel_viajar", fields.disponivel_viajar);
    appendIfDefined(fd, "tipo_transporte", fields.tipo_transporte);
    appendIfDefined(fd, "instagram", fields.instagram);
    appendIfDefined(fd, "escola_formacao", fields.escola_formacao);
    appendIfDefined(fd, "conte_sobre_voce", fields.conte_sobre_voce);
    for (const idioma of fields.idiomas) fd.append("idiomas[]", idioma);
    for (const esp of fields.especialidades) fd.append("especialidades[]", esp);
    for (const disp of fields.disponivel_para) fd.append("disponivel_para[]", disp);
    fields.disponibilidade.forEach((slot: ChefDisponibilidadeInput, index) => {
        appendIfDefined(fd, `disponibilidade[${index}][dia_semana]`, slot.dia_semana);
        appendIfDefined(fd, `disponibilidade[${index}][manha]`, slot.manha);
        appendIfDefined(fd, `disponibilidade[${index}][tarde]`, slot.tarde);
        appendIfDefined(fd, `disponibilidade[${index}][noite]`, slot.noite);
    });
}

export function buildUserClienteFormData(fields: CreateUserClienteFields): FormData {
    const fd = new FormData();
    appendUserBase(fd, fields);
    if (fields.comprovante_end) appendIfDefined(fd, "comprovante_end", fields.comprovante_end);
    return fd;
}

export function buildUserChefFormData(fields: CreateUserChefFields): FormData {
    const fd = new FormData();
    appendUserBase(fd, fields);
    appendChefProfile(fd, fields);
    return fd;
}

export function buildPratoFormData(fields: PratoFormFields): FormData {
    const fd = new FormData();
    appendIfDefined(fd, "nome_prato", fields.nome_prato);
    appendIfDefined(fd, "descricao", fields.descricao);
    appendIfDefined(fd, "servings", fields.servings);
    appendIfDefined(fd, "quantidade", fields.servings);
    appendIfDefined(fd, "ativo", fields.ativo);
    appendIfDefined(fd, "categorias", fields.categorias);
    appendIfDefined(fd, "tipos_cozinha", fields.tipos_cozinha);
    appendIfDefined(fd, "temas", fields.temas);
    appendIfDefined(fd, "ingredientes_principais", fields.ingredientes_principais);
    appendIfDefined(fd, "pref_culinarias", fields.pref_culinarias);
    appendIfDefined(fd, "ingredientes", fields.ingredientes);
    appendIfDefined(fd, "foto1", fields.foto1);
    appendIfDefined(fd, "foto2", fields.foto2);
    appendIfDefined(fd, "ficha_tecnica", fields.ficha_tecnica);
    appendIfDefined(fd, "meal_preap", fields.meal_preap);
    appendIfDefined(fd, "get_togheter", fields.get_togheter);
    appendIfDefined(fd, "receita", fields.receita);
    appendIfDefined(fd, "destaque_site", fields.destaque_site);
    return fd;
}

export function buildIngredientesUploadFormData(file: File | Blob): FormData {
    const fd = new FormData();
    fd.append("file", file);
    return fd;
}

export function buildTemaFormData(fields: TemaFormFields): FormData {
    const fd = new FormData();
    appendIfDefined(fd, "nome", fields.nome);
    appendIfDefined(fd, "descricao", fields.descricao);
    appendIfDefined(fd, "ativo", fields.ativo);
    if (fields.foto) appendIfDefined(fd, "foto", fields.foto);
    if (fields.pratos) appendIfDefined(fd, "pratos", fields.pratos);
    return fd;
}
