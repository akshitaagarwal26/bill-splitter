from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="SplitMyBill API")


# Allow the React frontend to communicate with FastAPI
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


@app.get("/")
def home():
    return {
        "message": "SplitMyBill API is running!"
    }


@app.post("/process-bill")
async def process_bill(file: UploadFile = File(...)):
    """
    Receive a restaurant bill image.

    For now, this endpoint uses mock extraction data.
    The image is actually received by the backend,
    which gives us a clean place to plug in OCR/AI later.
    """

    # Validate file type
    allowed_types = [
        "image/jpeg",
        "image/png",
        "image/webp",
    ]

    if file.content_type not in allowed_types:
        return {
            "success": False,
            "error": "Please upload a JPG, PNG, or WEBP image."
        }

    # Read the uploaded image
    image_data = await file.read()

    # Make sure something was uploaded
    if not image_data:
        return {
            "success": False,
            "error": "The uploaded file is empty."
        }

    # -----------------------------------------
    # MOCK EXTRACTION
    # -----------------------------------------
    # Later we will replace this with actual
    # OCR / AI-based receipt extraction.

    extracted_bill = {
        "restaurant": "The Daily Brew",

        "items": [
            {
                "id": 1,
                "name": "Margherita Pizza",
                "quantity": 1,
                "price": 349.00,
            },
            {
                "id": 2,
                "name": "Paneer Pasta",
                "quantity": 1,
                "price": 329.00,
            },
            {
                "id": 3,
                "name": "Chicken Burger",
                "quantity": 2,
                "price": 598.00,
            },
            {
                "id": 4,
                "name": "French Fries",
                "quantity": 1,
                "price": 199.00,
            },
            {
                "id": 5,
                "name": "Cold Coffee",
                "quantity": 3,
                "price": 447.00,
            },
            {
                "id": 6,
                "name": "Lemon Iced Tea",
                "quantity": 2,
                "price": 258.00,
            },
            {
                "id": 7,
                "name": "Chocolate Brownie",
                "quantity": 1,
                "price": 189.00,
            },
        ],

        "service_charge": 118.45,
        "gst": 124.37,
    }

    return {
        "success": True,
        "filename": file.filename,
        "content_type": file.content_type,
        "message": "Bill image received successfully.",
        "bill": extracted_bill,
    }