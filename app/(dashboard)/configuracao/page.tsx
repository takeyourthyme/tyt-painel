"use client";

import { useCallback, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { FileIcon as FileTypeIcon } from "@untitledui/file-icons";
import { CheckCircle, Trash01, UploadCloud02, XCircle } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { ButtonUtility } from "@/components/base/buttons/button-utility";
import { ProgressBar } from "@/components/base/progress-indicators/progress-indicators";
import { Toggle } from "@/components/base/toggle/toggle";
import { cx } from "@/utils/cx";
import { getReadableFileSize } from "@/components/application/file-upload/file-upload-base";

type UploadItem = {
    id: string;
    name: string;
    size: number;
    progress: number;
    failed: boolean;
    type: string | null;
};

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

function fileTypeFromName(name: string): string | null {
    const ext = name.split(".").pop()?.trim().toLowerCase();
    if (!ext) return null;
    return ext;
}

function UploadDropZone({
    hint,
    accept,
    onPickFile,
}: {
    hint: string;
    accept?: string;
    onPickFile: (file: File) => void;
}) {
    const inputId = useMemo(() => `upload-${Math.random().toString(16).slice(2)}`, []);
    const inputRef = useRef<HTMLInputElement>(null);
    const [isDraggingOver, setIsDraggingOver] = useState(false);

    const processFiles = useCallback(
        (files: File[]) => {
            const first = files[0];
            if (!first) return;
            onPickFile(first);
        },
        [onPickFile],
    );

    const handleDrop = useCallback(
        (event: React.DragEvent<HTMLDivElement>) => {
            event.preventDefault();
            setIsDraggingOver(false);
            const files = Array.from(event.dataTransfer.files || []);
            processFiles(files);
        },
        [processFiles],
    );

    return (
        <div
            onDragOver={(e) => {
                e.preventDefault();
                setIsDraggingOver(true);
            }}
            onDragEnter={(e) => {
                e.preventDefault();
                setIsDraggingOver(true);
            }}
            onDragLeave={(e) => {
                e.preventDefault();
                setIsDraggingOver(false);
            }}
            onDragEnd={(e) => {
                e.preventDefault();
                setIsDraggingOver(false);
            }}
            onDrop={handleDrop}
            className={cx(
                "relative flex flex-col items-center gap-3 rounded-xl bg-primary px-6 py-6 text-tertiary ring-1 ring-secondary transition duration-100 ease-linear ring-inset",
                isDraggingOver && "ring-2 ring-brand",
            )}
        >
            <div className="flex size-10 items-center justify-center rounded-full bg-secondary ring-1 ring-secondary ring-inset">
                <UploadCloud02 className="size-5 text-tertiary" aria-hidden />
            </div>

            <div className="flex flex-col gap-1 text-center">
                <div className="flex justify-center gap-1">
                    <input
                        ref={inputRef}
                        id={inputId}
                        type="file"
                        className="sr-only"
                        accept={accept}
                        onChange={(e) => {
                            const files = Array.from(e.target.files || []);
                            processFiles(files);
                            e.currentTarget.value = "";
                        }}
                    />
                    <label htmlFor={inputId}>
                        <Button color="link-color" size="md" onClick={() => inputRef.current?.click()}>
                            Clique para enviar
                        </Button>
                    </label>
                    <span className="text-sm text-tertiary">ou arraste o arquivo</span>
                </div>
                <p className="text-xs text-tertiary">{hint}</p>
            </div>
        </div>
    );
}

function UploadItemRow({
    item,
    onDelete,
}: {
    item: UploadItem;
    onDelete: () => void;
}) {
    const isComplete = item.progress === 100 && !item.failed;

    return (
        <div
            className={cx(
                "relative flex gap-3 rounded-xl bg-primary p-4 ring-1 ring-secondary transition-shadow duration-100 ease-linear ring-inset",
                item.failed && "ring-2 ring-error",
            )}
        >
            <FileTypeIcon className="size-10 shrink-0 dark:hidden" type={(item.type as any) ?? "empty"} theme="light" variant="default" />
            <FileTypeIcon className="size-10 shrink-0 not-dark:hidden" type={(item.type as any) ?? "empty"} theme="dark" variant="default" />

            <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex w-full min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-secondary">{item.name}</p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2">
                            <p className="text-sm text-tertiary">{getReadableFileSize(item.size)}</p>
                            <span className="h-3 w-px rounded-full bg-border-primary" aria-hidden />
                            <div className="flex items-center gap-1">
                                {isComplete ? <CheckCircle className="size-4 stroke-[2.5px] text-fg-success-primary" /> : null}
                                {isComplete ? <p className="text-sm font-medium text-success-primary">Concluído</p> : null}
                                {item.failed ? <XCircle className="size-4 text-fg-error-primary" /> : null}
                                {item.failed ? <p className="text-sm font-medium text-error-primary">Falha</p> : null}
                            </div>
                        </div>
                    </div>
                    <ButtonUtility color="tertiary" tooltip="Remover" icon={Trash01} size="xs" className="-mt-2 -mr-2 self-start" onClick={onDelete} />
                </div>

                {!item.failed ? (
                    <div className="mt-2 w-full">
                        <ProgressBar labelPosition="right" max={100} min={0} value={item.progress} />
                    </div>
                ) : (
                    <p className="mt-2 text-sm text-error-primary">Falha no envio. Tente novamente.</p>
                )}
            </div>
        </div>
    );
}

export default function ConfiguracaoPage() {
    const [showLgpdBanner, setShowLgpdBanner] = useState(true);
    const [showCookiesBanner, setShowCookiesBanner] = useState(true);

    const [termsFiles, setTermsFiles] = useState<UploadItem[]>([]);
    const [lgpdFiles, setLgpdFiles] = useState<UploadItem[]>([]);

    const addFile = useCallback((file: File, setList: Dispatch<SetStateAction<UploadItem[]>>) => {
        const failed = file.size > MAX_UPLOAD_BYTES;
        const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        setList((prev) => [
            {
                id,
                name: file.name,
                size: file.size,
                progress: failed ? 0 : 100,
                failed,
                type: fileTypeFromName(file.name),
            },
            ...prev,
        ]);
    }, []);

    return (
        <main className="min-h-0 flex-1 bg-secondary_alt px-4 py-6 pb-10 md:px-6 lg:px-8">
            <div className="mx-auto flex w-full max-w-[1372px] flex-col gap-8">
                <header className="flex flex-col gap-2">
                    <h1 className="text-display-md font-normal text-primary lg:text-display-lg">Configurações</h1>
                    <p className="text-sm text-tertiary">Gerencie os documentos legais e as preferências de privacidade da plataforma.</p>
                    <div className="mt-2 h-px w-full bg-border-secondary" aria-hidden />
                </header>

                <section className="grid gap-6 md:grid-cols-[240px_1fr] md:items-start">
                    <div>
                        <p className="text-sm font-semibold text-primary">Termos e Políticas</p>
                        <p className="mt-1 text-sm text-tertiary">Anexe o documento de Termos de Serviço e Política de Privacidade.</p>
                    </div>
                    <div className="flex flex-col gap-4">
                        <UploadDropZone
                            accept=".pdf,.doc,.docx"
                            hint="PDF, DOC ou DOCX (máx. 10MB)"
                            onPickFile={(file) => addFile(file, setTermsFiles)}
                        />
                        {termsFiles.length ? (
                            <div className="flex flex-col gap-3">
                                {termsFiles.map((f) => (
                                    <UploadItemRow key={f.id} item={f} onDelete={() => setTermsFiles((prev) => prev.filter((x) => x.id !== f.id))} />
                                ))}
                            </div>
                        ) : null}
                    </div>
                </section>

                <div className="h-px w-full bg-border-secondary" aria-hidden />

                <section className="grid gap-6 md:grid-cols-[240px_1fr] md:items-start">
                    <div>
                        <p className="text-sm font-semibold text-primary">LGPD</p>
                        <p className="mt-1 text-sm text-tertiary">Ative para exibir o aviso de conformidade com a Lei Geral de Proteção de Dados.</p>
                    </div>
                    <div className="flex flex-col gap-4">
                        <Toggle
                            size="sm"
                            isSelected={showLgpdBanner}
                            onChange={setShowLgpdBanner}
                            label="Exibir banner de consentimento e conformidade com a LGPD para os usuários."
                        />
                        <UploadDropZone
                            accept="image/*"
                            hint="SVG, PNG, JPG ou GIF (máx. 800x400px)"
                            onPickFile={(file) => addFile(file, setLgpdFiles)}
                        />
                        {lgpdFiles.length ? (
                            <div className="flex flex-col gap-3">
                                {lgpdFiles.map((f) => (
                                    <UploadItemRow key={f.id} item={f} onDelete={() => setLgpdFiles((prev) => prev.filter((x) => x.id !== f.id))} />
                                ))}
                            </div>
                        ) : null}
                    </div>
                </section>

                <div className="h-px w-full bg-border-secondary" aria-hidden />

                <section className="grid gap-6 md:grid-cols-[240px_1fr] md:items-start">
                    <div>
                        <p className="text-sm font-semibold text-primary">Cookies</p>
                        <p className="mt-1 text-sm text-tertiary">Ative para exibir o banner de consentimento de cookies aos usuários.</p>
                    </div>
                    <div className="flex flex-col gap-4">
                        <Toggle size="sm" isSelected={showCookiesBanner} onChange={setShowCookiesBanner} label="Exibir banner de Cookies" />
                    </div>
                </section>
            </div>
        </main>
    );
}
