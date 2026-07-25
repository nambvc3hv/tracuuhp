import { NextRequest, NextResponse } from "next/server";

// Simple in-memory rate limiter
const rateLimit = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimit.get(ip);

  if (!entry || now > entry.resetTime) {
    rateLimit.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }

  entry.count++;
  return true;
}

function sanitize(input: string): string {
  return input
    .replace(/[<>'";&]/g, "")
    .trim()
    .slice(0, 100);
}

function normalizeVietnamese(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFC")
    .replace(/\s+/g, " ")
    .trim();
}

function maskPhone(phone: string): string {
  if (phone.length <= 4) return phone;
  const visible = phone.slice(-4);
  return "*".repeat(phone.length - 4) + visible;
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "unknown";
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: "Bạn đã tra cứu quá nhiều lần. Vui lòng thử lại sau 1 phút." },
        { status: 429 }
      );
    }

    // Validate environment variables
    const apiKey = process.env.GOOGLE_SHEETS_API_KEY;
    const sheetId = process.env.GOOGLE_SHEET_ID;
    const sheetName = process.env.SHEET_NAME;

    if (!apiKey || !sheetId || !sheetName) {
      console.error("Missing Google Sheets environment variables");
      return NextResponse.json(
        { error: "Hệ thống chưa được cấu hình. Vui lòng liên hệ quản trị viên." },
        { status: 500 }
      );
    }

    // Parse and validate input
    const body = await request.json();
    const hoTen = sanitize(body.hoTen || "");
    const lop = sanitize(body.lop || "");

    if (!hoTen || !lop) {
      return NextResponse.json(
        { error: "Vui lòng nhập đầy đủ thông tin: Họ tên học sinh và Tên lớp." },
        { status: 400 }
      );
    }

    // Fetch data from Google Sheets
    const encodedSheetName = encodeURIComponent(sheetName);
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodedSheetName}?key=${apiKey}`;

    const response = await fetch(url, {
      next: { revalidate: 60 },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Google Sheets API error:", response.status, errorText);
      return NextResponse.json(
        { error: "Không thể kết nối đến cơ sở dữ liệu. Vui lòng thử lại sau." },
        { status: 502 }
      );
    }

    const data = await response.json();
    const rows: string[][] = data.values || [];

    if (rows.length < 2) {
      return NextResponse.json(
        { error: "Chưa có dữ liệu học phí." },
        { status: 404 }
      );
    }

    // Skip header row, search for matching records
    // Columns: A(STT), B(Ho ten), C(Lớp), D(Số buổi), E(Số tiền), F(Nội dung chuyển khoản), G(Ghi chú), H(Trạng thái), I(QR code)
    const normalizedHoTen = normalizeVietnamese(hoTen);
    const normalizedLop = normalizeVietnamese(lop);

    const results = rows.slice(1).filter((row) => {
      const rowHoTen = normalizeVietnamese(row[1] || ""); // Column B
      const rowLop = normalizeVietnamese(row[2] || ""); // Column C

      return (
        rowHoTen.includes(normalizedHoTen) &&
        rowLop.includes(normalizedLop)
      );
    });

    if (results.length === 0) {
      return NextResponse.json(
        {
          error:
            "Không tìm thấy thông tin. Vui lòng kiểm tra lại Họ tên học sinh và Tên lớp.",
        },
        { status: 404 }
      );
    }

    // Map results according to Google Sheet columns
    const mappedResults = results.map((row) => ({
      stt: row[0] || "",           // Column A
      hoTen: row[1] || "",         // Column B
      lop: row[2] || "",           // Column C
      soBuoi: row[3] || "",        // Column D
      soTien: row[4] || "",        // Column E
      ndck: row[5] || "",          // Column F (Nội dung chuyển khoản)
      ghiChu: row[6] || "",        // Column G
      trangThai: row[7] || "",     // Column H
      qrCode: row[8] || "",        // Column I
    }));

    return NextResponse.json({ results: mappedResults });
  } catch (error) {
    console.error("Lookup error:", error);
    return NextResponse.json(
      { error: "Đã có lỗi xảy ra. Vui lòng thử lại sau." },
      { status: 500 }
    );
  }
}
