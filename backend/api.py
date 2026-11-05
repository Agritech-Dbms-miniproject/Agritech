import os
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from functools import wraps
from uuid import uuid4

import mysql.connector
from mysql.connector import Error
from dotenv import load_dotenv
from flask import Flask, request, jsonify, session, send_from_directory
from werkzeug.utils import secure_filename
from flask_cors import CORS


# =========================================================
# 1. CONFIGURATION
# =========================================================

app = Flask(__name__)

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(BACKEND_DIR)
OUTER_DIR = os.path.dirname(PROJECT_DIR)

ENV_PATH = os.path.join(OUTER_DIR, ".env")
if not os.path.exists(ENV_PATH):
    ENV_PATH = os.path.join(PROJECT_DIR, ".env")

load_dotenv(ENV_PATH, override=True)

UPLOAD_FOLDER = os.path.join(BACKEND_DIR, "crop_uploads")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

ALLOWED_IMAGE_EXTENSIONS = {"jpg", "jpeg", "png", "webp"}
MAX_IMAGE_SIZE = 5 * 1024 * 1024

app.config["MAX_CONTENT_LENGTH"] = MAX_IMAGE_SIZE
app.secret_key = os.getenv(
    "FLASK_SECRET_KEY",
    "change_this_development_secret_key"
)
app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=False
)

CORS(
    app,
    supports_credentials=True,
    origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000"
    ]
)


# =========================================================
# 2. DATABASE HELPERS
# =========================================================

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", "3306"))
DB_USER = os.getenv("DB_USER", "root")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_NAME = os.getenv("DB_NAME", "agriculture_supply_chain")


def get_mysql_connection():
    return mysql.connector.connect(
        host=DB_HOST,
        port=DB_PORT,
        user=DB_USER,
        password=DB_PASSWORD,
        database=DB_NAME,
        connection_timeout=10
    )


def close_db(cursor=None, connection=None):
    if cursor is not None:
        try:
            cursor.close()
        except Error:
            app.logger.exception("Could not close database cursor")

    if connection is not None:
        try:
            if connection.is_connected():
                connection.close()
        except Error:
            app.logger.exception("Could not close database connection")


def json_safe(value):
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    return value


def json_safe_rows(rows):
    return [
        {key: json_safe(value) for key, value in row.items()}
        for row in rows
    ]


def normalise_role(role):
    role = str(role or "").strip().lower()
    return role if role in ("farmer", "buyer") else None


def login_required(function):
    @wraps(function)
    def wrapper(*args, **kwargs):
        if not session.get("account_id") or not session.get("role"):
            return jsonify({
                "success": False,
                "message": "Please log in first."
            }), 401
        return function(*args, **kwargs)
    return wrapper


def get_logged_in_account(cursor):
    """Return the signed-in account using the separate farmer/buyer tables."""
    account_id = session.get("account_id")
    role = normalise_role(session.get("role"))

    if not account_id or not role:
        return None

    if role == "farmer":
        cursor.execute(
            """
            SELECT
                Farmer_ID AS Account_ID,
                Farmer_Name AS Name,
                Phone_Number AS Phone,
                Email,
                Address,
                Village,
                'farmer' AS Role
            FROM farmer
            WHERE Farmer_ID = %s
            LIMIT 1
            """,
            (account_id,)
        )
    else:
        cursor.execute(
            """
            SELECT
                Buyer_ID AS Account_ID,
                Buyer_Name AS Name,
                Phone_Number AS Phone,
                Email,
                Address,
                Organization_Name,
                GSTIN,
                'buyer' AS Role
            FROM buyer
            WHERE Buyer_ID = %s
            LIMIT 1
            """,
            (account_id,)
        )

    return cursor.fetchone()


def valid_date_or_none(value):
    if value in (None, ""):
        return None
    if not isinstance(value, str):
        raise ValueError("Date must be provided as YYYY-MM-DD.")
    return date.fromisoformat(value)


def make_user_payload(account, role):
    account_id = account["Account_ID"]
    user = {
        "id": account_id,
        "name": account["Name"],
        "email": account["Email"],
        "phone": account.get("Phone"),
        "role": role,
        "account_type": role
    }

    # Keep the ID names commonly used by the existing frontend.
    if role == "farmer":
        user["farmer_id"] = account_id
    else:
        user["buyer_id"] = account_id

    if account.get("Address") is not None:
        user["address"] = account["Address"]
    if account.get("Village") is not None:
        user["village"] = account["Village"]
    if account.get("Organization_Name") is not None:
        user["organization_name"] = account["Organization_Name"]
    if account.get("GSTIN") is not None:
        user["gstin"] = account["GSTIN"]

    return user


# =========================================================
# 3. SERVE CROP IMAGES
# =========================================================

@app.route("/uploads/<path:filename>", methods=["GET"])
def uploaded_crop_image(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)


# =========================================================
# 4. HEALTH CHECK
# =========================================================

@app.route("/api/health", methods=["GET"])
def health():
    connection = None
    cursor = None
    try:
        connection = get_mysql_connection()
        cursor = connection.cursor()
        cursor.execute("SELECT DATABASE(), VERSION()")
        result = cursor.fetchone()

        return jsonify({
            "status": "ok",
            "database": "connected",
            "database_name": result[0],
            "env_file_found": os.path.exists(ENV_PATH)
        }), 200
    except Error:
        app.logger.exception("Database health check failed")
        return jsonify({
            "status": "error",
            "message": "Database connection failed.",
            "env_file_found": os.path.exists(ENV_PATH)
        }), 500
    finally:
        close_db(cursor, connection)


# =========================================================
# 5. REGISTER FARMER OR BUYER
# =========================================================

@app.route("/api/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}

    name = str(data.get("name", data.get("Name", ""))).strip()
    email = str(data.get("email", data.get("Email", ""))).strip().lower()
    phone = str(data.get("phone", data.get("Phone_Number", ""))).strip()
    password = str(data.get("password", data.get("Password", "")))
    role = normalise_role(
        data.get("role", data.get("account_type", data.get("Account_Type", "farmer")))
    )

    address = str(data.get("address", data.get("Address", ""))).strip()
    village = str(data.get("village", data.get("Village", ""))).strip()
    organization_name = str(
        data.get("organization_name", data.get("Organization_Name", ""))
    ).strip()
    gstin = str(data.get("gstin", data.get("GSTIN", ""))).strip()

    if not name or not email or not password:
        return jsonify({
            "success": False,
            "message": "Name, email and password are required."
        }), 400

    if len(password) < 6:
        return jsonify({
            "success": False,
            "message": "Password must contain at least 6 characters."
        }), 400

    if not role:
        return jsonify({
            "success": False,
            "message": "Role must be farmer or buyer."
        }), 400

    if len(name) > 100 or len(email) > 100 or len(phone) > 15:
        return jsonify({
            "success": False,
            "message": "Name, email or phone number exceeds the allowed length."
        }), 400

    connection = None
    cursor = None
    try:
        connection = get_mysql_connection()
        connection.start_transaction()
        cursor = connection.cursor(dictionary=True)

        # Prevent the same email from being registered in either account table.
        cursor.execute(
            """
            SELECT Email FROM farmer WHERE LOWER(Email) = %s
            UNION
            SELECT Email FROM buyer WHERE LOWER(Email) = %s
            LIMIT 1
            """,
            (email, email)
        )
        if cursor.fetchone():
            connection.rollback()
            return jsonify({
                "success": False,
                "message": "An account with this email already exists."
            }), 409

        if phone:
            cursor.execute(
                """
                SELECT Farmer_ID AS ID FROM farmer WHERE Phone_Number = %s
                UNION
                SELECT Buyer_ID AS ID FROM buyer WHERE Phone_Number = %s
                LIMIT 1
                """,
                (phone, phone)
            )
            if cursor.fetchone():
                connection.rollback()
                return jsonify({
                    "success": False,
                    "message": "This phone number is already registered."
                }), 409

        if role == "farmer":
            cursor.execute(
                """
                INSERT INTO farmer
                    (Farmer_Name, Phone_Number, Email, Address, Village, Password)
                VALUES (%s, %s, %s, %s, %s, %s)
                """,
                (
                    name,
                    phone or None,
                    email,
                    address or None,
                    village or None,
                    password
                )
            )
        else:
            cursor.execute(
                """
                INSERT INTO buyer
                    (
                        Buyer_Name, Phone_Number, Email, Password,
                        Address, Organization_Name, GSTIN
                    )
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    name,
                    phone or None,
                    email,
                    password,
                    address or None,
                    organization_name or None,
                    gstin or None
                )
            )

        connection.commit()
        return jsonify({
            "success": True,
            "message": "Registration successful. You can now log in.",
            "role": role
        }), 201

    except Error as error:
        if connection is not None:
            connection.rollback()
        app.logger.exception("Registration failed")
        if getattr(error, "errno", None) == 1062:
            return jsonify({
                "success": False,
                "message": "This email or phone number is already registered."
            }), 409
        return jsonify({
            "success": False,
            "message": "Registration failed. Check the Flask terminal."
        }), 500
    finally:
        close_db(cursor, connection)


# =========================================================
# 6. LOGIN
# =========================================================

@app.route("/api/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    email = str(data.get("email", "")).strip().lower()
    password = str(data.get("password", ""))

    if not email or not password:
        return jsonify({
            "success": False,
            "message": "Email and password are required."
        }), 400

    connection = None
    cursor = None
    try:
        connection = get_mysql_connection()
        cursor = connection.cursor(dictionary=True)

        # The schema has separate farmer and buyer accounts, so check both.
        cursor.execute(
            """
            SELECT
                Farmer_ID AS Account_ID,
                Farmer_Name AS Name,
                Phone_Number AS Phone,
                Email,
                Password,
                Address,
                Village,
                'farmer' AS Role
            FROM farmer
            WHERE LOWER(Email) = %s
            LIMIT 1
            """,
            (email,)
        )
        account = cursor.fetchone()
        role = "farmer" if account else None

        if account is None:
            cursor.execute(
                """
                SELECT
                    Buyer_ID AS Account_ID,
                    Buyer_Name AS Name,
                    Phone_Number AS Phone,
                    Email,
                    Password,
                    Address,
                    Organization_Name,
                    GSTIN,
                    'buyer' AS Role
                FROM buyer
                WHERE LOWER(Email) = %s
                LIMIT 1
                """,
                (email,)
            )
            account = cursor.fetchone()
            role = "buyer" if account else None

        # Password comparison is retained for compatibility with the
        # current database, whose existing Password values are plain text.
        if not account or str(account.get("Password") or "") != password:
            return jsonify({
                "success": False,
                "message": "Invalid email or password."
            }), 401

        session.clear()
        session["account_id"] = account["Account_ID"]
        session["role"] = role

        # Legacy key for frontend code that checks farmer_id.
        if role == "farmer":
            session["farmer_id"] = account["Account_ID"]
        else:
            session["buyer_id"] = account["Account_ID"]

        user = make_user_payload(account, role)

        return jsonify({
            "success": True,
            "message": "Login successful.",
            "role": role,
            "account_type": role,
            "user": user,
            "farmer": user
        }), 200

    except Error:
        app.logger.exception("Login failed")
        return jsonify({
            "success": False,
            "message": "Database error during login."
        }), 500
    finally:
        close_db(cursor, connection)


# =========================================================
# 7. CURRENT USER
# =========================================================

@app.route("/api/me", methods=["GET"])
@login_required
def current_user():
    connection = None
    cursor = None
    try:
        connection = get_mysql_connection()
        cursor = connection.cursor(dictionary=True)
        account = get_logged_in_account(cursor)

        if not account:
            session.clear()
            return jsonify({
                "success": False,
                "message": "Please log in again."
            }), 401

        role = normalise_role(session.get("role"))
        user = make_user_payload(account, role)

        return jsonify({
            "success": True,
            "user": user,
            "farmer": user,
            "role": role,
            "account_type": role
        }), 200
    except Error:
        app.logger.exception("Could not load current user")
        return jsonify({
            "success": False,
            "message": "Could not load account."
        }), 500
    finally:
        close_db(cursor, connection)


# =========================================================
# 8. LOGOUT
# =========================================================

@app.route("/api/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({
        "success": True,
        "message": "Logged out successfully."
    }), 200


# =========================================================
# 9. MARKETPLACE PRODUCE
# =========================================================

@app.route("/api/produce", methods=["GET"])
def get_produce():
    connection = None
    cursor = None
    try:
        connection = get_mysql_connection()
        cursor = connection.cursor(dictionary=True)
        cursor.execute(
            """
            SELECT
                p.Produce_ID,
                p.Crop_ID,
                c.Crop_Name,
                p.Quantity,
                p.Unit,
                p.Grade,
                p.Price,
                p.Harvest_Date,
                p.Available_From,
                p.Location,
                p.Image_Path,
                c.Farmer_ID,
                f.Farmer_Name AS Farmer_Name,
                f.Phone_Number AS Farmer_Phone
            FROM produce AS p
            INNER JOIN crop AS c ON c.Crop_ID = p.Crop_ID
            INNER JOIN farmer AS f ON f.Farmer_ID = c.Farmer_ID
            ORDER BY p.Produce_ID DESC
            """
        )
        return jsonify(json_safe_rows(cursor.fetchall())), 200
    except Error:
        app.logger.exception("Could not retrieve marketplace produce")
        return jsonify({
            "success": False,
            "message": "Could not retrieve produce listings."
        }), 500
    finally:
        close_db(cursor, connection)


# =========================================================
# 10. AVAILABLE LISTINGS
# =========================================================

@app.route("/api/listings", methods=["GET"])
def get_listings():
    connection = None
    cursor = None
    try:
        connection = get_mysql_connection()
        cursor = connection.cursor(dictionary=True)
        cursor.execute(
            """
            SELECT
                l.Listing_ID,
                l.Produce_ID,
                l.Listing_Date,
                l.Available_Quantity,
                l.Status,
                c.Crop_Name,
                p.Unit,
                p.Grade,
                p.Price,
                p.Location,
                p.Image_Path,
                p.Harvest_Date,
                p.Available_From,
                c.Farmer_ID,
                f.Farmer_Name AS Farmer_Name,
                f.Phone_Number AS Farmer_Phone
            FROM listing AS l
            INNER JOIN produce AS p ON p.Produce_ID = l.Produce_ID
            INNER JOIN crop AS c ON c.Crop_ID = p.Crop_ID
            INNER JOIN farmer AS f ON f.Farmer_ID = c.Farmer_ID
            WHERE l.Status = 'Available'
              AND l.Available_Quantity > 0
              AND (p.Available_From IS NULL OR p.Available_From <= CURDATE())
            ORDER BY l.Listing_ID DESC
            """
        )
        return jsonify(json_safe_rows(cursor.fetchall())), 200
    except Error:
        app.logger.exception("Could not retrieve available listings")
        return jsonify({
            "success": False,
            "message": "Could not load available listings."
        }), 500
    finally:
        close_db(cursor, connection)


# =========================================================
# 11. FARMER'S OWN PRODUCE
# =========================================================

@app.route("/api/my-produce", methods=["GET"])
@login_required
def get_my_produce():
    if session.get("role") != "farmer":
        return jsonify({
            "success": False,
            "message": "Only farmer accounts can access this dashboard."
        }), 403

    connection = None
    cursor = None
    try:
        connection = get_mysql_connection()
        cursor = connection.cursor(dictionary=True)
        farmer_id = session["account_id"]
        cursor.execute(
            """
            SELECT
                p.Produce_ID,
                p.Crop_ID,
                c.Crop_Name,
                p.Quantity,
                p.Unit,
                p.Grade,
                p.Price,
                p.Harvest_Date,
                p.Available_From,
                p.Location,
                p.Image_Path,
                f.Farmer_Name AS Farmer_Name
            FROM produce AS p
            INNER JOIN crop AS c ON c.Crop_ID = p.Crop_ID
            INNER JOIN farmer AS f ON f.Farmer_ID = c.Farmer_ID
            WHERE c.Farmer_ID = %s
            ORDER BY p.Produce_ID DESC
            """,
            (farmer_id,)
        )
        return jsonify(json_safe_rows(cursor.fetchall())), 200
    except Error:
        app.logger.exception("Could not retrieve farmer produce")
        return jsonify({
            "success": False,
            "message": "Could not retrieve your produce listings."
        }), 500
    finally:
        close_db(cursor, connection)


# =========================================================
# 12. ADD PRODUCE AND CREATE LISTING
# =========================================================

@app.route("/api/produce", methods=["POST"])
@login_required
def add_produce():
    if session.get("role") != "farmer":
        return jsonify({
            "success": False,
            "message": "Only farmer accounts can add produce."
        }), 403

    data = request.form if request.form else (request.get_json(silent=True) or {})
    image_file = request.files.get("image")
    image_path = None

    if image_file and image_file.filename:
        safe_name = secure_filename(image_file.filename)
        extension = safe_name.rsplit(".", 1)[-1].lower() if "." in safe_name else ""

        if extension not in ALLOWED_IMAGE_EXTENSIONS:
            return jsonify({
                "success": False,
                "message": "Crop image must be JPG, JPEG, PNG, or WebP."
            }), 400

        image_file.seek(0, os.SEEK_END)
        image_size = image_file.tell()
        image_file.seek(0)

        if image_size > MAX_IMAGE_SIZE:
            return jsonify({
                "success": False,
                "message": "Crop image must be 5 MB or smaller."
            }), 413

        stored_name = f"{uuid4().hex}.{extension}"
        image_file.save(os.path.join(UPLOAD_FOLDER, stored_name))
        image_path = f"/uploads/{stored_name}"

    crop_name = str(
        data.get("crop_name", data.get("Crop_Name", data.get("crop", "")))
    ).strip()
    location = str(data.get("location", "")).strip()
    grade = str(data.get("grade", "A")).strip() or "A"
    unit = str(data.get("unit", "kg")).strip() or "kg"

    try:
        quantity = Decimal(str(data.get("quantity", "")))
        price = Decimal(str(data.get("price", "")))

        if not quantity.is_finite() or quantity <= 0:
            raise ValueError("Quantity must be greater than zero.")
        if not price.is_finite() or price < 0:
            raise ValueError("Price cannot be negative.")
        if len(unit) > 20:
            raise ValueError("Unit must be at most 20 characters.")
    except (InvalidOperation, ValueError, TypeError):
        return jsonify({
            "success": False,
            "message": "Enter a valid positive quantity and price."
        }), 400

    if not crop_name or not location:
        return jsonify({
            "success": False,
            "message": "Crop name and location are required."
        }), 400

    try:
        harvest_date = valid_date_or_none(data.get("harvest_date"))
        available_from = valid_date_or_none(data.get("available_from"))
    except (ValueError, TypeError):
        return jsonify({
            "success": False,
            "message": "Enter dates in YYYY-MM-DD format."
        }), 400

    connection = None
    cursor = None
    try:
        connection = get_mysql_connection()
        connection.start_transaction()
        cursor = connection.cursor(dictionary=True)
        farmer_id = session["account_id"]

        cursor.execute(
            """
            SELECT Crop_ID
            FROM crop
            WHERE LOWER(Crop_Name) = LOWER(%s)
              AND Farmer_ID = %s
            LIMIT 1
            """,
            (crop_name, farmer_id)
        )
        existing_crop = cursor.fetchone()

        if existing_crop:
            crop_id = existing_crop["Crop_ID"]
        else:
            cursor.execute(
                """
                INSERT INTO crop (Farmer_ID, Crop_Name)
                VALUES (%s, %s)
                """,
                (farmer_id, crop_name)
            )
            crop_id = cursor.lastrowid

        cursor.execute(
            """
            INSERT INTO produce (
                Crop_ID, Quantity, Unit, Grade, Price,
                Harvest_Date, Available_From, Location, Image_Path
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                crop_id, quantity, unit, grade, price,
                harvest_date, available_from, location, image_path
            )
        )
        produce_id = cursor.lastrowid

        cursor.execute(
            """
            INSERT INTO listing (Produce_ID, Available_Quantity, Status)
            VALUES (%s, %s, 'Available')
            """,
            (produce_id, quantity)
        )
        listing_id = cursor.lastrowid

        connection.commit()
        return jsonify({
            "success": True,
            "message": "Produce and listing added successfully.",
            "produce_id": produce_id,
            "listing_id": listing_id
        }), 201

    except Error:
        if connection is not None:
            connection.rollback()
        app.logger.exception("Could not add produce")
        return jsonify({
            "success": False,
            "message": "Could not add produce. Check the Flask terminal."
        }), 500
    finally:
        close_db(cursor, connection)


# =========================================================
# 13. PLACE BUYER ORDER
# =========================================================

@app.route("/api/orders", methods=["POST"])
@login_required
def place_order():
    if session.get("role") != "buyer":
        return jsonify({
            "success": False,
            "message": "Please log in with a buyer account."
        }), 403

    data = request.get_json(silent=True) or {}
    items = data.get("items")

    if not isinstance(items, list) or not items:
        return jsonify({
            "success": False,
            "message": "Your cart is empty."
        }), 400
    if len(items) > 100:
        return jsonify({
            "success": False,
            "message": "Too many items in one order."
        }), 400

    quantities = {}
    try:
        for item in items:
            if not isinstance(item, dict):
                raise ValueError()
            listing_id = int(item.get("listing_id", item.get("Listing_ID", 0)))
            quantity = Decimal(str(item.get("quantity", item.get("Quantity", ""))))
            if listing_id <= 0 or not quantity.is_finite() or quantity <= 0:
                raise ValueError()
            if quantity.as_tuple().exponent < -2:
                return jsonify({
                    "success": False,
                    "message": "Quantity can have at most 2 decimal places."
                }), 400
            quantities[listing_id] = quantities.get(listing_id, Decimal("0")) + quantity
    except (ValueError, TypeError, InvalidOperation, OverflowError):
        return jsonify({
            "success": False,
            "message": "Each item needs a valid listing ID and quantity."
        }), 400

    connection = None
    cursor = None
    try:
        connection = get_mysql_connection()
        connection.start_transaction()
        cursor = connection.cursor(dictionary=True)
        buyer_id = session["account_id"]

        listing_ids = sorted(quantities.keys())
        placeholders = ", ".join(["%s"] * len(listing_ids))
        cursor.execute(
            f"""
            SELECT
                l.Listing_ID,
                l.Available_Quantity,
                l.Status,
                p.Price,
                p.Available_From
            FROM listing AS l
            INNER JOIN produce AS p ON p.Produce_ID = l.Produce_ID
            WHERE l.Listing_ID IN ({placeholders})
            ORDER BY l.Listing_ID
            FOR UPDATE
            """,
            tuple(listing_ids)
        )
        listings = {row["Listing_ID"]: row for row in cursor.fetchall()}

        if len(listings) != len(listing_ids):
            connection.rollback()
            return jsonify({
                "success": False,
                "message": "One or more listings do not exist."
            }), 400

        total = Decimal("0.00")
        order_items = []

        for listing_id in listing_ids:
            listing = listings[listing_id]
            quantity = quantities[listing_id]
            available = Decimal(str(listing["Available_Quantity"]))
            price = Decimal(str(listing["Price"]))

            if listing["Status"] != "Available":
                connection.rollback()
                return jsonify({
                    "success": False,
                    "message": f"Listing {listing_id} is not available."
                }), 400
            if listing["Available_From"] and listing["Available_From"] > date.today():
                connection.rollback()
                return jsonify({
                    "success": False,
                    "message": f"Listing {listing_id} is not available yet."
                }), 400
            if quantity > available:
                connection.rollback()
                return jsonify({
                    "success": False,
                    "message": (
                        f"Insufficient stock for listing {listing_id}. "
                        f"Available quantity: {available}."
                    )
                }), 400

            amount = (quantity * price).quantize(Decimal("0.01"))
            total += amount
            order_items.append({
                "listing_id": listing_id,
                "quantity": quantity,
                "price": price,
                "amount": amount
            })

        total = total.quantize(Decimal("0.01"))
        cursor.execute(
            """
            INSERT INTO orders (Buyer_ID, Total_Amount, Status)
            VALUES (%s, %s, 'Pending')
            """,
            (buyer_id, total)
        )
        order_id = cursor.lastrowid

        for item in order_items:
            cursor.execute(
                """
                INSERT INTO order_item
                    (Order_ID, Listing_ID, Quantity, Unit_Price, Amount)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (
                    order_id,
                    item["listing_id"],
                    item["quantity"],
                    item["price"],
                    item["amount"]
                )
            )

            cursor.execute(
                """
                UPDATE listing
                SET
                    Available_Quantity = Available_Quantity - %s,
                    Status = CASE
                        WHEN Available_Quantity - %s <= 0 THEN 'Sold Out'
                        ELSE 'Available'
                    END
                WHERE Listing_ID = %s
                  AND Status = 'Available'
                  AND Available_Quantity >= %s
                """,
                (
                    item["quantity"],
                    item["quantity"],
                    item["listing_id"],
                    item["quantity"]
                )
            )
            if cursor.rowcount != 1:
                raise RuntimeError("Stock changed while the order was being processed.")

        connection.commit()
        return jsonify({
            "success": True,
            "message": "Order placed successfully.",
            "order_id": order_id,
            "total_amount": float(total),
            "status": "Pending"
        }), 201

    except (Error, RuntimeError):
        if connection is not None:
            connection.rollback()
        app.logger.exception("Checkout failed")
        return jsonify({
            "success": False,
            "message": "Could not place the order. No partial order changes were saved."
        }), 500
    finally:
        close_db(cursor, connection)


# =========================================================
# 14. BUYER ORDER HISTORY
# =========================================================

@app.route("/api/my-orders", methods=["GET"])
@login_required
def get_my_orders():
    if session.get("role") != "buyer":
        return jsonify({
            "success": False,
            "message": "Only buyers can access their order history."
        }), 403

    connection = None
    cursor = None
    try:
        connection = get_mysql_connection()
        cursor = connection.cursor(dictionary=True)
        buyer_id = session["account_id"]

        cursor.execute(
            """
            SELECT
                Order_ID,
                Order_Date,
                Total_Amount,
                Status,
                Expected_Date
            FROM orders
            WHERE Buyer_ID = %s
            ORDER BY Order_Date DESC, Order_ID DESC
            """,
            (buyer_id,)
        )
        order_rows = cursor.fetchall()
        orders_result = []

        for order in order_rows:
            cursor.execute(
                """
                SELECT
                    oi.Order_Item_ID,
                    oi.Listing_ID,
                    oi.Quantity,
                    oi.Unit_Price,
                    oi.Amount,
                    c.Crop_Name,
                    p.Unit,
                    p.Grade,
                    p.Location,
                    f.Farmer_Name AS Farmer_Name
                FROM order_item AS oi
                LEFT JOIN listing AS l ON l.Listing_ID = oi.Listing_ID
                LEFT JOIN produce AS p ON p.Produce_ID = l.Produce_ID
                LEFT JOIN crop AS c ON c.Crop_ID = p.Crop_ID
                LEFT JOIN farmer AS f ON f.Farmer_ID = c.Farmer_ID
                WHERE oi.Order_ID = %s
                ORDER BY oi.Order_Item_ID
                """,
                (order["Order_ID"],)
            )
            items = json_safe_rows(cursor.fetchall())

            # Preserve both common key styles for frontend compatibility.
            for item in items:
                item["OrderItem_ID"] = item.pop("Order_Item_ID")
                item["Crop_Name"] = item.get("Crop_Name") or "Produce"
                item["Unit"] = item.get("Unit") or "kg"

            orders_result.append({
                "Order_ID": order["Order_ID"],
                "Order_Date": json_safe(order["Order_Date"]),
                "Total_Amount": json_safe(order["Total_Amount"]),
                "Status": order["Status"],
                "Expected_Date": json_safe(order["Expected_Date"]),
                "Items": items,
                "items": items
            })

        return jsonify({
            "success": True,
            "orders": orders_result
        }), 200

    except Error:
        app.logger.exception("Could not retrieve buyer orders")
        return jsonify({
            "success": False,
            "message": "Could not retrieve your orders."
        }), 500
    finally:
        close_db(cursor, connection)


# =========================================================
# 15. ERROR HANDLER
# =========================================================

@app.errorhandler(413)
def request_entity_too_large(_error):
    return jsonify({
        "success": False,
        "message": "Crop image must be 5 MB or smaller."
    }), 413


# =========================================================
# 16. START FLASK SERVER
# =========================================================

if __name__ == "__main__":
    print("AgriTrace API starting...")
    print("Environment file:", ENV_PATH)
    print("Environment file found:", os.path.exists(ENV_PATH))
    print("Database:", DB_NAME)

    app.run(
        host="127.0.0.1",
        port=5000,
        debug=True
    )
