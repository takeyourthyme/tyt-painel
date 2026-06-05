import { type ComponentType } from "react";
import * as Lucide from "lucide-react";
import {
    AlertCircle,
    Archive,
    ArrowLeft,
    ArrowRight,
    Check,
    CheckCircle,
    Container,
    LayersTwo01,
    ReceiptCheck,
    Settings01,
    Star01,
    Zap,
} from "@untitledui/icons";

export interface IconCatalogItem {
    id: string;
    label: string;
    Icon: ComponentType<{ className?: string }>;
}

export const ICON_CATALOG: IconCatalogItem[] = (() => {
    const processedIds = new Set<string>([
        "alert-circle",
        "archive",
        "arrow-left",
        "arrow-right",
        "check",
        "check-circle",
        "container",
        "layers-two",
        "receipt",
        "settings",
        "star",
        "zap",
    ]);

    const base = [
        { id: "alert-circle", label: "AlertCircle", Icon: AlertCircle },
        { id: "archive", label: "Archive", Icon: Archive },
        { id: "arrow-left", label: "ArrowLeft", Icon: ArrowLeft },
        { id: "arrow-right", label: "ArrowRight", Icon: ArrowRight },
        { id: "check", label: "Check", Icon: Check },
        { id: "check-circle", label: "CheckCircle", Icon: CheckCircle },
        { id: "container", label: "Container", Icon: Container },
        { id: "layers-two", label: "LayersTwo01", Icon: LayersTwo01 },
        { id: "receipt", label: "ReceiptCheck", Icon: ReceiptCheck },
        { id: "settings", label: "Settings01", Icon: Settings01 },
        { id: "star", label: "Star01", Icon: Star01 },
        { id: "zap", label: "Zap", Icon: Zap },
    ];

    const lucideItems = Object.keys(Lucide)
        .filter((key) => {
            const val = (Lucide as any)[key];
            return typeof val === "function" || (val && typeof val === "object" && (val as any).$$typeof);
        })
        .map((key) => {
            const id = key
                .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
                .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
                .toLowerCase();
            return {
                id,
                label: key,
                Icon: (Lucide as any)[key] as ComponentType<{ className?: string }>,
            };
        })
        .filter((item) => {
            if (processedIds.has(item.id)) {
                return false;
            }
            processedIds.add(item.id);
            return true;
        });

    return [...base, ...lucideItems];
})();
