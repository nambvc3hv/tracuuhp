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
    const soDienThoai = sanitize(body.soDienThoai || "").replace(/\D/g, "");

    if (!hoTen || !lop || !soDienThoai) {
      return NextResponse.json(
        { error: "Vui lòng nhập đầy đủ thông tin: Họ tên, Lớp và Số điện thoại." },
        { status: 400 }
      );
    }

    if (soDienThoai.length < 9 || soDienThoai.length > 11) {
      return NextResponse.json(
        { error: "Số điện thoại không hợp lệ." },
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
    const normalizedHoTen = normalizeVietnamese(hoTen);
    const normalizedLop = normalizeVietnamese(lop);

    const results = rows.slice(1).filter((row) => {
      const rowHoTen = normalizeVietnamese(row[1] || "");
      const rowLop = normalizeVietnamese(row[2] || "");
      const rowPhone = (row[3] || "").replace(/\D/g, "");

      return (
        rowHoTen.includes(normalizedHoTen) &&
        rowLop.includes(normalizedLop) &&
        rowPhone.includes(soDienThoai)
      );
    });

    if (results.length === 0) {
      return NextResponse.json(
        {
          error:
            "Không tìm thấy thông tin. Vui lòng kiểm tra lại Họ tên, Lớp và Số điện thoại.",
        },
        { status: 404 }
      );
    }

    // Map results - mask phone for privacy
    const mappedResults = results.map((row) => ({
      stt: row[0] || "",
      hoTen: row[1] || "",
      lop: row[2] || "",
      soDienThoai: maskPhone(row[3] || ""),
      soBuoi: row[4] || "",
      soTien: row[5] || "",
      ndck: row[6] || "",
      ghiChu: row[7] || "",
      trangThai: row[8] || "",
      qrCode: row[9] || "",
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
