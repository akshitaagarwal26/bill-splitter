from fastapi import FastAPI

app = FastAPI(title="SplitMyBill API")


@app.get("/")
def home():
    return {
        "message": "SplitMyBill API is running!"
    }