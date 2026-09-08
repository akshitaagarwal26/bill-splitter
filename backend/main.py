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
        Rs.330.00
        INR 330.00
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

    We don't depend on the table header because OCR can
    read headers incorrectly.
    """

    lower = line.lower()

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
        "cgst",
        "sgst",
        "igst",
        "service tax",
        "service charge",
        "service charges",
        "net amount",
        "amount due",
        "grand total",
        "get back",
        "subtotal",
        "discount",
        "invoice",
        "date",
        "time",
        "phone",
        "address",
        "tin:",
        "thank you",
        "good food",
        "see you again",
    ]

    if any(
        word in lower
        for word in ignored
    ):
        return False

    # Must contain a decimal-like money value
    money_pattern = r"\d+[.,]\d{1,3}"

    if not re.search(
        money_pattern,
        line
    ):
        return False

    # Need alphabetic text
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
    Extract restaurant items from OCR text.

    Supports both common formats:

    Format 1:
        Item Name 349.00 1.000 349.00

    Format 2:
        Item Name 1 349.00 349.00

    For Format 2:
        quantity comes BEFORE the first price.

    For Format 1:
        quantity comes AFTER the first price.
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

        # First decimal number is normally the RATE/PRICE
        price_match = money_matches[0]

        price_text = price_match.group(0)

        price = parse_number(
            price_text
        )

        if price is None:
            continue

        # ----------------------------------------------------
        # Determine quantity
        # ----------------------------------------------------

        quantity = 1

        before_price = line[
            :price_match.start()
        ]

        after_price = line[
            price_match.end():
        ]

        # ====================================================
        # FORMAT 2
        #
        # Item Name 1 349.00 349.00
        #
        # Quantity appears BEFORE price.
        # ====================================================

        quantity_before_match = re.search(
            r"(?:^|\s)(\d+)\s*$",
            before_price
        )

        if quantity_before_match:

            try:
                possible_quantity = int(
                    quantity_before_match.group(1)
                )

                if 1 <= possible_quantity <= 50:
                    quantity = possible_quantity

            except ValueError:
                quantity = 1

        else:

            # =================================================
            # FORMAT 1
            #
            # Item Name 349.00 1.000 349.00
            #
            # Quantity appears AFTER price.
            # =================================================

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

        name = before_price

        # If quantity was before the price,
        # remove it from the item name.
        if quantity_before_match:

            name = before_price[
                :quantity_before_match.start()
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
                "cgst",
                "sgst",
                "igst",
                "service",
                "tax",
                "gross",
                "net",
                "amount",
                "rate",
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
        # Avoid duplicate items
        # ----------------------------------------------------

        duplicate = False

        for existing in items:

            if (
                existing["name"].lower()
                == name.lower()
                and existing["price"]
                == round(price, 2)
            ):
                duplicate = True
                break

        if duplicate:
            continue

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
    Extract service charges and taxes.

    Supports:

        Service Charge
        Service Charges
        Service Tax
        GST
        CGST
        SGST
        IGST
        VAT

    Also detects:

        Grand Total
        Net Amount
        Amount Due
    """

    gst = 0.0
    service_charge = 0.0
    grand_total = None

    # --------------------------------------------------------
    # Calculate subtotal
    # --------------------------------------------------------

    subtotal = round(
        sum(
            item["price"] * item["quantity"]
            for item in items
        ),
        2
    )

    for line in lines:

        lower = line.lower()

        # ----------------------------------------------------
        # Extract numbers
        # ----------------------------------------------------

        number_matches = re.findall(
            r"\d+(?:[.,]\d{1,3})?",
            line
        )

        values = []

        for number in number_matches:

            value = parse_number(number)

            if value is not None:
                values.append(value)

        # ====================================================
        # SERVICE CHARGE
        # ====================================================

        if (
            "service charge" in lower
            or "service charges" in lower
        ):

            candidates = [
                value
                for value in values
                if (
                    value > 0
                    and value <= subtotal
                    and value not in [
                        5,
                        10,
                        12,
                        18,
                        28,
                    ]
                )
            ]

            if candidates:

                service_charge = max(
                    candidates
                )

        # ====================================================
        # SERVICE TAX
        # ====================================================

        elif "service tax" in lower:

            candidates = [
                value
                for value in values
                if (
                    value > 0
                    and value <= subtotal
                    and value not in [
                        5,
                        10,
                        12,
                        18,
                        28,
                    ]
                )
            ]

            if candidates:

                gst += max(
                    candidates
                )

        # ====================================================
        # GST / CGST / SGST / IGST / VAT
        # ====================================================

        elif any(
            tax_name in lower
            for tax_name in [
                "gst",
                "cgst",
                "sgst",
                "igst",
                "vat",
            ]
        ):

            candidates = [
                value
                for value in values
                if (
                    value > 0
                    and value < subtotal
                    and value not in [
                        5,
                        12,
                        18,
                        28,
                    ]
                )
            ]

            if candidates:

                gst += max(
                    candidates
                )

        # ====================================================
        # GRAND TOTAL / NET AMOUNT / AMOUNT DUE
        # ====================================================

        elif (
            "grand total" in lower
            or "net amount" in lower
            or "amount due" in lower
        ):

            candidates = [
                value
                for value in values
                if value >= subtotal
            ]

            if candidates:

                grand_total = max(
                    candidates
                )

    # ========================================================
    # SAFETY CHECKS
    # ========================================================

    if (
        service_charge < 0
        or service_charge > subtotal
    ):
        service_charge = 0.0

    if (
        gst < 0
        or gst > subtotal
    ):
        gst = 0.0

    # ========================================================
    # MAKE CHARGES MATCH FINAL TOTAL
    # ========================================================

    if grand_total is not None:

        expected_charges = round(
            grand_total - subtotal,
            2
        )

        detected_charges = round(
            service_charge + gst,
            2
        )

        if expected_charges >= 0:

            difference = round(
                expected_charges
                - detected_charges,
                2
            )

            if abs(difference) > 0.01:

                gst = round(
                    gst + difference,
                    2
                )

    else:

        grand_total = round(
            subtotal
            + service_charge
            + gst,
            2
        )

    # ========================================================
    # RETURN
    # ========================================================

    return {
        "gst": round(
            gst,
            2
        ),

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

    # OCR using receipt-friendly layout
    ocr_text = pytesseract.image_to_string(
        processed_image,
        config="--psm 4"
    )

    lines = [
        clean_text(line)
        for line in ocr_text.splitlines()
        if clean_text(line)
    ]

    # ========================================================
    # RESTAURANT
    # ========================================================

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
            and "date" not in lower
            and "time" not in lower
        ):

            restaurant = candidate

            break

    # ========================================================
    # ITEMS
    # ========================================================

    items = extract_items_from_lines(
        lines
    )

    # ========================================================
    # CHARGES
    # ========================================================

    charges = extract_charges(
        lines,
        items
    )

    # ========================================================
    # RETURN BILL
    # ========================================================

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

    # ========================================================
    # VALIDATE FILE
    # ========================================================

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

    # ========================================================
    # READ FILE
    # ========================================================

    image_data = await file.read()

    if not image_data:

        return {
            "success": False,
            "error": (
                "The uploaded file is empty."
            ),
        }

    # ========================================================
    # PREPROCESS IMAGE
    # ========================================================

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

    # ========================================================
    # OCR + EXTRACTION
    # ========================================================

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

    # ========================================================
    # MAKE SURE ITEMS WERE DETECTED
    # ========================================================

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

    # ========================================================
    # RESPONSE
    # ========================================================

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