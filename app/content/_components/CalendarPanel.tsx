"use client";
// Kartu 2 — generate banyak draft konten sekaligus tersebar 1 bulan.
import { Calendar } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input, Label, Select } from "@/components/ui/Field";

export function CalendarPanel({
  monthStart,
  onMonthStartChange,
  postsPerWeek,
  onPostsPerWeekChange,
  generatingCalendar,
  onGenerate,
}: {
  monthStart: string;
  onMonthStartChange: (v: string) => void;
  postsPerWeek: number;
  onPostsPerWeekChange: (v: number) => void;
  generatingCalendar: boolean;
  onGenerate: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>2. Kalender Konten Bulanan</CardTitle>
      </CardHeader>
      <CardBody className="flex flex-col gap-4">
        <p className="text-sm text-text-muted">
          Generate banyak draft sekaligus, tersebar sepanjang bulan — rotasi produk yang sudah punya foto
          x 4 tema. Tiap post tetap draft (belum publish), review dulu di daftar di bawah sebelum kamu
          jadwalkan/publish.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="cal-month">Bulan</Label>
            <Input
              id="cal-month"
              type="month"
              value={monthStart.slice(0, 7)}
              onChange={(e) => onMonthStartChange(`${e.target.value}-01`)}
            />
          </div>
          <div>
            <Label htmlFor="cal-freq">Post per minggu</Label>
            <Select id="cal-freq" value={postsPerWeek} onChange={(e) => onPostsPerWeekChange(Number(e.target.value))}>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}x / minggu
                </option>
              ))}
            </Select>
          </div>
        </div>
        <Button type="button" variant="outline" loading={generatingCalendar} onClick={onGenerate}>
          <Calendar className="h-4 w-4" />
          Generate Kalender Bulan Ini
        </Button>
      </CardBody>
    </Card>
  );
}
