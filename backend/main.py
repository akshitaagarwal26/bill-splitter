from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware

import io
import re

import cv2
import numpy as np
import pytesseract
from PIL import Image


# ============================================================
# APP
# ============================================================

app = FastAPI(title="SplitMyBill API")


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# TESSERACT
# ============================================================

pytesseract.pytesseract.tesseract_cmd = (
    r"C:\Program Files\Tesseract-OCR\tesseract.exe"
)


# ============================================================
# HOME
# ============================================================

@app.get("/")
def home():
    return {
        "message": "SplitMyBill API is running!"
    }


# ============================================================
# IMAGE PREPROCESSING
# ============================================================

def preprocess_image(image_bytes):
    image = Image.open(
        io.BytesIO(image_bytes)
    ).convert("RGB")

    image = np.array(image)

    image = cv2.cvtColor(
        image,
        cv2.COLOR_RGB2BGR
    )

    gray = cv2.cvtColor(
        image,
        cv2.COLOR_BGR2GRAY
    )

    # Improve contrast
    clahe = cv2.createCLAHE(
        clipLimit=2.0,
        tileGridSize=(8, 8)
    )

    gray = clahe.apply(gray)

    # Upscale
    gray = cv2.resize(
        gray,
        None,
        fx=2,
        fy=2,
        interpolation=cv2.INTER_CUBIC
    )

    # Reduce noise
    gray = cv2.GaussianBlur(
        gray,
        (3, 3),
        0
    )

    # Threshold
    processed = cv2.threshold(
        gray,
        0,
        255,
        cv2.THRESH_BINARY + cv2.THRESH_OTSU
    )[1]

    return processed


# ============================================================
# HELPERS
# ============================================================

def clean_text(text):
    text = text.replace("\t", " ")
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def parse_number(text):
    """
    Convert OCR number to float.

    Handles:
        330.00
        330,00
        ₹330.00
    """

    if not text:
        return None

    text = str(text).strip()

    text = (
        text
        .replace("₹", "")
        .replace("Rs.", "")
        .replace("Rs", "")
        .replace("INR", "")
        .replace(" ", "")
    )

    # Decimal comma:
    # 340,00 -> 340.00
    if "," in text and "." not in text:
        parts = text.split(",")

        if (
            len(parts) == 2
            and len(parts[1]) <= 2
        ):
            text = (
                parts[0]
                + "."
                + parts[1]
            )
        else:
            text = text.replace(",", "")

    else:
        text = text.replace(",", "")

    try:
        return float(text)
    except ValueError:
        return None


def is_item_line(line):
    """
    Decide whether an OCR line looks like a restaurant item.

    We intentionally don't depend on the table header because
    OCR often reads the header incorrectly.
    """

    lower = line.lower()

    # Definitely not an item
    ignored = [
        "cash/bill",
        "cashbill",
        "bill no",
        "waiter",
        "total quantity",
        "gross total",
        "gross fota",
        "vat",
        "gst",
        "service tax",
        "service charge",
        "service charges",
        "net amount",
        "get back",
        "subtotal",
        "discount",
        "invoice",
        "date",
        "time",
        "phone",
        "address",
        "tin:",
    ]

    if any(
        word in lower
        for word in ignored
    ):
        return False

    # Must contain a decimal-like money value.
    money_pattern = r"\d+[.,]\d{1,3}"

    if not re.search(
        money_pattern,
        line
    ):
        return False

    # Need some alphabetic text
    if not re.search(
        r"[A-Za-z]",
        line
    ):
        return False

    return True


# ============================================================
# ITEM EXTRACTION
# ============================================================

def extract_items_from_lines(lines):
    """
    Extract items directly from OCR text lines.

    Typical OCR line:

        FLAVOURED MOJITO 330.00 1.000 sut.ur

    We take:
        item name = text before price
        price     = first money value
        quantity  = number such as 1.000 / 2.000
    """

    items = []

    for line in lines:

        line = clean_text(line)

        if not line:
            continue

        if not is_item_line(line):
            continue

        # ----------------------------------------------------
        # Find money values
        # ----------------------------------------------------

        money_matches = list(
            re.finditer(
                r"\d+[.,]\d{1,3}",
                line
            )
        )

        if not money_matches:
            continue

        # First decimal number is normally the PRICE
        price_match = money_matches[0]

        price_text = price_match.group(0)

        price = parse_number(
            price_text
        )

        if price is None:
            continue

        # ----------------------------------------------------
        # Find quantity
        # ----------------------------------------------------

        quantity = 1

        after_price = line[
            price_match.end():
        ]

        # Typical receipt quantities:
        #
        # 1.000
        # 2.000
        # 3.000
        #
        # OCR can sometimes output 1.000 as 1.000
        # or 2.006 etc.

        quantity_match = re.search(
            r"\b(\d+)[.,]\d{3}\b",
            after_price
        )

        if quantity_match:

            try:
                quantity = int(
                    quantity_match.group(1)
                )
            except ValueError:
                quantity = 1

        # ----------------------------------------------------
        # Item name
        # ----------------------------------------------------

        name = line[
            :price_match.start()
        ]

        name = clean_text(name)

        # Remove OCR symbols at beginning
        name = re.sub(
            r"^[^A-Za-z]+",
            "",
            name
        )

        # Remove trailing symbols
        name = re.sub(
            r"[^A-Za-z0-9)]+$",
            "",
            name
        )

        if len(name) < 2:
            continue

        # ----------------------------------------------------
        # Reject obvious non-items
        # ----------------------------------------------------

        lower_name = name.lower()

        if any(
            word in lower_name
            for word in [
                "item",
                "price",
                "total",
                "quantity",
                "vat",
                "gst",
                "service",
                "tax",
                "gross",
                "net",
                "amount",
            ]
        ):
            continue

        # ----------------------------------------------------
        # Sanity checks
        # ----------------------------------------------------

        if price <= 0:
            continue

        if price > 100000:
            continue

        if quantity < 1 or quantity > 50:
            quantity = 1

        # ----------------------------------------------------
        # Add item
        # ----------------------------------------------------

        items.append(
            {
                "id": len(items) + 1,
                "name": name,
                "quantity": quantity,
                "price": round(price, 2),
            }
        )

    return items


# ============================================================
# CHARGE EXTRACTION
# ============================================================

def extract_charges(lines, items):
    """
    Extract tax/service charges when OCR gives a clear amount.

    If the receipt's bottom section is too blurry, we safely
    fall back to calculating the subtotal from the detected
    items rather than returning obviously incorrect numbers.
    """

    gst = 0.0
    service_charge = 0.0

    subtotal = round(
        sum(
            item["price"]
            * item["quantity"]
            for item in items
        ),
        2
    )

    grand_total = None

    for line in lines:

        lower = line.lower()

        # --------------------------------------------
        # Service charges
        # --------------------------------------------

        if "service charges" in lower:

            # Look for actual amount after percentage.
            #
            # Example:
            # Service Charges 10.00% 258.00
            #
            numbers = re.findall(
                r"\d+[.,]\d{1,3}",
                line
            )

            values = [
                parse_number(number)
                for number in numbers
            ]

            values = [
                value
                for value in values
                if value is not None
            ]

            # Ignore 10.00 percentage.
            candidates = [
                value
                for value in values
                if value > 20
            ]

            if candidates:
                service_charge = max(
                    candidates
                )

        # --------------------------------------------
        # Service tax
        # --------------------------------------------

        elif "service tax" in lower:

            numbers = re.findall(
                r"\d+[.,]\d{1,3}",
                line
            )

            values = [
                parse_number(number)
                for number in numbers
            ]

            values = [
                value
                for value in values
                if value is not None
                and value > 20
            ]

            if values:
                gst += max(values)

        # --------------------------------------------
        # VAT / GST
        # --------------------------------------------

        elif (
            "vat" in lower
            or "gst" in lower
        ):

            numbers = re.findall(
                r"\d+[.,]\d{1,3}",
                line
            )

            values = [
                parse_number(number)
                for number in numbers
            ]

            values = [
                value
                for value in values
                if value is not None
                and value > 20
                and value < subtotal
            ]

            if values:
                gst += max(values)

        # --------------------------------------------
        # Net amount
        # --------------------------------------------

        elif (
            "net amount" in lower
            or "amount due" in lower
        ):

            numbers = re.findall(
                r"\d+[.,]\d{1,3}",
                line
            )

            values = [
                parse_number(number)
                for number in numbers
            ]

            values = [
                value
                for value in values
                if value is not None
                and value > subtotal
            ]

            if values:
                grand_total = max(values)

    # --------------------------------------------
    # Safety checks
    # --------------------------------------------

    if service_charge > subtotal:
        service_charge = 0.0

    if gst > subtotal:
        gst = 0.0

    # If OCR didn't find a trustworthy final total,
    # calculate it.
    if grand_total is None:
        grand_total = round(
            subtotal
            + gst
            + service_charge,
            2
        )

    return {
        "gst": round(gst, 2),
        "service_charge": round(
            service_charge,
            2
        ),
        "subtotal": round(
            subtotal,
            2
        ),
        "grand_total": round(
            grand_total,
            2
        ),
    }


# ============================================================
# BILL EXTRACTION
# ============================================================

def extract_bill(processed_image):

    # OCR using a layout mode suitable for receipts
    ocr_text = pytesseract.image_to_string(
        processed_image,
        config="--psm 4"
    )

    lines = [
        clean_text(line)
        for line in ocr_text.splitlines()
        if clean_text(line)
    ]

    # --------------------------------------------------------
    # Restaurant
    # --------------------------------------------------------

    restaurant = "Unknown Restaurant"

    for line in lines[:10]:

        candidate = re.sub(
            r"^[^A-Za-z]+",
            "",
            line
        )

        lower = candidate.lower()

        if (
            len(candidate) >= 3
            and "cash" not in lower
            and "bill" not in lower
            and "tin:" not in lower
            and "phone" not in lower
            and "bangalore" not in lower
        ):
            restaurant = candidate
            break

    # --------------------------------------------------------
    # Items
    # --------------------------------------------------------

    items = extract_items_from_lines(
        lines
    )

    # --------------------------------------------------------
    # Charges
    # --------------------------------------------------------

    charges = extract_charges(
        lines,
        items
    )

    return {
        "restaurant": restaurant,

        "items": items,

        "service_charge": charges[
            "service_charge"
        ],

        "gst": charges[
            "gst"
        ],

        "subtotal": charges[
            "subtotal"
        ],

        "grand_total": charges[
            "grand_total"
        ],

        "ocr_text": ocr_text,
    }


# ============================================================
# PROCESS BILL
# ============================================================

@app.post("/process-bill")
async def process_bill(
    file: UploadFile = File(...)
):

    # --------------------------------------------------------
    # Validate file
    # --------------------------------------------------------

    allowed_types = [
        "image/jpeg",
        "image/png",
        "image/webp",
    ]

    if file.content_type not in allowed_types:

        return {
            "success": False,
            "error": (
                "Please upload a JPG, PNG, "
                "or WEBP image."
            ),
        }

    # --------------------------------------------------------
    # Read file
    # --------------------------------------------------------

    image_data = await file.read()

    if not image_data:

        return {
            "success": False,
            "error": (
                "The uploaded file is empty."
            ),
        }

    # --------------------------------------------------------
    # Preprocess
    # --------------------------------------------------------

    try:

        processed_image = preprocess_image(
            image_data
        )

    except Exception as error:

        return {
            "success": False,
            "error": (
                "Could not read the image: "
                f"{str(error)}"
            ),
        }

    # --------------------------------------------------------
    # OCR + extraction
    # --------------------------------------------------------

    try:

        bill = extract_bill(
            processed_image
        )

    except Exception as error:

        return {
            "success": False,
            "error": (
                "Bill processing failed: "
                f"{str(error)}"
            ),
        }

    # --------------------------------------------------------
    # Make sure items were detected
    # --------------------------------------------------------

    if not bill["items"]:

        return {
            "success": False,
            "error": (
                "I could not detect any bill "
                "items. Please upload a clearer "
                "photograph."
            ),
            "ocr_text": bill[
                "ocr_text"
            ],
        }

    # --------------------------------------------------------
    # Response
    # --------------------------------------------------------

    return {
        "success": True,

        "filename": file.filename,

        "content_type": file.content_type,

        "message": (
            "Bill image processed successfully."
        ),

        "ocr_text": bill[
            "ocr_text"
        ],

        "bill": {
            "restaurant": bill[
                "restaurant"
            ],

            "items": bill[
                "items"
            ],

            "service_charge": bill[
                "service_charge"
            ],

            "gst": bill[
                "gst"
            ],

            "subtotal": bill[
                "subtotal"
            ],

            "grand_total": bill[
                "grand_total"
            ],
        },
    }