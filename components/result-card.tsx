"use client";

import { useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { StudentResult } from "@/components/search-form";
import {
  User,
  BookOpen,
  Phone,
  Calendar,
  Banknote,
  FileText,
  MessageSquare,
  CircleCheckBig,
  Clock,
  QrCode,
  Copy,
  Check,
  X,
  Download,
} from "lucide-react";

interface ResultCardProps {
  result: StudentResult;
  index: number;
}

function getStatusVariant(status: string) {
  const normalized = status.toLowerCase().trim();
  if (
    normalized.includes("xong") ||
    normalized.includes("hoàn") ||
    normalized.includes("đã") ||
    normalized.includes("done") ||
    normalized.includes("paid")
  ) {
    return "default" as const;
  }
  if (
    normalized.includes("chưa") ||
    normalized.includes("pending") ||
    normalized.includes("chờ")
  ) {
    return "destructive" as const;
  }
  return "secondary" as const;
}

function getStatusIcon(status: string) {
  const normalized = status.toLowerCase().trim();
  if (
    normalized.includes("xong") ||
    normalized.includes("hoàn") ||
    normalized.includes("đã") ||
    normalized.includes("done") ||
    normalized.includes("paid")
  ) {
    return <CircleCheckBig className="h-3.5 w-3.5" />;
  }
  return <Clock className="h-3.5 w-3.5" />;
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-2">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
        {icon}
      </div>
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-sm font-medium text-foreground break-words">
          {value}
        </span>
      </div>
    </div>
  );
}

function CopyableRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = value;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [value]);

  if (!value) return null;

  return (
    <div className="flex items-start gap-3 py-2">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
        {icon}
      </div>
      <div className="flex flex-1 flex-col gap-1 min-w-0">
        <span className="text-xs text-muted-foreground">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground break-words">
            {value}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-7 shrink-0 gap-1.5 text-xs"
            onClick={handleCopy}
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 text-green-600" />
                <span className="text-green-600">{"Đã copy"}</span>
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                <span>{"Copy"}</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function normalizeQrSource(value: string) {
  const source = value.trim();

  // Google Sheets may contain an IMAGE() formula instead of the raw URL.
  const formulaUrl = source.match(/IMAGE\(\s*["']([^"']+)["']/i)?.[1];
  const url = formulaUrl || source;

  // VietQR currently redirects legacy JPG/PNG requests to SVG. Use the
  // final format directly so browsers do not render the redirect as a broken image.
  if (/^https?:\/\/img\.vietqr\.io\/image\//i.test(url)) {
    return url.replace(/\.(?:jpe?g|png)(?=\?|$)/i, ".svg");
  }

  // Convert common Google Drive sharing links into a renderable image URL.
  const driveFileId = url.match(/(?:drive\.google\.com\/(?:file\/d\/|open\?id=)|docs\.google\.com\/uc\?id=)([a-zA-Z0-9_-]+)/)?.[1];
  if (driveFileId) {
    return `https://drive.google.com/thumbnail?id=${driveFileId}&sz=w1000`;
  }

  return url;
}

function QrCodeViewer({ src }: { src: string }) {
  const [showModal, setShowModal] = useState(false);
  const imageSrc = normalizeQrSource(src);

  const handleDownload = useCallback(async () => {
    try {
      const response = await fetch(imageSrc);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "qrcode-hocphi.png";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      window.open(imageSrc, "_blank");
    }
  }, [imageSrc]);

  return (
    <>
      <div className="flex flex-col items-center gap-3 py-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <QrCode className="h-4 w-4" />
          <span className="text-sm font-medium">QR Code Chuyển Khoản</span>
        </div>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="group relative cursor-pointer rounded-xl border border-border bg-background p-3 shadow-sm transition-shadow hover:shadow-md"
          aria-label="Phóng to mã QR"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageSrc}
            alt="QR Code chuyển khoản học phí"
            className="h-56 w-56 object-contain"
          />
          <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-foreground/0 transition-colors group-hover:bg-foreground/5">
            <span className="rounded-full bg-card/90 px-3 py-1.5 text-xs font-medium text-foreground opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
              {"Bấm để phóng to"}
            </span>
          </div>
        </button>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={handleDownload}
          >
            <Download className="h-3.5 w-3.5" />
            {"Tải về"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground text-center max-w-xs">
          Quét mã QR bằng ứng dụng ngân hàng để chuyển khoản
        </p>
      </div>

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/60 p-4"
          onClick={() => setShowModal(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Xem mã QR phóng to"
        >
          <div
            className="relative flex max-h-[90vh] max-w-[90vw] flex-col items-center gap-4 rounded-2xl bg-card p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-secondary-foreground transition-colors hover:bg-accent"
              aria-label="Đóng"
            >
              <X className="h-4 w-4" />
            </button>
            <h3 className="text-base font-semibold text-foreground">
              QR Code Chuyển Khoản
            </h3>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageSrc}
              alt="QR Code chuyển khoản học phí - phóng to"
              className="max-h-[70vh] max-w-full object-contain"
              />
            <div className="flex items-center gap-3">
              <Button
                variant="default"
                size="sm"
                className="gap-1.5"
                onClick={handleDownload}
              >
                <Download className="h-4 w-4" />
                {"Tải ảnh về máy"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowModal(false)}
              >
                {"Đóng"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function ResultCard({ result, index }: ResultCardProps) {
  return (
    <Card className="border-border/60 shadow-lg overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg text-foreground">
              {index > 0 ? `Kết quả ${index + 1}` : "Thông Tin Học Phí"}
            </CardTitle>
          </div>
          {result.trangThai && (
            <Badge
              variant={getStatusVariant(result.trangThai)}
              className="flex items-center gap-1.5 shrink-0"
            >
              {getStatusIcon(result.trangThai)}
              {result.trangThai}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-0">
        <InfoRow
          icon={<User className="h-4 w-4" />}
          label="Họ và tên"
          value={result.hoTen}
        />
        <InfoRow
          icon={<BookOpen className="h-4 w-4" />}
          label="Lớp"
          value={result.lop}
        />
        <InfoRow
          icon={<Phone className="h-4 w-4" />}
          label="Số điện thoại PH"
          value={result.soDienThoai}
        />
        <InfoRow
          icon={<Calendar className="h-4 w-4" />}
          label="Số buổi"
          value={result.soBuoi}
        />

        <Separator className="my-2" />

        <div className="flex items-start gap-3 py-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Banknote className="h-4 w-4" />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-muted-foreground">Số tiền</span>
            <span className="text-lg font-bold text-primary">
              {result.soTien || "---"}
            </span>
          </div>
        </div>

        <CopyableRow
          icon={<FileText className="h-4 w-4" />}
          label="Nội dung chuyển khoản"
          value={result.ndck}
        />
        <InfoRow
          icon={<MessageSquare className="h-4 w-4" />}
          label="Ghi chú"
          value={result.ghiChu}
        />

        {result.qrCode && (
          <>
            <Separator className="my-2" />
            <QrCodeViewer src={result.qrCode} />
          </>
        )}
      </CardContent>
    </Card>
  );
}
