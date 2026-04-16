#!/usr/bin/env python3
"""Generate PDF invoices for Swavleba Keepz payment transactions."""

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from datetime import datetime, timedelta

# Register Arial Unicode for Georgian script support
pdfmetrics.registerFont(TTFont("ArialUni", "/Library/Fonts/Arial Unicode.ttf"))

# Georgia timezone UTC+4
GEO_TZ = timedelta(hours=4)

MONTHS_GE = {
    1: "იანვარი", 2: "თებერვალი", 3: "მარტი", 4: "აპრილი",
    5: "მაისი", 6: "ივნისი", 7: "ივლისი", 8: "აგვისტო",
    9: "სექტემბერი", 10: "ოქტომბერი", 11: "ნოემბერი", 12: "დეკემბერი",
}

# Company info
COMPANY = {
    "name": "Swavleba",
    "owner": "მათე არჩვაძე",
    "legal_form": "ინდივიდუალური მეწარმე",
    "address": "საქართველო, თბილისი, ლეო და ნოდარ გაბუნიას II შესახვევი, №3, ბინა 27",
    "email": "bejisscience@gmail.com",
    "phone": "+995 555 54 99 88",
    "website": "swavleba.ge",
}

# Transaction data from production database
TRANSACTIONS = [
    {
        "invoice_num": "INV-2026-001",
        "keepz_order_id": "0215beef-ca9a-4701-b7de-3f43351d44fd",
        "amount": 40.00,
        "currency": "GEL",
        "payment_method": "ბარათი",
        "paid_at_utc": "2026-03-20 20:57:53",
        "course_title": "Youtube Automatization",
        "username": "Amiran",
        "email": "gochashviliamirano@gmail.com",
    },
    {
        "invoice_num": "INV-2026-002",
        "keepz_order_id": "27e915d3-d6c4-4a54-bb99-dae72bc592fe",
        "amount": 40.00,
        "currency": "GEL",
        "payment_method": "ბარათი",
        "paid_at_utc": "2026-03-21 20:02:33",
        "course_title": "Youtube Automatization",
        "username": "data_707",
        "email": "kikilashvilidatka00@gmail.com",
    },
    {
        "invoice_num": "INV-2026-003",
        "keepz_order_id": "361fe495-591a-4fb7-b26b-f521d4c5fad3",
        "amount": 40.00,
        "currency": "GEL",
        "payment_method": "ბარათი",
        "paid_at_utc": "2026-03-21 20:05:57",
        "course_title": "Youtube Automatization",
        "username": "SandroBadin",
        "email": "sandrovadibadin@gmail.com",
    },
    {
        "invoice_num": "INV-2026-004",
        "keepz_order_id": "95b24acd-ad2d-47ca-bc85-62e3f80aa365",
        "amount": 40.00,
        "currency": "GEL",
        "payment_method": "ბარათი",
        "paid_at_utc": "2026-03-23 00:49:07",
        "course_title": "Youtube Automatization",
        "username": "omena79",
        "email": "giorgikvintradze2002@mail.ru",
    },
    {
        "invoice_num": "INV-2026-005",
        "keepz_order_id": "a0c819a7-3701-40ef-bfe7-235c896f80fa",
        "amount": 40.00,
        "currency": "GEL",
        "payment_method": "ბარათი",
        "paid_at_utc": "2026-03-23 19:32:19",
        "course_title": "Youtube Automatization",
        "username": "luka",
        "email": "liobidze450@gmail.com",
    },
    {
        "invoice_num": "INV-2026-006",
        "keepz_order_id": "dc6279bc-d7cb-4384-8967-003bbfdc80d4",
        "amount": 40.00,
        "currency": "GEL",
        "payment_method": "ბარათი",
        "paid_at_utc": "2026-03-27 02:50:00",
        "course_title": "Youtube Automatization",
        "username": "Nika24",
        "email": "n.tsutsunashvili@gmail.com",
    },
    {
        "invoice_num": "INV-2026-007",
        "keepz_order_id": "b0978bb6-61d0-4b35-8db3-3bda67b772e5",
        "amount": 40.00,
        "currency": "GEL",
        "payment_method": "ბარათი",
        "paid_at_utc": "2026-03-27 05:20:59",
        "course_title": "Youtube Automatization",
        "username": "Nika",
        "email": "nikushakiknavelidze111@gmail.com",
    },
    {
        "invoice_num": "INV-2026-008",
        "keepz_order_id": "adff19cc-e059-451f-8582-364a3007b303",
        "amount": 40.00,
        "currency": "GEL",
        "payment_method": "ბარათი",
        "paid_at_utc": "2026-03-27 06:36:26",
        "course_title": "Youtube Automatization",
        "username": "GIONCE",
        "email": "giorgimujiri2002@gmail.com",
    },
    {
        "invoice_num": "INV-2026-009",
        "keepz_order_id": "b4dffba9-fe2b-40cf-a670-0aa7837048ea",
        "amount": 40.00,
        "currency": "GEL",
        "payment_method": "ბარათი",
        "paid_at_utc": "2026-03-27 08:38:10",
        "course_title": "Youtube Automatization",
        "username": "Luka707",
        "email": "tatoshvili.luka712@gmail.com",
    },
    {
        "invoice_num": "INV-2026-010",
        "keepz_order_id": "073088d6-36cd-4e28-9747-0d462e1c8aa4",
        "amount": 40.00,
        "currency": "GEL",
        "payment_method": "ბარათი",
        "paid_at_utc": "2026-03-28 14:29:50",
        "course_title": "Youtube Automatization",
        "username": "andriamekaluashvili",
        "email": "mekaluashviliandria14@gmail.com",
    },
    {
        "invoice_num": "INV-2026-011",
        "keepz_order_id": "f4e9a2bf-b1dd-4aad-bf20-6a315fbb437a",
        "amount": 40.00,
        "currency": "GEL",
        "payment_method": "ბარათი",
        "paid_at_utc": "2026-03-28 18:14:15",
        "course_title": "Youtube Automatization",
        "username": "Tornike",
        "email": "tokobegiashvili@gmail.com",
    },
    {
        "invoice_num": "INV-2026-012",
        "keepz_order_id": "40ec313f-25ab-4a16-a0de-1cca1577ac58",
        "amount": 40.00,
        "currency": "GEL",
        "payment_method": "ბარათი",
        "paid_at_utc": "2026-03-30 12:29:53",
        "course_title": "Youtube Automatization",
        "username": "rezi",
        "email": "rezi.lomidze.04@gmail.com",
    },
    {
        "invoice_num": "INV-2026-013",
        "keepz_order_id": "d675f209-934c-4c3f-8971-0b9538a6dfae",
        "amount": 40.00,
        "currency": "GEL",
        "payment_method": "ბარათი",
        "paid_at_utc": "2026-03-30 18:32:59",
        "course_title": "Youtube Automatization",
        "username": "gogagvichia",
        "email": "gogagvichia3@gmail.com",
    },
    {
        "invoice_num": "INV-2026-014",
        "keepz_order_id": "99d565d9-c10f-483a-840a-5a575fdb6841",
        "amount": 40.00,
        "currency": "GEL",
        "payment_method": "ბარათი",
        "paid_at_utc": "2026-03-30 22:36:14",
        "course_title": "Youtube Automatization",
        "username": "George",
        "email": "george.alakulashvili@gmail.com",
    },
    {
        "invoice_num": "INV-2026-015",
        "keepz_order_id": "24a70962-9409-40bb-a317-8eba5b2f059c",
        "amount": 40.00,
        "currency": "GEL",
        "payment_method": "ბარათი",
        "paid_at_utc": "2026-03-31 07:34:19",
        "course_title": "Youtube Automatization",
        "username": "Kakhaa67",
        "email": "kkakhaa67@gmail.com",
    },
]

# Colors
EMERALD = HexColor("#10B981")
DARK = HexColor("#1F2937")
GRAY = HexColor("#6B7280")
LIGHT_GRAY = HexColor("#F3F4F6")
WHITE = HexColor("#FFFFFF")
BORDER = HexColor("#E5E7EB")

FONT = "ArialUni"


def format_date_geo(utc_str):
    """Convert UTC datetime string to Georgia time with Georgian month name."""
    dt = datetime.strptime(utc_str, "%Y-%m-%d %H:%M:%S")
    dt_geo = dt + GEO_TZ
    month = MONTHS_GE[dt_geo.month]
    return f"{dt_geo.day} {month} {dt_geo.year}, {dt_geo.strftime('%H:%M')}"


def draw_invoice(c, tx):
    width, height = A4
    margin = 25 * mm
    right = width - margin

    # --- Header bar ---
    c.setFillColor(EMERALD)
    c.rect(0, height - 18 * mm, width, 18 * mm, fill=1, stroke=0)

    c.setFillColor(WHITE)
    c.setFont(FONT, 22)
    c.drawString(margin, height - 13 * mm, "SWAVLEBA")

    c.setFont(FONT, 10)
    c.drawRightString(right, height - 10 * mm, "ინვოისი")
    c.setFont(FONT, 14)
    c.drawRightString(right, height - 15 * mm, tx["invoice_num"])

    # --- Company info (left) ---
    y = height - 32 * mm
    c.setFillColor(DARK)
    c.setFont(FONT, 10)
    c.drawString(margin, y, "გამყიდველი:")
    y -= 5 * mm
    c.setFont(FONT, 9)
    c.setFillColor(GRAY)
    lines = [
        COMPANY["owner"],
        f"({COMPANY['legal_form']})",
        COMPANY["address"],
        f"ელ. ფოსტა: {COMPANY['email']}",
        f"ტელ: {COMPANY['phone']}",
        f"ვებ: {COMPANY['website']}",
    ]
    for line in lines:
        c.drawString(margin, y, line)
        y -= 4.5 * mm

    # --- Customer info (right) ---
    y = height - 32 * mm
    c.setFillColor(DARK)
    c.setFont(FONT, 10)
    c.drawString(width / 2 + 10 * mm, y, "მყიდველი:")
    y -= 5 * mm
    c.setFont(FONT, 9)
    c.setFillColor(GRAY)
    c.drawString(width / 2 + 10 * mm, y, f"მომხმარებელი: {tx['username']}")
    y -= 4.5 * mm
    c.drawString(width / 2 + 10 * mm, y, f"ელ. ფოსტა: {tx['email']}")

    # --- Invoice details ---
    y = height - 75 * mm
    c.setFillColor(DARK)
    c.setFont(FONT, 10)
    c.drawString(margin, y, "ინვოისის დეტალები")
    y -= 2 * mm
    c.setStrokeColor(EMERALD)
    c.setLineWidth(1.5)
    c.line(margin, y, right, y)

    y -= 7 * mm
    details = [
        ("თარიღი:", format_date_geo(tx["paid_at_utc"])),
        ("გადახდის რეფერენსი:", tx["keepz_order_id"]),
        ("გადახდის მეთოდი:", f"{tx['payment_method']} (Keepz-ის საშუალებით)"),
        ("გადახდის სტატუსი:", "გადახდილია"),
    ]
    for label, value in details:
        c.setFont(FONT, 9)
        c.setFillColor(DARK)
        c.drawString(margin, y, label)
        c.setFont(FONT, 9)
        c.setFillColor(GRAY)
        c.drawString(margin + 45 * mm, y, value)
        y -= 5.5 * mm

    # --- Items table ---
    y -= 5 * mm

    # Header row
    c.setFillColor(EMERALD)
    c.rect(margin, y - 1 * mm, right - margin, 7 * mm, fill=1, stroke=0)
    c.setFillColor(WHITE)
    c.setFont(FONT, 9)
    c.drawString(margin + 3 * mm, y + 1 * mm, "#")
    c.drawString(margin + 12 * mm, y + 1 * mm, "მომსახურების აღწერა")
    c.drawRightString(right - 45 * mm, y + 1 * mm, "რაოდ.")
    c.drawRightString(right - 25 * mm, y + 1 * mm, "ფასი")
    c.drawRightString(right - 3 * mm, y + 1 * mm, "ჯამი")

    # Data row
    y -= 8 * mm
    c.setFillColor(LIGHT_GRAY)
    c.rect(margin, y - 2 * mm, right - margin, 8 * mm, fill=1, stroke=0)
    c.setFillColor(DARK)
    c.setFont(FONT, 9)
    c.drawString(margin + 3 * mm, y + 1 * mm, "1")
    c.drawString(margin + 12 * mm, y + 1 * mm, f"ონლაინ კურსზე ჩარიცხვა: {tx['course_title']}")
    c.drawRightString(right - 45 * mm, y + 1 * mm, "1")
    c.drawRightString(right - 25 * mm, y + 1 * mm, f"{tx['amount']:.2f} {tx['currency']}")
    c.setFont(FONT, 9)
    c.drawRightString(right - 3 * mm, y + 1 * mm, f"{tx['amount']:.2f} {tx['currency']}")

    # --- Totals ---
    y -= 15 * mm
    totals_x = right - 65 * mm

    c.setStrokeColor(BORDER)
    c.setLineWidth(0.5)
    c.line(totals_x, y + 3 * mm, right, y + 3 * mm)

    c.setFont(FONT, 9)
    c.setFillColor(GRAY)
    c.drawString(totals_x, y, "ქვეჯამი:")
    c.drawRightString(right - 3 * mm, y, f"{tx['amount']:.2f} {tx['currency']}")

    y -= 6 * mm
    c.setFont(FONT, 11)
    c.setFillColor(DARK)
    c.drawString(totals_x, y, "სულ:")
    c.setFillColor(EMERALD)
    c.drawRightString(right - 3 * mm, y, f"{tx['amount']:.2f} {tx['currency']}")

    # --- Paid stamp ---
    y -= 5 * mm
    c.setStrokeColor(BORDER)
    c.setLineWidth(0.5)
    c.line(totals_x, y, right, y)

    y -= 8 * mm
    c.setFillColor(EMERALD)
    c.setFont(FONT, 16)
    c.drawRightString(right - 3 * mm, y, "გადახდილია")

    # --- Notes ---
    y -= 25 * mm
    c.setFillColor(DARK)
    c.setFont(FONT, 10)
    c.drawString(margin, y, "შენიშვნები")
    y -= 2 * mm
    c.setStrokeColor(EMERALD)
    c.setLineWidth(1)
    c.line(margin, y, margin + 30 * mm, y)
    y -= 6 * mm
    c.setFont(FONT, 8)
    c.setFillColor(GRAY)
    notes = [
        "ეს ინვოისი ადასტურებს დასრულებულ ციფრული მომსახურების ტრანზაქციას.",
        "გადახდა დამუშავებულია Keepz-ის გადახდის სისტემის საშუალებით.",
        f"მომსახურება: ონლაინ კურსზე \"{tx['course_title']}\" წვდომა swavleba.ge-ზე.",
        "ფიზიკური საქონელი არ მიწოდებულა. მომსახურება არის ციფრული საგანმანათლებლო კონტენტი.",
    ]
    for note in notes:
        c.drawString(margin, y, note)
        y -= 4 * mm

    # --- Footer ---
    footer_y = 15 * mm
    c.setStrokeColor(BORDER)
    c.setLineWidth(0.5)
    c.line(margin, footer_y + 5 * mm, right, footer_y + 5 * mm)
    c.setFont(FONT, 7)
    c.setFillColor(GRAY)
    c.drawCentredString(width / 2, footer_y, "Swavleba | swavleba.ge | bejisscience@gmail.com | +995 555 54 99 88")
    c.drawCentredString(width / 2, footer_y - 3.5 * mm, COMPANY["address"])


def main():
    for tx in TRANSACTIONS:
        filename = f"{tx['invoice_num']}.pdf"
        filepath = f"/Users/bezhomatiashvili/Desktop/MainCourse/invoices/{filename}"
        c = canvas.Canvas(filepath, pagesize=A4)
        draw_invoice(c, tx)
        c.save()
        print(f"Generated: {filepath}")

    print(f"\nDone! {len(TRANSACTIONS)} invoices generated in /invoices/")


if __name__ == "__main__":
    main()
