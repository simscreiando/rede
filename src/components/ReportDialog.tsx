import { useState } from "react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { REPORT_REASONS, type ReportTargetType } from "@/lib/rede";

export function ReportDialog({
  targetType,
  targetId,
  label = "Denunciar",
}: {
  targetType: ReportTargetType;
  targetId: string;
  label?: string;
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>("");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!user || !reason) {
      toast.error("Escolha um motivo para a denúncia.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("reports").insert({
      reporter_id: user.id,
      target_type: targetType,
      target_id: targetId,
      reason,
      details: details.trim() || null,
    });
    setBusy(false);
    if (error) {
      toast.error("Não foi possível registrar a denúncia agora.");
      return;
    }
    setOpen(false);
    setReason("");
    setDetails("");
    toast.success("Denúncia registrada. Você poderá acompanhar a decisão.");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground">
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Denunciar conteúdo</DialogTitle>
          <DialogDescription>
            A denúncia abre um processo interno: triagem, análise, decisão com justificativa e
            possibilidade de recurso.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Motivo</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue placeholder="Escolha o motivo" />
              </SelectTrigger>
              <SelectContent>
                {REPORT_REASONS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="detalhes">Detalhes (opcional)</Label>
            <Textarea
              id="detalhes"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Conte o que aconteceu, sem incluir dados de terceiros que não sejam necessários."
            />
          </div>

          <Button onClick={submit} disabled={busy} className="w-full">
            Enviar denúncia
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
