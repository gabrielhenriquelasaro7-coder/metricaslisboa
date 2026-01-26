import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Globe, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const languages = [
  { code: "pt-BR", name: "Português", flag: "🇧🇷" },
  { code: "en-US", name: "English", flag: "🇺🇸" },
  { code: "es", name: "Español", flag: "🇪🇸" },
];

export default function LanguageSelector() {
  const { i18n, t } = useTranslation();

  const changeLanguage = (lng: string) => {
    // Executa a mudança global de idioma
    i18n.changeLanguage(lng);
    // Persiste manualmente para garantir sincronia com o motor de deteção
    localStorage.setItem("i18nextLng", lng);

    const langName = languages.find((l) => l.code === lng)?.name;
    toast.success(`${t("settings.languageChanged", "Idioma alterado para")} ${langName}`);
  };

  // Identifica o idioma atual ou usa o padrão
  const currentLanguage = languages.find((l) => l.code === i18n.language) || languages[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start gap-2 bg-background/50 border-sidebar-border hover:bg-accent"
        >
          <Globe className="h-4 w-4 text-muted-foreground" />
          <span className="flex-1 text-left">{currentLanguage.name}</span>
          <span className="text-xs">{currentLanguage.flag}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[200px] bg-popover border-border shadow-xl">
        {languages.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => changeLanguage(lang.code)}
            className={cn(
              "flex items-center justify-between cursor-pointer py-2",
              i18n.language === lang.code && "bg-primary/10 text-primary font-medium",
            )}
          >
            <div className="flex items-center gap-2">
              <span>{lang.flag}</span>
              <span>{lang.name}</span>
            </div>
            {i18n.language === lang.code && <Check className="h-4 w-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
