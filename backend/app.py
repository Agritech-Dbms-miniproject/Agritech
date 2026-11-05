
import os
import mysql.connector
import psycopg
from dotenv import load_dotenv

load_dotenv()


def test_mysql_connection():
    try:
        connection = mysql.connector.connect(
            host=os.getenv("MYSQL_HOST", "localhost"),
            port=int(os.getenv("MYSQL_PORT", "3306")),
            user=os.getenv("MYSQL_USER", "root"),
            password=os.getenv("MYSQL_PASSWORD"),
            database=os.getenv("MYSQL_DATABASE", "agriculture_supply_chain")
        )

        cursor = connection.cursor()
        cursor.execute("SHOW TABLES")
        tables = cursor.fetchall()

        print("MySQL connection successful!")
        print(f"MySQL tables found: {len(tables)}")

        cursor.close()
        connection.close()

    except mysql.connector.Error as error:
        print("MySQL connection failed:", error)


def test_postgres_connection():
    try:
        connection = psycopg.connect(
            host=os.getenv("PG_HOST", "localhost"),
            port=int(os.getenv("PG_PORT", "5432")),
            user=os.getenv("PG_USER", "postgres"),
            password=os.getenv("PG_PASSWORD"),
            dbname=os.getenv("PG_DATABASE", "agriculture_vector_db"),
            connect_timeout=5
        )

        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT crop_name FROM produce_embeddings ORDER BY id"
            )
            crops = cursor.fetchall()

        print("PostgreSQL connection successful!")
        print("Crops in vector database:")
        for crop in crops:
            print("-", crop[0])

        connection.close()

    except Exception as error:
        print("PostgreSQL connection failed:", error)


if __name__ == "__main__":
    test_mysql_connection()
    print()
    test_postgres_connection()
