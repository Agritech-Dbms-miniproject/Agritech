# Agritech
# 🌾 Agriculture Supply Chain Traceability System

### Smart Farmer Procurement Platform

A web-based Agriculture Supply Chain Traceability System designed to connect farmers and buyers through a digital platform. The application helps farmers register, manage agricultural produce, publish listings, and maintain supply chain information. It also helps buyers access produce details and manage procurement activities.

## 🚀 Project Overview

The Agriculture Supply Chain Traceability System aims to improve transparency, accessibility, and efficiency in agricultural procurement.

The platform provides a centralized system where farmers can manage their produce and buyers can explore available agricultural products.

## ✨ Key Features

- Farmer registration and management.
- Buyer access and procurement management.
- Add and manage agricultural produce.
- Crop and produce information management.
- Produce listing and availability tracking.
- Quantity and price management.
- Quality grading (Grade A and Grade B).
- Supply chain traceability.
- Database-backed information storage.
- Farmer and buyer dashboard.

## 🛠️ Technologies Used

### Frontend
- Next.js
- React
- TypeScript
- HTML
- CSS

### Backend
- Python
- Flask
- Flask-CORS
- REST API
- MySQL Connector
- PostgreSQL Connector

### Databases
- MySQL
- PostgreSQL

### Development Tools
- Visual Studio Code
- Git
- GitHub
- Postman

## 🏗️ System Architecture

The application follows a frontend-backend-database architecture.

1. **Frontend:** Provides the user interface for farmers and buyers.
2. **Backend:** Handles business logic, API requests, authentication, validation, and database operations.
3. **Database:** MySQL and PostgreSQL are used for persistent data storage and management.

### Application Flow

User → Next.js Frontend → Flask REST API → MySQL / PostgreSQL → API Response → Frontend

## 👩‍💻 Team Members

| Name | USN | Contribution |
|---|---|---|
| Navya R | PES2UG24CS346 | Frontend Development |
| Pavithra G C | PES2UG24CS346 | Backend Development |

### Team Collaboration

**Navya R – Frontend Developer**
- Developed the frontend user interface.
- Worked on dashboard and application pages.
- Implemented frontend components and user interactions.
- Integrated frontend functionality with backend APIs in collaboration with the team.

**Pavithra G C – Backend Developer**
- Developed backend functionality using Python Flask.
- Implemented REST API endpoints.
- Worked on database connectivity and operations.
- Implemented server-side validation and business logic.
- Worked on MySQL and PostgreSQL integration.

**Joint Contributions**
- Project planning and system design.
- Database design and integration.
- Frontend-backend integration.
- Testing and debugging.
- Overall project development and improvements.

## ⚙️ Installation and Setup

### Prerequisites

Install the following:
- Python 3.x
- Node.js and npm
- MySQL Server
- PostgreSQL
- Git

### 1. Clone the Repository

```bash
git clone https://github.com/Agritech-Dbms-miniproject/Agritech.git
cd Agritech
```

### 2. Backend Setup

Create and activate a Python virtual environment:

```bash
python -m venv .venv
```

For Windows Git Bash:

```bash
source .venv/Scripts/activate
```

Install backend dependencies:

```bash
pip install -r requirements.txt
```

Configure the required database credentials and environment variables in the `.env` file.

Start the Flask backend using the project's backend entry-point file.

### 3. Frontend Setup

Open a new terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the application:

```text
http://localhost:3000
```

### 4. Database Configuration

Configure MySQL and PostgreSQL connection details in the backend environment configuration.

Ensure that the required databases and tables are created before running the application.

**Important:** Never upload `.env` files, database passwords, API secrets, or other confidential credentials to GitHub.

## 🎯 Project Objectives

- Digitize agricultural procurement activities.
- Improve communication between farmers and buyers.
- Provide transparent produce information.
- Maintain organized agricultural supply chain records.
- Demonstrate relational database management and integration.
- Build a practical full-stack web application.

## 🔮 Future Enhancements

- Real-time supply chain tracking.
- Digital payment integration.
- Advanced analytics and reporting.
- Mobile application support.
- Improved farmer and buyer communication.
- Enhanced security and authentication.

## 📚 Academic Information

**Project:** Agriculture Supply Chain Traceability System – Smart Farmer Procurement Platform

**Domain:** Database Management Systems (DBMS)

**Project Type:** DBMS Mini Project

**Institution:** PES University

## 📄 License

This project is developed for academic and educational purposes.
